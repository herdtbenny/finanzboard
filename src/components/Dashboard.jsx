import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api, Unauthorized } from '../api.js';
import { categoryMemory, categoryOf, categoryOptions } from '../shared/categories.js';
import { monthKey } from '../shared/format.js';
import { balanceSeries, currentMonth, quickTemplates } from '../shared/insights.js';
import Overview from './Overview.jsx';
import Transactions from './Transactions.jsx';
import Analysis from './Analysis.jsx';
import Accounts, { AccountSheet } from './Accounts.jsx';
import TabBar from './TabBar.jsx';
import TransactionSheet from './TransactionSheet.jsx';

const byDateDesc = (a, b) => b.booking_date.localeCompare(a.booking_date) || String(b.created_at).localeCompare(String(a.created_at));

export default function Dashboard({ token, onLogout }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('overview');
    const [month, setMonth] = useState(currentMonth);
    const [category, setCategory] = useState(null);
    // null | 'new' | a transaction being edited
    const [txSheet, setTxSheet] = useState(null);
    const [newAccount, setNewAccount] = useState(false);
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

    const accounts = useMemo(() => data?.accounts || [], [data]);
    const transactions = useMemo(
        () => (data?.transactions || []).map((t) => ({ ...t, amount: Number(t.amount), category: categoryOf(t) })),
        [data],
    );
    const balances = useMemo(() => {
        const b = Object.fromEntries(accounts.map((a) => [a.id, Number(a.opening_balance)]));
        for (const t of transactions) if (t.account_id in b) b[t.account_id] += t.amount;
        return b;
    }, [accounts, transactions]);
    const series = useMemo(() => balanceSeries(accounts, transactions), [accounts, transactions]);

    // For the form: autocomplete names (most used first), the category last
    // used per name, category chips per direction and one-tap templates.
    const counterparties = useMemo(() => {
        const n = {};
        for (const t of transactions) if (t.counterparty) n[t.counterparty] = (n[t.counterparty] || 0) + 1;
        return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 300);
    }, [transactions]);
    const memory = useMemo(() => categoryMemory(transactions), [transactions]);
    const options = useMemo(() => ({ in: categoryOptions(transactions, 'in'), out: categoryOptions(transactions, 'out') }), [transactions]);
    const templates = useMemo(() => quickTemplates(transactions), [transactions]);

    const pickMonth = (m) => { setMonth(m); setCategory(null); };
    const goTo = (t) => { setTab(t); window.scrollTo({ top: 0 }); };
    const openCategory = (c) => { setCategory(c); goTo('transactions'); };

    let content;
    if (error) {
        content = <p className="rounded-2xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>;
    } else if (!data) {
        content = <p className="py-24 text-center text-muted">Lade …</p>;
    } else if (!accounts.length) {
        content = (
            <div className="rise mt-16 space-y-4 text-center">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-ink text-paper"><Wallet size={26} /></span>
                <h1 className="text-2xl font-semibold tracking-tight">Willkommen</h1>
                <p className="text-muted">Leg zuerst ein Konto mit seinem aktuellen Kontostand an.</p>
                <button onClick={() => setNewAccount(true)} className="rounded-full bg-ink px-6 py-3 font-medium text-paper">Konto anlegen</button>
            </div>
        );
    } else if (tab === 'overview') {
        content = <Overview accounts={accounts} balances={balances} series={series} transactions={transactions} month={month} onMonth={pickMonth} onOpen={setTxSheet} goTo={goTo} />;
    } else if (tab === 'transactions') {
        content = <Transactions transactions={transactions} accounts={accounts} month={month} onMonth={pickMonth} filter={category} onClearFilter={() => setCategory(null)} onOpen={setTxSheet} />;
    } else if (tab === 'analysis') {
        content = <Analysis transactions={transactions} month={month} onMonth={pickMonth} onCategory={openCategory} onOpen={setTxSheet} />;
    } else {
        content = <Accounts accounts={accounts} balances={balances} transactions={transactions} onSave={saveAccount} onDelete={deleteAccount} onLogout={onLogout} />;
    }

    const ready = data && accounts.length > 0;
    return (
        <div className={`mx-auto min-h-dvh max-w-2xl px-4 pt-safe ${ready ? 'pb-tabbar' : 'pb-safe'}`}>
            <main key={tab}>{content}</main>

            {ready && <TabBar tab={tab} onTab={goTo} onAdd={() => setTxSheet('new')} />}

            {txSheet && (
                <TransactionSheet
                    transaction={txSheet === 'new' ? null : txSheet}
                    accounts={accounts}
                    lastAccountId={lastAccountId}
                    counterparties={counterparties}
                    memory={memory}
                    optionsFor={(kind) => options[kind]}
                    templates={templates}
                    onSave={saveTransaction}
                    onDelete={deleteTransaction}
                    onClose={() => setTxSheet(null)}
                />
            )}

            {newAccount && <AccountSheet account={{}} count={0} onSave={saveAccount} onDelete={deleteAccount} onClose={() => setNewAccount(false)} />}
        </div>
    );
}
