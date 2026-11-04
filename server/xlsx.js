/**
 * JAMIA ASHRAFIA LAHORE - MINIMAL EXCEL (.xlsx) READER & WRITER
 *
 * Just enough of the Office Open XML format for spreadsheets people fill in and download: no dependency
 * beyond Node's zlib.
 *
 *   read(buffer)            -> { sheets: [{ name, rows: [[cell text, ...], ...] }] }
 *                              Cell values come back as text exactly as shown in Excel for text cells; numbers as
 *                              plain digits (never 1.2E+12); date cells as their serial number (see excelDate).
 *   write({ sheets })       -> Buffer of a .xlsx workbook. Each sheet: { name, rows, columns: [{ width, text }],
 *                              header: [style per header cell], validations, freezeHeader, hidden }
 *
 * Files are size-checked before and while unzipping (a small file cannot unpack to gigabytes).
 */

const zlib = require('zlib');

const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024;
const MAX_ENTRIES = 500;

// ---------------------------------------------------------------------------
// ZIP container
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function badFile(message) {
    return Object.assign(new Error(message || 'This file is not a valid Excel workbook (.xlsx). Save it from Excel as "Excel Workbook (*.xlsx)" and try again.'), { status: 400, badFile: true });
}

// Map of entry name -> Buffer
function unzip(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 22) throw badFile();
    // End of central directory: the last 22 bytes, or earlier when the archive has a comment
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw badFile();
    const count = buf.readUInt16LE(eocd + 10);
    let ptr = buf.readUInt32LE(eocd + 16);
    if (count > MAX_ENTRIES) throw badFile();
    const files = new Map();
    let total = 0;
    for (let i = 0; i < count; i++) {
        if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) throw badFile();
        const method = buf.readUInt16LE(ptr + 10);
        const compSize = buf.readUInt32LE(ptr + 20);
        const size = buf.readUInt32LE(ptr + 24);
        const nameLen = buf.readUInt16LE(ptr + 28);
        const extraLen = buf.readUInt16LE(ptr + 30);
        const commentLen = buf.readUInt16LE(ptr + 32);
        const local = buf.readUInt32LE(ptr + 42);
        const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
        ptr += 46 + nameLen + extraLen + commentLen;
        if (name.endsWith('/')) continue;
        if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw badFile();
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.slice(start, start + compSize);
        if (raw.length !== compSize) throw badFile();
        total += size;
        if (total > MAX_UNZIPPED_BYTES) throw badFile('This file is too large to read. Split it into smaller files.');
        let data;
        if (method === 0) data = raw;
        else if (method === 8) {
            try {
                data = zlib.inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED_BYTES });
            } catch (e) {
                throw badFile();
            }
        } else throw badFile();
        files.set(name, data);
    }
    return files;
}

function zip(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const nameBuf = Buffer.from(name, 'utf8');
        const body = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const comp = zlib.deflateRawSync(body);
        const crc = crc32(body);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(0, 10);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(comp.length, 18);
        local.writeUInt32LE(body.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(0, 12);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(comp.length, 20);
        central.writeUInt32LE(body.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt32LE(offset, 42);
        locals.push(local, nameBuf, comp);
        centrals.push(central, nameBuf);
        offset += 30 + nameBuf.length + comp.length;
    }
    const centralBuf = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, centralBuf, end]);
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function decode(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
        const k = e.toLowerCase();
        if (k === 'amp') return '&';
        if (k === 'lt') return '<';
        if (k === 'gt') return '>';
        if (k === 'quot') return '"';
        if (k === 'apos') return '\'';
        const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        return Number.isFinite(code) && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
    });
}

