const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function initDB() {
            if (!process.env.DATABASE_URL) return;
            const q = "CREATE TABLE IF NOT EXISTS clients (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(50) NOT NULL, event VARCHAR(255), status VARCHAR(100) DEFAULT 'Bekliyor', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);";
            await pool.query(q);
}
async function getClients() {
            const res = await pool.query("SELECT * FROM clients ORDER BY created_at DESC");
            return res.rows.map(r => ({ id: r.id, name: r.name, phone: r.phone, event: r.event, status: r.status }));
}
async function updateStatus(id, status) {
            await pool.query("UPDATE clients SET status = $1 WHERE id = $2", [status, id]);
}
async function addClient(name, phone, event) {
            const res = await pool.query("INSERT INTO clients (name, phone, event) VALUES ($1, $2, $3) RETURNING id", [name, phone, event]);
            return res.rows[0].id;
}
module.exports = { initDB, getClients, updateStatus, addClient };
