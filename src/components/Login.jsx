import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const { token } = await api('login', '', { method: 'POST', body: { password } });
            onLogin(token);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-dvh flex items-center justify-center px-6">
            <form onSubmit={submit} className="w-full max-w-xs space-y-4">
                <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-ink text-paper">
                    <Lock size={22} />
                </div>
                <h1 className="text-center text-xl font-semibold">Finanzen</h1>
                <input
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Passwort"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-ink"
                />
                {error && <p className="text-sm text-expense">{error}</p>}
                <button
                    disabled={busy || !password}
                    className="w-full rounded-full bg-ink py-3 font-medium text-paper disabled:opacity-40"
                >
                    {busy ? 'Anmelden …' : 'Anmelden'}
                </button>
            </form>
        </main>
    );
}
