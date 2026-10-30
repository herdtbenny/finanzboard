import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { dayLabel, money } from '../shared/format.js';

const PAGE = 60;

export default function TransactionList({ transactions, accounts, filter, onClearFilter }) {
    const [query, setQuery] = useState('');
    const [shown, setShown] = useState(PAGE);
    const multiAccount = accounts.length > 1;
    const accountName = Object.fromEntries(accounts.map((a) => [a.uid, a.name || a.bank]));

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return transactions;
        return transactions.filter((t) => `${t.counterparty} ${t.purpose} ${t.category}`.toLowerCase().includes(q));
    }, [transactions, query]);

    const days = [];
    for (const t of filtered.slice(0, shown)) {
        const last = days[days.length - 1];
        if (last?.date === t.booking_date) last.items.push(t);
        else days.push({ date: t.booking_date, items: [t] });
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-medium">Umsätze</h2>
                {filter && (
                    <button onClick={onClearFilter} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs text-paper">
                        {filter} <X size={12} />
                    </button>
                )}
            </div>

            <label className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5">
                <Search size={16} className="text-muted" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Suchen"
                    className="w-full bg-transparent text-base outline-none"
                />
            </label>

            {!filtered.length && <p className="py-8 text-center text-sm text-muted">Keine Umsätze</p>}

            {days.map((day) => (
                <div key={day.date}>
                    <p className="mb-1 px-1 text-xs font-medium text-muted">{dayLabel(day.date)}</p>
                    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
                        {day.items.map((t) => (
                            <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-medium">{t.counterparty || t.purpose || 'Unbekannt'}</p>
                                    <p className="truncate text-xs text-muted">
                                        {t.category}
                                        {t.status === 'PDNG' && ' · vorgemerkt'}
                                        {multiAccount && ` · ${accountName[t.account_uid] || ''}`}
                                    </p>
                                    {t.counterparty && t.purpose && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.purpose}</p>}
                                </div>
                                <p className={`tabular shrink-0 text-[15px] font-medium ${t.amount > 0 ? 'text-income' : ''}`}>
                                    {t.amount > 0 ? '+' : ''}{money(t.amount)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {filtered.length > shown && (
                <button onClick={() => setShown(shown + PAGE)} className="w-full rounded-full border border-line bg-card py-3 text-sm font-medium">
                    Mehr anzeigen
                </button>
            )}
        </section>
    );
}
