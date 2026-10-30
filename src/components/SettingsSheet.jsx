import { useEffect, useState } from 'react';
import { Landmark, LogOut, Search, X } from 'lucide-react';
import { api } from '../api.js';
import { relative } from '../shared/format.js';

// Bottom sheet: connected banks with their consent expiry, connecting a bank
// (search → bank login → back to /api/callback), last sync, logout.
export default function SettingsSheet({ token, data, guard, onClose, onLogout }) {
    const [query, setQuery] = useState('');
    const [banks, setBanks] = useState(null);
    const [connecting, setConnecting] = useState('');

    useEffect(() => {
        if (query.trim().length < 2) { setBanks(null); return; }
        const id = setTimeout(() => guard(async () => {
            setBanks(await api(`banks?q=${encodeURIComponent(query.trim())}`, token));
        }), 300);
        return () => clearTimeout(id);
    }, [query, token, guard]);

    async function connect(bank) {
        setConnecting(bank);
        await guard(async () => {
            const { url } = await api('connect', token, { method: 'POST', body: { bank } });
            window.location.href = url;
        });
        setConnecting('');
    }

    // Latest consent per bank.
    const sessions = Object.values(Object.fromEntries(
        [...(data?.sessions || [])].reverse().map((s) => [s.aspsp_name, s]),
    ));

    return (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="pb-safe max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-paper px-4 pt-3"
            >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Einstellungen</h2>
                    <button onClick={onClose} aria-label="Schließen" className="flex size-9 items-center justify-center rounded-full border border-line bg-card">
                        <X size={16} />
                    </button>
                </div>

                <h3 className="mb-2 text-sm font-medium text-muted">Verbundene Banken</h3>
                {!sessions.length && <p className="mb-4 text-sm text-muted">Noch keine.</p>}
                <ul className="mb-6 space-y-2">
                    {sessions.map((s) => {
                        const days = Math.ceil((new Date(s.valid_until) - Date.now()) / 86400000);
                        return (
                            <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{s.aspsp_name}</p>
                                    <p className={`text-xs ${days <= 14 ? 'text-expense' : 'text-muted'}`}>
                                        {days > 0 ? `Freigabe noch ${days} Tage gültig` : 'Freigabe abgelaufen'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => connect(s.aspsp_name)}
                                    disabled={Boolean(connecting)}
                                    className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
                                >
                                    {connecting === s.aspsp_name ? '…' : 'Erneuern'}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                <h3 className="mb-2 text-sm font-medium text-muted">Bank verbinden</h3>
                <label className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5">
                    <Search size={16} className="text-muted" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="z. B. VR Bank, Volksbank …"
                        className="w-full bg-transparent text-base outline-none"
                    />
                </label>
                {banks && (
                    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                        {!banks.length && <li className="px-4 py-3 text-sm text-muted">Keine Bank gefunden</li>}
                        {banks.map((b) => (
                            <li key={b.name}>
                                <button
                                    onClick={() => connect(b.name)}
                                    disabled={Boolean(connecting)}
                                    className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left disabled:opacity-40"
                                >
                                    {b.logo
                                        ? <img src={b.logo} alt="" className="size-6 shrink-0 rounded-full object-contain" />
                                        : <Landmark size={20} className="shrink-0 text-muted" />}
                                    <span className="text-sm">{connecting === b.name ? 'Weiterleiten …' : b.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-2 text-xs text-muted">
                    Du wirst zum Online-Banking deiner Bank weitergeleitet und bestätigst dort per TAN. Danach ruft die App die Umsätze täglich automatisch ab.
                </p>

                {data?.lastSync && (
                    <p className="mt-6 text-xs text-muted">
                        Letzter Abruf {relative(data.lastSync.at)}: {data.lastSync.ok ? '' : 'Fehler – '}{data.lastSync.message}
                    </p>
                )}

                <button onClick={onLogout} className="mt-6 mb-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-card py-3 text-sm font-medium">
                    <LogOut size={16} /> Abmelden
                </button>
            </div>
        </div>
    );
}
