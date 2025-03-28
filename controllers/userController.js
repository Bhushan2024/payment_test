const { query } = require('../pgadmin'); // Import the PostgreSQL query function

// Get all clients
exports.getAllClients = async (req, res) => {
    try {
        // Fetch all clients from the 'users' table, excluding unnecessary fields
        const clients = await query(
            "SELECT id, name, email, contact_number, role, active, margin FROM users WHERE role = 'client'"
        );

        if (clients.rows.length === 0) {
            return res.status(404).json({ message: "No clients found" });
        }

        return res.status(200).json(clients.rows);
    } catch (err) {
        console.error("Error fetching clients:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Deactivate a client (set active to false)
exports.deactivateClient = async (req, res) => {
    try {
        const { id } = req.body; // Get client ID from request body
        if (!id) {
            return res.status(400).json({ message: "Client ID is required" });
        }

        // Update the 'active' field in the database
        const client = await query(
            "UPDATE users SET active = FALSE WHERE id = $1 RETURNING *",
            [id]
        );

        if (client.rowCount === 0) {
            return res.status(404).json({ message: "Client not found" });
        }

        return res.status(200).json({ message: "Client deactivated successfully", client: client.rows[0] });
    } catch (err) {
        console.error("Error deactivating client:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Activate a client (set active to true)
exports.activateClient = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Client ID is required" });
        }

        // Update the 'active' field in the database
        const client = await query(
            "UPDATE users SET active = TRUE WHERE id = $1 RETURNING *",
            [id]
        );

        if (client.rowCount === 0) {
            return res.status(404).json({ message: "Client not found" });
        }

        return res.status(200).json({ message: "Client activated successfully", client: client.rows[0] });
    } catch (err) {
        console.error("Error activating client:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Mark a client as permanent by changing their role (assuming 'admin' is permanent)
exports.makePermanentClient = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Client ID is required" });
        }

        // Update the 'role' field to 'admin' (assuming this makes them permanent)
        const client = await query(
            "UPDATE users SET role = 'admin' WHERE id = $1 RETURNING *",
            [id]
        );

        if (client.rowCount === 0) {
            return res.status(404).json({ message: "Client not found" });
        }

        return res.status(200).json({ message: "Client marked as permanent", client: client.rows[0] });
    } catch (err) {
        console.error("Error making client permanent:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// Delete a client permanently from the database
exports.deleteClient = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Client ID is required" });
        }

        // Delete the user from the 'users' table
        const client = await query(
            "DELETE FROM users WHERE id = $1 RETURNING *",
            [id]
        );

        if (client.rowCount === 0) {
            return res.status(404).json({ message: "Client not found" });
        }

        return res.status(200).json({ message: "Client deleted permanently", client: client.rows[0] });
    } catch (err) {
        console.error("Error deleting client:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};