function esc(s) {
    // Characters XML 1.0 does not allow are dropped
    return String(s === undefined || s === null ? '' : s)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Namespace prefixes on element names (<x:row>) are removed so one set of patterns reads every producer's files
function plain(xml) {
    return xml.replace(/<(\/?)[A-Za-z][\w.-]*:/g, '<$1');
}

function attr(attrs, name) {
    const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
    return m ? decode(m[1]) : null;
}

// Text of a <si> or <is> element (rich-text runs joined, phonetic guides left out)
function textOf(xml) {
    const body = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let out = '';
    const re = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
    let m;
    while ((m = re.exec(body))) out += decode(m[1] || '');
    return out;
}

// "BC12" -> 54 (0-based column index)
function colIndex(ref) {
    const letters = /^[A-Z]+/i.exec(ref || '');
    if (!letters) return -1;
    let n = 0;
    for (const ch of letters[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
}

function colName(index) {
    let n = index + 1;
    let s = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

// Numbers as Excel would show them in a General cell, but never in exponent form (CNICs typed as numbers)
function numberText(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (Number.isInteger(n)) return BigInt(Math.round(n)).toString();
    return String(Number(n.toPrecision(15)));
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function read(buffer) {
    const files = unzip(buffer);
    const get = name => {
        const f = files.get(name);
        return f ? plain(f.toString('utf8')) : null;
    };
    const workbook = get('xl/workbook.xml');
    if (!workbook) throw badFile();

    const shared = [];
    const sst = get('xl/sharedStrings.xml');
    if (sst) {
        const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
        let m;
        while ((m = re.exec(sst))) shared.push(textOf(m[1] || ''));
    }

    // Sheet names in workbook order, with their part names from the relationships
    const rels = new Map();
    const relXml = get('xl/_rels/workbook.xml.rels') || '';
    let m;
    const relRe = /<Relationship\b([^>]*)\/?>/g;
    while ((m = relRe.exec(relXml))) {
        const id = attr(m[1], 'Id');
        let target = attr(m[1], 'Target') || '';
        target = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
        target = target.replace(/\/[^/]+\/\.\.\//g, '/');
        if (id) rels.set(id, target);
    }
    const sheets = [];
    const sheetRe = /<sheet\b([^>]*)\/?>/g;
    while ((m = sheetRe.exec(workbook))) {
        const name = attr(m[1], 'name') || `Sheet${sheets.length + 1}`;
        const relId = attr(m[1], 'r:id') || attr(m[1], 'id');
        const part = rels.get(relId) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
        const xml = get(part);
        sheets.push({ name, rows: xml ? readSheet(xml, shared) : [] });
    }
    return { sheets };
}

function readSheet(xml, shared) {
    const rows = [];
    const data = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
    if (!data) return rows;
    const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    let rm;
    let nextRow = 0;
    while ((rm = rowRe.exec(data[1]))) {
        const r = Number(attr(rm[1], 'r'));
        const rowIndex = Number.isFinite(r) && r > 0 ? r - 1 : nextRow;
        nextRow = rowIndex + 1;
        if (rowIndex > 1048575) break;
        const cells = [];
        const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
        let cm;
        let nextCol = 0;
        while ((cm = cellRe.exec(rm[2] || ''))) {
            const ref = attr(cm[1], 'r');
            const ci = ref ? colIndex(ref) : nextCol;
            nextCol = ci + 1;
            if (ci < 0 || ci > 16383) continue;
            const type = attr(cm[1], 't');
            const inner = cm[2] || '';
            const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
            let value = '';
            if (type === 's') value = v ? (shared[Number(v[1])] || '') : '';
            else if (type === 'inlineStr') value = textOf((/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(inner) || [])[1] || '');
            else if (type === 'str' || type === 'e') value = v ? decode(v[1]) : '';
            else if (type === 'b') value = v ? (v[1].trim() === '1' ? 'TRUE' : 'FALSE') : '';
            else value = v ? numberText(decode(v[1]).trim()) : '';
            cells[ci] = value;
        }
        for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
        rows[rowIndex] = cells;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    return rows;
}

// Excel date serial (1900 system) -> 'YYYY-MM-DD'
function excelDate(serial) {
    const n = Number(serial);
    if (!Number.isFinite(n) || n < 1 || n > 2958465) return null;
    const ms = Math.round((n - 25569) * 86400000);
    return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Cell styles (index into cellXfs below)
const STYLE = { normal: 0, headRequired: 1, headOptional: 2, text: 3, wrap: 4, title: 5, error: 6, bold: 7 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF064E3B"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFB45309"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF065F46"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="49" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="49" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(sheet) {
    const cols = sheet.columns || [];
    const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
    if (sheet.freezeHeader) {
        out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>');
    }
    if (cols.length) {
        out.push('<cols>');
        cols.forEach((c, i) => {
            const style = c.style !== undefined ? c.style : (c.text ? STYLE.text : null);
            out.push(`<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"${style !== null ? ` style="${style}"` : ''}/>`);
        });
        out.push('</cols>');
    }
    out.push('<sheetData>');
    (sheet.rows || []).forEach((row, ri) => {
        const rowStyle = (sheet.rowStyles || [])[ri];
        const cells = [];
        (row || []).forEach((value, ci) => {
            if (value === undefined || value === null || value === '') return;
            const ref = `${colName(ci)}${ri + 1}`;
            let style = ri === 0 && sheet.header ? sheet.header[ci] : (rowStyle !== undefined ? rowStyle : (cols[ci] && cols[ci].text ? STYLE.text : 0));
            if (style === undefined) style = 0;
            const s = style ? ` s="${style}"` : '';
            if (typeof value === 'number' && Number.isFinite(value)) cells.push(`<c r="${ref}"${s}><v>${value}</v></c>`);
            else cells.push(`<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`);
        });
        const ht = ri === 0 && sheet.headerHeight ? ` ht="${sheet.headerHeight}" customHeight="1"` : '';
        out.push(`<row r="${ri + 1}"${ht}>${cells.join('')}</row>`);
    });
    out.push('</sheetData>');
    if (sheet.autoFilter && (sheet.rows || []).length) {
        out.push(`<autoFilter ref="A1:${colName(Math.max(0, (sheet.rows[0] || []).length - 1))}${sheet.rows.length}"/>`);
    }
    const dv = sheet.validations || [];
    if (dv.length) {
        out.push(`<dataValidations count="${dv.length}">`);
        for (const v of dv) {
            const a = [];
            if (v.list) a.push('type="list"');
            a.push('allowBlank="1"');
            if (v.warnOnly) a.push('errorStyle="warning"');
            if (v.prompt) a.push('showInputMessage="1"', `promptTitle="${esc(String(v.title || '').slice(0, 32))}"`, `prompt="${esc(String(v.prompt).slice(0, 255))}"`);
            if (v.list) a.push('showErrorMessage="1"', `errorTitle="${esc(String(v.errorTitle || 'Not in the list').slice(0, 32))}"`, `error="${esc(String(v.error || 'Choose a value from the drop-down list.').slice(0, 255))}"`);
            a.push(`sqref="${v.range}"`);
            out.push(v.list ? `<dataValidation ${a.join(' ')}><formula1>${esc(v.list)}</formula1></dataValidation>` : `<dataValidation ${a.join(' ')}/>`);
        }
        out.push('</dataValidations>');
    }
    out.push('</worksheet>');
    return out.join('');
}

function write({ sheets }) {
    const sheetEntries = sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }));
    const files = [
        { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` },
        { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
        { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>` },
        { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
        { name: 'xl/styles.xml', data: STYLES_XML },
        ...sheetEntries
    ];
    return zip(files);
}

module.exports = { read, write, excelDate, colName, STYLE, unzip, zip };
