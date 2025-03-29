const cron = require('node-cron');
const { query } = require('../pgadmin');

const markExpiredTransactions = async () => {
  try {
    // Get current timestamp and subtract 15 minutes
    const currentUtcTime = new Date();
    currentUtcTime.setUTCMinutes(currentUtcTime.getUTCMinutes() - 15);

    // Update all pending transactions that are older than 15 minutes
    const result = await query(
      `UPDATE wallet_recharge 
       SET status = 'failed' 
       WHERE status = 'pending' AND created_at <= $1 
       RETURNING transaction_id;`,
      [currentUtcTime]
    );

    if (result.rowCount > 0) {
      console.log(`Marked ${result.rowCount} transactions as failed:`, result.rows);
    } else {
      console.log('No expired pending transactions found.');
    }
  } catch (error) {
    console.error('Error marking expired transactions as failed:', error);
  }
};

cron.schedule('*/2 * * * *', async () => {
  console.log('Running expired transactions cleanup job...');
  await markExpiredTransactions();
});

module.exports = markExpiredTransactions;
