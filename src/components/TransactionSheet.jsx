import { useState } from 'react';
import { Trash2, Zap } from 'lucide-react';
import { categorize } from '../shared/categories.js';
import { amountInput, money, moneyShort, newId, parseAmount, todayIso } from '../shared/format.js';
import Sheet, { Field, inputClass } from './Sheet.jsx';

// Add or edit one transaction. Until a category is tapped, it follows what
// you typed: the category used most for that name before, else the keyword rules.
export default function TransactionSheet({ transaction, accounts, lastAccountId, counterparties, memory, optionsFor, templates = [], onSave, onDelete, onClose }) {
    const editing = Boolean(transaction);
    const [kind, setKind] = useState(transaction && transaction.amount > 0 ? 'in' : 'out');
    const [amount, setAmount] = useState(amountInput(transaction?.amount));
    const [counterparty, setCounterparty] = useState(transaction?.counterparty || '');
    const [purpose, setPurpose] = useState(transaction?.purpose || '');
    const [date, setDate] = useState(transaction?.booking_date || todayIso());
    const [accountId, setAccountId] = useState(transaction?.account_id || lastAccountId || accounts[0]?.id);
    const [category, setCategory] = useState(transaction?.category || null);
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    const value = parseAmount(amount);
    const signed = kind === 'out' ? -Math.abs(value) : Math.abs(value);
    const suggested = memory[counterparty.trim().toLowerCase()] || categorize({ counterparty, purpose });
    const shownCategory = category || suggested;
    const options = optionsFor(kind);
    const valid = Number.isFinite(value) && value !== 0 && accountId && date;

    function applyTemplate(t) {
        setKind(t.amount > 0 ? 'in' : 'out');
        setAmount(amountInput(t.amount));
        setCounterparty(t.counterparty);
        setCategory(t.category);
        if (accounts.some((a) => a.id === t.account_id)) setAccountId(t.account_id);
    }

    async function save(e) {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setError('');
        try {
            await onSave({
                id: transaction?.id || newId(),
                account_id: accountId,
                booking_date: date,
                amount: signed,
                counterparty,
                purpose,
                category: shownCategory,
            });
            onClose();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    async function remove() {
        if (!confirmDelete) return setConfirmDelete(true);
        setBusy(true);
        try {
            await onDelete(transaction.id);
            onClose();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <Sheet title={editing ? 'Umsatz bearbeiten' : 'Neuer Umsatz'} onClose={onClose}>
            <form onSubmit={save} className="space-y-4 pb-4">
                {!editing && templates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {templates.map((t) => (
                            <button
                                key={`${t.counterparty}|${t.amount}`}
                                type="button"
                                onClick={() => applyTemplate(t)}
                                className="flex items-center gap-1.5 rounded-full border border-line bg-card py-1.5 pr-3 pl-2.5 text-sm active:scale-95 transition-transform"
                            >
                                <Zap size={13} className="text-muted" />
                                {t.counterparty}
                                <span className={`tabular ${t.amount > 0 ? 'text-income' : 'text-muted'}`}>{Number.isInteger(t.amount) ? moneyShort(Math.abs(t.amount)) : money(Math.abs(t.amount))}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-2 rounded-full border border-line bg-card p-1">
                    {[['out', 'Ausgabe', 'bg-expense'], ['in', 'Einnahme', 'bg-income']].map(([k, label, bg]) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => { setKind(k); setCategory(null); }}
                            className={`rounded-full py-2 text-sm font-medium transition-colors ${kind === k ? `${bg} text-white` : 'text-muted'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-baseline justify-center gap-2 py-2">
                    <span className={`text-4xl font-semibold ${kind === 'out' ? 'text-expense' : 'text-income'}`}>{kind === 'out' ? '−' : '+'}</span>
                    <input
                        autoFocus={!editing}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                        style={{ width: `${Math.max(4, amount.length) + 0.5}ch` }}
                        className="tabular max-w-[70vw] bg-transparent text-center text-4xl font-semibold outline-none placeholder:text-line"
                    />
                    <span className="text-2xl text-muted">€</span>
                </div>

                <Field label={kind === 'out' ? 'Wo / an wen' : 'Von wem'}>
                    <input
                        list="counterparties"
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                        placeholder={kind === 'out' ? 'z. B. REWE' : 'z. B. Arbeitgeber'}
                        className={inputClass}
                    />
                    <datalist id="counterparties">
                        {counterparties.map((c) => <option key={c} value={c} />)}
                    </datalist>
                </Field>

                <Field label="Kategorie">
                    <div className="flex flex-wrap gap-2">
                        {options.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCategory(c)}
                                className={`rounded-full border px-3 py-1.5 text-sm ${shownCategory === c ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </Field>

                <div className={`grid gap-3 ${accounts.length > 1 ? 'grid-cols-2' : ''}`}>
                    <Field label="Datum">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} min-h-12`} />
                    </Field>
                    {accounts.length > 1 && (
                        <Field label="Konto">
                            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputClass} min-h-12 appearance-none`}>
                                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </Field>
                    )}
                </div>

                <Field label="Notiz (optional)">
                    <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Verwendungszweck" className={inputClass} />
                </Field>

                {error && <p className="text-sm text-expense">{error}</p>}

                <div className="flex gap-2 pt-2">
                    {editing && (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={busy}
                            className={`flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-medium ${confirmDelete ? 'border-expense bg-expense text-white' : 'border-line bg-card text-expense'}`}
                        >
                            <Trash2 size={16} />{confirmDelete ? 'Wirklich?' : ''}
                        </button>
                    )}
                    <button disabled={busy || !valid} className="flex-1 rounded-full bg-ink py-3 font-medium text-paper disabled:opacity-40">
                        {busy ? 'Speichern …' : 'Speichern'}
                    </button>
                </div>
            </form>
        </Sheet>
    );
}
