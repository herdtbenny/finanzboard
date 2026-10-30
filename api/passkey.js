import crypto from 'node:crypto';
import {
    generateAuthenticationOptions, generateRegistrationOptions,
    verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { getSupabase, isAuthorized } from './_lib.js';

// Face ID / Touch ID login via WebAuthn passkeys. POST ?step=…
//   register-options / register-verify — adds this device (needs a login)
//   login-options / login-verify       — answers with the session token
// The challenge travels to the browser and back inside a signed, 5-minute
// `state`, so nothing has to be stored between the two calls.

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (value) => crypto.createHmac('sha256', process.env.DASHBOARD_SESSION_SECRET || '').update(value).digest('base64url');

function makeState(challenge) {
    const payload = `${challenge}.${Date.now()}`;
    return `${payload}.${sign(payload)}`;
}

function readState(state) {
    const [challenge, ts, sig] = String(state || '').split('.');
    if (!challenge || sig !== sign(`${challenge}.${ts}`) || Date.now() - Number(ts) > 5 * 60 * 1000) return null;
    return challenge;
}

// The site the request was made on: the passkey is bound to it, so one set up
// on localhost only works on localhost.
function site(req) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https');
    return { rpID: host.split(':')[0], origin: `${proto}://${host}` };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const client = getSupabase();
    if (!client || !process.env.DASHBOARD_SESSION_SECRET) return res.status(500).json({ error: 'Nicht konfiguriert' });

    const { step } = req.query;
    const { rpID, origin } = site(req);
    const { data: keys, error } = await client.from('passkeys').select('*');
    if (error) return res.status(500).json({ error: error.message });

    try {
        if (step === 'register-options' || step === 'register-verify') {
            if (!isAuthorized(req)) return res.status(401).json({ error: 'Nicht angemeldet' });

            if (step === 'register-options') {
                const options = await generateRegistrationOptions({
                    rpName: 'Finanzen',
                    rpID,
                    userName: 'Finanzen',
                    userID: new TextEncoder().encode('finanzboard-owner'),
                    attestationType: 'none',
                    excludeCredentials: keys.map((k) => ({ id: k.id, transports: k.transports?.split(',') })),
                    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
                });
                return res.status(200).json({ options, state: makeState(options.challenge) });
            }

            const challenge = readState(req.body.state);
            if (!challenge) return res.status(400).json({ error: 'Zeit abgelaufen, bitte nochmal' });
            const result = await verifyRegistrationResponse({
                response: req.body.response,
                expectedChallenge: challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: true,
            });
            if (!result.verified) return res.status(400).json({ error: 'Nicht bestätigt' });
            const { credential } = result.registrationInfo;
            const { error: insErr } = await client.from('passkeys').upsert({
                id: credential.id,
                public_key: b64(credential.publicKey),
                counter: credential.counter,
                transports: credential.transports?.join(',') || null,
            });
            if (insErr) throw insErr;
            return res.status(200).json({ ok: true });
        }

        if (step === 'login-options') {
            if (!keys.length) return res.status(404).json({ error: 'Face ID ist noch nicht eingerichtet' });
            const options = await generateAuthenticationOptions({
                rpID,
                allowCredentials: keys.map((k) => ({ id: k.id, transports: k.transports?.split(',') })),
                userVerification: 'required',
            });
            return res.status(200).json({ options, state: makeState(options.challenge) });
        }

        if (step === 'login-verify') {
            const challenge = readState(req.body.state);
            if (!challenge) return res.status(400).json({ error: 'Zeit abgelaufen, bitte nochmal' });
            const key = keys.find((k) => k.id === req.body.response?.id);
            if (!key) return res.status(401).json({ error: 'Dieses Gerät ist nicht eingerichtet' });
            const result = await verifyAuthenticationResponse({
                response: req.body.response,
                expectedChallenge: challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: true,
                credential: {
                    id: key.id,
                    publicKey: new Uint8Array(Buffer.from(key.public_key, 'base64url')),
                    counter: Number(key.counter),
                    transports: key.transports?.split(','),
                },
            });
            if (!result.verified) return res.status(401).json({ error: 'Nicht bestätigt' });
            await client.from('passkeys').update({ counter: result.authenticationInfo.newCounter }).eq('id', key.id);
            return res.status(200).json({ token: process.env.DASHBOARD_SESSION_SECRET });
        }

        res.status(400).json({ error: 'Unbekannter Schritt' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}
