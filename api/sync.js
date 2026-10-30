import { isAuthorized, isCron, logSync, syncAll } from './_lib.js';

// GET from the daily Vercel cron (CRON_SECRET), POST from the dashboard's
// sync button (session token).
export default async function handler(req, res) {
    if (!isCron(req) && !isAuthorized(req)) return res.status(401).json({ error: 'Nicht angemeldet' });
    try {
        const result = await syncAll();
        await logSync(true, `${result.accounts} Konten, ${result.transactions} Umsätze${result.note ? ` (${result.note})` : ''}`);
        res.status(200).json(result);
    } catch (e) {
        await logSync(false, e.message);
        res.status(500).json({ error: e.message });
    }
}
