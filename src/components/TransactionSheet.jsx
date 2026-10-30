import { useState } from 'react';
import { ArrowDown, Repeat, Trash2 } from 'lucide-react';
import { categorize, FALLBACK, NEUTRAL_CATEGORIES } from '../shared/categories.js';
import { amountInput, newId, parseAmount, todayIso } from '../shared/format.js';
import { REPEATS } from '../shared/repeat.js';
import Sheet, { Field, inputClass } from './Sheet.jsx';
import ReceiptScanner from './ReceiptScanner.jsx';
import CategoryPicker from './CategoryPicker.jsx';

const KINDS = [['out', 'Ausgabe', 'bg-expense text-white'], ['in', 'Einnahme', 'bg-income text-white'], ['transfer', 'Umbuchung', 'bg-ink text-paper']];

// One form for everything that moves money:
//   entry      a transaction or merged transfer to edit (null = new)
//   recurring  a standing order to edit (or {} for a new one)
// A new entry with "Wiederholen" set becomes a standing order instead. Until a
// category is tapped it follows what was typed: the category used most for
// that name before, else the keyword rules.
export default function TransactionSheet({
    entry, recurring, accounts, lastAccountId, counterparties, memory, optionsFor,
    onSaveTransactions, onDeleteTransaction, onSaveRecurring, onDeleteRecurring, onClose,
}) {
    const isRecurring = Boolean(recurring);
    const editing = Boolean(entry || recurring?.id);
    const src = recurring || entry || {};
    const initialKind = recurring?.kind || (entry?.transfer ? 'transfer' : entry && entry.amount > 0 ? 'in' : 'out');

    const [kind, setKind] = useState(initialKind);
    const [amount, setAmount] = useState(amountInput(src.amount));
    const [counterparty, setCounterparty] = useState(entry?.transfer && ['Umbuchung', 'Investieren'].includes(src.counterparty) ? '' : src.counterparty || '');
    const [purpose, setPurpose] = useState(src.purpose || '');
    const [date, setDate] = useState(recurring?.start_date || entry?.booking_date || todayIso());
    const fallbackAccount = lastAccountId || accounts[0]?.id;
    const [accountId, setAccountId] = useState(entry?.transfer?.from.account_id || src.account_id || fallbackAccount);
    const [toAccountId, setToAccountId] = useState(entry?.transfer?.to.account_id || recurring?.to_account_id || accounts.find((a) => a.id !== (src.account_id || fallbackAccount))?.id);
    const [category, setCategory] = useState(src.category && !entry?.transfer ? src.category : null);
    const [repeat, setRepeat] = useState(recurring?.interval ? `${recurring.interval}:${recurring.every}` : isRecurring ? 'month:1' : '');
    const [endDate, setEndDate] = useState(recurring?.end_date || '');
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    const transfer = kind === 'transfer';
    const value = parseAmount(amount);
    const guess = memory[counterparty.trim().toLowerCase()] || categorize({ counterparty, purpose });
    const suggested = NEUTRAL_CATEGORIES.includes(guess) ? FALLBACK : guess;
    // A transfer into a depot account counts as investing.
    const investing = kind === 'transfer' && accounts.find((a) => a.id === toAccountId)?.kind === 'depot';
    const transferCategory = investing ? 'Investieren' : 'Umbuchung';
    const shownCategory = category || suggested;
    const valid = Number.isFinite(value) && value !== 0 && accountId && date && (!transfer || (toAccountId && toAccountId !== accountId));
    // Editing can't turn a transfer into a single booking or back.
    const kindLocked = (k) => editing && !isRecurring && (k === 'transfer') !== (initialKind === 'transfer');
    const title = isRecurring ? (editing ? 'Dauerauftrag' : 'Neuer Dauerauftrag') : editing ? 'Bearbeiten' : 'Neuer Eintrag';

    // A read receipt fills what it found; the category then follows the shop.
    function applyReceipt(r) {
        setKind('out');
        if (r.amount != null) setAmount(amountInput(r.amount));
        if (r.shop) setCounterparty(r.shop);
        if (r.date) setDate(r.date);
        setCategory(null);
    }

    async function run(fn) {
        setBusy(true);
        setError('');
        try {
            await fn();
            onClose();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    function save(e) {
        e.preventDefault();
        if (!valid) return;
        const abs = Math.abs(value);

        if (isRecurring || repeat) {
            const [interval, every] = (repeat || 'month:1').split(':');
            return run(() => onSaveRecurring({
                id: recurring?.id || newId(),
                kind,
                account_id: accountId,
                to_account_id: transfer ? toAccountId : null,
                amount: abs,
                counterparty,
                category: transfer ? transferCategory : shownCategory,
                purpose,
                interval,
                every: Number(every),
                start_date: date,
                end_date: endDate || null,
            }));
        }

        if (transfer) {
            const tid = entry?.transfer?.from.transfer_id || newId();
            const shared = { booking_date: date, counterparty: counterparty || (investing ? 'Investieren' : 'Umbuchung'), purpose, category: transferCategory, transfer_id: tid, recurring_id: entry?.recurring_id || null };
            return run(() => onSaveTransactions([
                { ...shared, id: entry?.transfer?.from.id || `${tid}-out`, account_id: accountId, amount: -abs },
                { ...shared, id: entry?.transfer?.to.id || `${tid}-in`, account_id: toAccountId, amount: abs },
            ]));
        }

        return run(() => onSaveTransactions([{
            id: entry?.id || newId(),
            account_id: accountId,
            booking_date: date,
            amount: kind === 'out' ? -abs : abs,
            counterparty,
            purpose,
            category: shownCategory,
            recurring_id: entry?.recurring_id || null,
        }]));
    }

    function remove() {
        if (!confirmDelete) return setConfirmDelete(true);
        if (isRecurring) return run(() => onDeleteRecurring(recurring.id));
        return run(() => onDeleteTransaction(entry.transfer ? { transfer_id: entry.transfer.from.transfer_id } : { id: entry.id }));
    }

    const accountSelect = (value, onChange, exclude) => (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} min-h-12 appearance-none`}>
            {accounts.filter((a) => a.id !== exclude).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
    );

    return (
        <Sheet title={title} onClose={onClose}>
            <form onSubmit={save} className="space-y-4 pb-4">
                {!editing && !isRecurring && <ReceiptScanner known={counterparties} onResult={applyReceipt} />}

                <div className="grid grid-cols-3 rounded-full border border-line bg-card p-1">
                    {KINDS.map(([k, label, active]) => (
                        <button
                            key={k}
                            type="button"
                            disabled={kindLocked(k)}
                            onClick={() => { setKind(k); setCategory(null); }}
                            className={`rounded-full py-2 text-sm font-medium transition-colors disabled:opacity-30 ${kind === k ? active : 'text-muted'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-baseline justify-center gap-2 py-2">
                    {!transfer && <span className={`text-4xl font-semibold ${kind === 'out' ? 'text-expense' : 'text-income'}`}>{kind === 'out' ? '−' : '+'}</span>}
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

                {transfer ? (
                    <div className="space-y-1">
                        <Field label="Von">{accountSelect(accountId, (v) => { setAccountId(v); if (v === toAccountId) setToAccountId(accounts.find((a) => a.id !== v)?.id); })}</Field>
                        <div className="flex justify-center"><ArrowDown size={18} className="text-muted" /></div>
                        <Field label="Nach">{accountSelect(toAccountId, setToAccountId, accountId)}</Field>
                        {accounts.length < 2 && <p className="px-1 text-xs text-expense">Für eine Umbuchung brauchst du mindestens zwei Konten.</p>}
                        {investing && <p className="px-1 text-xs text-muted">Zählt als Investieren, nicht als Ausgabe.</p>}
                    </div>
                ) : (
                    <>
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

                        <Field label="Kategorie" group>
                            <CategoryPicker
                                options={optionsFor(kind).filter((c) => !NEUTRAL_CATEGORIES.includes(c))}
                                value={shownCategory}
                                picked={Boolean(category)}
                                onPick={setCategory}
                            />
                        </Field>
                    </>
                )}

                <div className={`grid gap-3 ${!transfer && accounts.length > 1 ? 'grid-cols-2' : ''}`}>
                    <Field label={isRecurring || repeat ? 'Erste Ausführung' : 'Datum'}>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} min-h-12`} />
                    </Field>
                    {!transfer && accounts.length > 1 && <Field label="Konto">{accountSelect(accountId, setAccountId)}</Field>}
                </div>

                {(isRecurring || !editing) && (
                    <div className={`grid gap-3 ${repeat ? 'grid-cols-2' : ''}`}>
                        <Field label="Wiederholen">
                            <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className={`${inputClass} min-h-12 appearance-none`}>
                                {!isRecurring && <option value="">Nie</option>}
                                {REPEATS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                            </select>
                        </Field>
                        {repeat && (
                            <Field label="Ende (optional)">
                                <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} min-h-12`} />
                            </Field>
                        )}
                    </div>
                )}
                {repeat && !isRecurring && (
                    <p className="-mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
                        <Repeat size={12} /> Wird als Dauerauftrag gespeichert und automatisch gebucht.
                    </p>
                )}
                {entry?.recurring_id && <p className="flex items-center gap-1.5 px-1 text-xs text-muted"><Repeat size={12} /> Von einem Dauerauftrag gebucht.</p>}

                <Field label={transfer ? 'Bezeichnung (optional)' : 'Notiz (optional)'}>
                    {transfer
                        ? <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="z. B. Sparen" className={inputClass} />
                        : <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Verwendungszweck" className={inputClass} />}
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
                            <Trash2 size={16} />{confirmDelete ? (isRecurring ? 'Beenden?' : 'Wirklich?') : ''}
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
