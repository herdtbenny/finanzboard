import { ACCOUNT_COLUMNS, session } from './_lib.js';

// POST { id, name, kind, opening_balance, sort_order } creates or updates an
// account of the signed-in person; kind 'depot' = value entered by hand. DELETE ?id=… removes it with all its transactions.
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;
    const { client, userId } = s;

    if (req.method === 'DELETE') {
        const { error } = await client.from('accounts').delete().eq('id', req.query.id).eq('user_id', userId);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const a = req.body || {};
    const opening = Number(a.opening_balance || 0);
    if (!a.id || !a.name?.trim() || !Number.isFinite(opening)) return res.status(400).json({ error: 'Name fehlt' });

    const { data: existing } = await client.from('accounts').select('user_id').eq('id', a.id).maybeSingle();
    if (existing && existing.user_id !== userId) return res.status(403).json({ error: 'Kein Zugriff' });

    const { data, error } = await client.from('accounts').upsert({
        id: a.id,
        user_id: userId,
        name: a.name.trim(),
        kind: a.kind === 'depot' ? 'depot' : 'cash',
        opening_balance: Math.round(opening * 100) / 100,
        sort_order: Number(a.sort_order) || 0,
    }).select(ACCOUNT_COLUMNS).single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
}
