import { ownAccountIds, session, TRANSACTION_COLUMNS } from './_lib.js';

// POST one transaction or an array of them (a transfer is two rows sharing a
// transfer_id) — created or updated, the ids come from the browser. Every
// account must be the person's own. `pending` = noch nicht bezahlt: listed,
// but not part of the balance yet.
// DELETE ?id=… removes one, ?transfer_id=… both halves of a transfer.
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;
    const { client, userId } = s;

    if (req.method === 'DELETE') {
        const { id, transfer_id: transferId } = req.query;
        const query = client.from('transactions').delete().eq('user_id', userId);
        const { error } = transferId ? await query.eq('transfer_id', transferId) : await query.eq('id', id);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const allowed = await ownAccountIds(client, userId);
    const list = Array.isArray(req.body) ? req.body : [req.body || {}];
    const rows = [];
    for (const t of list) {
        const amount = Number(t.amount);
        if (!t.id || !t.account_id || !/^\d{4}-\d{2}-\d{2}$/.test(t.booking_date || '') || !Number.isFinite(amount) || amount === 0) {
            return res.status(400).json({ error: 'Konto, Datum und Betrag sind Pflicht' });
        }
        if (!allowed.has(t.account_id)) return res.status(403).json({ error: 'Unbekanntes Konto' });
        rows.push({
            id: t.id,
            user_id: userId,
            account_id: t.account_id,
            booking_date: t.booking_date,
            amount: Math.round(amount * 100) / 100,
            counterparty: t.counterparty?.trim() || null,
            purpose: t.purpose?.trim() || null,
            category: t.category || null,
            transfer_id: t.transfer_id || null,
            recurring_id: t.recurring_id || null,
            pending: Boolean(t.pending),
        });
    }

    // An id that already belongs to someone else must not be taken over.
    const { data: existing } = await client.from('transactions').select('id,user_id').in('id', rows.map((r) => r.id));
    if ((existing || []).some((e) => e.user_id !== userId)) return res.status(403).json({ error: 'Kein Zugriff' });

    const { data, error } = await client.from('transactions').upsert(rows).select(TRANSACTION_COLUMNS);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(Array.isArray(req.body) ? data : data[0]);
}
