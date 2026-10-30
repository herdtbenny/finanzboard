import { useState } from 'react';
import { ChevronRight, Download, LogOut, Plus, ScanFace, Trash2 } from 'lucide-react';
import { lockEnabled, setLock } from '../api.js';
import { faceIdError, faceIdSupported, registerFaceId } from '../passkey.js';
import { amountInput, money, newId, parseAmount } from '../shared/format.js';
import { exportCsv } from '../shared/exportCsv.js';
import Sheet, { Field, inputClass } from './Sheet.jsx';
import { Card, PageTitle } from './ui.jsx';
import People, { Profile } from './People.jsx';

export default function Accounts({ token, me, onMeChanged, accounts, balances, transactions, onSave, onDelete, onLogout }) {
    const [editing, setEditing] = useState(null);
    const counts = {};
    for (const t of transactions) counts[t.account_id] = (counts[t.account_id] || 0) + 1;
    const total = Object.values(balances).reduce((s, v) => s + v, 0);

    return (
        <div className="rise space-y-4">
            <PageTitle>Konten</PageTitle>

            <ul className="space-y-2">
                {accounts.map((a) => (
                    <li key={a.id}>
                        <button onClick={() => setEditing(a)} className="flex w-full items-center gap-3 rounded-[24px] border border-line bg-card px-5 py-4 text-left active:scale-[0.99] transition-transform">
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{a.name}</p>
                                <p className="text-xs text-muted">{counts[a.id] || 0} Umsätze</p>
                            </div>
                            <span className={`tabular font-semibold ${balances[a.id] < 0 ? 'text-expense' : ''}`}>{money(balances[a.id])}</span>
                            <ChevronRight size={16} className="text-muted" />
                        </button>
                    </li>
                ))}
            </ul>
            <div className="flex justify-between px-5 text-sm">
                <span className="text-muted">Gesamt</span>
                <span className="tabular font-semibold">{money(total)}</span>
            </div>

            <button onClick={() => setEditing({})} className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-medium text-paper">
                <Plus size={18} /> Konto hinzufügen
            </button>

            <Profile token={token} me={me} />
            <FaceId token={token} />
            {me.user.is_admin && <People token={token} me={me} onMeChanged={onMeChanged} />}

            <Card className="space-y-1 p-2">
                <button onClick={() => exportCsv(transactions, accounts)} className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium active:bg-ink/5">
                    <Download size={17} /> Alle Umsätze als CSV exportieren
                </button>
                <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium text-muted active:bg-ink/5">
                    <LogOut size={17} /> Abmelden
                </button>
            </Card>

            {editing && (
                <AccountSheet
                    account={editing}
                    count={accounts.length}
                    onSave={onSave}
                    onDelete={onDelete}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}

// Face ID / Touch ID: sets up a passkey for this device and turns on the
// lock, so opening the app asks for Face ID instead of staying logged in.
function FaceId({ token }) {
    const [on, setOn] = useState(lockEnabled);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    if (!faceIdSupported()) return null;

    async function enable() {
        setBusy(true);
        setMessage('');
        try {
            await registerFaceId(token);
            setLock(true, token);
            setOn(true);
            setMessage('Eingerichtet. Beim nächsten Öffnen entsperrst du mit Face ID.');
        } catch (e) {
            setMessage(faceIdError(e));
        }
        setBusy(false);
    }

    function disable() {
        setLock(false, token);
        setOn(false);
        setMessage('');
    }

    return (
        <Card className="p-2">
            <div className="flex items-center gap-3 px-3 py-2">
                <ScanFace size={20} className="shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Face ID</p>
                    <p className="text-xs text-muted">{on ? 'Beim Öffnen gesperrt' : 'Entsperren statt Passwort'}</p>
                </div>
                {on ? (
                    <button onClick={disable} className="rounded-full border border-line px-4 py-2 text-sm font-medium">Aus</button>
                ) : (
                    <button onClick={enable} disabled={busy} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-40">
                        {busy ? '…' : 'Einrichten'}
                    </button>
                )}
            </div>
            {message && <p className="px-3 pb-2 text-xs text-muted">{message}</p>}
        </Card>
    );
}

export function AccountSheet({ account, count, onSave, onDelete, onClose }) {
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
            onClose();
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
        <Sheet title={account.id ? 'Konto bearbeiten' : 'Neues Konto'} onClose={onClose}>
            <form onSubmit={save} className="space-y-4 pb-4">
                <Field label="Name">
                    <input autoFocus={!account.id} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. VR Giro" className={inputClass} />
                </Field>
                <Field label="Anfangssaldo">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setNegative(!negative)} aria-label="Vorzeichen wechseln" className="w-12 shrink-0 rounded-full border border-line bg-card text-lg font-semibold">
                            {negative ? '−' : '+'}
                        </button>
                        <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00" className={`${inputClass} tabular`} />
                    </div>
                    <span className="mt-1 block px-1 text-xs text-muted">Der Kontostand an dem Tag, ab dem du Umsätze einträgst.</span>
                </Field>

                {error && <p className="text-sm text-expense">{error}</p>}

                <div className="flex gap-2 pt-2">
                    {account.id && (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={busy}
                            className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-medium ${confirmDelete ? 'border-expense bg-expense text-white' : 'border-line bg-card text-expense'}`}
                        >
                            <Trash2 size={16} />{confirmDelete ? 'Mit allen Umsätzen löschen?' : ''}
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
