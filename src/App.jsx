import { useCallback, useEffect, useState } from 'react';
import { api, loadSpace, loadToken, saveSpace, saveToken, Unauthorized } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';

// Signs in, then loads who is signed in and their Haushalte, and opens the
// one last used on this device.
export default function App() {
    const [token, setToken] = useState(loadToken);
    const [me, setMe] = useState(null);
    const [space, setSpace] = useState(loadSpace);
    const [error, setError] = useState('');

    const login = (t) => { saveToken(t); setToken(t); };
    const logout = useCallback(() => { saveToken(''); setToken(''); setMe(null); }, []);

    const loadMe = useCallback(() => api('me', token).then((m) => {
        setMe(m);
        setSpace((current) => (m.spaces.some((s) => s.id === current) ? current : m.spaces[0]?.id || ''));
    }), [token]);

    useEffect(() => {
        if (!token) return;
        loadMe().catch((e) => (e instanceof Unauthorized ? logout() : setError(e.message)));
    }, [token, loadMe, logout]);

    useEffect(() => { if (space) saveSpace(space); }, [space]);

    if (!token) return <Login onLogin={login} />;
    if (error) return <p className="p-6 text-sm text-expense">{error}</p>;
    if (!me) return <p className="py-24 text-center text-muted">Lade …</p>;
    if (!me.spaces.length) {
        return (
            <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-muted">Hallo {me.user.name}, du bist noch keinem Haushalt zugeordnet. Frag den Admin.</p>
                <button onClick={logout} className="rounded-full border border-line px-5 py-2.5 text-sm">Abmelden</button>
            </main>
        );
    }

    return <Dashboard key={space} token={token} me={me} space={space} onSpace={setSpace} onMeChanged={loadMe} onLogout={logout} />;
}
