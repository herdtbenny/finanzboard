import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Home, Wallet } from 'lucide-react';
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

export default function Dashboard({ token, me, space, onSpace, onMeChanged, onLogout }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('overview');
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
            return await api(path, token, { ...opts, space });
        } catch (e) {
            if (e instanceof Unauthorized) onLogout();
            throw e;
        }
    }, [token, space, onLogout]);

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

    async function deleteAccount(id) {
        await call(`accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        await load();
        if (account === id) setAccount(null);
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
    const openAccount = (id) => { setAccount(id); goTo('transactions'); };

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
        content = <Overview accounts={accounts} balances={balances} series={series} transactions={transactions} month={month} onMonth={pickMonth} onOpen={setTxSheet} onAccount={openAccount} goTo={goTo} />;
    } else if (tab === 'transactions') {
        content = (
            <Transactions
                transactions={transactions} accounts={accounts} balances={balances} month={month} onMonth={pickMonth}
                filter={category} onClearFilter={() => setCategory(null)} account={account} onAccount={setAccount} onOpen={setTxSheet}
            />
        );
    } else if (tab === 'analysis') {
        content = <Analysis transactions={transactions} accounts={accounts} month={month} onMonth={pickMonth} onCategory={openCategory} onOpen={setTxSheet} />;
    } else {
        content = (
            <Accounts
                token={token} me={me} onMeChanged={onMeChanged} accounts={accounts} balances={balances} transactions={transactions} recurrings={data.recurrings || []}
                onSave={saveAccount} onDelete={deleteAccount} onOpenRecurring={setRecurringSheet} onLogout={onLogout}
            />
        );
    }

    const ready = data && accounts.length > 0;
    return (
        <div className={`mx-auto min-h-dvh max-w-2xl px-4 pt-safe ${ready ? 'pb-tabbar' : 'pb-safe'}`}>
            {me.spaces.length > 1 && <SpaceSwitch spaces={me.spaces} space={space} onSpace={onSpace} />}
            <main key={tab}>{content}</main>

            {ready && <TabBar tab={tab} onTab={goTo} onAdd={() => setTxSheet('new')} />}

            {(txSheet || recurringSheet) && (
                <TransactionSheet
                    entry={txSheet && txSheet !== 'new' ? txSheet : null}
                    recurring={recurringSheet}
                    accounts={accounts}
                    lastAccountId={lastAccountId}
                    counterparties={counterparties}
                    memory={memory}
                    optionsFor={(kind) => options[kind]}
                    templates={templates}
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

// Shown when the person belongs to several Haushalte.
function SpaceSwitch({ spaces, space, onSpace }) {
    return (
        <label className="relative mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-card py-2 pr-9 pl-3.5 text-sm font-medium">
            <Home size={15} className="shrink-0" />
            <select
                value={space}
                onChange={(e) => onSpace(e.target.value)}
                aria-label="Haushalt"
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            >
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {spaces.find((s) => s.id === space)?.name}
            <ChevronDown size={15} className="pointer-events-none absolute right-3" />
        </label>
    );
}
