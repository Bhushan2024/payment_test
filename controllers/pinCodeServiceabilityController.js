const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

exports.pinCodeServiceability = async (req, res, next) => {
    try {
        const { filter_codes} = req.body;        
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;
        
        if (!baseUrl) {
            return res.status(500).json({ message: "Base URL not configured" });
        }

        const apiUrl = `${baseUrl}/c/api/pin-codes/json/?`;
        
        const params = {
            filter_codes: filter_codes,
        };
        
        const response = await axios.get(apiUrl, {
            params,
            headers: {
                Authorization: `Token ${token}`
            }
        });

        // if (!response.data || response.data.length === 0) {
        //     return res.status(404).json({ message: "No shipping cost data found" });
        // }

        return res.status(200).json(response.data);
    } catch (err) {
        console.error("Error fetching pincode serviceability:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

exports.pinCodeData = async (req, res, next) => {
    try {
        const { filter_codes } = req.body;
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;

        if (!baseUrl) {
            return res.status(500).json({ message: "Base URL not configured" });
        }

        const apiUrl = `${baseUrl}/c/api/pin-codes/json/?`;
        const params = { filter_codes };

        const response = await axios.get(apiUrl, {
            params,
            headers: {
                Authorization: `Token ${token}`
            }
        });

        if (!response.data || !response.data.delivery_codes) {
            return res.status(404).json({ message: "No data found" });
        }

        const extractedData = response.data.delivery_codes.map(item => {
            const { postal_code } = item;
            if (!postal_code) return null;
            
            const city = postal_code.city || "";
            const country = postal_code.country_code || "";
            
            const stateMatch = postal_code.inc.match(/\((.*?)\)/);
            const state = stateMatch ? stateMatch[1] : "";

            return { city, state, country };
        }).filter(Boolean); 

        return res.status(200).json({ data: extractedData });
    } catch (err) {
        console.error("Error fetching pin code data:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};
