import { isNeutral } from './categories.js';
import { monthKey, shiftMonth } from './format.js';

export const currentMonth = () => new Date().toISOString().slice(0, 7);

// Income, expenses and expenses per category of one month. Transfers and
// balance corrections are left out.
export function monthSummary(transactions, key) {
    const s = { in: 0, out: 0, byCategory: {} };
    for (const t of transactions) {
        if (monthKey(t.booking_date) !== key || isNeutral(t)) continue;
        if (t.amount > 0) s.in += t.amount;
        else {
            s.out -= t.amount;
            s.byCategory[t.category] = (s.byCategory[t.category] || 0) - t.amount;
        }
    }
    s.net = s.in - s.out;
    s.rate = s.in > 0 ? s.net / s.in : null;
    return s;
}

// Average expenses of the `n` months before `key` that have any data at all,
// overall and per category.
export function averageBefore(transactions, key, n = 6) {
    const months = [];
    const firstKey = transactions.length ? monthKey(transactions[transactions.length - 1].booking_date) : key;
    for (let i = 1; i <= n; i++) {
        const k = shiftMonth(key, -i);
        if (k < firstKey) break;
        months.push(monthSummary(transactions, k));
    }
    if (!months.length) return null;
    const byCategory = {};
    for (const m of months) for (const [c, v] of Object.entries(m.byCategory)) byCategory[c] = (byCategory[c] || 0) + v / months.length;
    return {
        out: months.reduce((s, m) => s + m.out, 0) / months.length,
        in: months.reduce((s, m) => s + m.in, 0) / months.length,
        byCategory,
        months: months.length,
    };
}

// Total balance at the end of each of the last `n` months (the current month
// up to today). `transactions` is sorted newest first.
export function balanceSeries(accounts, transactions, n = 12) {
    const now = currentMonth();
    const keys = Array.from({ length: n }, (_, i) => shiftMonth(now, i - (n - 1)));
    const opening = accounts.reduce((s, a) => s + Number(a.opening_balance), 0);
    const byMonth = {};
    let before = 0;
    for (const t of transactions) {
        const k = monthKey(t.booking_date);
        if (k < keys[0]) before += t.amount;
        else byMonth[k] = (byMonth[k] || 0) + t.amount;
    }
    let running = opening + before;
    return keys.map((key) => {
        running += byMonth[key] || 0;
        return { key, value: running };
    });
}

// Frequent bookings of the last 90 days (same name, category and amount),
// offered as one-tap templates in the form.
export function quickTemplates(transactions, limit = 6) {
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const counts = new Map();
    for (const t of transactions) {
        if (t.booking_date < since) break;
        if (!t.counterparty || t.category === 'Kontostand') continue;
        const key = `${t.counterparty.toLowerCase()}|${t.category}|${t.amount}`;
        const hit = counts.get(key) || { counterparty: t.counterparty, category: t.category, amount: t.amount, account_id: t.account_id, n: 0 };
        hit.n++;
        counts.set(key, hit);
    }
    return [...counts.values()].filter((t) => t.n >= 2).sort((a, b) => b.n - a.n).slice(0, limit);
}
