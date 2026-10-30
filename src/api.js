const KEY = 'finanzboard-token';

// The token is kept in localStorage so the phone stays logged in (unlike the
// websbybenny dashboard, which forgets it on reload).
export function loadToken() {
    try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function saveToken(token) {
    try { token ? localStorage.setItem(KEY, token) : localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export class Unauthorized extends Error {}

export async function api(path, token, { method = 'GET', body } = {}) {
    const res = await fetch(`/api/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== 'login') throw new Unauthorized();
    if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
    return data;
}
