import { db, TRANSACTION_COLUMNS } from './_lib.js';

// POST one transaction or an array of them (a transfer is two rows sharing a
// transfer_id) — created or updated, the ids come from the browser.
// DELETE ?id=… removes one, ?transfer_id=… both halves of a transfer.
export default async function handler(req, res) {
    const client = db(req, res);
    if (!client) return;

    if (req.method === 'DELETE') {
        const { id, transfer_id: transferId } = req.query;
        const query = client.from('transactions').delete();
        const { error } = transferId ? await query.eq('transfer_id', transferId) : await query.eq('id', id);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const list = Array.isArray(req.body) ? req.body : [req.body || {}];
    const rows = [];
    for (const t of list) {
        const amount = Number(t.amount);
        if (!t.id || !t.account_id || !/^\d{4}-\d{2}-\d{2}$/.test(t.booking_date || '') || !Number.isFinite(amount) || amount === 0) {
            return res.status(400).json({ error: 'Konto, Datum und Betrag sind Pflicht' });
        }
        rows.push({
            id: t.id,
            account_id: t.account_id,
            booking_date: t.booking_date,
            amount: Math.round(amount * 100) / 100,
            counterparty: t.counterparty?.trim() || null,
            purpose: t.purpose?.trim() || null,
            category: t.category || null,
            transfer_id: t.transfer_id || null,
            recurring_id: t.recurring_id || null,
        });
    }

    const { data, error } = await client.from('transactions').upsert(rows).select(TRANSACTION_COLUMNS);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(Array.isArray(req.body) ? data : data[0]);
}
