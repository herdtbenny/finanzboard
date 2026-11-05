// One-off import of a MoneyStats backup (.moneystats) into Supabase.
//
//   node scripts/import-moneystats.js import/Backup.moneystats "Person"          → dry run, shows a summary
//   node scripts/import-moneystats.js import/Backup.moneystats "Person" --write  → writes into that person's data
//
// Safe to run again: ids are derived from the records, so rows are updated,
// not duplicated. Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.
//
// Backup format: sections "????Name!!!!", records separated by "#", fields by
// ";". Used sections: Accounts (id, name, …, sort order at 4), Konten = the
// transactions (account 0, date 1, amount 2, set-balance value 3, title 5,
// group 8, note 9, standing order 10, transfer id 19), Groups = categories,
// Recurrings (id, start, end, unit m/w/y, every n). The two halves of a
// transfer share transfer id and date; a standing order's bookings point to
// it, the latest one before today serves as its template.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [file, userName, flag] = process.argv.slice(2);
if (!file || !userName) {
    console.error('Aufruf: node scripts/import-moneystats.js <datei.moneystats> <Person> [--write]');
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
    const transferId = !isBalance && r[19] !== '0' ? `ms-tr-${r[19]}-${date}` : null;
    seenIds[base] = (seenIds[base] || 0) + 1;
    transactions.push({
        id: `ms-${hash(`${base}|${seenIds[base]}`)}`,
        account_id: account.id,
        booking_date: date,
        amount,
        counterparty: isBalance ? 'Kontostand-Korrektur' : r[5].trim() || null,
        purpose: isBalance ? `Saldo auf ${Number(r[3]).toFixed(2).replace('.', ',')} € gesetzt` : r[9].trim() || null,
        category,
        transfer_id: transferId,
    });
}

// Only pairs that really are two halves (one minus, one plus) stay linked.
const halves = {};
for (const t of transactions) if (t.transfer_id) (halves[t.transfer_id] ||= []).push(t);
for (const pair of Object.values(halves)) {
    const ok = pair.length === 2 && pair[0].amount === -pair[1].amount;
    if (!ok) for (const t of pair) t.transfer_id = null;
}

// ---------- Standing orders still running ----------

const UNIT = { m: 'month', w: 'week', y: 'year' };
const recurrings = [];
const doneTransfers = new Set();
for (const rec of sections.Recurrings) {
    const [id, start, end, unit, every] = rec;
    if (end.slice(0, 10) <= today || !UNIT[unit]) continue;
    const past = records.map((x) => x.r).filter((r) => r[10] === id && r[1].slice(0, 10) <= today);
    if (!past.length) continue;
    const t = past[past.length - 1];
    const base = {
        id: `ms-rec-${id}`,
        amount: cents(Math.abs(Number(t[2]))),
        counterparty: t[5].trim() || null,
        purpose: t[9].trim() || null,
        interval: UNIT[unit],
        every: Number(every) || 1,
        start_date: start.slice(0, 10),
        end_date: end.slice(0, 10),
        last_date: t[1].slice(0, 10),
    };
    if (t[19] !== '0') {
        // Both halves have their own standing order in MoneyStats; one is enough.
        if (doneTransfers.has(t[19])) continue;
        doneTransfers.add(t[19]);
        const tr = sections.Transfers.find((x) => x[0] === t[19]);
        const negative = Number(t[2]) < 0;
        const other = tr && (tr[1] === t[0] ? tr[2] : tr[1]);
        recurrings.push({ ...base, kind: 'transfer', category: 'Umbuchung', account_id: `ms-${negative ? t[0] : other}`, to_account_id: `ms-${negative ? other : t[0]}` });
    } else {
        recurrings.push({ ...base, kind: Number(t[2]) < 0 ? 'out' : 'in', category: groups[t[8]] || 'Sonstiges', account_id: `ms-${t[0]}`, to_account_id: null });
    }
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
console.log(`\n${transactions.length} Umsätze werden übernommen (${new Set(transactions.map((t) => t.transfer_id).filter(Boolean)).size} Umbuchungen verknüpft), ${future} in der Zukunft geplante übersprungen.`);
console.log('\nDaueraufträge:');
for (const r of recurrings) console.log(`  ${(r.counterparty || '').padEnd(14)} ${r.kind.padEnd(8)} ${fmt(r.amount).padStart(10)}  alle ${r.every} ${r.interval}  zuletzt ${r.last_date}  bis ${r.end_date}`);

if (!write) {
    console.log('\nProbelauf, nichts geschrieben. Mit --write übernehmen.\n');
    process.exit(0);
}

// ---------- Write ----------

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: owner } = await db.from('users').select('id').ilike('name', userName).maybeSingle();
if (!owner) throw new Error(`Person „${userName}“ gibt es nicht`);
for (const row of [...accounts, ...transactions, ...recurrings]) row.user_id = owner.id;

const { error: accErr } = await db.from('accounts').upsert(accounts);
if (accErr) throw accErr;
for (let i = 0; i < transactions.length; i += 500) {
    const { error } = await db.from('transactions').upsert(transactions.slice(i, i + 500));
    if (error) throw error;
}
const { error: recErr } = await db.from('recurrings').upsert(recurrings);
if (recErr) throw recErr;
console.log(`\nGeschrieben: ${accounts.length} Konten, ${transactions.length} Umsätze, ${recurrings.length} Daueraufträge.\n`);
