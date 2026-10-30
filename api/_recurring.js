// Turns standing orders (table `recurrings`) into transactions, up to today.

// Today in German time, as YYYY-MM-DD.
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

// The n-th occurrence (0 = start). Monthly and yearly orders keep the start
// day, clamped to the month's last day (31 → 30 in April).
export function occurrence(r, n) {
    const [y, m, d] = r.start_date.split('-').map(Number);
    if (r.interval === 'week') {
        const date = new Date(Date.UTC(y, m - 1, d + 7 * r.every * n));
        return date.toISOString().slice(0, 10);
    }
    const months = (r.interval === 'year' ? 12 : 1) * r.every * n;
    const first = new Date(Date.UTC(y, m - 1 + months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(d, last));
    return first.toISOString().slice(0, 10);
}

export function nextOccurrence(r) {
    for (let n = 0; n < 2000; n++) {
        const date = occurrence(r, n);
        if (r.end_date && date > r.end_date) return null;
        if (!r.last_date || date > r.last_date) return date;
    }
    return null;
}

// The transactions one occurrence books: one row, or two for a transfer.
export function bookingsFor(r, date) {
    const amount = Number(r.amount);
    const base = { booking_date: date, purpose: r.purpose || null, recurring_id: r.id };
    if (r.kind === 'transfer') {
        const transfer = `rec-${r.id}-${date}`;
        const name = r.counterparty || 'Umbuchung';
        return [
            { ...base, id: `${transfer}-out`, account_id: r.account_id, amount: -amount, counterparty: name, category: 'Umbuchung', transfer_id: transfer },
            { ...base, id: `${transfer}-in`, account_id: r.to_account_id, amount, counterparty: name, category: 'Umbuchung', transfer_id: transfer },
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

// Books every occurrence that is due and not booked yet. Safe to call often:
// last_date moves forward, and the ids are fixed per occurrence.
export async function bookDue(client) {
    const { data: recurrings, error } = await client.from('recurrings').select('*');
    if (error) throw error;
    const now = today();
    for (const r of recurrings) {
        const rows = [];
        let last = r.last_date;
        for (let date = nextOccurrence(r); date && date <= now && rows.length < 1000; date = nextOccurrence({ ...r, last_date: last })) {
            rows.push(...bookingsFor(r, date));
            last = date;
        }
        if (!rows.length) continue;
        const { error: insErr } = await client.from('transactions').upsert(rows);
        if (insErr) throw insErr;
        await client.from('recurrings').update({ last_date: last }).eq('id', r.id);
    }
}
