import { checkPassword, getSupabase, makeToken } from './_lib.js';

// POST { name, password } → { token }
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const client = getSupabase();
    if (!client || !process.env.DASHBOARD_SESSION_SECRET) return res.status(500).json({ error: 'Login ist nicht konfiguriert' });

    const { name, password } = req.body || {};
    const { data: user } = await client.from('users').select('id,password_hash').ilike('name', String(name || '').trim()).maybeSingle();
    // Same answer for unknown names and wrong passwords.
    if (!user || !checkPassword(password, user.password_hash)) return res.status(401).json({ error: 'Name oder Passwort falsch' });

    res.status(200).json({ token: makeToken(user.id) });
}
