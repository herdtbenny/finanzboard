import { checkPassword, exactly, getSupabase, makeToken } from './_lib.js';

// Failed logins are counted per name and per device address (table
// login_attempts). Too many in a row lock that name or address for a while;
// a successful login clears the name's count.
const LIMITS = { name: 5, ip: 20 };
const LOCK_MINUTES = 15;
const FORGET_HOURS = 24;

// POST { name, password } → { token }
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const client = getSupabase();
    if (!client || !process.env.DASHBOARD_SESSION_SECRET) return res.status(500).json({ error: 'Login ist nicht konfiguriert' });

    const { name, password } = req.body || {};
    const cleanName = String(name || '').trim();
    const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unbekannt';
    const keys = { name: `name:${cleanName.toLowerCase()}`, ip: `ip:${ip}` };

    const { data: attempts } = await client.from('login_attempts').select('key,failures,locked_until,updated_at').in('key', Object.values(keys));
    const lockedUntil = Math.max(0, ...(attempts || []).map((a) => (a.locked_until ? new Date(a.locked_until).getTime() : 0)));
    if (lockedUntil > Date.now()) {
        const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
        return res.status(429).json({ error: `Zu viele Fehlversuche. Bitte in ${minutes} Min. noch mal.` });
    }

    const { data: user } = cleanName
        ? await client.from('users').select('id,password_hash,token_version').ilike('name', exactly(cleanName)).maybeSingle()
        : { data: null };
    if (user && checkPassword(password, user.password_hash)) {
        await client.from('login_attempts').delete().eq('key', keys.name);
        return res.status(200).json({ token: makeToken(user) });
    }

    // Wrong: count it for the name and the address.
    const now = new Date();
    const rows = Object.entries(keys).map(([kind, key]) => {
        const old = (attempts || []).find((a) => a.key === key);
        // Failures long ago don't add up with new ones.
        const recent = old && now - new Date(old.updated_at) < FORGET_HOURS * 3600000;
        const failures = (recent ? old.failures : 0) + 1;
        const lock = failures >= LIMITS[kind];
        return {
            key,
            failures: lock ? 0 : failures,
            locked_until: lock ? new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString() : null,
            updated_at: now.toISOString(),
        };
    });
    await client.from('login_attempts').upsert(rows);
    // Same answer for unknown names and wrong passwords.
    res.status(401).json({ error: 'Name oder Passwort falsch' });
}
