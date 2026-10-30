const KEY = 'finanzboard-token';
const SPACE = 'finanzboard-space';

// The session token stays in localStorage. It runs out after 7 days without
// use; every answer brings a renewed one (see api/_lib.js), which replaces it.
export function loadToken() {
    try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function saveToken(token) {
    try { token ? localStorage.setItem(KEY, token) : localStorage.removeItem(KEY); } catch { /* private mode */ }
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
    // The stored token is the freshest one; `token` is the fallback.
    if (token) token = loadToken() || token;
    const res = await fetch(`/api/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(space ? { 'X-Space': space } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const renewed = res.headers.get('X-Session-Token');
    if (renewed && token) saveToken(renewed);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('login')) throw new Unauthorized();
    if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
    return data;
}
