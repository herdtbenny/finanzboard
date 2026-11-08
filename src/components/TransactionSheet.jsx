import { useState } from 'react';
import { ArrowDown, Clock, Repeat } from 'lucide-react';
import { categorize, FALLBACK, NEUTRAL_CATEGORIES } from '../shared/categories.js';
import { amountInput, newId, parseAmount, todayIso } from '../shared/format.js';
import { today } from '../shared/schedule.js';
import { REPEATS } from '../shared/repeat.js';
import Sheet, { DeleteButton, Field, inputClass, SaveButton } from './Sheet.jsx';
import { useReceiptScanner } from './ReceiptScanner.jsx';
import CategoryPicker from './CategoryPicker.jsx';
import { Switch } from './ui.jsx';

const KINDS = [['out', 'Ausgabe', 'bg-expense text-white'], ['in', 'Einnahme', 'bg-income text-white'], ['transfer', 'Umbuchung', 'bg-ink text-paper']];

// One form for everything that moves money:
//   entry      a transaction or merged transfer to edit (null = new)
//   recurring  a standing order to edit (or {} for a new one)
// A new entry with "Wiederholen" set becomes a standing order instead. Until a
// category is tapped it follows what was typed: the category used most for
// that name before, else the keyword rules.
// "Noch nicht bezahlt" (pending) keeps an entry out of the balance until it's
// marked as paid; a date ahead does the same until that day.
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
    const [pending, setPending] = useState(Boolean(entry?.pending));
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    const transfer = kind === 'transfer';
    const value = parseAmount(amount);
    // Only categories of the chosen direction; an existing entry keeps its own
    // (e.g. a friend's share booked under an expense category).
    const kindOptions = transfer ? [] : optionsFor(kind);
    const remembered = memory[counterparty.trim().toLowerCase()];
    const guess = kindOptions.includes(remembered) ? remembered : categorize({ counterparty, purpose }, kindOptions);
    const options = category && !kindOptions.includes(category) ? [...kindOptions, category] : kindOptions;
    const suggested = NEUTRAL_CATEGORIES.includes(guess) || !kindOptions.includes(guess) ? FALLBACK : guess;
    // A transfer into a depot account counts as investing.
    const investing = kind === 'transfer' && accounts.find((a) => a.id === toAccountId)?.kind === 'depot';
    const transferCategory = investing ? 'Investieren' : 'Umbuchung';
    const shownCategory = category || suggested;
    const valid = Number.isFinite(value) && value !== 0 && accountId && date && (!transfer || (toAccountId && toAccountId !== accountId));
    // Editing can't turn a transfer into a single booking or back.
    const kindLocked = (k) => editing && !isRecurring && (k === 'transfer') !== (initialKind === 'transfer');
    // The date row: repeat only for new entries and standing orders; the paid
    // switch is narrow, a repeat's end date as wide as the others.
    const showRepeat = isRecurring || !editing;
    const rowCols = repeat ? 'grid-cols-3' : showRepeat ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-[1fr_auto]';
    const compactInput = 'w-full min-w-0 rounded-2xl border border-line bg-card px-3 py-3 text-[15px] outline-none focus:border-ink';
    const title = isRecurring ? (editing ? 'Dauerauftrag' : 'Neuer Dauerauftrag') : editing ? 'Bearbeiten' : 'Neu';

    // A read receipt fills what it found; the category then follows the shop.
    function applyReceipt(r) {
        setKind('out');
        if (r.amount != null) setAmount(amountInput(r.amount));
        if (r.shop) setCounterparty(r.shop);
        if (r.date) setDate(r.date);
        setCategory(null);
    }

    const scanner = useReceiptScanner({ known: counterparties, onResult: applyReceipt });
    const canScan = !editing && !isRecurring;

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
            const shared = { booking_date: date, pending, counterparty: counterparty || (investing ? 'Investieren' : 'Umbuchung'), purpose, category: transferCategory, transfer_id: tid, recurring_id: entry?.recurring_id || null };
            return run(() => onSaveTransactions([
                { ...shared, id: entry?.transfer?.from.id || `${tid}-out`, account_id: accountId, amount: -abs },
                { ...shared, id: entry?.transfer?.to.id || `${tid}-in`, account_id: toAccountId, amount: abs },
            ]));
        }

        return run(() => onSaveTransactions([{
            id: entry?.id || newId(),
            account_id: accountId,
            booking_date: date,
            pending,
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

    // `compact`: narrower padding and text, for the account next to the name.
    const accountSelect = (value, onChange, exclude, compact) => (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${compact ? compactInput : inputClass} min-h-12 appearance-none truncate`}>
            {accounts.filter((a) => a.id !== exclude).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
    );

    // Delete and save sit in the sheet's top bar, next to the receipt scanner
    // and the close button; save submits the form from outside it.
    const headerActions = (
        <>
            {canScan && scanner.button}
            {editing && (
                <DeleteButton
                    onClick={remove}
                    disabled={busy}
                    confirm={confirmDelete}
                    confirmText={isRecurring ? 'Beenden?' : 'Wirklich?'}
                    label={isRecurring ? 'Dauerauftrag beenden' : 'Löschen'}
                />
            )}
            <SaveButton form="transaction-form" disabled={!valid} busy={busy} />
        </>
    );

    return (
        <Sheet title={title} action={headerActions} onClose={onClose}>
            <form id="transaction-form" onSubmit={save} className="space-y-4 pb-4">
                {canScan && scanner.status}

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
                        {/* Who and which account side by side */}
                        <div className={`grid gap-2 ${accounts.length > 1 ? 'grid-cols-[3fr_2fr]' : ''}`}>
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
                            {accounts.length > 1 && <Field label="Konto">{accountSelect(accountId, setAccountId, null, true)}</Field>}
                        </div>

                        <div role="group" aria-label="Kategorie">
                            <CategoryPicker options={options} value={shownCategory} onPick={setCategory} />
                        </div>
                    </>
                )}

                {/* Date, repeat and paid in one row; with a repeat, its end takes the paid slot */}
                <div className={`grid gap-2 ${rowCols}`}>
                    <Field label={isRecurring || repeat ? 'Erste Ausführung' : 'Datum'}>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={compactInput} />
                    </Field>
                    {showRepeat && (
                        <Field label="Wiederholen">
                            <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className={`${compactInput} min-h-12 appearance-none`}>
                                {!isRecurring && <option value="">Nie</option>}
                                {REPEATS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                            </select>
                        </Field>
                    )}
                    {repeat ? (
                        <Field label="Ende">
                            <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className={compactInput} />
                        </Field>
                    ) : (
                        <Field label="Bezahlt" group>
                            <div className="flex h-12 items-center justify-center rounded-2xl border border-line bg-card px-3">
                                <Switch on={!pending} onChange={(paid) => setPending(!paid)} label="Bezahlt" />
                            </div>
                        </Field>
                    )}
                </div>
                {repeat && !isRecurring && (
                    <p className="-mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
                        <Repeat size={12} /> Wird als Dauerauftrag gespeichert und automatisch gebucht.
                    </p>
                )}
                {!repeat && pending && (
                    <p className="-mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
                        <Clock size={12} /> Noch nicht bezahlt: steht in den Umsätzen, zählt aber erst zum Kontostand, wenn du es als bezahlt markierst.
                    </p>
                )}
                {!repeat && !pending && date > today() && (
                    <p className="-mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
                        <Clock size={12} /> Liegt in der Zukunft: vorgemerkt, zählt ab dem {new Date(`${date}T00:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} zum Kontostand.
                    </p>
                )}
                {entry?.recurring_id && <p className="flex items-center gap-1.5 px-1 text-xs text-muted"><Repeat size={12} /> Von einem Dauerauftrag gebucht.</p>}

                <Field label={transfer ? 'Bezeichnung (optional)' : 'Notiz (optional)'}>
                    {transfer
                        ? <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="z. B. Sparen" className={inputClass} />
                        : <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Verwendungszweck" className={inputClass} />}
                </Field>

                {error && <p className="text-sm text-expense">{error}</p>}


            </form>
        </Sheet>
    );
}
