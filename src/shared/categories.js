// The categories, taken over from the MoneyStats backup. The form lists them
// sorted by how often each was used; categories found in the data but missing
// here show up there too.
export const EXPENSE_CATEGORIES = [
    'Essen & Trinken', 'Sonstiges', 'Geschenke', 'Sprit', 'Kleidung', 'Trade Republic', 'Versicherungen',
    'Aktivitäten', 'Urlaub', 'Gym', 'Drogerie', 'Miete', 'Umbuchung',
];
export const INCOME_CATEGORIES = ['Taschengeld', 'Gehalt', 'Sonstiges', 'Umbuchung'];

// Neither income nor expense: money moved between own accounts, and the
// corrections that set an account to a known balance.
export const NEUTRAL_CATEGORIES = ['Umbuchung', 'Kontostand'];
export const isNeutral = (t) => NEUTRAL_CATEGORIES.includes(t.category);

// Keyword rules for names never used before, matched against counterparty +
// purpose (case-insensitive). First match wins.
export const CATEGORY_RULES = [
    { name: 'Umbuchung', match: ['umbuchung', 'sparen'] },
    { name: 'Gehalt', match: ['gehalt', 'lohn'] },
    { name: 'Taschengeld', match: ['taschengeld', 'zinsen'] },
    { name: 'Trade Republic', match: ['sparplan', 'etf', 'msci', 'nasdaq', 's&p'] },
    { name: 'Gym', match: ['fitx', 'gym', 'mcfit'] },
    { name: 'Sprit', match: ['tank', 'sprit', 'aral', 'shell', 'esso', 'parken', 'parkhaus'] },
    { name: 'Drogerie', match: ['dm', 'rossmann', 'müller', 'apotheke', 'kontaktlinsen'] },
    { name: 'Essen & Trinken', match: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'bäcker', 'döner', 'mcces', 'mcdonald', 'burger', 'pizza', 'lieferando', 'wolt', 'restaurant', 'café', 'cafe'] },
    { name: 'Kleidung', match: ['zara', 'bershka', 'h&m', 'hundm', 'primark', 'pull&bear', 'zalando', 'snipes'] },
    { name: 'Versicherungen', match: ['versicherung', 'icloud', 'klarmobil', 'handyvertrag', 'freenet', 'claude', 'spotify', 'netflix'] },
    { name: 'Geschenke', match: ['geschenk', 'blumen'] },
    { name: 'Urlaub', match: ['urlaub', 'flug', 'hotel', 'airbnb', 'kurtaxe'] },
    { name: 'Aktivitäten', match: ['tennis', 'paddle', 'sauna', 'kino', 'ticket', 'bowling'] },
    { name: 'Miete', match: ['miete', 'kaution'] },
];

export const FALLBACK = 'Sonstiges';

function matchesWord(text, word) {
    // Short keywords like "dm" only as a whole word, not inside "admin".
    if (word.length > 3) return text.includes(word);
    return new RegExp(`(^|[^a-zäöüß])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-zäöüß])`).test(text);
}

export function categorize(t) {
    const text = `${t.counterparty || ''} ${t.purpose || ''}`.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.match.some((word) => matchesWord(text, word))) return rule.name;
    }
    return FALLBACK;
}

export const categoryOf = (t) => t.category || categorize(t);

// Learns from history: for each counterparty, the category used most often.
export function categoryMemory(transactions) {
    const counts = {};
    for (const t of transactions) {
        const key = (t.counterparty || '').trim().toLowerCase();
        if (!key || t.category === 'Kontostand') continue;
        counts[key] ??= {};
        counts[key][t.category] = (counts[key][t.category] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]]));
}

// Categories for the form: the defaults plus any found in the data for that
// direction, most used first.
export function categoryOptions(transactions, kind) {
    const usage = {};
    for (const t of transactions) {
        if ((kind === 'out') !== (t.amount < 0) || t.category === 'Kontostand') continue;
        usage[t.category] = (usage[t.category] || 0) + 1;
    }
    const defaults = kind === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const all = [...new Set([...defaults, ...Object.keys(usage)])];
    return all.sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
}
