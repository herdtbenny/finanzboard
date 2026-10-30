import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ---------- Auth ----------

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

// The bank redirects back to /api/callback without our bearer token, so the
// `state` we hand to Enable Banking is signed and short-lived instead.
export function makeState() {
    const ts = Date.now().toString();
    return `${ts}.${hmac(ts)}`;
}

export function checkState(state) {
    const [ts, sig] = String(state || '').split('.');
    if (!ts || !sig || sig !== hmac(ts)) return false;
    return Date.now() - Number(ts) < 60 * 60 * 1000;
}

function hmac(value) {
    return crypto.createHmac('sha256', process.env.DASHBOARD_SESSION_SECRET || '').update(value).digest('hex');
}

// ---------- Supabase ----------

let cached;

export function getSupabase() {
    if (cached !== undefined) return cached;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    cached = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
    return cached;
}

// ---------- Enable Banking ----------

const EB_API = 'https://api.enablebanking.com';

// Every request is signed with a short-lived RS256 JWT made from the
// application's private key; the application id is the key id.
function ebToken() {
    const appId = process.env.ENABLEBANKING_APP_ID;
    const pem = (process.env.ENABLEBANKING_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!appId || !pem) throw new Error('Enable Banking ist nicht konfiguriert (ENABLEBANKING_APP_ID / ENABLEBANKING_PRIVATE_KEY).');

    const now = Math.floor(Date.now() / 1000);
    const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const body = `${enc({ typ: 'JWT', alg: 'RS256', kid: appId })}.${enc({
        iss: 'enablebanking.com',
        aud: 'api.enablebanking.com',
        iat: now,
        exp: now + 3600,
    })}`;
    const sig = crypto.createSign('RSA-SHA256').update(body).sign(pem).toString('base64url');
    return `${body}.${sig}`;
}

// `psu` = the user's own IP and browser. Sending them marks a request as made
// while the user is present, which PSD2 doesn't count towards the limit of
// 4 unattended reads per account and day.
export async function eb(path, { method = 'GET', body, psu } = {}) {
    const psuHeaders = psu ? { 'Psu-Ip-Address': psu.ip, 'Psu-User-Agent': psu.userAgent } : {};
    const res = await fetch(EB_API + path, {
        method,
        headers: { Authorization: `Bearer ${ebToken()}`, 'Content-Type': 'application/json', ...psuHeaders },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`Enable Banking ${res.status}: ${data.message || data.detail || text}`);
    return data;
}

// ---------- Sync ----------

const BALANCE_PREFERENCE = ['ITAV', 'CLAV', 'XPCD', 'ITBD', 'CLBD'];

function pickBalance(balances = []) {
    for (const type of BALANCE_PREFERENCE) {
        const hit = balances.find((b) => b.balance_type === type);
        if (hit) return hit;
    }
    return balances[0];
}

function toRow(accountUid, t) {
    const sign = t.credit_debit_indicator === 'DBIT' ? -1 : 1;
    const amount = sign * Math.abs(Number(t.transaction_amount?.amount || 0));
    const counterparty = (sign < 0 ? t.creditor?.name : t.debtor?.name) || null;
    const purpose = (t.remittance_information || []).join(' ').trim() || null;
    const bookingDate = t.booking_date || t.value_date || t.transaction_date;
    // Banks don't reliably send a unique id, so fall back to the content.
    const ref = t.transaction_id || t.entry_reference || [bookingDate, amount, counterparty, purpose].join('|');
    const id = crypto.createHash('sha1').update(`${accountUid}|${ref}`).digest('hex');
    return {
        id,
        account_uid: accountUid,
        booking_date: bookingDate,
        amount,
        currency: t.transaction_amount?.currency || 'EUR',
        counterparty,
        purpose,
        status: t.status === 'PDNG' ? 'PDNG' : 'BOOK',
        raw: t,
    };
}

async function fetchTransactions(uid, dateFrom, psu) {
    const all = [];
    let key;
    do {
        const qs = new URLSearchParams({ date_from: dateFrom });
        if (key) qs.set('continuation_key', key);
        const page = await eb(`/accounts/${uid}/transactions?${qs}`, { psu });
        all.push(...(page.transactions || []));
        key = page.continuation_key;
    } while (key);
    return all;
}

function isoDate(d) {
    return d.toISOString().slice(0, 10);
}

// Pulls balances and transactions for every account whose consent is still
// valid. `initialDays` is how far back to go for an account that has no
// transactions yet; later runs only re-read the last 10 days.
export async function syncAll({ initialDays = 90, psu } = {}) {
    const db = getSupabase();
    if (!db) throw new Error('Supabase ist nicht konfiguriert.');

    const { data: sessions, error } = await db.from('bank_sessions').select('id').gt('valid_until', new Date().toISOString());
    if (error) throw error;
    if (!sessions.length) return { accounts: 0, transactions: 0, note: 'Keine gültige Bankverbindung' };

    const { data: accounts, error: accErr } = await db.from('accounts').select('uid').in('session_id', sessions.map((s) => s.id));
    if (accErr) throw accErr;

    let count = 0;
    for (const { uid } of accounts) {
        const { balances } = await eb(`/accounts/${uid}/balances`, { psu });
        const bal = pickBalance(balances);
        await db.from('accounts').update({
            balance: bal ? Number(bal.balance_amount.amount) : null,
            balance_date: bal?.reference_date || isoDate(new Date()),
            updated_at: new Date().toISOString(),
        }).eq('uid', uid);

        const { data: last } = await db.from('transactions').select('booking_date').eq('account_uid', uid).eq('status', 'BOOK')
            .order('booking_date', { ascending: false }).limit(1);
        const from = new Date();
        if (last?.length) from.setTime(new Date(last[0].booking_date).getTime() - 10 * 86400000);
        else from.setDate(from.getDate() - initialDays);

        const rows = (await fetchTransactions(uid, isoDate(from), psu)).filter((t) => t.booking_date || t.value_date).map((t) => toRow(uid, t));
        // Pending entries have no stable id and turn into booked ones later,
        // so they are replaced wholesale on every run.
        await db.from('transactions').delete().eq('account_uid', uid).eq('status', 'PDNG');
        const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
        if (unique.length) {
            const { error: upErr } = await db.from('transactions').upsert(unique);
            if (upErr) throw upErr;
        }
        count += unique.length;
    }
    return { accounts: accounts.length, transactions: count };
}

export function psuFrom(req) {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
    return { ip, userAgent: req.headers['user-agent'] || '' };
}

export async function lastSuccessfulSync() {
    const db = getSupabase();
    if (!db) return null;
    const { data } = await db.from('sync_log').select('at').eq('ok', true).order('at', { ascending: false }).limit(1);
    return data?.[0]?.at ? new Date(data[0].at) : null;
}

export async function logSync(ok, message) {
    const db = getSupabase();
    if (db) await db.from('sync_log').insert({ ok, message: String(message).slice(0, 500) });
}
