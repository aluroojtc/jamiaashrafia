/**
 * JAMIA ASHRAFIA LAHORE - ISSUE TEMPORARY PASSWORDS
 *
 * Accounts no longer fall back to a shared default password, and the old demo passwords were public.
 * This gives accounts a random temporary password that must be changed at first sign-in.
 *
 *   npm run issue-temp-passwords                 accounts that have no password yet
 *   npm run issue-temp-passwords -- --all        every account (use after the old demo passwords were in use)
 *   npm run issue-temp-passwords -- --role STUDENT
 *   npm run issue-temp-passwords -- --user u_student_1
 *   add --dry-run to list the accounts without changing anything
 *
 * The passwords are written to private/temp-passwords-<time>.csv (never served by the web server).
 * Hand them out through the Academic Office, then delete the file.
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');
const lmsApi = require('../server/lms-api');
const auth = require('../server/auth');

const has = flag => process.argv.includes(`--${flag}`);
function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}
const csv = v => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;

async function main() {
    if (!(await db.testConnection())) process.exit(1);
    await lmsApi.ensureSchema();

    const [rows] = await db.query(`SELECT data FROM lms_records WHERE collection = 'users' AND deleted = 0`);
    const [creds] = await db.query(`SELECT user_id FROM user_credentials`);
    const withPassword = new Set(creds.map(c => c.user_id));
    const role = (arg('role') || '').toUpperCase();
    const only = arg('user');

    const targets = rows.map(r => JSON.parse(r.data)).filter(u => {
        if (only) return u.id === only;
        if (role && u.role !== role) return false;
        return has('all') || !withPassword.has(u.id);
    });

    if (!targets.length) {
        console.log('No matching accounts. Nothing to do.');
        process.exit(0);
    }

    if (has('dry-run')) {
        console.log(`${targets.length} account(s) would get a temporary password:`);
        targets.forEach(u => console.log(`  ${u.id.padEnd(28)} ${String(u.role || '').padEnd(15)} ${u.email || u.rollNo || ''}`));
        process.exit(0);
    }

    const lines = ['"User ID","Name","Role","Sign in with","Temporary password"'];
    for (const u of targets) {
        const password = auth.temporaryPassword(10);
        await auth.setPassword(null, u.id, password, true);
        await auth.revokeUserSessions(u.id);
        lines.push([u.id, u.name, u.role, u.email || u.rollNo || u.username || u.id, password].map(csv).join(','));
    }

    const dir = path.resolve(__dirname, '..', 'private');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `temp-passwords-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
    fs.writeFileSync(file, '﻿' + lines.join('\n'), { mode: 0o600 });

    console.log(`Issued temporary passwords for ${targets.length} account(s).`);
    console.log(`Saved to: ${file}`);
    console.log('Each person must choose a new password at first sign-in. Delete the file once the passwords are handed out.');
    process.exit(0);
}

main().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
