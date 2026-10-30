import { getSupabase, isCron } from './_lib.js';

// Daily Vercel cron (vercel.json): a read and a heartbeat insert, so the free
// Supabase project isn't paused after 7 days without activity.
export default async function handler(req, res) {
    if (!isCron(req)) return res.status(401).json({ error: 'Nicht erlaubt' });
    const client = getSupabase();
    if (!client) return res.status(500).json({ error: 'Supabase ist nicht konfiguriert' });

    await client.from('accounts').select('id').limit(1);
    const { error } = await client.from('keep_alive').insert({});
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ ok: true });
}
