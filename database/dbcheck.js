/**
 * Database connection diagnostic (safe to run in production; never prints the password).
 * Run with: npm run dbcheck   (cPanel: Setup Node.js App -> Run JS script -> dbcheck)
 */

const fs = require('fs');
const path = require('path');

// Capture what the hosting environment set BEFORE db.js loads .env (db.js never overrides these)
const presetVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DATABASE_URL']
    .filter(k => process.env[k] !== undefined);

const db = require('./db');
const mysql = require('mysql2/promise');

const envPath = path.resolve(__dirname, '..', '.env');
const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';

console.log('=== Jamia Ashrafia LMS - Database Connection Check ===');
console.log(`Node ${process.version} | mysql2 ${require('mysql2/package.json').version}`);
console.log(`.env file: ${envPath} (${fs.existsSync(envPath) ? 'found' : 'NOT FOUND'})`);
console.log(`Set by hosting environment (override .env): ${presetVars.length ? presetVars.join(', ') : 'none'}`);
console.log(`DB_USER=${db.config.user} | DB_NAME=${db.config.database} | DB_HOST=${db.config.host}:${db.config.port}`);
console.log(`Password length=${password.length} | letters/digits only=${/^[A-Za-z0-9]+$/.test(password) ? 'yes' : 'NO'}`);
console.log('');

const socketCandidates = [
    '/var/lib/mysql/mysql.sock',
    '/var/run/mysqld/mysqld.sock',
    '/run/mysqld/mysqld.sock',
    '/tmp/mysql.sock'
].filter(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

const attempts = [
    { label: `TCP host "${db.config.host}" (what the app uses)`, opts: { host: db.config.host, port: db.config.port } },
    { label: 'TCP host "127.0.0.1"', opts: { host: '127.0.0.1', port: db.config.port } },
    ...socketCandidates.map(s => ({ label: `Unix socket ${s}`, opts: { socketPath: s } }))
];

(async () => {
    for (const a of attempts) {
        let conn;
        try {
            conn = await mysql.createConnection({
                ...a.opts,
                user: db.config.user,
                password,
                database: db.config.database,
                connectTimeout: 8000
            });
            const [[who]] = await conn.query('SELECT CURRENT_USER() AS u, VERSION() AS v');
            console.log(`[OK]     ${a.label} -> connected as ${who.u} (server ${who.v})`);
            const [tables] = await conn.query(
                `SELECT table_name AS t, table_rows AS n FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name IN
                 ('branches','departments','academic_programs','academic_sessions','student_admissions','notifications')`
            );
            console.log(`         tables: ${tables.map(r => `${r.t}(~${r.n})`).join(', ') || 'none of the LMS tables found'}`);
        } catch (err) {
            console.log(`[FAILED] ${a.label} -> ${err.code || ''} ${err.message}`);
        } finally {
            if (conn) await conn.end().catch(() => {});
        }
    }
    await db.pool.end().catch(() => {});
    process.exit(0);
})();
