import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api.js';

const LAST_NAME = 'finanzboard-name';
const lastName = () => { try { return localStorage.getItem(LAST_NAME) || ''; } catch { return ''; } };
const rememberName = (n) => { try { localStorage.setItem(LAST_NAME, n.trim()); } catch { /* private mode */ } };

export default function Login({ onLogin, notice }) {
    // The name is always required; the last one used on this device is filled in.
    const [name, setName] = useState(lastName);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const { token } = await api('login', '', { method: 'POST', body: { name, password } });
            rememberName(name);
            onLogin(token);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="flex min-h-dvh items-center justify-center px-6">
            <div className="rise w-full max-w-xs space-y-4">
                <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-ink text-paper">
                    <Lock size={24} />
                </div>
                <h1 className="text-center text-2xl font-semibold tracking-tight">Finanzen</h1>

                <form onSubmit={submit} className="space-y-3">
                    <input
                        autoFocus={!name}
                        autoComplete="username"
                        autoCapitalize="none"
                        placeholder="Benutzername"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-full border border-line bg-card px-5 py-3.5 text-base outline-none focus:border-ink"
                    />
                    <input
                        type="password"
                        autoFocus={Boolean(name)}
                        autoComplete="current-password"
                        placeholder="Passwort"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-full border border-line bg-card px-5 py-3.5 text-base outline-none focus:border-ink"
                    />
                    <button disabled={busy || !name || !password} className="w-full rounded-full bg-ink py-3.5 font-medium text-paper disabled:opacity-40">
                        {busy ? 'Anmelden …' : 'Anmelden'}
                    </button>
                </form>
                {error && <p className="text-center text-sm text-expense">{error}</p>}
                {!error && notice && <p className="text-center text-xs text-muted">Abgemeldet – {notice}</p>}
            </div>
        </main>
    );
}
