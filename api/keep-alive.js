import { getSupabase, isCron } from './_lib.js';
import { bookDue } from './_recurring.js';

// Daily Vercel cron (vercel.json): books due standing orders even when the
// app isn't opened, and keeps the free Supabase project from being paused
// after 7 days without activity (a read plus a heartbeat insert).
export default async function handler(req, res) {
    if (!isCron(req)) return res.status(401).json({ error: 'Nicht erlaubt' });
    const client = getSupabase();
    if (!client) return res.status(500).json({ error: 'Supabase ist nicht konfiguriert' });

    try {
        await bookDue(client);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
    const { error } = await client.from('keep_alive').insert({});
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ ok: true });
}
