import { eb, isAuthorized } from './_lib.js';

// GET ?q=volksbank — searchable list of German banks Enable Banking supports.
export default async function handler(req, res) {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Nicht angemeldet' });
    try {
        const { aspsps } = await eb('/aspsps?country=DE&psu_type=personal');
        const q = String(req.query.q || '').toLowerCase().trim();
        const list = aspsps
            .filter((a) => !q || a.name.toLowerCase().includes(q))
            .slice(0, 40)
            .map((a) => ({ name: a.name, logo: a.logo || null }));
        res.status(200).json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
