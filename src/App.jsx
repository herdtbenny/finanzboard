import { useCallback, useEffect, useState } from 'react';
import { api, loadToken, saveToken, Unauthorized } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';

// Signs in, then loads who is signed in and opens their data.
export default function App() {
    const [token, setToken] = useState(loadToken);
    const [me, setMe] = useState(null);
    const [error, setError] = useState('');

    const login = (t) => { saveToken(t); setToken(t); };
    const logout = useCallback(() => { saveToken(''); setToken(''); setMe(null); }, []);

    const loadMe = useCallback(() => api('me', token).then(setMe), [token]);

    useEffect(() => {
        if (!token) return;
        loadMe().catch((e) => (e instanceof Unauthorized ? logout() : setError(e.message)));
    }, [token, loadMe, logout]);

    if (!token) return <Login onLogin={login} />;
    if (error) return <p className="p-6 text-sm text-expense">{error}</p>;
    if (!me) return <p className="py-24 text-center text-muted">Lade …</p>;

    return <Dashboard token={token} me={me} onMeChanged={loadMe} onLogout={logout} />;
}
