const { getTotalBalance } = require("../helpers/walletCalculations");
const authentication = require("../middleware/authentication"); 
const { query } = require("../pgadmin"); 

exports.getWalletBalance = async (req, res) => {
    try {
        // Extract user ID from authorization token
        const authToken = req.headers.authorization?.split(" ")[1];

        if (!authToken) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        // Check if wallet exists for the user
        const walletCheck = await query(
            "SELECT id FROM wallets WHERE user_id = $1 AND status != 'closed'",
            [userId]
        );

        if (walletCheck.rowCount === 0) {
            return res.status(404).json({ message: "Wallet not found or closed" });
        }

        // Get wallet balance
        const balance = await getTotalBalance(userId);

        return res.status(200).json({
            message: "Wallet balance retrieved successfully",
            wallet: {
                balance: balance,
                currency: "INR" 
            }
        });

    } catch (err) {
        console.error("❌ Error fetching wallet balance:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};
