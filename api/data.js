import { ACCOUNT_COLUMNS, db, TRANSACTION_COLUMNS } from './_lib.js';
import { bookDue } from './_recurring.js';

// All accounts, transactions and standing orders. Due standing orders are
// booked first, so opening the app shows them right away. Balances are
// computed in the browser, so this needs the full history.
export default async function handler(req, res) {
    const client = db(req, res);
    if (!client) return;

    try {
        await bookDue(client);
    } catch (e) {
        return res.status(500).json({ error: `Daueraufträge: ${e.message}` });
    }

    // Supabase caps a select at 1000 rows, so page through.
    const transactions = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('transactions').select(TRANSACTION_COLUMNS)
            .order('booking_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, from + 999);
        if (error) return res.status(500).json({ error: error.message });
        transactions.push(...data);
        if (data.length < 1000) break;
    }

    const [accounts, recurrings] = await Promise.all([
        client.from('accounts').select(ACCOUNT_COLUMNS).order('sort_order').order('created_at'),
        client.from('recurrings').select('*').order('created_at'),
    ]);
    if (accounts.error) return res.status(500).json({ error: accounts.error.message });

    res.status(200).json({ accounts: accounts.data, transactions, recurrings: recurrings.data || [] });
}
