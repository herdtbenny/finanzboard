import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, KeyRound, Shield, Trash2, UserRound } from 'lucide-react';
import { api } from '../api.js';
import Sheet, { Field, inputClass } from './Sheet.jsx';
import { Card, CardHeader } from './ui.jsx';

// The signed-in person: name and their own password.
export function Profile({ token, me }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-sm active:bg-ink/5">
                <UserRound size={17} className="shrink-0" />
                <span className="flex-1 font-medium">{me.user.name}</span>
                <span className="text-xs text-muted">Passwort ändern</span>
                <ChevronRight size={15} className="text-muted" />
            </button>
            {open && <PasswordSheet token={token} onClose={() => setOpen(false)} />}
        </>
    );
}

function PasswordSheet({ token, onClose }) {
    const [current, setCurrent] = useState('');
    const [password, setPassword] = useState('');
    const [state, setState] = useState({ busy: false, error: '', done: false });

    async function save(e) {
        e.preventDefault();
        setState({ busy: true, error: '', done: false });
        try {
            await api('me', token, { method: 'POST', body: { current, password } });
            setState({ busy: false, error: '', done: true });
            setTimeout(onClose, 900);
        } catch (err) {
            setState({ busy: false, error: err.message, done: false });
        }
    }

    return (
        <Sheet title="Passwort ändern" onClose={onClose}>
            <form onSubmit={save} className="space-y-4 pb-4">
                <Field label="Aktuelles Passwort">
                    <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Neues Passwort (mind. 6 Zeichen)">
                    <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
                </Field>
                {state.error && <p className="text-sm text-expense">{state.error}</p>}
                <button disabled={state.busy || !current || password.length < 6} className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 font-medium text-paper disabled:opacity-40">
                    {state.done ? <><Check size={18} /> Geändert</> : state.busy ? 'Speichern …' : 'Speichern'}
                </button>
            </form>
        </Sheet>
    );
}

// Admin: the people who can sign in. Each has their own accounts and
// transactions; nobody sees anyone else's.
export default function People({ token, me, onMeChanged }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [person, setPerson] = useState(null);

    const load = useCallback(() => api('admin', token).then(setData).catch((e) => setError(e.message)), [token]);
    useEffect(() => { load(); }, [load]);

    async function act(body) {
        await api('admin', token, { method: 'POST', body });
        await load();
        await onMeChanged();
    }

    if (error) return <p className="text-sm text-expense">{error}</p>;
    if (!data) return null;

    return (
        <>
            <Card className="px-2 pb-2">
                <div className="px-3"><CardHeader title="Personen" action="Neu" onAction={() => setPerson({})} /></div>
                <ul>
                    {data.users.map((u) => (
                        <li key={u.id}>
                            <button onClick={() => setPerson(u)} className="flex w-full items-center gap-2.5 rounded-[18px] px-3 py-1.5 text-left active:bg-ink/5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.06]"><UserRound size={15} strokeWidth={1.8} /></span>
                                <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium">
                                    {u.name}{u.id === me.user.id && <span className="text-xs font-normal text-muted">(du)</span>}
                                </p>
                                {u.is_admin && <Shield size={15} className="shrink-0 text-muted" aria-label="Admin" />}
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="px-3 pt-1 pb-2 text-xs text-muted">Jede Person hat ihre eigenen Konten und Umsätze und sieht nur diese.</p>
            </Card>

            {person && <PersonSheet person={person} me={me} onAct={act} onClose={() => setPerson(null)} />}
        </>
    );
}

function useAction(onClose) {
    const [state, setState] = useState({ busy: false, error: '' });
    const run = async (fn) => {
        setState({ busy: true, error: '' });
        try {
            await fn();
            onClose();
        } catch (e) {
            setState({ busy: false, error: e.message });
        }
    };
    return [state, run];
}

function PersonSheet({ person, me, onAct, onClose }) {
    const isNew = !person.id;
    const [name, setName] = useState(person.name || '');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [state, run] = useAction(onClose);
    const self = person.id === me.user.id;

    function save(e) {
        e.preventDefault();
        run(() => onAct(isNew
            ? { action: 'createUser', name, password }
            : { action: 'updateUser', id: person.id, name, password: password || undefined }));
    }

    return (
        <Sheet title={isNew ? 'Neue Person' : person.name} onClose={onClose}>
            <form onSubmit={save} className="space-y-4 pb-4">
                <Field label="Benutzername (zum Anmelden)">
                    <input autoFocus={isNew} autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mama" className={inputClass} />
                </Field>
                <Field label={isNew ? 'Passwort (mind. 6 Zeichen)' : 'Neues Passwort (leer lassen = unverändert)'}>
                    <div className="relative">
                        <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`${inputClass} pr-11`} />
                        <KeyRound size={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" />
                    </div>
                </Field>

                {state.error && <p className="text-sm text-expense">{state.error}</p>}
                <div className="flex gap-2 pt-2">
                    {!isNew && !self && (
                        <button
                            type="button"
                            onClick={() => (confirm ? run(() => onAct({ action: 'deleteUser', id: person.id })) : setConfirm(true))}
                            className={`flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium ${confirm ? 'border-expense bg-expense text-white' : 'border-line bg-card text-expense'}`}
                        >
                            <Trash2 size={16} />{confirm ? 'Mit allen Daten löschen?' : ''}
                        </button>
                    )}
                    <button disabled={state.busy || !name.trim() || (isNew && password.length < 6)} className="flex-1 rounded-full bg-ink py-3 font-medium text-paper disabled:opacity-40">
                        {state.busy ? 'Speichern …' : 'Speichern'}
                    </button>
                </div>
            </form>
        </Sheet>
    );
}
