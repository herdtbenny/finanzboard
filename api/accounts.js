import { ACCOUNT_COLUMNS, db } from './_lib.js';

// POST { id, name, opening_balance, sort_order } creates or updates an account
// in the picked Haushalt. DELETE ?id=… removes it with all its transactions.
export default async function handler(req, res) {
    const s = await db(req, res);
    if (!s) return;
    const { client, spaceId } = s;

    if (req.method === 'DELETE') {
        const { error } = await client.from('accounts').delete().eq('id', req.query.id).eq('space_id', spaceId);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const a = req.body || {};
    const opening = Number(a.opening_balance || 0);
    if (!a.id || !a.name?.trim() || !Number.isFinite(opening)) return res.status(400).json({ error: 'Name fehlt' });

    const { data: existing } = await client.from('accounts').select('space_id').eq('id', a.id).maybeSingle();
    if (existing && existing.space_id !== spaceId) return res.status(403).json({ error: 'Kein Zugriff' });

    const { data, error } = await client.from('accounts').upsert({
        id: a.id,
        space_id: spaceId,
        name: a.name.trim(),
        opening_balance: Math.round(opening * 100) / 100,
        sort_order: Number(a.sort_order) || 0,
    }).select(ACCOUNT_COLUMNS).single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
}
