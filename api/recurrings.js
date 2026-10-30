import { db, spaceAccountIds } from './_lib.js';
import { bookDue } from './_recurring.js';

const INTERVALS = ['week', 'month', 'year'];
const KINDS = ['out', 'in', 'transfer'];

// POST creates or updates a standing order and books what is due right away.
// DELETE ?id=… stops it; the bookings it already made stay.
export default async function handler(req, res) {
    const s = await db(req, res);
    if (!s) return;
    const { client, spaceId } = s;

    if (req.method === 'DELETE') {
        const { error } = await client.from('recurrings').delete().eq('id', req.query.id).eq('space_id', spaceId);
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const r = req.body || {};
    const amount = Math.round(Math.abs(Number(r.amount)) * 100) / 100;
    const date = /^\d{4}-\d{2}-\d{2}$/;
    if (!r.id || !KINDS.includes(r.kind) || !r.account_id || !amount || !INTERVALS.includes(r.interval) || !date.test(r.start_date || '')) {
        return res.status(400).json({ error: 'Angaben unvollständig' });
    }
    if (r.kind === 'transfer' && (!r.to_account_id || r.to_account_id === r.account_id)) {
        return res.status(400).json({ error: 'Zwei verschiedene Konten wählen' });
    }
    if (r.end_date && (!date.test(r.end_date) || r.end_date < r.start_date)) {
        return res.status(400).json({ error: 'Enddatum liegt vor dem Start' });
    }

    const allowed = await spaceAccountIds(client, spaceId);
    if (!allowed.has(r.account_id) || (r.kind === 'transfer' && !allowed.has(r.to_account_id))) {
        return res.status(403).json({ error: 'Konto gehört nicht zu diesem Haushalt' });
    }

    const row = {
        id: r.id,
        space_id: spaceId,
        kind: r.kind,
        account_id: r.account_id,
        to_account_id: r.kind === 'transfer' ? r.to_account_id : null,
        amount,
        counterparty: r.counterparty?.trim() || null,
        category: r.kind === 'transfer' ? 'Umbuchung' : r.category || null,
        purpose: r.purpose?.trim() || null,
        interval: r.interval,
        every: Math.max(1, Number(r.every) || 1),
        start_date: r.start_date,
        end_date: r.end_date || null,
    };
    // A changed start date starts the schedule over; otherwise keep what was booked.
    const { data: old } = await client.from('recurrings').select('start_date,last_date,space_id').eq('id', r.id).maybeSingle();
    if (old && old.space_id !== spaceId) return res.status(403).json({ error: 'Kein Zugriff' });
    row.last_date = old && old.start_date === row.start_date ? old.last_date : null;

    const { error } = await client.from('recurrings').upsert(row);
    if (error) return res.status(500).json({ error: error.message });
    try {
        await bookDue(client, spaceId);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
    res.status(200).json({ ok: true });
}
