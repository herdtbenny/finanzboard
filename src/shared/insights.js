import { isNeutral, isRefund } from './categories.js';
import { monthKey, shiftMonth } from './format.js';

export const currentMonth = () => new Date().toISOString().slice(0, 7);

// Income, expenses and expenses per category of one month. Transfers,
// balance corrections and depot value changes are left out; refunds lower
// their category's expenses; `invested` is what went into a depot.
export function monthSummary(transactions, key) {
    const s = { in: 0, out: 0, invested: 0, byCategory: {} };
    for (const t of transactions) {
        if (monthKey(t.booking_date) !== key) continue;
        if (t.category === 'Investieren' && t.amount > 0) s.invested += t.amount;
        if (isNeutral(t)) continue;
        if (t.amount > 0 && !isRefund(t)) s.in += t.amount;
        else {
            s.out -= t.amount;
            s.byCategory[t.category] = (s.byCategory[t.category] || 0) - t.amount;
        }
    }
    // A category can end up at zero or below when refunds outweigh it.
    for (const [c, v] of Object.entries(s.byCategory)) if (v <= 0.005) delete s.byCategory[c];
    s.out = Math.max(0, s.out);
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

// How much the total of all accounts changed in a month: every booking
// counts, also depot value changes and corrections (transfers cancel out).
export function balanceChange(transactions, key) {
    let sum = 0;
    for (const t of transactions) if (monthKey(t.booking_date) === key) sum += t.amount;
    return sum;
}

// The usual change: average of the `n` months before `key` that have data.
export function usualChange(transactions, key, n = 6) {
    const firstKey = transactions.length ? monthKey(transactions[transactions.length - 1].booking_date) : key;
    const changes = [];
    for (let i = 1; i <= n; i++) {
        const k = shiftMonth(key, -i);
        if (k < firstKey) break;
        changes.push(balanceChange(transactions, k));
    }
    return changes.length ? changes.reduce((s, c) => s + c, 0) / changes.length : null;
}
