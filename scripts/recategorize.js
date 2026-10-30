// One-off: moves a Haushalt's transactions to the new categories
// (src/shared/categories.js) and turns ETF purchases into transfers into a
// depot account. Dry run by default.
//
//   node scripts/recategorize.js <Haushalt>                 → shows what would change
//   node scripts/recategorize.js <Haushalt> --write [Depotname]   → writes (needs migration 004)
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { EXPENSE_CATEGORIES, ruleFor } from '../src/shared/categories.js';

const [spaceName, flag, depotName = 'TR Depot'] = process.argv.slice(2);
if (!spaceName) {
    console.error('Aufruf: node scripts/recategorize.js <Haushalt> [--write [Depotname]]');
    process.exit(1);
}
const write = flag === '--write';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }) => { if (error) throw error; return data; };

const space = must(await db.from('spaces').select('id').eq('name', spaceName).maybeSingle());
if (!space) throw new Error(`Haushalt „${spaceName}“ gibt es nicht`);

const rows = [];
for (let from = 0; ; from += 1000) {
    const page = must(await db.from('transactions').select('*').eq('space_id', space.id).range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) break;
}

const RENAME = {
    Gehalt: 'Gehalt & Jobs', Sprit: 'Mobilität', Gym: 'Sport & Freizeit', Aktivitäten: 'Sport & Freizeit',
    Miete: 'Wohnen', Drogerie: 'Drogerie & Gesundheit', Kleidung: 'Shopping', Urlaub: 'Urlaub', Geschenke: 'Geschenke',
};
const REFUND = ['zurück', 'rückzahlung', 'refund', 'storno', 'anteil', 'erstattung', 'bonus', 'gutschrift', 'zuschuss'];
const FAMILY = ['oma', 'opa', 'mama', 'papa', 'eltern', 'geburtstag', 'weihnacht', 'ostern', 'spritze', 'zuschuss', 'evelyne'];
const isExpense = (c) => EXPENSE_CATEGORIES.includes(c);
const hasAny = (text, words) => words.some((w) => text.includes(w));

function newCategory(t) {
    const name = `${t.counterparty || ''} ${t.purpose || ''}`.toLowerCase();
    const rule = ruleFor(name);
    const income = t.amount > 0;

    if (t.category === 'Gehalt' && rule === 'Verkäufe') return 'Verkäufe';
    if (RENAME[t.category]) return RENAME[t.category];
    if (t.category === 'Essen & Trinken') {
        return ['Lebensmittel', 'Drogerie & Gesundheit'].includes(rule) ? rule : 'Essen gehen';
    }
    if (t.category === 'Versicherungen') {
        if (name.includes('semester')) return 'Sonstiges';
        return ['Versicherungen', 'Mobilität', 'Sport & Freizeit', 'Wohnen'].includes(rule) ? rule : 'Abos & Verträge';
    }
    if (t.category === 'Trade Republic') return income ? 'Sonstiges' : 'Investieren';
    if (t.category === 'Taschengeld' && income) {
        if (name.includes('taschengeld') || /(^|[^a-zäöü])tasche([^a-zäöü]|$)/.test(name)) return 'Taschengeld';
        if (name.includes('zins')) return 'Sonstiges';
        if (rule === 'Verkäufe' || name.includes('vint')) return 'Verkäufe';
        if (hasAny(name, REFUND) && isExpense(rule)) return rule;
        if (hasAny(name, FAMILY)) return 'Taschengeld';
        return 'Sonstiges';
    }
    // Sonstiges, and the odd expense booked as Taschengeld.
    if (income) return hasAny(name, REFUND) && isExpense(rule) ? rule : 'Sonstiges';
    return isExpense(rule) ? rule : 'Sonstiges';
}

const changes = [];
const toDepot = [];
for (const t of rows) {
    if (['Umbuchung', 'Kontostand', 'Wertänderung'].includes(t.category) || t.transfer_id) continue;
    const next = newCategory(t);
    if (next === 'Investieren') toDepot.push(t);
    else if (next !== t.category) changes.push({ t, next });
}

// ---------- Summary ----------
const pairs = {};
for (const { t, next } of changes) {
    const key = `${t.category} → ${next}`;
    pairs[key] ||= { n: 0, names: {} };
    pairs[key].n++;
    const nm = (t.counterparty || '').toLowerCase();
    pairs[key].names[nm] = (pairs[key].names[nm] || 0) + 1;
}
console.log(`\n${rows.length} Umsätze im Haushalt „${spaceName}“\n`);
for (const [key, p] of Object.entries(pairs).sort((a, b) => b[1].n - a[1].n)) {
    const names = Object.entries(p.names).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => (c > 1 ? `${n}×${c}` : n)).join(', ');
    console.log(`${key.padEnd(46)} ${String(p.n).padStart(4)}  ${names}`);
}
const invested = toDepot.reduce((s, t) => s - Number(t.amount), 0);
console.log(`\nInvestieren: ${toDepot.length} Käufe (${invested.toFixed(2)} €) werden Umbuchungen ins Depot „${depotName}“`);

if (!write) {
    console.log('\nProbelauf, nichts geschrieben. Mit --write übernehmen.\n');
    process.exit(0);
}

// ---------- Write ----------
let depot = must(await db.from('accounts').select('id').eq('space_id', space.id).eq('name', depotName).maybeSingle());
if (!depot) {
    depot = { id: crypto.randomUUID() };
    must(await db.from('accounts').insert({ id: depot.id, space_id: space.id, name: depotName, kind: 'depot', opening_balance: 0, sort_order: 99 }));
}
for (let i = 0; i < changes.length; i += 200) {
    const batch = changes.slice(i, i + 200);
    await Promise.all(batch.map(({ t, next }) => db.from('transactions').update({ category: next }).eq('id', t.id).then(must)));
}
const halves = [];
for (const t of toDepot) {
    const tid = `inv-${t.id}`;
    halves.push({ ...t, category: 'Investieren', transfer_id: tid });
    halves.push({
        ...t, id: `${tid}-in`, account_id: depot.id, amount: -Number(t.amount),
        category: 'Investieren', transfer_id: tid, created_at: undefined,
    });
}
for (const h of halves) delete h.created_at;
if (halves.length) must(await db.from('transactions').upsert(halves));
console.log(`\nGeschrieben: ${changes.length} umsortiert, ${toDepot.length} Käufe ins Depot gebucht.\n`);
