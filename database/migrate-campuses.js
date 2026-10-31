/**
 * Gives existing records a campus (classes, students, teachers, staff, admission applications).
 * Safe to run any number of times: only records without campus fields are changed and nothing is removed.
 * The server also runs this at start-up; this script lets you run it (and see what changed) by hand.
 *
 *   npm run migrate:campuses
 */

const db = require('./db');
const campus = require('../server/campus');

(async () => {
    if (!(await db.testConnection())) process.exit(1);
    const fallback = await campus.defaultCampusId(true);
    if (!fallback) {
        console.log('No campus is set up yet (Institution Setup > Campuses). Nothing to do.');
        process.exit(0);
    }
    console.log(`Default campus: ${fallback}`);
    const counts = await campus.migrate(msg => console.log(msg));
    console.log(`Done. Changed: ${JSON.stringify(counts)}`);
    process.exit(0);
})().catch(err => {
    console.error('Campus migration failed:', err.message);
    process.exit(1);
});
