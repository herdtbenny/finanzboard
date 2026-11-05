// When standing orders are due. Shared by the server (api/_recurring.js),
// which books them, and the app, which shows the next date.

// Today in German time, as YYYY-MM-DD.
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

// How far ahead standing orders are booked: they show as vorgemerkt until
// their day comes.
export const AHEAD_DAYS = 31;

export function addDays(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// A booking counts towards the balance once its day has come — unless it's
// marked as not paid yet. Everything else is vorgemerkt.
export const isBooked = (t, now = today()) => !t.pending && t.booking_date <= now;

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

// The first occurrence after `after` (or the very first without it), null
// when the order has ended by then.
export function occurrenceAfter(r, after) {
    for (let n = 0; n < 5000; n++) {
        const date = occurrence(r, n);
        if (r.end_date && date > r.end_date) return null;
        if (!after || date > after) return date;
    }
    return null;
}

// The next occurrence not booked yet.
export const nextOccurrence = (r) => occurrenceAfter(r, r.last_date);
