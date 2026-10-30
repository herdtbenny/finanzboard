export default function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const expected = process.env.DASHBOARD_PASSWORD;
    const secret = process.env.DASHBOARD_SESSION_SECRET;
    if (!expected || !secret) return res.status(500).json({ error: 'Login ist nicht konfiguriert' });
    if ((req.body || {}).password !== expected) return res.status(401).json({ error: 'Falsches Passwort' });

    res.status(200).json({ token: secret });
}
