/**
 * JAMIA ASHRAFIA LAHORE - TRANSLATION CATALOG CHECK
 *   npm run i18n:check
 *
 * - js/i18n/ur.js and js/i18n/ar.js hold the same keys;
 * - every translation keeps the placeholders of its key ({n}, {name} …);
 * - every I18n.t('…') key written in the code exists in both catalogs.
 * Text shown through the live page translator cannot be listed here: open a page in Urdu or Arabic and run
 * I18n.missingStrings() in the browser console to see English text that has no translation yet.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const catalogs = {};
global.I18n = { register(code, entries) { catalogs[code] = entries; } };
require(path.join(root, 'js/i18n/ur.js'));
require(path.join(root, 'js/i18n/ar.js'));

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const placeholders = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const problems = [];

const ur = catalogs.ur || {};
const ar = catalogs.ar || {};
Object.keys(ur).filter(k => !(k in ar)).forEach(k => problems.push(`Missing in ar.js: ${k}`));
Object.keys(ar).filter(k => !(k in ur)).forEach(k => problems.push(`Missing in ur.js: ${k}`));
for (const [code, entries] of Object.entries(catalogs)) {
    for (const [key, value] of Object.entries(entries)) {
        if (placeholders(key) !== placeholders(value)) problems.push(`Placeholder mismatch in ${code}.js: ${key}`);
    }
}

// I18n.t('literal') / I18n.t("literal") / I18n.t(`literal without ${}`)
const sources = ['index.html', 'login.html', 'js/app.js', 'js/auth-rbac.js', 'js/lms-core.js']
    .concat(fs.readdirSync(path.join(root, 'js/modules')).map(f => `js/modules/${f}`));
const known = new Set(Object.keys(ur).map(norm));
const T_CALL = /I18n\.t\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const file of sources) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(T_CALL)) {
        if (m[1] === '`' && m[2].includes('${')) continue;
        const key = norm(m[2].replace(/\\(['"`\\])/g, '$1'));
        if (!known.has(key)) problems.push(`${file}: I18n.t key has no translation: ${key}`);
    }
}

console.log(`Urdu: ${Object.keys(ur).length} entries • Arabic: ${Object.keys(ar).length} entries`);
if (problems.length) {
    problems.forEach(p => console.log(' - ' + p));
    console.log(`${problems.length} problem(s)`);
    process.exit(1);
}
console.log('Catalogs are complete and consistent.');
