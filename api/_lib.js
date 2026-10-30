import { createClient } from '@supabase/supabase-js';

// Same scheme as the websbybenny dashboard: the login exchanges the password
// for DASHBOARD_SESSION_SECRET, which the client then sends as bearer token.
export function isAuthorized(req) {
    const secret = process.env.DASHBOARD_SESSION_SECRET;
    const auth = req.headers.authorization || '';
    return Boolean(secret) && auth === `Bearer ${secret}`;
}

// Vercel cron calls carry `Bearer CRON_SECRET`.
export function isCron(req) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

let cached;

export function getSupabase() {
    if (cached !== undefined) return cached;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    cached = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
    return cached;
}

// Shared guard for the authenticated routes: answers the request itself and
// returns null when it can't go on.
export function db(req, res) {
    if (!isAuthorized(req)) {
        res.status(401).json({ error: 'Nicht angemeldet' });
        return null;
    }
    const client = getSupabase();
    if (!client) res.status(500).json({ error: 'Supabase ist nicht konfiguriert' });
    return client;
}

export const TRANSACTION_COLUMNS = 'id,account_id,booking_date,amount,counterparty,purpose,category,created_at';
export const ACCOUNT_COLUMNS = 'id,name,opening_balance,sort_order';
