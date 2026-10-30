// Keyword rules, matched against counterparty + purpose (case-insensitive).
// First match wins, so put the more specific rules first. Edit freely — the
// categories are computed in the browser, so changes apply to all old
// transactions too.
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
    { name: 'PayPal', match: ['paypal'] },
];

export const FALLBACK = { in: 'Sonstige Einnahmen', out: 'Sonstiges' };

export function categorize(t) {
    const text = `${t.counterparty || ''} ${t.purpose || ''}`.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.match.some((word) => text.includes(word))) return rule.name;
    }
    return t.amount < 0 ? FALLBACK.out : FALLBACK.in;
}

// Moving money between your own accounts is neither income nor expense.
export const isTransfer = (t) => t.category === 'Umbuchung';
