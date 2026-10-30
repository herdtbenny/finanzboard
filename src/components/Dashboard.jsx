import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Landmark, RefreshCw, Settings } from 'lucide-react';
import { api, Unauthorized } from '../api.js';
import { categorize, isTransfer } from '../shared/categories.js';
import { maskIban, money, moneyShort, monthKey, monthLabel, relative, shiftMonth } from '../shared/format.js';
import MonthChart from './MonthChart.jsx';
import CategoryBars from './CategoryBars.jsx';
import TransactionList from './TransactionList.jsx';
import SettingsSheet from './SettingsSheet.jsx';

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function Dashboard({ token, onLogout }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(() => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('connected')) return `${p.get('connected')} verbunden`;
        if (p.get('error')) return `Fehler: ${p.get('error')}`;
        return '';
    });
    const [syncing, setSyncing] = useState(false);
    const [month, setMonth] = useState(thisMonth);
    const [category, setCategory] = useState(null);
    const [settings, setSettings] = useState(false);

    const guard = useCallback(async (fn) => {
        try {
            return await fn();
        } catch (e) {
            if (e instanceof Unauthorized) onLogout();
            else setError(e.message);
        }
    }, [onLogout]);

    const load = useCallback(() => guard(async () => {
        const d = await api('data', token);
        setData(d);
        setError('');
        return d;
    }), [guard, token]);

    // `auto`: opening the app or bringing it back to the foreground. Shows the
    // stored data right away, then fetches fresh transactions from the bank
    // (the server skips that if the last fetch is under 5 minutes old). Errors
    // of an automatic fetch only show up in the "Aktualisiert" line.
    const sync = useCallback(async ({ auto = false } = {}) => {
        setSyncing(true);
        try {
            const r = await api('sync', token, { method: 'POST', body: { auto } });
            if (!auto) setNotice(r.note || `${r.transactions} Umsätze aktualisiert`);
            if (!r.skipped) await load();
        } catch (e) {
            if (e instanceof Unauthorized) onLogout();
            else if (auto) await load();
            else setError(e.message);
        }
        setSyncing(false);
    }, [token, load, onLogout]);

    useEffect(() => {
        load().then((d) => { if (d?.accounts.length) sync({ auto: true }); });
        if (window.location.search) window.history.replaceState(null, '', '/');

        const onVisible = () => { if (document.visibilityState === 'visible') sync({ auto: true }); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [load, sync]);

    const transactions = useMemo(
        () => (data?.transactions || []).map((t) => ({ ...t, amount: Number(t.amount), category: categorize(t) })),
        [data],
    );
    const inMonth = useMemo(
        () => transactions.filter((t) => monthKey(t.booking_date) === month && !isTransfer(t)),
        [transactions, month],
    );
    const income = inMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = -inMonth.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const total = (data?.accounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);
    const listed = category ? inMonth.filter((t) => t.category === category) : inMonth;

    const expiring = (data?.sessions || [])
        .map((s) => ({ ...s, days: Math.ceil((new Date(s.valid_until) - Date.now()) / 86400000) }))
        .filter((s) => s.days <= 14);
    const noBank = data && !data.accounts.length;

    return (
        <div className="mx-auto min-h-dvh max-w-2xl pb-safe">
            <header className="pt-safe sticky top-0 z-10 flex items-center justify-between bg-paper/90 px-4 pb-3 backdrop-blur">
                <h1 className="text-lg font-semibold">Finanzen</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => sync()}
                        disabled={syncing || noBank}
                        aria-label="Jetzt synchronisieren"
                        className="flex size-10 items-center justify-center rounded-full border border-line bg-card disabled:opacity-40"
                    >
                        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setSettings(true)}
                        aria-label="Einstellungen"
                        className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            <main className="space-y-6 px-4">
                {(error || notice) && (
                    <button
                        onClick={() => { setError(''); setNotice(''); }}
                        className={`w-full rounded-2xl px-4 py-3 text-left text-sm ${error ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income'}`}
                    >
                        {error || notice}
                    </button>
                )}

                {expiring.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setSettings(true)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm"
                    >
                        <AlertTriangle size={18} className="shrink-0 text-expense" />
                        <span>
                            {s.days > 0
                                ? `Freigabe für ${s.aspsp_name} läuft in ${s.days} Tagen ab.`
                                : `Freigabe für ${s.aspsp_name} ist abgelaufen.`}{' '}
                            <span className="underline">Erneuern</span>
                        </span>
                    </button>
                ))}

                {!data && !error && <p className="py-20 text-center text-muted">Lade …</p>}

                {noBank && (
                    <div className="space-y-4 rounded-3xl border border-line bg-card p-6 text-center">
                        <Landmark className="mx-auto text-muted" size={32} />
                        <p className="text-muted">Noch keine Bank verbunden.</p>
                        <button onClick={() => setSettings(true)} className="rounded-full bg-ink px-5 py-2.5 font-medium text-paper">
                            Bank verbinden
                        </button>
                    </div>
                )}

                {data && !noBank && (
                    <>
                        <section>
                            <p className="text-sm text-muted">Gesamtsaldo</p>
                            <p className="tabular text-4xl font-semibold tracking-tight">{money(total)}</p>
                            {data.lastSync && (
                                <p className="mt-1 text-xs text-muted">
                                    {syncing ? 'Aktualisiere …' : `Aktualisiert ${relative(data.lastSync.at)}`}
                                    {!syncing && !data.lastSync.ok && <span className="text-expense"> · letzter Abruf fehlgeschlagen</span>}
                                </p>
                            )}
                            <div className="no-scrollbar -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4">
                                {data.accounts.map((a) => (
                                    <div key={a.uid} className="min-w-[60%] shrink-0 snap-start rounded-3xl border border-line bg-card p-4 sm:min-w-[40%]">
                                        <p className="truncate text-sm font-medium">{a.name || a.bank}</p>
                                        <p className="text-xs text-muted">{maskIban(a.iban)}</p>
                                        <p className="tabular mt-3 text-xl font-semibold">{money(a.balance)}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="flex items-center justify-between">
                            <button onClick={() => { setMonth(shiftMonth(month, -1)); setCategory(null); }} aria-label="Vorheriger Monat" className="flex size-10 items-center justify-center rounded-full border border-line bg-card">
                                <ChevronLeft size={18} />
                            </button>
                            <p className="font-medium">{monthLabel(month)}</p>
                            <button
                                onClick={() => { setMonth(shiftMonth(month, 1)); setCategory(null); }}
                                disabled={month >= thisMonth()}
                                aria-label="Nächster Monat"
                                className="flex size-10 items-center justify-center rounded-full border border-line bg-card disabled:opacity-30"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </section>

                        <section className="grid grid-cols-3 gap-2">
                            <Stat label="Einnahmen" value={income} dot="bg-income" />
                            <Stat label="Ausgaben" value={expense} dot="bg-expense" />
                            <Stat label="Bilanz" value={income - expense} signed />
                        </section>

                        <MonthChart transactions={transactions} month={month} onSelect={(m) => { setMonth(m); setCategory(null); }} />

                        <CategoryBars transactions={inMonth} active={category} onSelect={setCategory} />

                        <TransactionList transactions={listed} accounts={data.accounts} filter={category} onClearFilter={() => setCategory(null)} />
                    </>
                )}
            </main>

            {settings && (
                <SettingsSheet
                    token={token}
                    data={data}
                    guard={guard}
                    onClose={() => setSettings(false)}
                    onLogout={onLogout}
                />
            )}
        </div>
    );
}

function Stat({ label, value, dot, signed }) {
    const color = signed ? (value < 0 ? 'text-expense' : 'text-income') : '';
    return (
        <div className="rounded-2xl border border-line bg-card p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted">
                {dot && <span className={`size-2 rounded-full ${dot}`} />}
                {label}
            </p>
            <p className={`tabular mt-1 truncate text-[15px] font-semibold ${color}`}>
                {signed && value > 0 ? '+' : ''}{moneyShort(value)}
            </p>
        </div>
    );
}
