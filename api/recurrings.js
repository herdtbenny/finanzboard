import { ownAccountIds, session } from './_lib.js';
import { bookDue, dropAhead } from './_recurring.js';

const INTERVALS = ['week', 'month', 'year'];
const KINDS = ['out', 'in', 'transfer'];

// POST creates or updates a standing order and books it right away (up to a
// month ahead). Bookings still to come are made anew, so a changed amount or
// day applies to them too.
// DELETE ?id=… stops it; the bookings up to today stay, the ones ahead go.
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;
    const { client, userId } = s;

    const { data: old } = await client.from('recurrings').select('id,user_id,start_date,last_date').eq('id', (req.method === 'DELETE' ? req.query.id : req.body?.id) || '').maybeSingle();
    if (old && old.user_id !== userId) return res.status(403).json({ error: 'Kein Zugriff' });

    if (req.method === 'DELETE') {
        if (!old) return res.status(200).json({ ok: true });
        try {
            await dropAhead(client, old);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
        const { error } = await client.from('recurrings').delete().eq('id', old.id).eq('user_id', userId);
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

    const allowed = await ownAccountIds(client, userId);
    if (!allowed.has(r.account_id) || (r.kind === 'transfer' && !allowed.has(r.to_account_id))) {
        return res.status(403).json({ error: 'Unbekanntes Konto' });
    }

    const row = {
        id: r.id,
        user_id: userId,
        kind: r.kind,
        account_id: r.account_id,
        to_account_id: r.kind === 'transfer' ? r.to_account_id : null,
        amount,
        counterparty: r.counterparty?.trim() || null,
        category: r.kind === 'transfer' ? (r.category === 'Investieren' ? 'Investieren' : 'Umbuchung') : r.category || null,
        purpose: r.purpose?.trim() || null,
        interval: r.interval,
        every: Math.max(1, Number(r.every) || 1),
        start_date: r.start_date,
        end_date: r.end_date || null,
        last_date: null,
    };
    try {
        // A changed start date starts the schedule over; otherwise keep what
        // was booked up to today and book what lies ahead anew.
        if (old) {
            const kept = await dropAhead(client, old);
            row.last_date = old.start_date === row.start_date ? kept : null;
        }
        const { error } = await client.from('recurrings').upsert(row);
        if (error) throw error;
        await bookDue(client, userId);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
    res.status(200).json({ ok: true });
}
