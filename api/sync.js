import { isAuthorized, isCron, lastSuccessfulSync, logSync, psuFrom, syncAll } from './_lib.js';

// Opening the app sends POST { auto: true }: skipped when the last successful
// sync is under 5 minutes old, so reloading doesn't hammer the bank. The sync
// button sends no `auto` and always runs. The daily cron (GET, CRON_SECRET)
// runs without the user's IP, as an unattended read.
const AUTO_INTERVAL = 5 * 60 * 1000;

export default async function handler(req, res) {
    const cron = isCron(req);
    if (!cron && !isAuthorized(req)) return res.status(401).json({ error: 'Nicht angemeldet' });

    if (!cron && req.body?.auto) {
        const last = await lastSuccessfulSync();
        if (last && Date.now() - last.getTime() < AUTO_INTERVAL) return res.status(200).json({ skipped: true });
    }

    try {
        const result = await syncAll({ psu: cron ? undefined : psuFrom(req) });
        await logSync(true, `${result.accounts} Konten, ${result.transactions} Umsätze${result.note ? ` (${result.note})` : ''}`);
        res.status(200).json(result);
    } catch (e) {
        await logSync(false, e.message);
        res.status(500).json({ error: e.message });
    }
}
