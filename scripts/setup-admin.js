// Creates the first person (admin), or makes an existing one admin with a new
// password (that signs them out everywhere). Safe to run again.
//
//   node scripts/setup-admin.js <name> <password>
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [name, password] = process.argv.slice(2);
if (!name || !password || password.length < 6) {
    console.error('Aufruf: node scripts/setup-admin.js <name> <passwort (mind. 6 Zeichen)>');
    process.exit(1);
}

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }) => { if (error) throw error; return data; };

// Same format as api/_lib.js hashPassword().
const salt = crypto.randomBytes(16).toString('base64url');
const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('base64url')}`;

let user = must(await db.from('users').select('id,token_version').ilike('name', name.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle());
if (user) {
    must(await db.from('users').update({ password_hash: hash, is_admin: true, token_version: user.token_version + 1 }).eq('id', user.id));
} else {
    user = { id: crypto.randomUUID() };
    must(await db.from('users').insert({ id: user.id, name, password_hash: hash, is_admin: true }));
}

console.log(`Admin „${name}“ ist angelegt.`);
