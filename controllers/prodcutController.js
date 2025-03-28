const { query } = require('../pgadmin'); // PostgreSQL query function
const authentication = require("../middleware/authentication");

// Create a new category
exports.createCategory = async (req, res) => {
    try {
        const { name, description, warehouse_id } = req.body;
        const authToken = req.headers.authorization?.split(' ')[1];

        if (!authToken) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        // Insert category into PostgreSQL
        const result = await query(
            `INSERT INTO categories (name, description, warehouse_id) VALUES ($1, $2, $3) RETURNING *`,
            [name, description, warehouse_id]
        );

        return res.status(201).json({
            message: "Category created successfully",
            category: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error creating category:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};
// Get categories by userId
exports.getCategoriesByUserId = async (req, res) => {
    try {
        const authToken = req.headers.authorization?.split(' ')[1];

        if (!authToken) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        // Fetch categories that belong to warehouses owned by the user
        const result = await query(
            `SELECT c.* 
             FROM categories c
             JOIN warehouses w ON c.warehouse_id = w.id
             WHERE w.user_id = $1 
             ORDER BY c.created_at DESC`,
            [userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "No categories found for this user" });
        }

        return res.status(200).json({
            message: "Categories retrieved successfully",
            categories: result.rows,
        });

    } catch (err) {
        console.error("❌ Error fetching categories by userId:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};


// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const result = await query("SELECT * FROM categories ORDER BY created_at DESC");

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "No categories found" });
        }

        return res.status(200).json({
            message: "Categories retrieved successfully",
            categories: result.rows,
        });

    } catch (err) {
        console.error("❌ Error fetching categories:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Get a single category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.body;

        const result = await query("SELECT * FROM categories WHERE id = $1", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.status(200).json({
            message: "Category retrieved successfully",
            category: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error fetching category:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Update a category
exports.updateCategory = async (req, res) => {
    try {
        const { id, name, description, warehouse_id } = req.body;
        console.log(req.body);

        const result = await query(
            `UPDATE categories 
             SET name = $1, description = $2, warehouse_id = $3, created_at = NOW()
             WHERE id = $4 RETURNING *`,
            [name, description, warehouse_id, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.status(200).json({
            message: "Category updated successfully",
            category: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error updating category:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.body;

        const result = await query("DELETE FROM categories WHERE id = $1 RETURNING *", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.status(200).json({
            message: "Category deleted successfully",
            deletedCategory: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error deleting category:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};


// Product Controllers
// Create a new product
exports.createProduct = async (req, res) => {
    try {
        const authToken = req.headers.authorization?.split(" ")[1];
        if (!authToken) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const userId = authentication.decodeToken(authToken);
        if (!userId) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        const { item_name, sku_code, category_id, price, discount_type, discount, product_image } = req.body;

        // Validate required fields
        if (!item_name || !sku_code || !category_id || !price) {
            return res.status(400).json({ message: "Item name, SKU, category, and price are required" });
        }

        // Validate price and discount
        if (price <= 0) {
            return res.status(400).json({ message: "Price must be greater than zero" });
        }
        if (discount < 0) {
            return res.status(400).json({ message: "Discount cannot be negative" });
        }
        if (discount_type && !["percentage", "amount"].includes(discount_type)) {
            return res.status(400).json({ message: "Invalid discount type" });
        }

        // Check if category exists and belongs to the user
        const categoryResult = await query(
            `SELECT w.user_id FROM categories c 
             JOIN warehouses w ON c.warehouse_id = w.id 
             WHERE c.id = $1`,
            [category_id]
        );

        if (categoryResult.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" });
        }

        if (categoryResult.rows[0].user_id !== userId) {
            return res.status(403).json({ message: "Unauthorized to add product to this category" });
        }

        // Insert new product
        const result = await query(
            `INSERT INTO products (item_name, sku_code, category_id, price, discount_type, discount, product_image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [item_name, sku_code, category_id, price, discount_type, discount, product_image]
        );

        return res.status(201).json({
            message: "Product created successfully",
            product: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error creating product:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Get all products
exports.getAllProducts = async (req, res) => {
    try {
        const result = await query("SELECT * FROM products ORDER BY created_at DESC");

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "No products found" });
        }

        return res.status(200).json({
            message: "Products retrieved successfully",
            products: result.rows,
        });

    } catch (err) {
        console.error("❌ Error fetching products:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Get all products by category
exports.getProductsByCategory = async (req, res) => {
    try {
        const { category_id } = req.body;

        if (!category_id) {
            return res.status(400).json({ message: "Category ID is required" });
        }

        // Check if category exists
        const categoryCheck = await query("SELECT * FROM categories WHERE id = $1", [category_id]);
        if (categoryCheck.rowCount === 0) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Fetch products under the given category
        const result = await query(
            "SELECT * FROM products WHERE category_id = $1 ORDER BY created_at DESC",
            [category_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "No products found for this category" });
        }

        return res.status(200).json({
            message: "Products retrieved successfully",
            products: result.rows,
        });

    } catch (err) {
        console.error("❌ Error fetching products by category:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};


// Get product by ID
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.body;

        const result = await query("SELECT * FROM products WHERE id = $1", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json({
            message: "Product retrieved successfully",
            product: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error fetching product:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Update product
exports.updateProduct = async (req, res) => {
    try {
        const { id, item_name, price, discount_type, discount, product_image } = req.body;

        // Check if product exists
        const productCheck = await query("SELECT * FROM products WHERE id = $1", [id]);
        if (productCheck.rowCount === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Update product
        const result = await query(
            `UPDATE products 
             SET item_name = COALESCE($1, item_name),
                 price = COALESCE($2, price),
                 discount_type = COALESCE($3, discount_type),
                 discount = COALESCE($4, discount),
                 product_image = COALESCE($5, product_image) 
             WHERE id = $6 RETURNING *`,
            [item_name, price, discount_type, discount, product_image, id]
        );

        return res.status(200).json({
            message: "Product updated successfully",
            product: result.rows[0],
        });

    } catch (err) {
        console.error("❌ Error updating product:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Delete product
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.body;

        // Check if product exists
        const productCheck = await query("SELECT * FROM products WHERE id = $1", [id]);
        if (productCheck.rowCount === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Delete product
        await query("DELETE FROM products WHERE id = $1", [id]);

        return res.status(200).json({ message: "Product deleted successfully" });

    } catch (err) {
        console.error("❌ Error deleting product:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Get products by userId
exports.getProductsByUserId = async (req, res) => {
    try {
        const {userId} = req.body;

        const result = await query(
            `SELECT p.* FROM products p 
             JOIN categories c ON p.category_id = c.id 
             JOIN warehouses w ON c.warehouse_id = w.id 
             WHERE w.user_id = $1 ORDER BY p.created_at DESC`,
            [userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "No products found for this user" });
        }

        return res.status(200).json({
            message: "Products retrieved successfully",
            products: result.rows,
        });

    } catch (err) {
        console.error("❌ Error fetching products by userId:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

