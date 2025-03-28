const axios = require("axios");
const dotenv = require("dotenv");
const { query } = require("../pgadmin"); // Using pgadmin query helper for PostgreSQL
const authentication = require("./../middleware/authentication");

dotenv.config({ path: "./config.env" });

exports.CalculateshippingCost = async (req, res, next) => {
    try {
        const { weight, originCityPincode, deliveryCityPincode, statusofshipment, paymentmode } = req.body;
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;
        const authToken = req.headers.authorization?.split(" ")[1];

        if (!baseUrl) {
            return res.status(500).json({ message: "Base URL not configured" });
        }

        // Decode token to get user ID
        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        console.log("👤 Logged-in User ID:", userId);

        // Fetch user details from PostgreSQL
        const userResult = await query("SELECT margin FROM users WHERE id = $1", [userId]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const userMargin = userResult.rows[0].margin || 0; // Get user's margin (percentage)
        console.log("💰 User Margin Percentage:", userMargin);

        const modes = ["E", "S"]; // Both modes
        const results = [];

        for (const modeOfShipment of modes) {
            const apiUrl = `${baseUrl}/api/kinko/v1/invoice/charges/.json`;
            const params = {
                md: modeOfShipment,
                cgm: weight,
                o_pin: originCityPincode,
                d_pin: deliveryCityPincode,
                ss: statusofshipment,
                pt: paymentmode,
            };

            console.log(`📡 Fetching shipping cost for mode: ${modeOfShipment}`);

            // Fetch shipping cost from Delhivery API
            const response = await axios.get(apiUrl, {
                params,
                headers: {
                    Authorization: `Token ${token}`,
                },
            });

            if (!response.data || response.data.length === 0) {
                return res.status(404).json({ message: `No shipping cost data found for mode ${modeOfShipment}` });
            }

            const data = response.data[0];
            console.log("📊 Delhivery API Response:", data);

            const gstCharges = Object.values(data.tax_data).reduce((sum, tax) => sum + tax, 0);
            const basePrice = data.charge_DL;
            const totalAmount = data.total_amount;

            // Apply margin to total amount
            const marginAmount = (totalAmount * userMargin) / 100;
            const updatedTotalAmount = totalAmount + marginAmount;

            results.push({
                mode: modeOfShipment,
                prices: {
                    total_amount: updatedTotalAmount,
                },
            });
        }

        return res.status(200).json({ shipping_costs: results });

    } catch (err) {
        console.error("❌ Error fetching shipping cost:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};
