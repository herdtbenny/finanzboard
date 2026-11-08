import { useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronDown, Clock, Repeat, Search, TrendingUp, X } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { dayLabel, money, monthKey } from '../shared/format.js';
import { isNeutral } from '../shared/categories.js';
import { mergeTransfers, transferTitle } from '../shared/transfers.js';
import { bookingsFor, isBooked, occurrencesIn } from '../shared/schedule.js';
import { MonthSwitch, PageTitle } from './ui.jsx';

const PAGE = 80;

// One line in a list. A merged transfer shows "from → to" and its amount
// without sign. In one account's statement a transfer shows as its half
// (`t.whole` = the merged transfer): signed, with where the money went to
// or came from; tapping it opens the whole transfer. Vorgemerkt (not paid
// yet, or dated ahead) shows greyed out as a whole, with a clock.
export function TransactionRow({ t, onOpen, showDate, names }) {
    const whole = t.transfer ? t : t.whole;
    const isTransfer = Boolean(whole);
    const isHalf = Boolean(t.whole);
    const title = isTransfer ? transferTitle(whole) : t.counterparty || t.purpose || 'Unbekannt';
    let where = t.category;
    if (isHalf) where = t.amount < 0 ? `→ an ${names[whole.transfer.to.account_id]}` : `← von ${names[whole.transfer.from.account_id]}`;
    else if (isTransfer) where = `${names[whole.transfer.from.account_id]} → ${names[whole.transfer.to.account_id]}`;
    const booked = isBooked(t);
    const sub = [
        !booked && (t.pending ? 'Nicht bezahlt' : 'Vorgemerkt'),
        where,
        showDate && dayLabel(t.booking_date),
        !isTransfer && names.__multi && names[t.account_id],
    ].filter(Boolean).join(' · ');
    // Expenses red, income green; transfers and corrections stay grey.
    const amountClass = isTransfer || isNeutral(t) ? 'text-muted' : t.amount > 0 ? 'text-income' : 'text-expense';

    return (
        <li>
            <button onClick={() => onOpen(whole || t)} className={`flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left active:bg-ink/5 ${booked ? '' : 'opacity-45'}`}>
                {isTransfer
                    ? (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06]">
                            {t.category === 'Investieren' ? <TrendingUp size={18} strokeWidth={1.8} /> : <ArrowLeftRight size={18} strokeWidth={1.8} />}
                        </span>
                    )
                    : <CategoryIcon category={t.category} />}
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-medium">
                        <span className="truncate">{title}</span>
                        {t.recurring_id && <Repeat size={12} className="shrink-0 text-muted" aria-label="Dauerauftrag" />}
                        {!booked && <Clock size={12} className="shrink-0 text-muted" aria-label="Vorgemerkt" />}
                    </p>
                    <p className="truncate text-xs text-muted">{sub}</p>
                </div>
                <p className={`tabular shrink-0 text-[15px] font-semibold ${amountClass}`}>
                    {(!isTransfer || isHalf) && t.amount > 0 ? '+' : ''}{money(t.amount)}
                </p>
            </button>
        </li>
    );
}

export function accountNames(accounts) {
    return { ...Object.fromEntries(accounts.map((a) => [a.id, a.name])), __multi: accounts.length > 1 };
}

