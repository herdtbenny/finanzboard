import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { dayLabel, money, monthKey } from '../shared/format.js';
import { MonthSwitch, PageTitle } from './ui.jsx';

const PAGE = 80;

export function TransactionRow({ t, onOpen, showDate, accountName }) {
    const sub = [t.category, showDate && dayLabel(t.booking_date), accountName].filter(Boolean).join(' · ');
    return (
        <li>
            <button onClick={() => onOpen(t)} className="flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left active:bg-ink/5">
                <CategoryIcon category={t.category} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{t.counterparty || t.purpose || 'Unbekannt'}</p>
                    <p className="truncate text-xs text-muted">{sub}</p>
                </div>
                <p className={`tabular shrink-0 text-[15px] font-semibold ${t.amount > 0 ? 'text-income' : ''}`}>
                    {t.amount > 0 ? '+' : ''}{money(t.amount)}
                </p>
            </button>
        </li>
    );
}

// Searching looks through all months; otherwise the list shows the chosen
// month, optionally narrowed to one category.
export default function Transactions({ transactions, accounts, month, onMonth, filter, onClearFilter, onOpen }) {
    const [query, setQuery] = useState('');
    const [shown, setShown] = useState(PAGE);
    const accountName = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    const multi = accounts.length > 1;
    const q = query.toLowerCase().trim();

    const list = useMemo(() => {
        if (q) return transactions.filter((t) => `${t.counterparty} ${t.purpose} ${t.category} ${String(Math.abs(t.amount)).replace('.', ',')}`.toLowerCase().includes(q));
        return transactions.filter((t) => monthKey(t.booking_date) === month && (!filter || t.category === filter));
    }, [transactions, q, month, filter]);

    const days = [];
    for (const t of list.slice(0, shown)) {
        const last = days[days.length - 1];
        if (last?.date === t.booking_date) { last.items.push(t); last.sum += t.amount; } else days.push({ date: t.booking_date, items: [t], sum: t.amount });
    }
    const total = list.reduce((s, t) => s + t.amount, 0);

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

            {!q && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <MonthSwitch month={month} onChange={onMonth} />
                    {filter && (
                        <button onClick={onClearFilter} className="flex items-center gap-1.5 rounded-full bg-ink py-2 pr-3 pl-4 text-sm text-paper">
                            {filter} <X size={14} />
                        </button>
                    )}
                </div>
            )}

            <p className="px-1 text-xs text-muted">
                {list.length} {list.length === 1 ? 'Umsatz' : 'Umsätze'}{q ? ' gefunden' : ''} · Summe <span className="tabular">{money(total)}</span>
            </p>

            {!list.length && <p className="py-12 text-center text-sm text-muted">{q ? 'Nichts gefunden.' : 'Noch keine Umsätze in diesem Monat.'}</p>}

            {days.map((day) => (
                <section key={day.date}>
                    <div className="mb-1 flex justify-between px-2 text-xs text-muted">
                        <span className="font-medium">{dayLabel(day.date)}{q && ` ${day.date.slice(0, 4)}`}</span>
                        <span className="tabular">{money(day.sum)}</span>
                    </div>
                    <ul className="rounded-[24px] border border-line bg-card p-1">
                        {day.items.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} accountName={multi ? accountName[t.account_id] : null} />)}
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
