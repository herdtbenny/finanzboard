import crypto from 'node:crypto';
import { exactly, hashPassword, session } from './_lib.js';

// People, for admins only. Everyone has their own accounts and transactions.
// GET → { users }
// POST { action, … }:
//   createUser { name, password }
//   updateUser { id, name?, password? }   a new password signs them out everywhere
//   deleteUser { id }                      — with all their data
// Only admins pick user names; people can't change their own. New people are
// never admins (the first admin comes from scripts/setup-admin.js).
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;
    if (!s.user.is_admin) return res.status(403).json({ error: 'Nur für Admins' });
    const { client } = s;

    if (req.method === 'GET') {
        const { data, error } = await client.from('users').select('id,name,is_admin,created_at').order('created_at');
        return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ users: data });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const b = req.body || {};
    const fail = (msg, code = 400) => res.status(code).json({ error: msg });
    const nameTaken = async (name, exceptId) => {
        const { data } = await client.from('users').select('id').ilike('name', exactly(name.trim()));
        return (data || []).some((u) => u.id !== exceptId);
    };

    switch (b.action) {
        case 'createUser': {
            const name = String(b.name || '').trim();
            if (!name || String(b.password || '').length < 6) return fail('Name und mindestens 6 Zeichen Passwort');
            if (await nameTaken(name)) return fail('Name ist schon vergeben');
            const { error } = await client.from('users').insert({ id: crypto.randomUUID(), name, password_hash: hashPassword(b.password), is_admin: false });
            return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
        }
        case 'updateUser': {
            const { data: user } = await client.from('users').select('token_version').eq('id', b.id).maybeSingle();
            if (!user) return fail('Person nicht gefunden', 404);
            const patch = {};
            if (b.name != null) {
                if (!String(b.name).trim()) return fail('Name fehlt');
                if (await nameTaken(b.name, b.id)) return fail('Name ist schon vergeben');
                patch.name = String(b.name).trim();
            }
            if (b.password) {
                if (String(b.password).length < 6) return fail('Mindestens 6 Zeichen');
                patch.password_hash = hashPassword(b.password);
                patch.token_version = user.token_version + 1;
            }
            const { error } = await client.from('users').update(patch).eq('id', b.id);
            return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
        }
        case 'deleteUser': {
            if (b.id === s.userId) return fail('Du kannst dich nicht selbst löschen');
            const { error } = await client.from('users').delete().eq('id', b.id);
            return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
        }
        default:
            return fail('Unbekannte Aktion');
    }
}
