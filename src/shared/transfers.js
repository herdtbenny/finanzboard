// A transfer is stored as two transactions sharing a transfer_id (minus on
// the source, plus on the target). For lists across all accounts they are
// shown as one entry: { ...source row, id: transfer_id, amount: positive,
// transfer: { from, to } }.
export function mergeTransfers(transactions) {
    const pairs = {};
    for (const t of transactions) if (t.transfer_id) (pairs[t.transfer_id] ||= []).push(t);

    const out = [];
    for (const t of transactions) {
        const pair = t.transfer_id && pairs[t.transfer_id];
        const from = pair?.length === 2 && pair.find((x) => x.amount < 0);
        const to = pair?.length === 2 && pair.find((x) => x.amount > 0);
        if (!from || !to) { out.push(t); continue; }
        if (t !== from) continue;
        out.push({ ...from, id: from.transfer_id, amount: to.amount, transfer: { from, to } });
    }
    return out;
}

export const transferTitle = (t) => (t.counterparty && !['Umbuchung', 'Investieren'].includes(t.counterparty) ? t.counterparty : t.category);
