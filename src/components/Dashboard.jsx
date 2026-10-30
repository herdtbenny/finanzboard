import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Wallet } from 'lucide-react';
import { api, Unauthorized } from '../api.js';
import { categoryMemory, categoryOf, categoryOptions, isNeutral } from '../shared/categories.js';
import { money, moneyShort, monthKey, monthLabel, shiftMonth } from '../shared/format.js';
import MonthChart from './MonthChart.jsx';
import CategoryBars from './CategoryBars.jsx';
import TransactionList from './TransactionList.jsx';
import TransactionSheet from './TransactionSheet.jsx';
import AccountsSheet from './AccountsSheet.jsx';

const thisMonth = () => new Date().toISOString().slice(0, 7);

const byDateDesc = (a, b) => b.booking_date.localeCompare(a.booking_date) || String(b.created_at).localeCompare(String(a.created_at));

export default function Dashboard({ token, onLogout }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [month, setMonth] = useState(thisMonth);
    const [category, setCategory] = useState(null);
    // null | 'new' | a transaction being edited
    const [txSheet, setTxSheet] = useState(null);
    // null | 'list' | 'new'
    const [accountSheet, setAccountSheet] = useState(null);
    const [lastAccountId, setLastAccountId] = useState(null);

    // Throws on errors so the sheets can show them; logs out on 401.
    const call = useCallback(async (path, opts) => {
        try {
            return await api(path, token, opts);
        } catch (e) {
            if (e instanceof Unauthorized) onLogout();
            throw e;
        }
    }, [token, onLogout]);

    useEffect(() => {
        call('data').then(setData).catch((e) => setError(e.message));
    }, [call]);

    // Every save answers with the stored row, which replaces the local copy —
    // no reload of the whole list.
    async function saveTransaction(t) {
        const saved = await call('transactions', { method: 'POST', body: t });
        setLastAccountId(saved.account_id);
        setData((d) => ({ ...d, transactions: [...d.transactions.filter((x) => x.id !== saved.id), saved].sort(byDateDesc) }));
        setMonth(monthKey(saved.booking_date));
    }

    async function deleteTransaction(id) {
        await call(`transactions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        setData((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== id) }));
    }

    async function saveAccount(a) {
        const saved = await call('accounts', { method: 'POST', body: a });
        setData((d) => {
            const exists = d.accounts.some((x) => x.id === saved.id);
            return { ...d, accounts: exists ? d.accounts.map((x) => (x.id === saved.id ? saved : x)) : [...d.accounts, saved] };
        });
    }

    async function deleteAccount(id) {
        await call(`accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        setData((d) => ({
            accounts: d.accounts.filter((x) => x.id !== id),
            transactions: d.transactions.filter((x) => x.account_id !== id),
        }));
    }

    const accounts = data?.accounts || [];
    const transactions = useMemo(
        () => (data?.transactions || []).map((t) => ({ ...t, amount: Number(t.amount), category: categoryOf(t) })),
        [data],
    );
    const balances = useMemo(() => {
        const b = Object.fromEntries(accounts.map((a) => [a.id, Number(a.opening_balance)]));
        for (const t of transactions) if (t.account_id in b) b[t.account_id] += t.amount;
        return b;
    }, [accounts, transactions]);
    // Names for the form's autocomplete, most used first.
    const counterparties = useMemo(() => {
        const n = {};
        for (const t of transactions) if (t.counterparty) n[t.counterparty] = (n[t.counterparty] || 0) + 1;
        return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 300);
    }, [transactions]);
    const memory = useMemo(() => categoryMemory(transactions), [transactions]);
    const options = useMemo(() => ({ in: categoryOptions(transactions, 'in'), out: categoryOptions(transactions, 'out') }), [transactions]);

    const inMonth = transactions.filter((t) => monthKey(t.booking_date) === month && !isNeutral(t));
    const income = inMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = -inMonth.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const total = Object.values(balances).reduce((s, v) => s + v, 0);
    const listed = category ? inMonth.filter((t) => t.category === category) : transactions.filter((t) => monthKey(t.booking_date) === month);
    const pickMonth = (m) => { setMonth(m); setCategory(null); };

    return (
        <div className="mx-auto min-h-dvh max-w-2xl pb-safe">
            <header className="pt-safe sticky top-0 z-10 flex items-center justify-between bg-paper/90 px-4 pb-3 backdrop-blur">
                <h1 className="text-lg font-semibold">Finanzen</h1>
                {data && (
                    <button
                        onClick={() => setAccountSheet('list')}
                        aria-label="Konten"
                        className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
                    >
                        <Wallet size={18} />
                    </button>
                )}
            </header>

            <main className="space-y-6 px-4 pb-28">
                {error && (
                    <button onClick={() => setError('')} className="w-full rounded-2xl bg-expense/10 px-4 py-3 text-left text-sm text-expense">
                        {error}
                    </button>
                )}

                {!data && !error && <p className="py-20 text-center text-muted">Lade …</p>}

                {data && !accounts.length && (
                    <div className="space-y-4 rounded-3xl border border-line bg-card p-6 text-center">
                        <Wallet className="mx-auto text-muted" size={32} />
                        <p className="text-muted">Leg zuerst ein Konto mit seinem aktuellen Kontostand an.</p>
                        <button onClick={() => setAccountSheet('new')} className="rounded-full bg-ink px-5 py-2.5 font-medium text-paper">
                            Konto anlegen
                        </button>
                    </div>
                )}

                {data && accounts.length > 0 && (
                    <>
                        <section>
                            <p className="text-sm text-muted">Gesamtsaldo</p>
                            <p className={`tabular text-4xl font-semibold tracking-tight ${total < 0 ? 'text-expense' : ''}`}>{money(total)}</p>
                            {accounts.length > 1 && (
                                <div className="no-scrollbar -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4">
                                    {accounts.map((a) => (
                                        <button
                                            key={a.id}
                                            onClick={() => setAccountSheet('list')}
                                            className="min-w-[60%] shrink-0 snap-start rounded-3xl border border-line bg-card p-4 text-left sm:min-w-[40%]"
                                        >
                                            <p className="truncate text-sm font-medium">{a.name}</p>
                                            <p className="tabular mt-3 text-xl font-semibold">{money(balances[a.id])}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="flex items-center justify-between">
                            <button onClick={() => pickMonth(shiftMonth(month, -1))} aria-label="Vorheriger Monat" className="flex size-10 items-center justify-center rounded-full border border-line bg-card">
                                <ChevronLeft size={18} />
                            </button>
                            <p className="font-medium">{monthLabel(month)}</p>
                            <button
                                onClick={() => pickMonth(shiftMonth(month, 1))}
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

                        {transactions.length > 0 && <MonthChart transactions={transactions} month={month} onSelect={pickMonth} />}

                        <CategoryBars transactions={inMonth} active={category} onSelect={setCategory} />

                        <TransactionList
                            transactions={listed}
                            accounts={accounts}
                            filter={category}
                            onClearFilter={() => setCategory(null)}
                            onOpen={setTxSheet}
                        />
                    </>
                )}
            </main>

            {data && accounts.length > 0 && (
                <button
                    onClick={() => setTxSheet('new')}
                    aria-label="Umsatz hinzufügen"
                    className="fixed right-4 z-10 flex size-16 items-center justify-center rounded-full bg-ink text-paper shadow-lg shadow-black/20 active:scale-95 sm:right-[max(1rem,calc(50%-20rem))]"
                    style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                >
                    <Plus size={28} />
                </button>
            )}

            {txSheet && (
                <TransactionSheet
                    transaction={txSheet === 'new' ? null : txSheet}
                    accounts={accounts}
                    lastAccountId={lastAccountId}
                    counterparties={counterparties}
                    memory={memory}
                    optionsFor={(kind) => options[kind]}
                    onSave={saveTransaction}
                    onDelete={deleteTransaction}
                    onClose={() => setTxSheet(null)}
                />
            )}

            {accountSheet && (
                <AccountsSheet
                    accounts={accounts}
                    balances={balances}
                    startWithNew={accountSheet === 'new'}
                    onSave={saveAccount}
                    onDelete={deleteAccount}
                    onLogout={onLogout}
                    onClose={() => setAccountSheet(null)}
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
