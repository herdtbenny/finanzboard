import { useState } from 'react';
import { loadToken, saveToken } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
    const [token, setToken] = useState(loadToken);

    const login = (t) => { saveToken(t); setToken(t); };
    const logout = () => { saveToken(''); setToken(''); };

    return token ? <Dashboard token={token} onLogout={logout} /> : <Login onLogin={login} />;
}
