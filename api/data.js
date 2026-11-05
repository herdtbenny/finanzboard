import { ACCOUNT_COLUMNS, session, TRANSACTION_COLUMNS } from './_lib.js';
import { bookDue } from './_recurring.js';

// Everything of the signed-in person: accounts, transactions, standing
// orders and their own categories.
// Standing orders are booked first (up to a month ahead, as vorgemerkt), so
// opening the app shows them right away. Balances are computed in the browser, so this needs the full history.
export default async function handler(req, res) {
    const s = await session(req, res);
    if (!s) return;
    const { client, userId } = s;

    try {
        await bookDue(client, userId);
    } catch (e) {
        return res.status(500).json({ error: `Daueraufträge: ${e.message}` });
    }

    // Supabase caps a select at 1000 rows, so page through.
    const transactions = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('transactions').select(TRANSACTION_COLUMNS)
            .eq('user_id', userId)
            .order('booking_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, from + 999);
        if (error) return res.status(500).json({ error: error.message });
        transactions.push(...data);
        if (data.length < 1000) break;
    }

    const [accounts, recurrings, categories] = await Promise.all([
        client.from('accounts').select(ACCOUNT_COLUMNS).eq('user_id', userId).order('sort_order').order('created_at'),
        client.from('recurrings').select('*').eq('user_id', userId).order('created_at'),
        client.from('categories').select('id,name,kind,icon').eq('user_id', userId).order('created_at'),
    ]);
    if (accounts.error) return res.status(500).json({ error: accounts.error.message });

    res.status(200).json({ accounts: accounts.data, transactions, recurrings: recurrings.data || [], categories: categories.data || [] });
}
