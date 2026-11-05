import { occurrenceAfter, today } from './schedule.js';

export const REPEATS = [
    ['week:1', 'Wöchentlich'],
    ['week:2', 'Alle 2 Wochen'],
    ['week:4', 'Alle 4 Wochen'],
    ['month:1', 'Monatlich'],
    ['month:3', 'Vierteljährlich'],
    ['month:6', 'Halbjährlich'],
    ['year:1', 'Jährlich'],
];

export function repeatLabel(r) {
    const hit = REPEATS.find(([v]) => v === `${r.interval}:${r.every}`);
    if (hit) return hit[1];
    const unit = { week: 'Wochen', month: 'Monate', year: 'Jahre' }[r.interval];
    return `Alle ${r.every} ${unit}`;
}

// Next booking date still to come, or null when the order has run out.
export function nextDate(r) {
    return occurrenceAfter(r, today());
}
