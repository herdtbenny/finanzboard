// Keyword rules, matched against counterparty + purpose (case-insensitive).
// First match wins, so put the more specific rules first. They only suggest a
// category while typing; the one picked in the form is what gets saved.
export const CATEGORY_RULES = [
    { name: 'Umbuchung', match: ['umbuchung', 'übertrag', 'eigene überweisung'] },
    { name: 'Gehalt', match: ['gehalt', 'lohn', 'bezüge', 'salary'] },
    { name: 'Miete & Wohnen', match: ['miete', 'nebenkosten', 'hausverwaltung', 'stadtwerke', 'strom', 'gas ', 'rundfunk', 'ard zdf'] },
    { name: 'Lebensmittel', match: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'norma', 'tegut', 'globus', 'denns', 'alnatura', 'bäckerei', 'metzgerei'] },
    { name: 'Drogerie', match: ['dm-drogerie', 'dm drogerie', 'rossmann', 'müller'] },
    { name: 'Essen & Trinken', match: ['lieferando', 'wolt', 'restaurant', 'pizzeria', 'mcdonald', 'burger king', 'starbucks', 'café', 'cafe', 'bar '] },
    { name: 'Mobilität', match: ['aral', 'shell', 'esso', 'total', 'jet ', 'tankstelle', 'deutsche bahn', 'db vertrieb', 'flixbus', 'uber', 'bolt', 'parken', 'mvg', 'vgn', 'deutschlandticket'] },
    { name: 'Abos', match: ['netflix', 'spotify', 'disney', 'amazon prime', 'apple.com', 'google', 'youtube', 'adobe', 'chatgpt', 'openai', 'anthropic', 'icloud'] },
    { name: 'Versicherung', match: ['versicherung', 'allianz', 'huk', 'ergo', 'axa', 'debeka', 'krankenkasse', 'aok', 'tk ', 'barmer'] },
    { name: 'Handy & Internet', match: ['telekom', 'vodafone', 'o2', 'telefonica', '1&1', 'congstar'] },
    { name: 'Shopping', match: ['amazon', 'zalando', 'ebay', 'otto', 'ikea', 'mediamarkt', 'saturn', 'h&m', 'zara', 'decathlon'] },
    { name: 'Bargeld', match: ['geldautomat', 'bargeld', 'auszahlung', 'atm'] },
    { name: 'Gesundheit', match: ['apotheke', 'arzt', 'zahnarzt', 'physio'] },
    { name: 'Freizeit', match: ['kino', 'fitness', 'mcfit', 'urban sports', 'ticket', 'eventim', 'steam', 'playstation'] },
    { name: 'Gebühren & Bank', match: ['kontoführung', 'entgelt', 'zinsen', 'gebühr'] },
];

export const FALLBACK = { in: 'Sonstige Einnahmen', out: 'Sonstiges' };

export const EXPENSE_CATEGORIES = [
    'Lebensmittel', 'Miete & Wohnen', 'Essen & Trinken', 'Mobilität', 'Shopping', 'Abos', 'Versicherung',
    'Handy & Internet', 'Drogerie', 'Gesundheit', 'Freizeit', 'Bargeld', 'Gebühren & Bank', 'Umbuchung', FALLBACK.out,
];
export const INCOME_CATEGORIES = ['Gehalt', 'Kunden', 'Erstattung', 'Umbuchung', FALLBACK.in];

export function categorize(t) {
    const text = `${t.counterparty || ''} ${t.purpose || ''}`.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.match.some((word) => text.includes(word))) return rule.name;
    }
    return t.amount < 0 ? FALLBACK.out : FALLBACK.in;
}

export const categoryOf = (t) => t.category || categorize(t);

// Moving money between your own accounts is neither income nor expense.
export const isTransfer = (t) => t.category === 'Umbuchung';
