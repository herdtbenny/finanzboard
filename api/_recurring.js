// Turns standing orders (table `recurrings`) into transactions — up to
// AHEAD_DAYS ahead, so the coming ones show as vorgemerkt and count towards
// the balance on their day.
import { addDays, AHEAD_DAYS, nextOccurrence, today } from '../src/shared/schedule.js';

// The transactions one occurrence books: one row, or two for a transfer.
export function bookingsFor(r, date) {
    const amount = Number(r.amount);
    const base = { booking_date: date, purpose: r.purpose || null, recurring_id: r.id, user_id: r.user_id };
    if (r.kind === 'transfer') {
        const transfer = `rec-${r.id}-${date}`;
        const name = r.counterparty || 'Umbuchung';
        const category = r.category === 'Investieren' ? 'Investieren' : 'Umbuchung';
        return [
            { ...base, id: `${transfer}-out`, account_id: r.account_id, amount: -amount, counterparty: name, category, transfer_id: transfer },
            { ...base, id: `${transfer}-in`, account_id: r.to_account_id, amount, counterparty: name, category, transfer_id: transfer },
        ];
    }
    return [{
        ...base,
        id: `rec-${r.id}-${date}`,
        account_id: r.account_id,
        amount: r.kind === 'out' ? -amount : amount,
        counterparty: r.counterparty || null,
        category: r.category || null,
    }];
}

// Books every occurrence up to the horizon that is not booked yet — of one
// person, or of everyone when userId is left out (the daily cron). Safe to
// call often: last_date moves forward, and the ids are fixed per occurrence.
export async function bookDue(client, userId) {
    let query = client.from('recurrings').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: recurrings, error } = await query;
    if (error) throw error;
    const until = addDays(today(), AHEAD_DAYS);
    for (const r of recurrings) {
        const rows = [];
        let last = r.last_date;
        for (let date = nextOccurrence(r); date && date <= until && rows.length < 1000; date = nextOccurrence({ ...r, last_date: last })) {
            rows.push(...bookingsFor(r, date));
            last = date;
        }
        if (!rows.length) continue;
        const { error: insErr } = await client.from('transactions').upsert(rows);
        if (insErr) throw insErr;
        await client.from('recurrings').update({ last_date: last }).eq('id', r.id);
    }
}

// Removes the bookings of a standing order that lie in the future (booked
// ahead, not due yet), when it is changed or stopped. Returns the last_date
// to go on from: today at the latest, so changed orders book again from
// tomorrow on with the new values.
export async function dropAhead(client, r) {
    const now = today();
    const { error } = await client.from('transactions').delete().eq('recurring_id', r.id).eq('user_id', r.user_id).gt('booking_date', now);
    if (error) throw error;
    return r.last_date && r.last_date > now ? now : r.last_date;
}
