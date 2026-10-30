import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api } from './api.js';

export const faceIdSupported = () => browserSupportsWebAuthn();

// Adds this device's Face ID / Touch ID as a login (needs a session).
export async function registerFaceId(token) {
    const { options, state } = await api('passkey?step=register-options', token, { method: 'POST' });
    const response = await startRegistration({ optionsJSON: options });
    await api('passkey?step=register-verify', token, { method: 'POST', body: { state, response } });
}

// Face ID instead of the password (the name is still needed); resolves to
// the session token.
export async function loginWithFaceId(name) {
    const { options, state } = await api('passkey?step=login-options', '', { method: 'POST', body: { name } });
    const response = await startAuthentication({ optionsJSON: options });
    const { token } = await api('passkey?step=login-verify', '', { method: 'POST', body: { name, state, response } });
    return token;
}

// The browser's own messages when the prompt is dismissed aren't helpful.
export function faceIdError(e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return 'Abgebrochen';
    return e?.message || 'Face ID hat nicht geklappt';
}
