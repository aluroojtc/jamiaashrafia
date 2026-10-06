/**
 * JAMIA ASHRAFIA LAHORE - CREATE OR RECOVER THE SUPER ADMIN ACCOUNT
 *
 * Run on the server (never through the browser):
 *   npm run bootstrap-admin
 *   npm run bootstrap-admin -- --email mohtamim@jamiaashrafia.org --name "Maulana ..."
 *
 * - No Super Admin yet: creates one (id u_admin unless --id is given).
 * - A Super Admin exists: issues it a new temporary password (choose a specific one with --id or --email).
 * The temporary password is printed once and must be changed at first sign-in. Open sessions of that account end.
 */

const db = require('./db');
const lmsApi = require('../server/lms-api');
const auth = require('../server/auth');

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}

async function main() {
    if (!(await db.testConnection())) process.exit(1);
    await lmsApi.ensureSchema();

    const [rows] = await db.query(`SELECT id, data FROM lms_records WHERE collection = 'users' AND deleted = 0`);
    const users = rows.map(r => JSON.parse(r.data));
    const wantId = arg('id');
    const wantEmail = (arg('email') || '').toLowerCase();
    const admins = users.filter(u => u.role === 'SUPER_ADMIN');

    let target = admins.find(u => (wantId && u.id === wantId) || (wantEmail && String(u.email || '').toLowerCase() === wantEmail));
    if (!target && !wantId && !wantEmail) target = admins[0];
    if ((wantId || wantEmail) && !target && admins.length) {
        console.error('No Super Admin matches that --id / --email. Existing Super Admin accounts:');
        admins.forEach(u => console.error(`  ${u.id}  ${u.email || ''}`));
        process.exit(1);
    }

    let created = false;
    if (!target) {
        const id = wantId || 'u_admin';
        const email = wantEmail || 'mohtamim@jamiaashrafia.org';
        const clash = users.find(u => u.id === id || String(u.email || '').toLowerCase() === email);
        if (clash) {
            console.error(`Cannot create the Super Admin: account ${clash.id} already uses that id or email.`);
            process.exit(1);
        }
        target = {
            id,
            name: arg('name') || 'Super Admin (Mohtamim)',
            urduName: '',
            role: 'SUPER_ADMIN',
            designation: 'Principal / Mohtamim',
            email,
            status: 'ACTIVE',
            branchId: 'b1',
            avatar: 'SA',
            createdAt: new Date().toISOString()
        };
        await db.query(
            `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at)
             VALUES ('users', ?, ?, 0, 'bootstrap', NOW(3))
             ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0, updated_by = 'bootstrap', updated_at = NOW(3)`,
            [id, JSON.stringify(target)]
        );
        created = true;
    }

    const password = auth.temporaryPassword(12);
    await auth.setPassword(null, target.id, password, true);
    // Super Admin authority is confirmed by the protected super_admins table
    await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'bootstrap')`, [target.id]);
    await auth.revokeUserSessions(target.id);

    console.log('');
    console.log(created ? 'Super Admin account created.' : 'New temporary password issued for the Super Admin.');
    console.log(`  Sign in with:  ${target.email || target.id}`);
    console.log(`  Temporary password:  ${password}`);
    console.log('  You will be asked to choose a new password at first sign-in. This password is not stored anywhere else.');
    console.log('');
    process.exit(0);
}

main().catch(err => {
    console.error('Bootstrap failed:', err.message);
    process.exit(1);
});