// Searching looks through all months. Without an account filter, transfers
// show as one entry; with one, the list is that account's statement: each
// half of a transfer with its sign, plus the balance.
// Months go on without end: standing orders show in every month ahead, also
// past the month they are booked up to (`projected`, opening the order).
export default function Transactions({ transactions, recurrings, accounts, balances, pending, month, onMonth, filter, onClearFilter, account, onAccount, onOpen, onOpenRecurring }) {
    const [query, setQuery] = useState('');
    // 'all' | 'out' | 'in'
    const [type, setType] = useState('all');
    const [shown, setShown] = useState(PAGE);
    const names = accountNames(accounts);
    const q = query.toLowerCase().trim();

    const all = useMemo(() => {
        if (q) return transactions;
        const ahead = recurrings.flatMap((r) => occurrencesIn(r, month).flatMap((d) => bookingsFor(r, d)))
            .map((t) => ({ ...t, amount: Number(t.amount), projected: true, created_at: '' }));
        if (!ahead.length) return transactions;
        return [...ahead, ...transactions].sort((a, b) => b.booking_date.localeCompare(a.booking_date));
    }, [transactions, recurrings, month, q]);
    const open = (t) => (t.projected ? onOpenRecurring(recurrings.find((r) => r.id === t.recurring_id)) : onOpen(t));

    const base = useMemo(() => {
        const merged = mergeTransfers(all);
        if (!account) return merged;
        const wholes = Object.fromEntries(merged.filter((t) => t.transfer).map((t) => [t.transfer_id, t]));
        return all
            .filter((t) => t.account_id === account)
            .map((t) => (t.transfer_id && wholes[t.transfer_id] ? { ...t, whole: wholes[t.transfer_id] } : t));
    }, [all, account]);
    const list = useMemo(() => {
        // Transfers and corrections are neither; they only show under "Alle".
        // Every plus is income, every minus an expense.
        const ofType = (t) => {
            if (type === 'all') return true;
            if (t.transfer || t.whole || isNeutral(t)) return false;
            return type === 'in' ? t.amount > 0 : t.amount < 0;
        };
        if (q) return base.filter((t) => ofType(t) && `${t.counterparty} ${t.purpose} ${t.category} ${String(Math.abs(t.amount)).replace('.', ',')}`.toLowerCase().includes(q));
        return base.filter((t) => ofType(t) && monthKey(t.booking_date) === month && (!filter || t.category === filter));
    }, [base, q, month, filter, type]);

    // Sums leave out what is vorgemerkt: it is listed, but not spent yet.
    const counts = (t) => isBooked(t.whole || t);
    const days = [];
    for (const t of list.slice(0, shown)) {
        const value = t.transfer || !counts(t) ? 0 : t.amount;
        const last = days[days.length - 1];
        if (last?.date === t.booking_date) { last.items.push(t); last.sum += value; } else days.push({ date: t.booking_date, items: [t], sum: value });
    }
    // The line above the list: income and expenses, reckoned like the month
    // card (transfers and corrections left out); in
    // an account's statement, how much that account changed instead.
    let income = 0;
    let expenses = 0;
    for (const t of list) {
        if (!counts(t)) continue;
        if (t.transfer || t.whole || isNeutral(t)) continue;
        if (t.amount > 0) income += t.amount;
        else expenses -= t.amount;
    }
    const bookedCount = list.filter(counts).length;
    const change = list.reduce((s, t) => s + (t.transfer || !counts(t) ? 0 : t.amount), 0);

    return (
        <div className="space-y-4">
            <PageTitle>Umsätze</PageTitle>

            <label className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-3">
                <Search size={17} className="shrink-0 text-muted" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
                    placeholder="In allen Monaten suchen"
                    className="w-full bg-transparent text-base outline-none"
                />
            </label>

            {/* Month and account side by side; the account pill takes the rest of the row */}
            <div className="flex items-center gap-2">
                {!q && <div className="shrink-0"><MonthSwitch month={month} onChange={onMonth} compact max="9999-12" /></div>}
                {accounts.length > 1 && (
                    <label className={`relative flex min-w-0 flex-1 items-center rounded-full border ${account ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}>
                        <select
                            value={account || ''}
                            onChange={(e) => { onAccount(e.target.value || null); setShown(PAGE); }}
                            aria-label="Konto"
                            className="w-full min-w-0 appearance-none truncate bg-transparent py-2.5 pr-8 pl-4 text-sm font-medium outline-none"
                        >
                            <option value="">Alle Konten</option>
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <ChevronDown size={15} className="pointer-events-none absolute right-3" />
                    </label>
                )}
            </div>
            <div className="grid grid-cols-3 rounded-full border border-line bg-card p-1">
                {[['all', 'Alle', 'bg-ink text-paper'], ['out', 'Ausgaben', 'bg-expense text-white'], ['in', 'Einnahmen', 'bg-income text-white']].map(([k, label, active]) => (
                    <button
                        key={k}
                        onClick={() => { setType(k); setShown(PAGE); }}
                        aria-pressed={type === k}
                        className={`rounded-full py-1.5 text-sm font-medium transition-colors ${type === k ? active : 'text-muted'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {filter && !q && (
                <button onClick={onClearFilter} className="flex items-center gap-1.5 rounded-full bg-ink py-2 pr-3 pl-4 text-sm text-paper">
                    {filter} <X size={14} />
                </button>
            )}

            <p className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 px-1 text-xs text-muted">
                <span>
                    {bookedCount} {bookedCount === 1 ? 'Eintrag' : 'Einträge'}{q ? ' gefunden' : ''}
                    {account ? (
                        <> · Veränderung <span className={`tabular font-medium ${change < 0 ? 'text-expense' : 'text-income'}`}>{change > 0 ? '+' : ''}{money(change)}</span></>
                    ) : (
                        <>
                            {type !== 'out' && <> · Einnahmen <span className="tabular font-medium text-income">+{money(income)}</span></>}
                            {type !== 'in' && <> · Ausgaben <span className="tabular font-medium text-expense">−{money(expenses)}</span></>}
                        </>
                    )}
                </span>
                {account && (
                    <span>
                        Kontostand <span className="tabular font-semibold text-ink">{money(balances[account])}</span>
                        {Math.abs(pending[account]) > 0.005 && <> · vorgemerkt <span className="tabular font-medium">{pending[account] > 0 ? '+' : ''}{money(pending[account])}</span></>}
                    </span>
                )}
            </p>

            {!list.length && <p className="py-12 text-center text-sm text-muted">{q ? 'Nichts gefunden.' : 'Keine Umsätze in diesem Monat.'}</p>}

            {days.map((day) => (
                <section key={day.date}>
                    <div className="mb-1 flex justify-between px-2 text-xs text-muted">
                        <span className="font-medium">{dayLabel(day.date)}{q && ` ${day.date.slice(0, 4)}`}</span>
                        <span className="tabular">{money(day.sum)}</span>
                    </div>
                    <ul className="rounded-[24px] border border-line bg-card p-1">
                        {day.items.map((t) => <TransactionRow key={t.id} t={t} onOpen={open} names={account ? { ...names, __multi: false } : names} />)}
                    </ul>
                </section>
            ))}

            {list.length > shown && (
                <button onClick={() => setShown(shown + PAGE)} className="w-full rounded-full border border-line bg-card py-3 text-sm font-medium">
                    Mehr anzeigen
                </button>
            )}
        </div>
    );
}
