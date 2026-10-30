import { db, TRANSACTION_COLUMNS } from './_lib.js';

// POST { id, account_id, booking_date, amount, counterparty, purpose, category }
//   creates or updates one transaction (the id comes from the browser).
// DELETE ?id=… removes one.
export default async function handler(req, res) {
    const client = db(req, res);
    if (!client) return;

    if (req.method === 'DELETE') {
        const { error } = await client.from('transactions').delete().eq('id', req.query.id);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const t = req.body || {};
    const amount = Number(t.amount);
    if (!t.id || !t.account_id || !/^\d{4}-\d{2}-\d{2}$/.test(t.booking_date || '') || !Number.isFinite(amount) || amount === 0) {
        return res.status(400).json({ error: 'Konto, Datum und Betrag sind Pflicht' });
    }

    const { data, error } = await client.from('transactions').upsert({
        id: t.id,
        account_id: t.account_id,
        booking_date: t.booking_date,
        amount: Math.round(amount * 100) / 100,
        counterparty: t.counterparty?.trim() || null,
        purpose: t.purpose?.trim() || null,
        category: t.category || null,
    }).select(TRANSACTION_COLUMNS).single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
}
