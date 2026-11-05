import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

let cached;

export function getSupabase() {
    if (cached !== undefined) return cached;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    cached = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
    return cached;
}

// ---------- Passwords ----------

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('base64url');
    const hash = crypto.scryptSync(password, salt, 64).toString('base64url');
    return `scrypt$${salt}$${hash}`;
}

export function checkPassword(password, stored) {
    const [, salt, hash] = String(stored).split('$');
    if (!salt || !hash) return false;
    const given = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'base64url');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// ---------- Sessions ----------
// A session token is "<user id>.<token version>.<expiry>.<signature>", signed
// with DASHBOARD_SESSION_SECRET; nothing else is stored. It expires after 7
// days without use: every signed-in request answers with a fresh token
// (X-Session-Token header) that the app stores, so using the app keeps you
// logged in and a device left alone for a week is logged out. Raising
// users.token_version (on every password change) ends all sessions at once.

const SESSION_DAYS = 7;
const sign = (value) => crypto.createHmac('sha256', process.env.DASHBOARD_SESSION_SECRET || '').update(value).digest('base64url');

export function makeToken(user) {
    const payload = `${user.id}.${user.token_version || 0}.${Date.now() + SESSION_DAYS * 86400000}`;
    return `${payload}.${sign(payload)}`;
}

function readToken(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || !process.env.DASHBOARD_SESSION_SECRET) return null;
    const [userId, version, exp, sig] = auth.slice(7).split('.');
    if (!userId || !version || !exp || !sig) return null;
    const expected = sign(`${userId}.${version}.${exp}`);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return Number(exp) > Date.now() ? { userId, version: Number(version) } : null;
}

// Vercel cron calls carry `Bearer CRON_SECRET`.
export function isCron(req) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

// Guard for every signed-in route. Answers the request itself and returns
// null when it can't go on; otherwise { client, user }. Everything a person
// stores carries their user_id, and every route reads and writes only that.
export async function session(req, res) {
    const client = getSupabase();
    if (!client) {
        res.status(500).json({ error: 'Supabase ist nicht konfiguriert' });
        return null;
    }
    const token = readToken(req);
    const { data: user } = token ? await client.from('users').select('id,name,is_admin,token_version').eq('id', token.userId).maybeSingle() : { data: null };
    if (!user || user.token_version !== token.version) {
        res.status(401).json({ error: 'Nicht angemeldet' });
        return null;
    }
    res.setHeader('X-Session-Token', makeToken(user));
    return { client, user: { id: user.id, name: user.name, is_admin: user.is_admin }, userId: user.id };
}

// Ids of the person's accounts, to check that writes only touch those.
export async function ownAccountIds(client, userId) {
    const { data } = await client.from('accounts').select('id').eq('user_id', userId);
    return new Set((data || []).map((a) => a.id));
}

// For a case-insensitive exact match with .ilike(): % and _ would otherwise
// match anything.
export const exactly = (text) => String(text).replace(/[\\%_]/g, (c) => `\\${c}`);

export const TRANSACTION_COLUMNS = 'id,account_id,booking_date,amount,counterparty,purpose,category,transfer_id,recurring_id,pending,created_at';
export const ACCOUNT_COLUMNS = 'id,name,kind,opening_balance,sort_order';
