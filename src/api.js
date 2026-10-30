const KEY = 'finanzboard-token';
const LOCK = 'finanzboard-faceid';
const SPACE = 'finanzboard-space';

// Without the Face ID lock the token stays in localStorage, so the phone stays
// logged in. With it, the token only lives in sessionStorage: closing the app
// locks it, and opening asks for Face ID again.
export function lockEnabled() {
    try { return localStorage.getItem(LOCK) === '1'; } catch { return false; }
}

export function loadToken() {
    try { return (lockEnabled() ? sessionStorage : localStorage).getItem(KEY) || ''; } catch { return ''; }
}

export function saveToken(token) {
    try {
        localStorage.removeItem(KEY);
        sessionStorage.removeItem(KEY);
        if (token) (lockEnabled() ? sessionStorage : localStorage).setItem(KEY, token);
    } catch { /* private mode */ }
}

export function setLock(on, token) {
    try { on ? localStorage.setItem(LOCK, '1') : localStorage.removeItem(LOCK); } catch { /* private mode */ }
    saveToken(token);
}

// The Haushalt last opened on this device.
export function loadSpace() {
    try { return localStorage.getItem(SPACE) || ''; } catch { return ''; }
}

export function saveSpace(id) {
    try { localStorage.setItem(SPACE, id); } catch { /* private mode */ }
}

export class Unauthorized extends Error {}

// `space` picks the Haushalt the request works on (X-Space header).
export async function api(path, token, { method = 'GET', body, space } = {}) {
    const res = await fetch(`/api/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(space ? { 'X-Space': space } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('login') && !path.startsWith('passkey')) throw new Unauthorized();
    if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
    return data;
}
