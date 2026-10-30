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
// A session token is "<user id>.<expiry>.<signature>", signed with
// DASHBOARD_SESSION_SECRET; nothing is stored. It expires after 7 days
// without use: every signed-in request answers with a fresh token
// (X-Session-Token header) that the app stores, so using the app keeps you
// logged in and a device left alone for a week is logged out.

const SESSION_DAYS = 7;
const sign = (value) => crypto.createHmac('sha256', process.env.DASHBOARD_SESSION_SECRET || '').update(value).digest('base64url');

export function makeToken(userId) {
    const payload = `${userId}.${Date.now() + SESSION_DAYS * 86400000}`;
    return `${payload}.${sign(payload)}`;
}

function readToken(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || !process.env.DASHBOARD_SESSION_SECRET) return null;
    const [userId, exp, sig] = auth.slice(7).split('.');
    if (!userId || !exp || !sig) return null;
    const expected = sign(`${userId}.${exp}`);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return Number(exp) > Date.now() ? userId : null;
}

// Vercel cron calls carry `Bearer CRON_SECRET`.
export function isCron(req) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

// Guard for every signed-in route. Answers the request itself and returns
// null when it can't go on; otherwise { client, user, spaces }.
export async function session(req, res) {
    const client = getSupabase();
    if (!client) {
        res.status(500).json({ error: 'Supabase ist nicht konfiguriert' });
        return null;
    }
    const userId = readToken(req);
    const { data: user } = userId ? await client.from('users').select('id,name,is_admin').eq('id', userId).maybeSingle() : { data: null };
    if (!user) {
        res.status(401).json({ error: 'Nicht angemeldet' });
        return null;
    }
    res.setHeader('X-Session-Token', makeToken(user.id));
    const { data: rows } = await client.from('memberships').select('spaces(id,name)').eq('user_id', user.id);
    const spaces = (rows || []).map((r) => r.spaces).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    return { client, user, spaces };
}

// Like session(), plus the Haushalt picked in the app (X-Space header), which
// the person must be a member of. Returns { client, user, spaceId }.
export async function db(req, res) {
    const s = await session(req, res);
    if (!s) return null;
    const wanted = req.headers['x-space'];
    const space = s.spaces.find((x) => x.id === wanted) || (!wanted && s.spaces[0]);
    if (!space) {
        res.status(403).json({ error: 'Kein Zugriff auf diesen Haushalt' });
        return null;
    }
    return { ...s, spaceId: space.id };
}

// Ids of the space's accounts, to check that writes only touch those.
export async function spaceAccountIds(client, spaceId) {
    const { data } = await client.from('accounts').select('id').eq('space_id', spaceId);
    return new Set((data || []).map((a) => a.id));
}

export const TRANSACTION_COLUMNS = 'id,account_id,booking_date,amount,counterparty,purpose,category,transfer_id,recurring_id,created_at';
export const ACCOUNT_COLUMNS = 'id,name,kind,opening_balance,sort_order';
