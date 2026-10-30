import { eb, isAuthorized, makeState } from './_lib.js';

// POST { bank } — starts the consent flow and returns the bank's login URL.
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Nicht angemeldet' });

    const bank = (req.body || {}).bank;
    const appUrl = process.env.APP_URL;
    if (!bank) return res.status(400).json({ error: 'Bank fehlt' });
    if (!appUrl) return res.status(500).json({ error: 'APP_URL ist nicht gesetzt' });

    try {
        const { aspsps } = await eb('/aspsps?country=DE&psu_type=personal');
        const aspsp = aspsps.find((a) => a.name === bank);
        if (!aspsp) return res.status(404).json({ error: 'Bank nicht gefunden' });

        // As long as the bank allows, capped at 180 days.
        const maxSeconds = Math.min(aspsp.maximum_consent_validity || 90 * 86400, 180 * 86400);
        const validUntil = new Date(Date.now() + maxSeconds * 1000).toISOString();

        const auth = await eb('/auth', {
            method: 'POST',
            body: {
                access: { valid_until: validUntil },
                aspsp: { name: aspsp.name, country: 'DE' },
                state: makeState(),
                redirect_url: `${appUrl}/api/callback`,
                psu_type: 'personal',
            },
        });
        res.status(200).json({ url: auth.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
