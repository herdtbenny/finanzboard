// Reads amount, date and shop from the text of a German receipt — whether it
// came from the in-browser OCR or from the iPhone's "Text scannen". Plain
// rules, no AI: good at totals and dates, best effort for the shop name.

// Lines that name the total, strongest first.
const TOTAL_WORDS = ['zu zahlen', 'zahlbetrag', 'endbetrag', 'gesamtbetrag', 'summe', 'gesamt', 'total', 'betrag'];
// Card payment lines carry the total too, when no total line was found.
const PAYMENT_WORDS = ['girocard', 'kartenzahlung', 'ec-karte', 'ec karte', 'ec-cash', 'visa', 'mastercard', 'maestro', 'apple pay'];
// Lines with an amount that is never the total.
const NOT_TOTAL = ['mwst', 'mw.st', 'ust', 'netto', 'steuer', 'gegeben', 'rückgeld', 'ruckgeld', 'zurück', 'rabatt', 'ersparnis', 'gespart', 'punkte', 'payback'];
// Header lines that are never the shop name (matched as whole words).
const NOT_SHOP = ['str', 'straße', 'strasse', 'tel', 'telefon', 'fax', 'www', 'http', 'ust', 'steuer', 'st-nr', 'stnr', 'kasse', 'bon', 'beleg', 'filiale', 'öffnungszeiten', 'datum', 'uhrzeit', 'willkommen', 'vielen dank', 'quittung', 'rechnung', 'inh', 'inhaber'];

// "1.234,56" / "23,47" / "23.47" / "23, 47" — OCR likes to drop or add spaces.
const AMOUNT = /(?<![\d,.])(\d{1,3}(?:[.\s]\d{3})*|\d+)\s?[,.]\s?(\d{2})(?![\d])/g;

const DATE = /(?<!\d)(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})(?!\d)/g;

function amountsIn(line) {
    const found = [];
    // A date like 30.10.2026 must not read as 30,10 €.
    for (const m of line.replace(DATE, ' ').matchAll(AMOUNT)) {
        const value = Number(`${m[1].replace(/[.\s]/g, '')}.${m[2]}`);
        if (value > 0 && value < 100000) found.push(value);
    }
    return found;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (line, words) => words.some((w) => line.includes(w));
const hasWord = (line, words) => words.some((w) => new RegExp(`(^|[^a-zäöüß])${escape(w)}($|[^a-zäöüß])`).test(line));

function findAmount(lines) {
    const lower = lines.map((l) => l.toLowerCase());
    for (const words of [TOTAL_WORDS, PAYMENT_WORDS]) {
        for (const word of words) {
            for (let i = 0; i < lower.length; i++) {
                if (!lower[i].includes(word) || has(lower[i], NOT_TOTAL)) continue;
                // The amount is on the same line, or on the next one.
                const here = amountsIn(lines[i]);
                if (here.length) return here[here.length - 1];
                const next = lines[i + 1] && !has(lower[i + 1], NOT_TOTAL) ? amountsIn(lines[i + 1]) : [];
                if (next.length) return next[next.length - 1];
            }
        }
    }
    // No total line: the largest amount on the receipt.
    const all = lines.filter((l, i) => !has(lower[i], NOT_TOTAL)).flatMap(amountsIn);
    return all.length ? Math.max(...all) : null;
}

function findDate(text, today) {
    const earliest = new Date(today);
    earliest.setFullYear(earliest.getFullYear() - 2);
    for (const m of text.matchAll(DATE)) {
        const day = Number(m[1]);
        const month = Number(m[2]);
        const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        const date = new Date(year, month - 1, day);
        if (date.getMonth() !== month - 1 || date.getDate() !== day) continue;
        if (date > today || date < earliest) continue;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
}

// A name you already use wins (it keeps your categories working), searched
// in the header only so that item names don't match. Otherwise the first
// header line that reads like a name.
function findShop(lines, known) {
    const header = lines.slice(0, 8).join('\n').toLowerCase();
    let best = null;
    for (const name of known) {
        const n = name.trim().toLowerCase();
        if (n.length < 2 || !/[a-zäöü]/.test(n)) continue;
        const at = header.search(new RegExp(`(^|[^a-zäöüß])${escape(n)}($|[^a-zäöüß])`));
        if (at < 0) continue;
        if (!best || at < best.at || (at === best.at && n.length > best.name.length)) best = { name, at };
    }
    if (best) return best.name;

    for (const line of lines.slice(0, 6)) {
        const clean = line.replace(/[^A-Za-zÄÖÜäöüß&' -]/g, ' ').replace(/\s+/g, ' ').trim();
        const letters = clean.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
        if (letters < 3 || letters < line.replace(/\s/g, '').length * 0.6) continue;
        if (hasWord(line.toLowerCase(), NOT_SHOP) || /[@]|\d{5}/.test(line)) continue;
        // "REWE MARKT GMBH" → "Rewe Markt"
        const words = clean.split(' ').filter((w) => !/^(gmbh|ag|kg|ohg|co|e\.?k|mbh)$/i.test(w)).slice(0, 3);
        return words.map((w) => (w === w.toUpperCase() && w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w)).join(' ');
    }
    return null;
}

// { amount, date, shop } — each null when not found.
export function parseReceipt(text, { known = [], today = new Date() } = {}) {
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return {
        amount: findAmount(lines),
        date: findDate(lines.join('\n'), today),
        shop: findShop(lines, known),
    };
}
