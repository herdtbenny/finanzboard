import { useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronDown, Repeat, Search, TrendingUp, X } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { dayLabel, money, monthKey } from '../shared/format.js';
import { mergeTransfers, transferTitle } from '../shared/transfers.js';
import { MonthSwitch, PageTitle } from './ui.jsx';

const PAGE = 80;

// One line in a list. A merged transfer shows "from → to" and its amount
// without sign.
export function TransactionRow({ t, onOpen, showDate, names }) {
    const isTransfer = Boolean(t.transfer);
    const title = isTransfer ? transferTitle(t) : t.counterparty || t.purpose || 'Unbekannt';
    const sub = [
        isTransfer ? `${names[t.transfer.from.account_id]} → ${names[t.transfer.to.account_id]}` : t.category,
        showDate && dayLabel(t.booking_date),
        !isTransfer && names.__multi && names[t.account_id],
    ].filter(Boolean).join(' · ');

    return (
        <li>
            <button onClick={() => onOpen(t)} className="flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left active:bg-ink/5">
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
                    </p>
                    <p className="truncate text-xs text-muted">{sub}</p>
                </div>
                <p className={`tabular shrink-0 text-[15px] font-semibold ${isTransfer ? 'text-muted' : t.amount > 0 ? 'text-income' : ''}`}>
                    {!isTransfer && t.amount > 0 ? '+' : ''}{money(t.amount)}
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
export default function Transactions({ transactions, accounts, balances, month, onMonth, filter, onClearFilter, account, onAccount, onOpen }) {
    const [query, setQuery] = useState('');
    const [shown, setShown] = useState(PAGE);
    const names = accountNames(accounts);
    const q = query.toLowerCase().trim();

    const base = useMemo(
        () => (account ? transactions.filter((t) => t.account_id === account) : mergeTransfers(transactions)),
        [transactions, account],
    );
    const list = useMemo(() => {
        if (q) return base.filter((t) => `${t.counterparty} ${t.purpose} ${t.category} ${String(Math.abs(t.amount)).replace('.', ',')}`.toLowerCase().includes(q));
        return base.filter((t) => monthKey(t.booking_date) === month && (!filter || t.category === filter));
    }, [base, q, month, filter]);

    const days = [];
    for (const t of list.slice(0, shown)) {
        const value = t.transfer ? 0 : t.amount;
        const last = days[days.length - 1];
        if (last?.date === t.booking_date) { last.items.push(t); last.sum += value; } else days.push({ date: t.booking_date, items: [t], sum: value });
    }
    const total = list.reduce((s, t) => s + (t.transfer ? 0 : t.amount), 0);

    return (
        <div className="rise space-y-4">
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
                {!q && <div className="shrink-0"><MonthSwitch month={month} onChange={onMonth} compact /></div>}
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
            {filter && !q && (
                <button onClick={onClearFilter} className="flex items-center gap-1.5 rounded-full bg-ink py-2 pr-3 pl-4 text-sm text-paper">
                    {filter} <X size={14} />
                </button>
            )}

            <p className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 px-1 text-xs text-muted">
                <span>{list.length} {list.length === 1 ? 'Eintrag' : 'Einträge'}{q ? ' gefunden' : ''} · Summe <span className="tabular">{money(total)}</span></span>
                {account && <span>Kontostand <span className="tabular font-semibold text-ink">{money(balances[account])}</span></span>}
            </p>

            {!list.length && <p className="py-12 text-center text-sm text-muted">{q ? 'Nichts gefunden.' : 'Keine Umsätze in diesem Monat.'}</p>}

            {days.map((day) => (
                <section key={day.date}>
                    <div className="mb-1 flex justify-between px-2 text-xs text-muted">
                        <span className="font-medium">{dayLabel(day.date)}{q && ` ${day.date.slice(0, 4)}`}</span>
                        <span className="tabular">{money(day.sum)}</span>
                    </div>
                    <ul className="rounded-[24px] border border-line bg-card p-1">
                        {day.items.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} names={account ? { ...names, __multi: false } : names} />)}
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
