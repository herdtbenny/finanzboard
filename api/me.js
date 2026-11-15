import { checkPassword, hashPassword, makeToken, session } from './_lib.js';

// GET  → the signed-in person.
// POST { current, password } → changes their own password. That signs them
// out on every other device; this one gets a fresh token right away.
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;

    if (req.method === 'POST') {
        const { current, password } = req.body || {};
        const { data: user } = await s.client.from('users').select('id,password_hash,token_version').eq('id', s.userId).single();
        if (!checkPassword(current, user.password_hash)) return res.status(400).json({ error: 'Aktuelles Passwort stimmt nicht' });
        if (String(password || '').length < 6) return res.status(400).json({ error: 'Mindestens 6 Zeichen' });
        const tokenVersion = (user.token_version || 0) + 1;
        const { error } = await s.client.from('users').update({ password_hash: hashPassword(password), token_version: tokenVersion }).eq('id', s.userId);
        if (error) return res.status(500).json({ error: error.message });
        res.setHeader('X-Session-Token', makeToken({ id: s.userId, token_version: tokenVersion }));
        return res.status(200).json({ ok: true });
    }

    res.status(200).json({ user: s.user });
}
