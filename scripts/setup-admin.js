// One-off after migration 003: creates the first person (admin) and their
// Haushalt, and moves all data that has no Haushalt yet into it — the data
// from before there were several people. Safe to run again.
//
//   node scripts/setup-admin.js <name> <password> [haushalt-name]
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [name, password, spaceName = name] = process.argv.slice(2);
if (!name || !password || password.length < 6) {
    console.error('Aufruf: node scripts/setup-admin.js <name> <passwort (mind. 6 Zeichen)> [haushalt-name]');
    process.exit(1);
}

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }) => { if (error) throw error; return data; };

// Same format as api/_lib.js hashPassword().
const salt = crypto.randomBytes(16).toString('base64url');
const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('base64url')}`;

let user = must(await db.from('users').select('id').ilike('name', name).maybeSingle());
if (user) {
    must(await db.from('users').update({ password_hash: hash, is_admin: true }).eq('id', user.id));
} else {
    user = { id: crypto.randomUUID() };
    must(await db.from('users').insert({ id: user.id, name, password_hash: hash, is_admin: true }));
}

let space = must(await db.from('spaces').select('id').eq('name', spaceName).maybeSingle());
if (!space) {
    space = { id: crypto.randomUUID() };
    must(await db.from('spaces').insert({ id: space.id, name: spaceName }));
}
must(await db.from('memberships').upsert({ user_id: user.id, space_id: space.id }));

const moved = {};
for (const table of ['accounts', 'transactions', 'recurrings']) {
    const rows = must(await db.from(table).update({ space_id: space.id }).is('space_id', null).select('id'));
    moved[table] = rows.length;
}
moved.passkeys = must(await db.from('passkeys').update({ user_id: user.id }).is('user_id', null).select('id')).length;

console.log(`Admin „${name}“ im Haushalt „${spaceName}“. Übernommen:`, moved);
