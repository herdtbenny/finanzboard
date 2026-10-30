import { useState } from 'react';
import { ChevronRight, LogOut, Plus, Trash2 } from 'lucide-react';
import { amountInput, money, newId, parseAmount } from '../shared/format.js';
import Sheet, { Field, inputClass } from './Sheet.jsx';

// Accounts with their opening balance, plus logout. Tapping an account (or
// "Konto hinzufügen") opens the edit form in the same sheet.
export default function AccountsSheet({ accounts, balances, startWithNew, onSave, onDelete, onLogout, onClose }) {
    const [editing, setEditing] = useState(startWithNew ? {} : null);

    if (editing) {
        return (
            <Sheet title={editing.id ? 'Konto bearbeiten' : 'Neues Konto'} onClose={onClose}>
                <AccountForm
                    account={editing}
                    count={accounts.length}
                    onSave={async (a) => { await onSave(a); startWithNew ? onClose() : setEditing(null); }}
                    onDelete={async (id) => { await onDelete(id); setEditing(null); }}
                    onCancel={() => (accounts.length ? setEditing(null) : onClose())}
                />
            </Sheet>
        );
    }

    return (
        <Sheet title="Konten" onClose={onClose}>
            <ul className="mb-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
                {accounts.map((a) => (
                    <li key={a.id}>
                        <button onClick={() => setEditing(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                            <span className="flex-1 truncate font-medium">{a.name}</span>
                            <span className="tabular text-sm">{money(balances[a.id])}</span>
                            <ChevronRight size={16} className="text-muted" />
                        </button>
                    </li>
                ))}
            </ul>
            <button onClick={() => setEditing({})} className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-card py-3 text-sm font-medium">
                <Plus size={16} /> Konto hinzufügen
            </button>
            <button onClick={onLogout} className="mt-6 mb-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm text-muted">
                <LogOut size={16} /> Abmelden
            </button>
        </Sheet>
    );
}

function AccountForm({ account, count, onSave, onDelete, onCancel }) {
    const [name, setName] = useState(account.name || '');
    const [opening, setOpening] = useState(account.id ? amountInput(account.opening_balance) : '');
    const [negative, setNegative] = useState(Number(account.opening_balance) < 0);
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    const value = opening.trim() ? parseAmount(opening) : 0;
    const valid = name.trim() && Number.isFinite(value);

    async function run(fn) {
        setBusy(true);
        setError('');
        try {
            await fn();
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    function save(e) {
        e.preventDefault();
        if (!valid) return;
        run(() => onSave({
            id: account.id || newId(),
            name,
            opening_balance: negative ? -Math.abs(value) : Math.abs(value),
            sort_order: account.id ? account.sort_order : count,
        }));
    }

    function remove() {
        if (!confirmDelete) return setConfirmDelete(true);
        run(() => onDelete(account.id));
    }

    return (
        <form onSubmit={save} className="space-y-4 pb-4">
            <Field label="Name">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Girokonto VR Bank" className={inputClass} />
            </Field>
            <Field label="Anfangssaldo">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setNegative(!negative)}
                        aria-label="Vorzeichen wechseln"
                        className="w-12 shrink-0 rounded-full border border-line bg-card text-lg font-semibold"
                    >
                        {negative ? '−' : '+'}
                    </button>
                    <input
                        inputMode="decimal"
                        value={opening}
                        onChange={(e) => setOpening(e.target.value.replace(/[^\d.,]/g, ''))}
                        placeholder="0,00"
                        className={`${inputClass} tabular`}
                    />
                </div>
                <span className="mt-1 block px-1 text-xs text-muted">
                    Der Kontostand an dem Tag, ab dem du Umsätze einträgst.
                </span>
            </Field>

            {error && <p className="text-sm text-expense">{error}</p>}

            <div className="flex gap-2 pt-2">
                {account.id ? (
                    <button
                        type="button"
                        onClick={remove}
                        disabled={busy}
                        className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-medium ${confirmDelete ? 'border-expense bg-expense text-white' : 'border-line bg-card text-expense'}`}
                    >
                        <Trash2 size={16} />{confirmDelete ? 'Mit allen Umsätzen löschen?' : ''}
                    </button>
                ) : (
                    <button type="button" onClick={onCancel} className="rounded-full border border-line bg-card px-5 py-3 text-sm font-medium">
                        Abbrechen
                    </button>
                )}
                <button disabled={busy || !valid} className="flex-1 rounded-full bg-ink py-3 font-medium text-paper disabled:opacity-40">
                    {busy ? 'Speichern …' : 'Speichern'}
                </button>
            </div>
        </form>
    );
}
