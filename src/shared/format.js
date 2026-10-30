// Always with cents — amounts are never rounded in the UI.
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n) => eur.format(n || 0);

export const monthKey = (date) => String(date).slice(0, 7);

export function monthLabel(key, opts = { month: 'long', year: 'numeric' }) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('de-DE', opts);
}

export function shiftMonth(key, delta) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dayLabel(iso) {
    const d = new Date(`${iso}T00:00:00`);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Heute';
    if (d.toDateString() === yesterday.toDateString()) return 'Gestern';
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
}

export function relative(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Min.`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

export const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "1.234,5" / "1234.50" / "12,-" → number, NaN if unreadable.
export function parseAmount(text) {
    let s = String(text).trim().replace(/\s|€|-$/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return s ? Number(s) : NaN;
}

// Number → what goes back into an input field: "12,5".
export const amountInput = (n) => (n || n === 0 ? Math.abs(n).toFixed(2).replace('.', ',') : '');

export const newId = () => crypto.randomUUID();
