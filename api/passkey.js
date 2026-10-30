import crypto from 'node:crypto';
import {
    generateAuthenticationOptions, generateRegistrationOptions,
    verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { getSupabase, makeToken, session } from './_lib.js';

// Face ID / Touch ID login via WebAuthn passkeys. POST ?step=…
//   register-options / register-verify — adds this device for the signed-in person
//   login-options / login-verify       — answers with that person's session token
// Logging in always takes the name: only that person's passkeys are offered,
// and the answer must come from one of them.
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

    try {
        if (step === 'register-options' || step === 'register-verify') {
            const s = await session(req, res);
            if (!s) return;
            const { data: keys } = await client.from('passkeys').select('id,transports').eq('user_id', s.user.id);

            if (step === 'register-options') {
                const options = await generateRegistrationOptions({
                    rpName: 'Finanzen',
                    rpID,
                    userName: s.user.name,
                    userID: new TextEncoder().encode(s.user.id),
                    attestationType: 'none',
                    excludeCredentials: (keys || []).map((k) => ({ id: k.id, transports: k.transports?.split(',') })),
                    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
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
                user_id: s.user.id,
                public_key: b64(credential.publicKey),
                counter: credential.counter,
                transports: credential.transports?.join(',') || null,
            });
            if (insErr) throw insErr;
            return res.status(200).json({ ok: true });
        }

        const findKeys = async () => {
            const { data: user } = await client.from('users').select('id').ilike('name', String(req.body?.name || '').trim()).maybeSingle();
            const { data } = user ? await client.from('passkeys').select('*').eq('user_id', user.id) : { data: [] };
            return data || [];
        };

        if (step === 'login-options') {
            const keys = await findKeys();
            // Same answer for unknown names and people without Face ID.
            if (!keys.length) return res.status(404).json({ error: 'Für diesen Namen ist Face ID nicht eingerichtet' });
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
            const key = (await findKeys()).find((k) => k.id === req.body.response?.id);
            if (!key) return res.status(401).json({ error: 'Face ID passt nicht zu diesem Namen' });
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
            return res.status(200).json({ token: makeToken(key.user_id) });
        }

        res.status(400).json({ error: 'Unbekannter Schritt' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}
