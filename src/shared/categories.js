// Default categories for every Haushalt (each can add its own, see below). The form lists them sorted by how
// often each was used; categories found in the data but missing here show up
// there too.
export const EXPENSE_CATEGORIES = [
    'Lebensmittel', 'Essen gehen', 'Mobilität', 'Wohnen', 'Abos & Verträge', 'Versicherungen',
    'Shopping', 'Drogerie & Gesundheit', 'Sport & Freizeit', 'Urlaub', 'Geschenke', 'Sonstiges',
];
export const INCOME_CATEGORIES = ['Gehalt & Jobs', 'Taschengeld', 'Verkäufe', 'Sonstiges'];

// The Haushalt's own categories ({ id, name, kind: 'out' | 'in', icon }),
// set once the data is loaded; everything below takes them into account.
let custom = [];
export function setCustomCategories(list) { custom = list || []; }
export const customCategories = () => custom;
const ownOf = (kind) => custom.filter((c) => c.kind === kind).map((c) => c.name);
export const expenseCategories = () => [...EXPENSE_CATEGORIES.slice(0, -1), ...ownOf('out'), 'Sonstiges'];
export const incomeCategories = () => [...INCOME_CATEGORIES.slice(0, -1), ...ownOf('in'), 'Sonstiges'];

// Neither income nor expense: money moved between own accounts (Investieren
// is a transfer into a depot), corrections that set an account to a known
// balance, and the change in a depot's value.
export const NEUTRAL_CATEGORIES = ['Umbuchung', 'Investieren', 'Kontostand', 'Wertänderung'];
export const isNeutral = (t) => NEUTRAL_CATEGORIES.includes(t.category);

// Money coming back in an expense category (a refund, a friend paying their
// share) lowers that category's spending instead of counting as income.
export const isRefund = (t) => t.amount > 0 && !incomeCategories().includes(t.category) && !isNeutral(t);

// Keyword rules for names never used before, matched against counterparty +
// purpose (case-insensitive; keywords up to 3 letters only as whole words).
// First match wins. Also used by scripts/recategorize.js.
export const CATEGORY_RULES = [
    { name: 'Umbuchung', match: ['umbuchung'] },
    { name: 'Investieren', match: ['sparplan', 'etf', 'msci', 'nasdaq', 's&p'] },
    { name: 'Gehalt & Jobs', match: ['gehalt', 'lohn', 'aushilf', 'minijob'] },
    { name: 'Taschengeld', match: ['taschengeld', 'oma', 'opa', 'mama', 'papa', 'eltern', 'geburtstag', 'finanzspritze'] },
    { name: 'Verkäufe', match: ['vinted', 'kleinanzeigen', 'verkauft'] },
    { name: 'Versicherungen', match: ['versicherung', 'kv', 'sbk', 'aok', 'haftpflicht', 'krankenkasse'] },
    { name: 'Abos & Verträge', match: ['icloud', 'freenet', 'klarmobil', 'handyvertrag', 'claude', 'chatgpt', 'spotify', 'netflix', 'disney', 'prime', 'moneystats', 'namecheap', 'abo'] },
    { name: 'Mobilität', match: ['tank', 'sprit', 'aral', 'shell', 'esso', 'parken', 'parkhaus', 'blitzer', 'bolt', 'nextbike', 'scooter', 'eroller', 'deutschland ticket', 'dticket', 'd ticket', 'db', 'bahn', 'zug', 'zugticket', 'zugtickets', 'flixbus', 'maut', 'werkstatt', 'tüv', 'strafzettel'] },
    { name: 'Drogerie & Gesundheit', match: ['dm', 'rossmann', 'müller', 'apotheke', 'arzt', 'zahn', 'linsen', 'brille', 'impf', 'friseur', 'rasier', 'elmex', 'nasenspray', 'tabletten'] },
    { name: 'Lebensmittel', match: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'norma', 'globus', 'tegut', 'denns', 'alnatura', 'bäcker', 'bäckerei', 'metzger', 'supermarkt', 'einkauf', 'myprotein', 'protein', 'creatine', 'pettendorfladen'] },
    { name: 'Essen gehen', match: ['mcces', 'mcc', 'mcdonald', 'burger', 'bk', 'kfc', 'döner', 'pizza', 'sushi', 'restaurant', 'mensa', 'cafe', 'café', 'coffe', 'eis', 'pommes', 'lieferando', 'wolt', 'mealmates', 'dult', 'bar', 'kölsch', 'bier', 'biergarten', 'getränke', 'essen'] },
    { name: 'Wohnen', match: ['miete', 'kaution', 'nebenkosten', 'strom', 'wewash', 'blumenerde'] },
    { name: 'Sport & Freizeit', match: ['fitx', 'gym', 'mcfit', 'tbasv', 'tennis', 'paddle', 'padel', 'fussball', 'sauna', 'therme', 'westbad', 'kino', 'cinemaxx', 'konzert', 'ticket', 'billiard', 'bowling', 'tipico', 'eafc'] },
    { name: 'Urlaub', match: ['urlaub', 'flug', 'flüge', 'hotel', 'airbnb', 'unterkunft', 'unterkünfte', 'kurtaxe', 'thailand', 'chiang', 'doha', 'muy thai', 'wechselstube', '7/11', 'malta', 'prag', 'kroatien'] },
    { name: 'Geschenke', match: ['geschenk', 'blumen', 'gutschein'] },
    // Shopping: things you buy — clothes, tech, furniture, household goods.
    { name: 'Shopping', match: ['zara', 'bershka', 'h&m', 'hundm', 'primark', 'pull&bear', 'zalando', 'snipes', 'uniqlo', 'new yorker', 'deichmann', 'schuhe', 'kleidung', 'jacke', 'hose', 'shirt', 'pulli', 'amazon', 'media markt', 'mediamarkt', 'saturn', 'temu', 'action', 'euroshop', 'tkmaxx', 'apple', 'kabel', 'adapter', 'otto', 'ebay', 'ikea', 'bauhaus', 'obi', 'möbel', 'tisch', 'stuhl', 'lampe', 'airfryer', 'jysk', 'xxxlutz', 'poco'] },
];

export const FALLBACK = 'Sonstiges';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function matchesWord(text, word) {
    if (word.length > 3) return text.includes(word);
    return new RegExp(`(^|[^a-zäöüß])${escapeRe(word)}($|[^a-zäöüß])`).test(text);
}

// The first rule that matches, or null.
export function ruleFor(text) {
    const lower = String(text || '').toLowerCase();
    return CATEGORY_RULES.find((rule) => rule.match.some((word) => matchesWord(lower, word)))?.name || null;
}

export function categorize(t) {
    return ruleFor(`${t.counterparty || ''} ${t.purpose || ''}`) || FALLBACK;
}

export const categoryOf = (t) => t.category || categorize(t);

// Learns from history: for each counterparty, the category used most often.
export function categoryMemory(transactions) {
    const counts = {};
    for (const t of transactions) {
        const key = (t.counterparty || '').trim().toLowerCase();
        if (!key || isNeutral(t)) continue;
        counts[key] ??= {};
        counts[key][t.category] = (counts[key][t.category] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]]));
}

// Categories for the form: only those of that direction (expense or income,
// own ones included), most used first.
export function categoryOptions(transactions, kind) {
    const list = kind === 'out' ? expenseCategories() : incomeCategories();
    const usage = {};
    for (const t of transactions) {
        if (isNeutral(t) || (kind === 'out') !== (t.amount < 0)) continue;
        usage[t.category] = (usage[t.category] || 0) + 1;
    }
    return [...list].sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
}
