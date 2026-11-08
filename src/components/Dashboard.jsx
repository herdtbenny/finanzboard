import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Unauthorized } from '../api.js';
import { categoryMemory, categoryOf, categoryOptions, setCustomCategories } from '../shared/categories.js';
import { monthKey } from '../shared/format.js';
import { balanceSeries, currentMonth } from '../shared/insights.js';
import { isBooked, today } from '../shared/schedule.js';
import Overview from './Overview.jsx';
import Transactions from './Transactions.jsx';
import Analysis from './Analysis.jsx';
import Accounts, { AccountSheet } from './Accounts.jsx';
import TabBar, { TABS } from './TabBar.jsx';
import TransactionSheet from './TransactionSheet.jsx';

const byDateDesc = (a, b) => b.booking_date.localeCompare(a.booking_date) || String(b.created_at).localeCompare(String(a.created_at));

export default function Dashboard({ token, me, onMeChanged, onLogout }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('overview');
    // Which side the next tab slides in from.
    const [slide, setSlide] = useState('');
    const [month, setMonth] = useState(currentMonth);
    const [category, setCategory] = useState(null);
    const [account, setAccount] = useState(null);
    // null | 'new' | a transaction (or merged transfer) being edited
    const [txSheet, setTxSheet] = useState(null);
    // null | {} for a new standing order | the one being edited
    const [recurringSheet, setRecurringSheet] = useState(null);
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

    const load = useCallback(() => call('data').then(setData), [call]);

    useEffect(() => {
        load().catch((e) => setError(e.message));
    }, [load]);

    // Every save answers with the stored rows, which replace the local copies —
    // no reload of the whole list.
    async function saveTransactions(rows) {
        const saved = await call('transactions', { method: 'POST', body: rows });
        const ids = new Set(saved.map((t) => t.id));
        if (!saved[0].transfer_id) setLastAccountId(saved[0].account_id);
        setData((d) => ({ ...d, transactions: [...d.transactions.filter((x) => !ids.has(x.id)), ...saved].sort(byDateDesc) }));
        setMonth(monthKey(saved[0].booking_date));
    }

    // { id } for one booking, { transfer_id } for both halves of a transfer.
    async function deleteTransaction({ id, transfer_id: transferId }) {
        await call(`transactions?${transferId ? `transfer_id=${encodeURIComponent(transferId)}` : `id=${encodeURIComponent(id)}`}`, { method: 'DELETE' });
        setData((d) => ({ ...d, transactions: d.transactions.filter((x) => (transferId ? x.transfer_id !== transferId : x.id !== id)) }));
    }

    // The server books what's due right away, so reload everything after.
    async function saveRecurring(r) {
        await call('recurrings', { method: 'POST', body: r });
        await load();
    }

    async function deleteRecurring(id) {
        await call(`recurrings?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        setData((d) => ({ ...d, recurrings: d.recurrings.filter((r) => r.id !== id) }));
    }

    async function saveAccount(a) {
        const saved = await call('accounts', { method: 'POST', body: a });
        setData((d) => {
            const exists = d.accounts.some((x) => x.id === saved.id);
            return { ...d, accounts: exists ? d.accounts.map((x) => (x.id === saved.id ? saved : x)) : [...d.accounts, saved] };
        });
    }

    // Renaming or deleting changes transactions too, so reload everything.
    async function saveCategory(c) {
        await call('categories', { method: 'POST', body: c });
        await load();
    }

    async function deleteCategory(id) {
        await call(`categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        await load();
    }

    async function deleteAccount(id) {
        await call(`accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        await load();
        if (account === id) setAccount(null);
    }

    // Own categories first: icons and chips depend on them.
    setCustomCategories(data?.categories);
    const accounts = useMemo(() => data?.accounts || [], [data]);
    const transactions = useMemo(
        () => (data?.transactions || []).map((t) => ({ ...t, amount: Number(t.amount), category: categoryOf(t) })),
        [data],
    );
    // Balances hold what is booked; vorgemerkt (not paid yet, or dated ahead)
    // is summed up per account on its own.
    const { balances, pending } = useMemo(() => {
        const now = today();
        const b = Object.fromEntries(accounts.map((a) => [a.id, Number(a.opening_balance)]));
        const p = Object.fromEntries(accounts.map((a) => [a.id, 0]));
        for (const t of transactions) {
            if (!(t.account_id in b)) continue;
            if (isBooked(t, now)) b[t.account_id] += t.amount;
            else p[t.account_id] += t.amount;
        }
        return { balances: b, pending: p };
    }, [accounts, transactions]);
    // The month switches go as far as the latest booking, which may be ahead.
    const lastMonth = useMemo(() => {
        const latest = transactions[0] ? monthKey(transactions[0].booking_date) : '';
        return latest > currentMonth() ? latest : currentMonth();
    }, [transactions]);
    const series = useMemo(() => balanceSeries(accounts, transactions), [accounts, transactions]);

    // For the form: autocomplete names (most used first), the category last
    // used per name and category chips per direction.
    const counterparties = useMemo(() => {
        const n = {};
        for (const t of transactions) if (t.counterparty) n[t.counterparty] = (n[t.counterparty] || 0) + 1;
        return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 300);
    }, [transactions]);
    const memory = useMemo(() => categoryMemory(transactions), [transactions]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const options = useMemo(() => ({ in: categoryOptions(transactions, 'in'), out: categoryOptions(transactions, 'out') }), [transactions, data?.categories]);

    const pickMonth = (m) => { setMonth(m); setCategory(null); };
    const goTo = (t) => {
        if (t === tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
        const col = (id) => TABS.findIndex((x) => x?.id === id);
        setSlide(col(t) > col(tab) ? 'from-right' : 'from-left');
        setTab(t);
        window.scrollTo({ top: 0 });
    };
    const openCategory = (c) => { setCategory(c); goTo('transactions'); };
    const openAccount = (id) => { setAccount(id); goTo('transactions'); };

    let content;
    if (error) {
        content = <p className="rounded-2xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>;
    } else if (!data) {
        content = <p className="py-24 text-center text-muted">Lade …</p>;
    } else if (tab === 'overview') {
        content = <Overview onNewAccount={() => setNewAccount(true)} accounts={accounts} balances={balances} series={series} transactions={transactions} month={month} maxMonth={lastMonth} onMonth={pickMonth} onOpen={setTxSheet} onAccount={openAccount} goTo={goTo} />;
    } else if (tab === 'transactions') {
        content = (
            <Transactions
                transactions={transactions} recurrings={data.recurrings || []} accounts={accounts} balances={balances} pending={pending} month={month} onMonth={pickMonth}
                filter={category} onClearFilter={() => setCategory(null)} account={account} onAccount={setAccount} onOpen={setTxSheet} onOpenRecurring={setRecurringSheet}
            />
        );
    } else if (tab === 'analysis') {
        content = (
            <Analysis
                transactions={transactions} accounts={accounts} recurrings={data.recurrings || []} month={month} maxMonth={lastMonth} onMonth={pickMonth}
                onCategory={openCategory} onOpen={setTxSheet} onOpenRecurring={setRecurringSheet}
            />
        );
    } else {
        content = (
            <Accounts
                token={token} me={me} onMeChanged={onMeChanged} accounts={accounts} balances={balances} transactions={transactions}
                categories={data.categories || []} onSave={saveAccount} onDelete={deleteAccount} onSaveTransactions={saveTransactions}
                onSaveCategory={saveCategory} onDeleteCategory={deleteCategory} onLogout={onLogout}
            />
        );
    }

    // Without an account there is nothing to book on yet: + creates one first.
    return (
        <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-safe pb-tabbar">
            <main key={tab} className={slide}>{content}</main>

            {data && <TabBar tab={tab} onTab={goTo} onAdd={() => (accounts.length ? setTxSheet('new') : setNewAccount(true))} />}

            {(txSheet || recurringSheet) && (
                <TransactionSheet
                    entry={txSheet && txSheet !== 'new' ? txSheet : null}
                    recurring={recurringSheet}
                    accounts={accounts}
                    lastAccountId={lastAccountId}
                    counterparties={counterparties}
                    memory={memory}
                    optionsFor={(kind) => options[kind]}
                    onSaveTransactions={saveTransactions}
                    onDeleteTransaction={deleteTransaction}
                    onSaveRecurring={saveRecurring}
                    onDeleteRecurring={deleteRecurring}
                    onClose={() => { setTxSheet(null); setRecurringSheet(null); }}
                />
            )}

            {newAccount && <AccountSheet account={{}} count={0} onSave={saveAccount} onDelete={deleteAccount} onClose={() => setNewAccount(false)} />}
        </div>
    );
}
