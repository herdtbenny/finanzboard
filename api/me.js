import { checkPassword, hashPassword, session } from './_lib.js';

// GET  → the signed-in person and the Haushalte they belong to.
// POST { current, password } → changes their own password.
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;

    if (req.method === 'POST') {
        const { current, password } = req.body || {};
        const { data: user } = await s.client.from('users').select('password_hash').eq('id', s.user.id).single();
        if (!checkPassword(current, user.password_hash)) return res.status(400).json({ error: 'Aktuelles Passwort stimmt nicht' });
        if (String(password || '').length < 6) return res.status(400).json({ error: 'Mindestens 6 Zeichen' });
        const { error } = await s.client.from('users').update({ password_hash: hashPassword(password) }).eq('id', s.user.id);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }

    res.status(200).json({ user: s.user, spaces: s.spaces });
}
