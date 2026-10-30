import { useState } from 'react';
import { Lock, ScanFace } from 'lucide-react';
import { api, lockEnabled } from '../api.js';
import { faceIdError, faceIdSupported, loginWithFaceId } from '../passkey.js';

export default function Login({ onLogin }) {
    const locked = lockEnabled();
    const faceId = faceIdSupported();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(!(locked && faceId));
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

    async function unlock() {
        setBusy(true);
        setError('');
        try {
            onLogin(await loginWithFaceId());
        } catch (err) {
            setError(faceIdError(err));
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

                {faceId && (
                    <button
                        onClick={unlock}
                        disabled={busy}
                        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-medium disabled:opacity-40 ${showPassword ? 'border border-line bg-card' : 'bg-ink text-paper'}`}
                    >
                        <ScanFace size={20} /> Mit Face ID entsperren
                    </button>
                )}

                {showPassword ? (
                    <form onSubmit={submit} className="space-y-3">
                        <input
                            type="password"
                            autoFocus={!faceId}
                            autoComplete="current-password"
                            placeholder="Passwort"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-full border border-line bg-card px-5 py-3.5 text-base outline-none focus:border-ink"
                        />
                        <button disabled={busy || !password} className="w-full rounded-full bg-ink py-3.5 font-medium text-paper disabled:opacity-40">
                            {busy ? 'Anmelden …' : 'Mit Passwort anmelden'}
                        </button>
                    </form>
                ) : (
                    <button onClick={() => setShowPassword(true)} className="w-full rounded-full py-2 text-sm text-muted">
                        Passwort verwenden
                    </button>
                )}
                {error && <p className="text-center text-sm text-expense">{error}</p>}
            </div>
        </main>
    );
}
