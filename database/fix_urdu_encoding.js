// Reverses UTF-8 text that was mis-read as CP850 (Windows console) and re-saved as UTF-8.
// Usage: node database/fix_urdu_encoding.js            (dry run: lists what would change)
//        node database/fix_urdu_encoding.js --apply    (writes the repaired text)
// Cause: .sql seed files imported through the Windows mysql console without --default-character-set=utf8mb4.
const db = require('./db');
const APPLY = process.argv.includes('--apply');
const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
const REV = new Map([...CP850].map((c, i) => [c, 0x80 + i]));
function repair(s) {
  if (typeof s !== 'string' || !/[^\x00-\x7f]/.test(s)) return null;
  const bytes = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (REV.has(ch)) bytes.push(REV.get(ch));
    else return null; // contains a char CP850 cannot produce: not this kind of damage
  }
  let out;
  try { out = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes)); } catch { return null; }
  return out !== s && /[؀-ۿ]/.test(out) ? out : null;
}
(async () => {
  const [cols] = await db.query(`SELECT c.TABLE_NAME t, c.COLUMN_NAME c FROM information_schema.COLUMNS c
    JOIN information_schema.TABLES tb ON tb.TABLE_SCHEMA=c.TABLE_SCHEMA AND tb.TABLE_NAME=c.TABLE_NAME AND tb.TABLE_TYPE='BASE TABLE'
    WHERE c.TABLE_SCHEMA = DATABASE() AND c.DATA_TYPE IN ('char','varchar','text','tinytext','mediumtext','longtext')`);
  const byTable = {};
  cols.forEach(r => (byTable[r.t] = byTable[r.t] || []).push(r.c));
  let total = 0;
  for (const [t, cs] of Object.entries(byTable)) {
    const [pk] = await db.query(`SELECT COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION`, [t]);
    if (!pk.length) { continue; }
    const keys = pk.map(r => r.c);
    for (const c of cs) {
      const [rows] = await db.query(`SELECT ${keys.map(k => '`'+k+'`').join(',')}, \`${c}\` v FROM \`${t}\` WHERE \`${c}\` REGEXP '[^ -~]'`);
      for (const r of rows) {
        const fixed = repair(r.v);
        if (!fixed) continue;
        total++;
        console.log(`${t}.${c} [${keys.map(k => r[k]).join(',')}]: ${fixed}`);
        if (APPLY) await db.query(`UPDATE \`${t}\` SET \`${c}\` = ? WHERE ${keys.map(k => '`'+k+'` = ?').join(' AND ')} AND \`${c}\` = ?`, [fixed, ...keys.map(k => r[k]), r.v]);
      }
    }
  }
  console.log(`${APPLY ? 'Fixed' : 'Would fix'} ${total} value(s).`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
