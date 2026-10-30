// One-off import of a MoneyStats backup (.moneystats) into Supabase.
//
//   node scripts/import-moneystats.js import/Backup.moneystats          → dry run, shows a summary
//   node scripts/import-moneystats.js import/Backup.moneystats --write  → writes
//
// Safe to run again: ids are derived from the records, so rows are updated,
// not duplicated. Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.
//
// Backup format: sections "????Name!!!!", records separated by "#", fields by
// ";". Used sections: Accounts (id, name, …, sort order at 4) and Konten =
// the transactions (account 0, date 1, amount 2, set-balance value 3,
// title 5, group 8, note 9, transfer id 19). Groups are the categories.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [file, flag] = process.argv.slice(2);
if (!file) {
    console.error('Aufruf: node scripts/import-moneystats.js <datei.moneystats> [--write]');
    process.exit(1);
}
const write = flag === '--write';

// Category names that read better than in MoneyStats.
const RENAME = { traderepublic: 'Trade Republic' };

const sections = {};
for (const part of fs.readFileSync(file, 'utf8').split('????')) {
    if (!part) continue;
    const [name, body = ''] = part.split('!!!!');
    sections[name] = body.split('#').filter(Boolean).map((r) => r.split(';'));
}

const groups = Object.fromEntries(sections.Groups.map((g) => [g[0], RENAME[g[1]] || g[1]]));
const today = new Date().toISOString().slice(0, 10);
const cents = (n) => Math.round(n * 100) / 100;
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 20);

// Records in time order (stable for equal timestamps). The timestamp carries
// its own offset, so Date parses it correctly.
const records = sections.Konten
    .map((r, i) => ({ r, i, at: new Date(r[1].replace(' ', 'T').replace(/ ([+-]\d\d)(\d\d)$/, '$1:$2')).getTime() }))
    .sort((a, b) => a.at - b.at || a.i - b.i);

const accounts = sections.Accounts.map((a) => ({
    id: `ms-${a[0]}`,
    name: a[1],
    opening_balance: 0,
    sort_order: Number(a[4]) || 0,
}));
const accountById = Object.fromEntries(accounts.map((a) => [a.id.slice(3), a]));

const running = Object.fromEntries(accounts.map((a) => [a.id, 0]));
const seenAny = new Set();
const seenIds = {};
const transactions = [];
let future = 0;

for (const { r } of records) {
    const account = accountById[r[0]];
    if (!account) continue;
    const date = r[1].slice(0, 10);
    if (date > today) { future++; continue; }

    const isBalance = r[5] === 'Kontostand' && Number(r[3]) !== 0;
    let amount;
    let category;
    if (isBalance) {
        const target = Number(r[3]);
        if (!seenAny.has(account.id)) {
            // First entry of the account: that's its opening balance.
            account.opening_balance = cents(target);
            running[account.id] = target;
            seenAny.add(account.id);
            continue;
        }
        amount = cents(target - running[account.id]);
        category = 'Kontostand';
        if (amount === 0) continue;
    } else {
        amount = cents(Number(r[2]));
        if (amount === 0) continue;
        category = r[19] !== '0' ? 'Umbuchung' : groups[r[8]] || 'Sonstiges';
    }
    seenAny.add(account.id);
    running[account.id] += amount;

    const base = `ms|${r[0]}|${r[1]}|${r[2]}|${r[3]}|${r[5]}|${r[12]}`;
    seenIds[base] = (seenIds[base] || 0) + 1;
    transactions.push({
        id: `ms-${hash(`${base}|${seenIds[base]}`)}`,
        account_id: account.id,
        booking_date: date,
        amount,
        counterparty: isBalance ? 'Kontostand-Korrektur' : r[5].trim() || null,
        purpose: isBalance ? `Saldo auf ${Number(r[3]).toFixed(2).replace('.', ',')} € gesetzt` : r[9].trim() || null,
        category,
    });
}

// ---------- Summary ----------

const fmt = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
console.log(`\nKonten (Saldo heute = Anfangssaldo + Umsätze bis ${today}):`);
for (const a of [...accounts].sort((x, y) => x.sort_order - y.sort_order)) {
    const n = transactions.filter((t) => t.account_id === a.id).length;
    console.log(`  ${a.name.padEnd(16)} Anfang ${fmt(a.opening_balance).padStart(12)}   ${String(n).padStart(4)} Umsätze   Saldo ${fmt(running[a.id]).padStart(12)}`);
}
console.log(`  ${'Gesamt'.padEnd(16)} ${' '.repeat(37)}Saldo ${fmt(Object.values(running).reduce((s, v) => s + v, 0)).padStart(12)}`);

const byCat = {};
for (const t of transactions) byCat[t.category] = (byCat[t.category] || 0) + 1;
console.log('\nKategorien:', Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', '));
console.log(`\n${transactions.length} Umsätze werden übernommen, ${future} in der Zukunft geplante übersprungen.`);

if (!write) {
    console.log('\nProbelauf, nichts geschrieben. Mit --write übernehmen.\n');
    process.exit(0);
}

// ---------- Write ----------

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { error: accErr } = await db.from('accounts').upsert(accounts);
if (accErr) throw accErr;
for (let i = 0; i < transactions.length; i += 500) {
    const { error } = await db.from('transactions').upsert(transactions.slice(i, i + 500));
    if (error) throw error;
}
console.log(`\nGeschrieben: ${accounts.length} Konten, ${transactions.length} Umsätze.\n`);
