const { query } = require('../pgadmin'); // Import PostgreSQL query function
const dotenv = require("dotenv");
const axios = require("axios");
const authentication = require("./../middleware/authentication");
dotenv.config({ path: "./config.env" });
const crypto = require("crypto");
const { getTotalBalance } = require("../helpers/walletCalculations");



// Create a warehouse and store it in PostgreSQL
exports.createWarehouse = async (req, res) => {
    try {
        const {
            name, phone, email, city, pin, address, state, country,
            registered_name, return_address, return_city,
            return_pin, return_state, return_country
        } = req.body;

        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;
        const authToken = req.headers.authorization?.split(' ')[1];

        if (!baseUrl) {
            return res.status(500).json({ message: "Base URL not configured" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        // Call Delhivery API
        const payload = {
            name, phone, email, city, pin, address, country,
            registered_name, return_address, return_city,
            return_pin, return_state, return_country
        };

        const response = await axios.post(
            `${baseUrl}/api/backend/clientwarehouse/create/`,
            payload,
            { headers: { Authorization: `Token ${token}` } }
        );

        if (!response.data.success) {
            return res.status(400).json({
                message: "Failed to create warehouse in Delhivery API",
                error: response.data.error || "Unknown error"
            });
        }

        const data = response.data.data;

        // Extract business days
        const businessDays = data.business_days || [];

        // Store warehouse details in PostgreSQL
        const result = await query(
            `INSERT INTO warehouses (
                facility_name, contact_person, pickup_location, email, 
                address_line, pincode, city, state, country, 
                default_pickup_slot, working_days, user_id, 
                return_address_same_as_pickup, return_address, return_pincode, 
                return_city, return_state, return_country
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                $13, $14, $15, $16, $17, $18
            ) RETURNING *`,
            [
                data.name, phone, data.address, email,
                data.address, data.pincode, city, state, country,
                "9AM - 6PM", businessDays, userId,
                return_address === address, return_address, return_pin,
                return_city, return_state, return_country
            ]
        );

        return res.status(201).json({
            message: "Warehouse created successfully",
            warehouse: result.rows[0],
            delhiveryResponse: response.data
        });

    } catch (err) {
        console.error("❌ Error creating warehouse:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Get warehouses for a user or all warehouses (if admin)
exports.getUserWarehouses = async (req, res) => {
    try {
        const authToken = req.headers.authorization?.split(' ')[1];

        if (!authToken) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        // Fetch user role
        const userResult = await query("SELECT role FROM users WHERE id = $1", [userId]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const userRole = userResult.rows[0].role;
        let warehouses;

        if (userRole === "admin") {
            // Admin can see all warehouses
            warehouses = await query("SELECT * FROM warehouses");
        } else if (userRole === "client") {
            // Client can see only their own warehouses
            warehouses = await query("SELECT * FROM warehouses WHERE user_id = $1", [userId]);
        } else {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        if (warehouses.rowCount === 0) {
            return res.status(404).json({ message: "No warehouses found" });
        }

        const formattedWarehouses = warehouses.rows.map(warehouse => ({
            data: {
                business_hours: warehouse.working_days.reduce((acc, day) => {
                    acc[day] = {
                        start_time: "09:00 AM",
                        close_time: "06:00 PM"
                    };
                    return acc;
                }, {}),
                id: warehouse.id,
                name: warehouse.facility_name,
                business_days: warehouse.working_days,
                pincode: warehouse.pincode,
                type_of_clientwarehouse: null,
                phone: "N/A",
                client: warehouse.contact_person,
                address: warehouse.address_line,
                active: true,
                message: "Warehouse data retrieved successfully",
                largest_vehicle_constraint: null,
                email: warehouse.email,
                state: warehouse.state,
                city: warehouse.city,
                country: warehouse.country,
                default_pickup_slot: warehouse.default_pickup_slot,
                return_address_same_as_pickup: warehouse.return_address_same_as_pickup,
                return_address: warehouse.return_address,
                return_pincode: warehouse.return_pincode,
                return_city: warehouse.return_city,
                return_state: warehouse.return_state,
                return_country: warehouse.return_country,
                createdAt: warehouse.created_at
            },
            success: true,
            error: ""
        }));

        return res.status(200).json({
            message: "Warehouses retrieved successfully",
            warehouses: formattedWarehouses,
        });

    } catch (err) {
        console.error("❌ Error fetching warehouses:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Generate a unique 10-character order ID
exports.generateUniqueOrderId = async (req, res) => {
    try {
        let orderId;
        let isUnique = false;

        while (!isUnique) {
            // Generate a random 10-ditit order id
            orderId = Array.from(crypto.randomBytes(12))
                .map(byte => byte % 10) // Convert each byte to a single digit (0-9)
                .join("");

            // Check if the generated order ID already exists
            const existingOrder = await query("SELECT id FROM orders WHERE order_unique_id = $1", [orderId]);

            if (existingOrder.rowCount === 0) {
                isUnique = true;
            }
        }

        return res.status(200).json({
            message: "Unique Order ID generated successfully",
            order_id: orderId
        });

    } catch (err) {
        console.error("❌ Error generating unique order ID:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Create Forward Shipment
exports.createForwardOrder = async (req, res) => {
    try {
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;
        let finalWaybill;
        let final_upload_wbn;

        if (!baseUrl || !token) {
            throw new Error("Missing Delhivery API credentials");
        }

        // Extract data from request body
        const { pickup_location, shipment } = req.body;

        if (!pickup_location || !shipment || !Array.isArray(shipment) || shipment.length === 0) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        console.log("📦 Extracted pickup_location:", pickup_location);
        console.log("🚚 Extracted shipment details:", shipment);

        // Fetch warehouse information from PostgreSQL
        const warehouseResult = await query("SELECT * FROM warehouses WHERE id = $1", [pickup_location]);
        if (warehouseResult.rowCount === 0) {
            return res.status(404).json({ message: "Warehouse not found" });
        }

        const warehouse = warehouseResult.rows[0];
        console.log("🏭 Warehouse Info:", warehouse);

        // Get logged-in user's ID
        const authToken = req.headers.authorization?.split(" ")[1];
        if (!authToken) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        console.log("👤 Logged-in User ID:", userId);

        // Fetch user details from users table
        const userResult = await query("SELECT * FROM users WHERE id = $1", [userId]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userResult.rows[0];
        console.log("👤 User Details:", user);

        // Extract shipment details
        const shipmentDetails = shipment[0];

        // Convert pincode and weight to numbers
        const originPincode = Number(warehouse.pincode);
        const destinationPincode = Number(shipmentDetails.pin);
        const weight = Number(shipmentDetails.weight);

        if (isNaN(originPincode) || isNaN(destinationPincode) || isNaN(weight)) {
            return res.status(400).json({ message: "Invalid pincode or weight values" });
        }

        console.log("📌 Converted Origin Pincode:", originPincode);
        console.log("📌 Converted Destination Pincode:", destinationPincode);
        console.log("⚖️ Converted Weight:", weight);

        // Map `md` (mode) values
        const modeMapping = {
            "Express": "E",
            "Surface": "S"
        };
        const mode = modeMapping[shipmentDetails.shipping_mode] || shipmentDetails.shipping_mode;

        // API URL
        const apiUrl = `${baseUrl}/api/kinko/v1/invoice/charges/.json`;

        const params = {
            md: mode,
            cgm: weight,
            o_pin: originPincode,
            d_pin: destinationPincode,
            ss: "Delivered",
            pt: shipmentDetails.payment_mode
        };

        console.log("📦 API Request Params:", JSON.stringify(params));
        console.log("🔑 Delhivery Token:", token);

        // Fetch shipping cost from Delhivery API
        const response = await axios.get(apiUrl, {
            params,
            headers: {
                Authorization: `Token ${token}`
            }
        });

        console.log("💰 Shipping Cost Response:", response.data);

        // Extract total amount from response
        const totalAmount = response.data[0].total_amount;


        console.log("💲 Total Shipping Cost from API:", totalAmount);

        // Apply user margin
        const margin = Number(user.margin) || 0;
        const marginAmount = (totalAmount * margin) / 100;
        let finalShippingPrice = totalAmount + marginAmount;
        finalShippingPrice = Math.round(finalShippingPrice * 100) / 100;

        console.log("💲 Final Shipping Price (After Margin):", finalShippingPrice);

        const WalletBalance = await getTotalBalance(user.id);

        // Check if wallet balance is sufficient
        if (WalletBalance < finalShippingPrice) {
            return res.status(400).json({
                message: "Insufficient wallet balance",
                wallet_balance: WalletBalance,
                required_amount: finalShippingPrice - WalletBalance
            });
        }

        console.log("✅ Wallet balance is sufficient. Proceeding with shipment.");

        for (const item of shipment) {
            // Check if items array exists
            if (Array.isArray(item.items) && item.items.length > 0) {
                // Create a new array to store the enhanced items with full details
                item.qc_items = [];

                // Process each product in the items array
                for (const productItem of item.items) {
                    // Get product details from the product table with category name
                    const productResult = await query(
                        "SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = $1",
                        [productItem.product_id]
                    );

                    if (productResult.rowCount > 0) {
                        const product = productResult.rows[0];

                        // Add the enhanced product details to qc_items
                        item.qc_items.push({
                            description: product.item_name || 'Product Description',
                            brand: product.item_name || 'Brand',
                            category: product.category_name || 'Category',
                            quantity: productItem.quantity || 1,
                            sku: product.sku_code || 'SKU',
                            price: product.price || 0
                        });
                    }
                }
            } else {
                // Create an empty array if no items
                item.qc_items = [];
            }
        }


        // Ensure shipment is an array before mapping
        const formattedShipments = Array.isArray(shipment)
            ? shipment.map(item => ({
                name: item.name,
                add: item.address,
                city: item.city,
                state: item.state,
                country: "India",
                pin: Number(item.pin),
                phone: item.phone,
                payment_mode: item.payment_mode,
                order: item.order,
                shipping_mode: item.shipping_mode,
                weight: item.weight.toString(),
                fragile_shipment: item.fragile_shipment ? "true" : "false",
                cod_amount: item.cod_amount || 0,
                plastic_packaging: item.plastic_packaging ? "true" : "false",
                shipment_height: item.shipment_heigth,
                shipment_width: item.shipment_width,
                shipment_length: item.shipment_length,
                qc: {
                    item: Array.isArray(item.qc_items)
                        ? item.qc_items.map(qcItem => ({
                            descr: qcItem.description,
                            brand: qcItem.brand,
                            pcat: qcItem.category,
                            item_quantity: qcItem.quantity
                        }))
                        : []
                }
            }))
            : [];

        // Prepare the final data
        const formattedData = {
            format: "json",
            data: {
                shipments: formattedShipments,
                pickup_location: {
                    name: warehouse.facility_name,
                    city: warehouse.city,
                    pin: warehouse.pincode.toString(),
                    country: warehouse.country,
                    phone: warehouse.contact_person,
                    add: warehouse.pickup_location
                }
            }
        };
        console.log("📦 Final Formatted Data:", JSON.stringify(formattedData, null, 2));

        const forwardOrderapiUrl = `${baseUrl}/api/cmu/create.json`;



        console.log("🔄 Calling Delhivery API to create forward order...");
        try {
            // Format data parameter exactly as required by Delhivery API
            const dataParam = encodeURIComponent(JSON.stringify(formattedData.data));
            const requestBody = `format=json&data=${dataParam}`;

            const forwardOrderResponse = await axios.post(
                forwardOrderapiUrl,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Token ${token}`
                    }
                }
            );

            console.log("✅ Forward Order API Response:", JSON.stringify(forwardOrderResponse.data, null, 2));
            final_upload_wbn = forwardOrderResponse.data.upload_wbn;
            finalWaybill = forwardOrderResponse.data.packages[0].waybill;

            console.log("📝 Updating database with API response values:");
            console.log(`- upload_wbn: ${final_upload_wbn}`);
            console.log(`- waybill: ${finalWaybill}`);

            // Check if the API call was successful
            if (!forwardOrderResponse.data || forwardOrderResponse.data.error) {
                throw new Error(forwardOrderResponse.data?.error || "Unknown error from Delhivery API");
            }

        } catch (err) {
            console.error("❌ Error in createForwardOrder:", err);
            return res.status(500).json({ message: "Failed to create forward order", error: err.message });
        }
        try {
            // 1. Insert into customers table
            const customerData = {
                first_name: shipmentDetails.name.split(' ')[0], // Assuming name format is "First Last"
                last_name: shipmentDetails.name.includes(' ') ? shipmentDetails.name.split(' ').slice(1).join(' ') : '',
                email: shipmentDetails.email,
                mobile_number: shipmentDetails.phone,
                shipping_address_line1: shipmentDetails.address,
                shipping_address_line2: '',
                shipping_city: shipmentDetails.city,
                shipping_state: shipmentDetails.state,
                shipping_pincode: shipmentDetails.pin,
                shipping_same_as_billing: true, // Default assumption
                billing_address_line1: shipmentDetails.address,
                billing_address_line2: '',
                billing_city: shipmentDetails.city,
                billing_state: shipmentDetails.state,
                billing_pincode: shipmentDetails.pin
            };
            console.log("customerData.................." + JSON.stringify(customerData))

            const customerInsertQuery = `
                INSERT INTO customers (
                    first_name, last_name, email, mobile_number, 
                    shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode,
                    shipping_same_as_billing, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
            `;

            const customerInsertValues = [
                customerData.first_name,
                customerData.last_name,
                customerData.email,
                customerData.mobile_number,
                customerData.shipping_address_line1,
                customerData.shipping_address_line2,
                customerData.shipping_city,
                customerData.shipping_state,
                customerData.shipping_pincode,
                customerData.shipping_same_as_billing,
                customerData.billing_address_line1,
                customerData.billing_address_line2,
                customerData.billing_city,
                customerData.billing_state,
                customerData.billing_pincode
            ];

            const customerResult = await query(customerInsertQuery, customerInsertValues);
            const customerId = customerResult.rows[0].id;
            console.log("👤 Customer created with ID:", customerId);

            // 2. Insert into orders table
            // Generate a unique order ID
            const orderUniqueId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const orderInsertQuery = `
                INSERT INTO orders (
                    order_unique_id, customer_id, warehouse_id, payment_mode, 
                    packages_count, total_cod_amount, upload_wbn, clientid
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `;

            const orderInsertValues = [
                shipmentDetails.order,
                customerId,
                pickup_location,
                shipmentDetails.payment_mode,
                shipment.length, // Number of packages
                shipmentDetails.payment_mode === 'COD' ? Number(shipmentDetails.cod_amount || 0) : 0,
                final_upload_wbn,
                userId
            ];

            const orderResult = await query(orderInsertQuery, orderInsertValues);
            const orderId = orderResult.rows[0].id;
            console.log("📦 Order created with ID:", orderId);

            // 3. Insert into shipments table for each shipment in the array
            for (const item of shipment) {
                // Generate tracking number
                const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;


                // Create product details JSON
                const productDetails = {
                    shipping_mode: item.shipping_mode,
                    dimensions: {
                        height: item.shipment_height,
                        width: item.shipment_width,
                        length: item.shipment_length
                    },
                    fragile: item.fragile_shipment ? true : false,
                    plastic_packaging: item.plastic_packaging ? true : false,
                    items: Array.isArray(item.qc_items) ? item.qc_items.map(qcItem => ({
                        description: qcItem.description,
                        brand: qcItem.brand,
                        category: qcItem.category,
                        quantity: qcItem.quantity,
                        sku: qcItem.sku,
                        price: qcItem.price
                    })) : []
                };

                const shipmentInsertQuery = `
                    INSERT INTO shipments (
                        tracking_number, order_id, product_details, 
                        shipment_status, waybill, cod_amount, weight
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `;

                const shipmentInsertValues = [
                    trackingNumber,
                    orderId,
                    JSON.stringify(productDetails),
                    'Manifested',
                    finalWaybill,
                    item.payment_mode === 'COD' ? Number(item.cod_amount || 0) : 0,
                    Number(item.weight || 0)
                ];

                const shipmentResult = await query(shipmentInsertQuery, shipmentInsertValues);
                const shipmentId = shipmentResult.rows[0].id;
                console.log("🚚 Shipment created with ID:", shipmentId);


                // Generate a unique 12-digit transaction ID
                const transactionId = `TR${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 100)}`;
                console.log("💰 Generated Transaction ID:", transactionId);

                // Insert into wallet_recharge table for the shipping cost
                const walletResult = await query("SELECT id FROM wallets WHERE user_id = $1", [userId]);
                if (walletResult.rowCount === 0) {
                    throw new Error("Wallet not found for the user");
                }
                const walletId = walletResult.rows[0].id;

                // Create product description for transaction
                const productNames = [];
                for (const item of shipment) {
                    if (Array.isArray(item.qc_items) && item.qc_items.length > 0) {
                        for (const qcItem of item.qc_items) {
                            productNames.push(`${qcItem.quantity}x ${qcItem.description}`);
                        }
                    }
                }
                const productDescription = productNames.length > 0
                    ? `Shipping for: ${productNames.join(', ')}`
                    : `Shipping for order`;

                // Insert wallet transaction record
                const walletTransactionQuery = `
                    INSERT INTO wallet_recharge (
                        wallet_id, transaction_type, amount, description, transaction_id, status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `;

                const walletTransactionValues = [
                    walletId,
                    'debit',
                    finalShippingPrice,
                    `${productDescription} (Order ID: ${shipmentDetails.order})`,
                    transactionId,
                    'completed'
                ];

                const walletTransactionResult = await query(walletTransactionQuery, walletTransactionValues);
                const walletTransactionId = walletTransactionResult.rows[0].id;

                console.log("💵 Wallet transaction created with ID:", walletTransactionId);
            }

            // Update the response to include the new IDs
            return res.status(200).json({
                message: "Order created successfully with database entries",
                order_id: orderId,
                order_unique_id: shipmentDetails.order
            });

        } catch (err) {
            console.error("❌ Error in createForwardOrder:", err);
            return res.status(500).json({ message: "Internal server error", error: err.message });
        }




    } catch (err) {
        console.error("❌ Error in createForwardOrder:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Get all shipments for a user
exports.getshippingLabel = async (req, res) => {
    try {
        const { waybill } = req.body;
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;

        if (!waybill) {
            return res.status(400).json({ message: "Waybill number is required" });
        }

        // URLs for both API calls
        const labelDataUrl = `${baseUrl}/api/p/packing_slip?wbns=${waybill}`;
        const labelPdfUrl = `${baseUrl}/api/p/packing_slip?wbns=${waybill}&pdf=true`;


        // Make both API calls in parallel
        const [labelDataResponse, labelPdfResponse] = await Promise.all([
            axios.get(labelDataUrl, {
                headers: { Authorization: `Token ${token}` }
            }),
            axios.get(labelPdfUrl, {
                headers: { Authorization: `Token ${token}` }
            })
        ]);

        // Check if package data was found
        if (!labelDataResponse.data || !labelDataResponse.data.packages || labelDataResponse.data.packages.length === 0) {
            return res.status(404).json({ message: "No package found for the provided waybill" });
        }

        // Extract package data
        const packageData = labelDataResponse.data.packages[0];

        // Extract PDF link from PDF response
        let pdfDownloadLink = null;
        if (labelPdfResponse.data &&
            labelPdfResponse.data.packages &&
            labelPdfResponse.data.packages.length > 0 &&
            labelPdfResponse.data.packages[0].pdf_download_link) {
            pdfDownloadLink = labelPdfResponse.data.packages[0].pdf_download_link;
        }

        // Combine the data
        const combinedResponse = {
            ...packageData,
            pdf_download_link: pdfDownloadLink
        };

        // **Update the database: Mark is_label_downloaded as true**
        const updateQuery = `
            UPDATE shipments
            SET islabeldownloaded = TRUE
            WHERE waybill = $1
        `;

        await query(updateQuery, [waybill]);

        return res.status(200).json({
            message: "Shipping label retrieved successfully",
            label_data: combinedResponse,
            packages_found: labelDataResponse.data.packages_found || 1
        });

    } catch (error) {
        console.error("❌ Error in getshippingLabel:", error);
        return res.status(500).json({
            message: "Failed to retrieve shipping label",
            error: error.message
        });
    }
};


// Get shipping order details
exports.getshippingOrderDetails = async (req, res) => {
    try {
        const { uniqueOrderId } = req.body;

        if (!uniqueOrderId) {
            return res.status(400).json({ message: "Order ID is required" });
        }

        console.log("🔍 Fetching order details for uniqueOrderId:", uniqueOrderId);

        // 1. Query the orders table to get the order details
        const orderResult = await query(
            "SELECT * FROM orders WHERE order_unique_id = $1",
            [uniqueOrderId]
        );

        if (orderResult.rowCount === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        const order = orderResult.rows[0];

        // 2. Get the customer details
        const customerResult = await query(
            "SELECT * FROM customers WHERE id = $1",
            [order.customer_id]
        );

        const customer = customerResult.rowCount > 0 ? customerResult.rows[0] : null;

        // 3. Get the warehouse details
        const warehouseResult = await query(
            "SELECT * FROM warehouses WHERE id = $1",
            [order.warehouse_id]
        );

        const warehouse = warehouseResult.rowCount > 0 ? warehouseResult.rows[0] : null;

        // 4. Get all shipment records for this order
        const shipmentResult = await query(
            "SELECT * FROM shipments WHERE order_id = $1",
            [order.id]
        );

        let shipments = shipmentResult.rows;

        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;

        // Fetch shipping status for each shipment
        const updatedShipments = await Promise.all(
            shipments.map(async (shipment) => {
                const waybill = shipment.waybill;
                if (!waybill) return shipment;

                try {
                    console.log(`🚚 Fetching status for waybill: ${waybill}`);
                    const apiUrl = `${baseUrl}/api/v1/packages/json/?waybill=${waybill}`;

                    const response = await axios.get(apiUrl, {
                        headers: { Authorization: `Token ${token}` }
                    });

                    if (response.data.ShipmentData && response.data.ShipmentData.length > 0) {
                        const shipmentData = response.data.ShipmentData[0].Shipment;

                        if (shipmentData.AWB === waybill && shipmentData.Status) {
                            shipment = {
                                ...shipment,
                                Status: shipmentData.Status
                            };
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error fetching shipment status for waybill ${waybill}:`, error.message);
                }

                return shipment;
            })
        );

        return res.status(200).json({
            message: "Order details retrieved successfully",
            order,
            customer,
            warehouse,
            shipments: updatedShipments
        });

    } catch (error) {
        console.error("❌ Error in getshippingOrderDetails:", error);
        return res.status(500).json({
            message: "Failed to retrieve order details",
            error: error.message
        });
    }
};

// Get all shipments for a user
exports.getshippingOrdersbyUser = async (req, res) => {
    try {
        const { status, SearchData, searchtType, manifeestedDate, pickupLocation, transportMode, paymentMode } = req.body;

        const authToken = req.headers.authorization?.split(" ")[1];
        const userId = authentication.decodeToken(authToken);

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userResult = await query("SELECT role FROM users WHERE id = $1", [userId]);

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const userRole = userResult.rows[0].role;
        let orderQuery = "SELECT * FROM orders";
        let queryParams = [];

        if (userRole === "client") {
            orderQuery += " WHERE clientid = $1";
            queryParams.push(userId);
        }

        const orderResult = await query(orderQuery, queryParams);

        if (orderResult.rowCount === 0) {
            return res.status(404).json({ message: "No orders found" });
        }

        const orders = orderResult.rows;
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;

        const enrichedOrders = await Promise.all(
            orders.map(async (order) => {
                const customerResult = await query("SELECT * FROM customers WHERE id = $1", [order.customer_id]);
                const warehouseResult = await query("SELECT * FROM warehouses WHERE id = $1", [order.warehouse_id]);
                const shipmentResult = await query("SELECT * FROM shipments WHERE order_id = $1", [order.id]);

                let shipments = shipmentResult.rows;

                const updatedShipments = await Promise.all(
                    shipments.map(async (shipment) => {
                        const waybill = shipment.waybill;
                        if (!waybill) return shipment;

                        try {
                            console.log(`🚚 Fetching status for waybill: ${waybill}`);
                            const apiUrl = `${baseUrl}/api/v1/packages/json/?waybill=${waybill}`;

                            const response = await axios.get(apiUrl, {
                                headers: { Authorization: `Token ${token}` }
                            });

                            if (response.data.ShipmentData && response.data.ShipmentData.length > 0) {
                                const shipmentData = response.data.ShipmentData[0].Shipment;

                                if (shipmentData.AWB === waybill && shipmentData.Status) {
                                    shipment = { ...shipment, Status: shipmentData.Status };
                                }
                            }
                        } catch (error) {
                            console.error(`❌ Error fetching shipment status for waybill ${waybill}:`, error.message);
                        }

                        return shipment;
                    })
                );

                return {
                    order,
                    customer: customerResult.rowCount > 0 ? customerResult.rows[0] : null,
                    warehouse: warehouseResult.rowCount > 0 ? warehouseResult.rows[0] : null,
                    shipments: updatedShipments
                };
            })
        );

        // Apply filters if provided
        let finalOrders = enrichedOrders;
        if (status) {
            finalOrders = enrichedOrders.filter(order =>
                order.shipments.some(shipment => shipment.shipment_status === status)
            );
        }

        if (SearchData && searchtType) {
            if (searchtType === "AWB") {
                finalOrders = finalOrders.filter(order =>
                    order.shipments.some(shipment => shipment.waybill === SearchData)
                );
            } else if (searchtType === "Order Id") {
                finalOrders = finalOrders.filter(order => order.order.order_unique_id === SearchData);
            }
        }

        if (manifeestedDate) {
            finalOrders = finalOrders.filter(order =>
                new Date(order.order.order_date).toISOString().startsWith(manifeestedDate)
            );
        }

        if (pickupLocation) {
            finalOrders = finalOrders.filter(order => order.warehouse && order.warehouse.id === pickupLocation);
        }

        if (transportMode) {
            finalOrders = finalOrders.filter(order =>
                order.shipments.some(shipment => shipment.product_details?.shipping_mode === transportMode)
            );
        }

        if (paymentMode) {
            finalOrders = finalOrders.filter(order => order.order.payment_mode === paymentMode);
        }

        return res.status(200).json({
            message: "Orders retrieved successfully after filtering",
            orders: finalOrders
        });
    } catch (error) {
        console.error("❌ Error in getshippingOrdersbyUser:", error);
        return res.status(500).json({
            message: "Failed to retrieve orders",
            error: error.message
        });
    }
};

// Edit shipment details
exports.editShipmentDetails = async (req, res) => {
    try {
        const {
            waybill, name, add, phone, gm, pt, cod
        } = req.body;

        if (!waybill) {
            return res.status(400).json({ message: "Waybill is required" });
        }

        // Construct payload dynamically
        const payload = { waybill };
        if (name) payload.name = name;
        if (add) payload.add = add;
        if (phone) payload.phone = phone;
        if (gm) payload.gm = gm;
        if (pt) payload.pt = pt;
        if (cod) payload.cod = cod;

        // Call Delhivery API
        const baseUrl = process.env.Delhivery_BaseUrl_Dev;
        const token = process.env.Delhivery_API_Token;
        const apiUrl = `${baseUrl}/api/p/edit`;

        const response = await axios.post(apiUrl, payload, {
            headers: { Authorization: `Token ${token}` },
        });

        // Fetch order_id using waybill from shipments table
        const orderQuery = `SELECT order_id FROM shipments WHERE waybill = $1`;
        const orderResult = await query(orderQuery, [waybill]);

        if (orderResult.rowCount === 0) {
            return res.status(404).json({ message: "Order not found for given waybill" });
        }
        const orderId = orderResult.rows[0].order_id;

        // Fetch customer_id using order_id from orders table
        const customerQuery = `SELECT customer_id FROM orders WHERE id = $1`;
        const customerResult = await query(customerQuery, [orderId]);

        if (customerResult.rowCount === 0) {
            return res.status(404).json({ message: "Customer not found for given order" });
        }
        const customerId = customerResult.rows[0].customer_id;

        // Updating Customer Table if name, add, or phone exist
        // Updating Customer Table if name, add, or phone exist
        if (name || add || phone) {
            let updateCustomerQuery = `UPDATE customers SET `;
            const customerParams = [];
            let paramCounter = 1;

            if (name) {
                // Split name into first name and last name by space
                const nameParts = name.trim().split(' ');
                const firstName = nameParts[0];
                // Join all remaining parts as last name, or use empty string if no last name
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

                updateCustomerQuery += `first_name = $${paramCounter}, `;
                customerParams.push(firstName);
                paramCounter++;

                updateCustomerQuery += `last_name = $${paramCounter}, `;
                customerParams.push(lastName);
                paramCounter++;
            }

            if (add) {
                updateCustomerQuery += `shipping_address_line1 = $${paramCounter}, `;
                customerParams.push(add);
                paramCounter++;
            }

            if (phone) {
                updateCustomerQuery += `mobile_number = $${paramCounter}, `;
                customerParams.push(phone);
                paramCounter++;
            }

            // Remove trailing comma and space
            updateCustomerQuery = updateCustomerQuery.slice(0, -2);
            updateCustomerQuery += ` WHERE id = $${paramCounter}`;
            customerParams.push(customerId);

            await query(updateCustomerQuery, customerParams);
        }
        // Updating Shipments Table if gm (weight) exists
        if (gm) {
            const updateShipmentQuery = `
                UPDATE shipments 
                SET weight = $1
                WHERE waybill = $2
            `;
            await query(updateShipmentQuery, [gm, waybill]);
        }

        // Updating Orders Table if pt (payment mode) or cod (COD amount) exist
        if (pt || cod) {
            let updateOrderQuery = `UPDATE orders SET `;
            const orderParams = [];
            let paramCounter = 1;

            if (pt) {
                // Standardize to lowercase "prepaid" in the database
                const normalizedPt = pt.toLowerCase() === "pre-paid" ? "prepaid" : pt;

                updateOrderQuery += `payment_mode = $${paramCounter}, `;
                orderParams.push(normalizedPt);
                paramCounter++;

                // If payment mode is "Pre-paid" or "prepaid", set total_cod_amount to 0
                if (normalizedPt.toLowerCase() === "prepaid" || pt.toLowerCase() === "pre-paid") {
                    updateOrderQuery += `total_cod_amount = 0, `;
                }
            }

            // Only update COD amount if payment type is not prepaid and cod parameter exists
            if (cod && !(pt && (pt.toLowerCase() === "prepaid" || pt.toLowerCase() === "pre-paid"))) {
                updateOrderQuery += `total_cod_amount = $${paramCounter}, `;
                orderParams.push(cod);
                paramCounter++;
            }

            // Remove trailing comma and space
            updateOrderQuery = updateOrderQuery.slice(0, -2);
            updateOrderQuery += ` WHERE id = $${paramCounter}`;
            orderParams.push(orderId);

            await query(updateOrderQuery, orderParams);
        }

        return res.status(200).json({
            message: "Shipment details edited and database updated successfully",
            response: response.data,
        });
    } catch (error) {
        console.error("❌ Error in editShipmentDetails:", error);
        return res.status(500).json({
            message: "Failed to edit shipment details and update database",
            error: error.message,
        });
    }
};