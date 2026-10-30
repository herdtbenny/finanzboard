import crypto from 'node:crypto';
import { hashPassword, session } from './_lib.js';

// People and Haushalte, for admins only.
// GET → { users, spaces } (each space with its member ids)
// POST { action, … }:
//   createUser { name, password, admin, ownSpace }   ownSpace: also create a Haushalt named after them
//   updateUser { id, name?, password?, admin? }
//   deleteUser { id }
//   saveSpace  { id?, name, members: [userId] }
//   deleteSpace { id }   — deletes the Haushalt with all its data
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;
    if (!s.user.is_admin) return res.status(403).json({ error: 'Nur für Admins' });
    const { client } = s;

    if (req.method === 'GET') {
        const [users, spaces, members] = await Promise.all([
            client.from('users').select('id,name,is_admin,created_at').order('created_at'),
            client.from('spaces').select('id,name').order('created_at'),
            client.from('memberships').select('user_id,space_id'),
        ]);
        return res.status(200).json({
            users: users.data || [],
            spaces: (spaces.data || []).map((sp) => ({ ...sp, members: (members.data || []).filter((m) => m.space_id === sp.id).map((m) => m.user_id) })),
        });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const b = req.body || {};
    const fail = (msg, code = 400) => res.status(code).json({ error: msg });
    const nameTaken = async (name, exceptId) => {
        const { data } = await client.from('users').select('id').ilike('name', name.trim());
        return (data || []).some((u) => u.id !== exceptId);
    };

    switch (b.action) {
        case 'createUser': {
            const name = String(b.name || '').trim();
            if (!name || String(b.password || '').length < 6) return fail('Name und mindestens 6 Zeichen Passwort');
            if (await nameTaken(name)) return fail('Name ist schon vergeben');
            const id = crypto.randomUUID();
            const { error } = await client.from('users').insert({ id, name, password_hash: hashPassword(b.password), is_admin: Boolean(b.admin) });
            if (error) return fail(error.message, 500);
            if (b.ownSpace) {
                const spaceId = crypto.randomUUID();
                await client.from('spaces').insert({ id: spaceId, name });
                await client.from('memberships').insert({ user_id: id, space_id: spaceId });
            }
            return res.status(200).json({ ok: true });
        }
        case 'updateUser': {
            const patch = {};
            if (b.name != null) {
                if (!String(b.name).trim()) return fail('Name fehlt');
                if (await nameTaken(b.name, b.id)) return fail('Name ist schon vergeben');
                patch.name = String(b.name).trim();
            }
            if (b.password) {
                if (String(b.password).length < 6) return fail('Mindestens 6 Zeichen');
                patch.password_hash = hashPassword(b.password);
            }
            if (b.admin != null) {
                if (b.id === s.user.id && !b.admin) return fail('Du kannst dir die Admin-Rechte nicht selbst nehmen');
                patch.is_admin = Boolean(b.admin);
            }
            const { error } = await client.from('users').update(patch).eq('id', b.id);
            return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
        }
        case 'deleteUser': {
            if (b.id === s.user.id) return fail('Du kannst dich nicht selbst löschen');
            const { error } = await client.from('users').delete().eq('id', b.id);
            return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
        }
        case 'saveSpace': {
            const name = String(b.name || '').trim();
            const members = Array.isArray(b.members) ? b.members : [];
            if (!name) return fail('Name fehlt');
            if (!members.length) return fail('Mindestens eine Person');
            const id = b.id || crypto.randomUUID();
            const { error } = await client.from('spaces').upsert({ id, name });
            if (error) return fail(error.message, 500);
            await client.from('memberships').delete().eq('space_id', id);
            await client.from('memberships').insert(members.map((user_id) => ({ user_id, space_id: id })));
            return res.status(200).json({ ok: true, id });
        }
        case 'deleteSpace': {
            const { error } = await client.from('spaces').delete().eq('id', b.id);
            return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
        }
        default:
            return fail('Unbekannte Aktion');
    }
}
