/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LMS DATABASE ADAPTER
 * Production-ready MySQL / MariaDB connection pool for cPanel Shared Hosting & Local Staging
 * Supports parameterized queries, transactions, and environment variable configuration.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// 1. Lightweight .env loader if .env exists in project root (no external dependencies needed)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        });
    } catch (e) {
        console.warn('[DB] Warning: Could not read local .env file:', e.message);
    }
}

// 2. Parse database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'jamia_ashrafia_lms',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// Support DATABASE_URL if provided (e.g. mysql://user:pass@host:3306/dbname)
if (process.env.DATABASE_URL) {
    try {
        const parsed = new URL(process.env.DATABASE_URL);
        dbConfig.host = parsed.hostname;
        if (parsed.port) dbConfig.port = parseInt(parsed.port, 10);
        if (parsed.username) dbConfig.user = decodeURIComponent(parsed.username);
        if (parsed.password) dbConfig.password = decodeURIComponent(parsed.password);
        if (parsed.pathname) dbConfig.database = parsed.pathname.replace(/^\//, '');
    } catch (err) {
        console.warn('[DB] Could not parse DATABASE_URL, falling back to individual DB_* envs:', err.message);
    }
}

// 3. Create connection pool
const pool = mysql.createPool(dbConfig);

// 4. Test connection on startup
async function testConnection() {
    try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        console.log(`[DB] Connected successfully to MySQL database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}`);
        return true;
    } catch (err) {
        console.error('[DB] Connection Error: Could not connect to MySQL database.');
        console.error(`[DB] Target: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        console.error(`[DB] Reason: ${err.message}`);
        console.error('[DB] Please verify DB_HOST, DB_NAME, DB_USER, DB_PASSWORD environment variables.');
        return false;
    }
}

module.exports = {
    pool,
    query: (sql, params) => pool.execute(sql, params),
    getConnection: () => pool.getConnection(),
    testConnection,
    config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user
    }
};
