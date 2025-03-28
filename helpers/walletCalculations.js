const { query } = require("../pgadmin"); 

// Function to get total credits for a user
const getTotalCredits = async (userId) => {
    const result = await query(
        `SELECT COALESCE(SUM(wr.amount), 0) AS total 
         FROM wallet_recharge wr
         JOIN wallets w ON wr.wallet_id = w.id
         WHERE w.user_id = $1 AND wr.transaction_type = 'credit' AND wr.status = 'completed'`,
        [userId]
    );
    return parseFloat(result.rows[0].total);
};

// Function to get total debits for a user
const getTotalDebits = async (userId) => {
    const result = await query(
        `SELECT COALESCE(SUM(wr.amount), 0) AS total 
         FROM wallet_recharge wr
         JOIN wallets w ON wr.wallet_id = w.id
         WHERE w.user_id = $1 AND wr.transaction_type = 'debit' AND wr.status = 'completed'`,
        [userId]
    );
    return parseFloat(result.rows[0].total);
};

// Function to get total balance (credits - debits) for a user
const getTotalBalance = async (userId) => {
    const totalCredits = await getTotalCredits(userId);
    const totalDebits = await getTotalDebits(userId);
    return totalCredits - totalDebits;
};

// Export functions to use in other controllers
module.exports = {
    getTotalCredits,
    getTotalDebits,
    getTotalBalance
};
