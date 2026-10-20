/**
 * JAMIA ASHRAFIA LAHORE - LOCALIZATION (English / اردو / العربية)
 *
 * One catalog per language (js/i18n/ur.js, js/i18n/ar.js) maps the English source text to its translation,
 * gettext-style: the English text is the key, so the English UI needs no catalog at all.
 *
 * Load this file synchronously in <head>, before any stylesheet that depends on [dir]. It:
 *  - picks the language (saved choice, else the browser's language, else English) and sets <html lang dir>
 *    before the first paint, so Urdu and Arabic pages render right-to-left from the start;
 *  - loads that language's catalog;
 *  - translates every text node and the title / placeholder / aria-label / alt attributes as pages and
 *    modules render (a MutationObserver), so module templates keep their English source text;
 *  - translates alert / confirm / prompt messages.
 *
 * Catalog keys may hold placeholders:
 *   {n}     a number, e.g. '{n} students enrolled'  ->  '{n} طلبہ داخل'
 *   {name}  any text, e.g. 'Welcome, {name}'        ->  'خوش آمدید، {name}'
 * A translated text may move the placeholders; a captured {name} value is itself translated when the catalog has it.
 *
 * Code that builds a sentence around markup (<strong>, links) should call I18n.t('… {x} …', { x: html })
 * so the sentence is translated whole. Mark user content that must never be translated with translate="no".
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'JAMIA_LANG';
    const LANGUAGES = {
        en: { name: 'English', dir: 'ltr', locale: 'en-GB' },
        ur: { name: 'اردو', dir: 'rtl', locale: 'ur-PK' },
        ar: { name: 'العربية', dir: 'rtl', locale: 'ar-u-ca-gregory-nu-latn' }
    };
    const CATALOG_VERSION = '1.1';

    function readStored() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    function writeStored(code) {
        try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* private mode: the choice lasts this page only */ }
    }

    function browserLanguage() {
        const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
        for (const l of list) {
            const code = String(l).slice(0, 2).toLowerCase();
            if (LANGUAGES[code]) return code;
        }
        return 'en';
    }

    const stored = readStored();
    const lang = LANGUAGES[stored] ? stored : browserLanguage();
    const meta = LANGUAGES[lang];

    const root = document.documentElement;
    root.lang = lang;
    root.dir = meta.dir;

    // ---------------------------------------------------------------------
    // Catalog lookup
    // ---------------------------------------------------------------------
    const all = new Map();       // every catalog key -> translation (used by I18n.t)
    const exact = new Map();     // 'Save' -> 'محفوظ کریں'
    const numeric = new Map();   // '{n} students' -> '{n} طلبہ'
    const patterns = [];         // keys with {name} placeholders, tried in order (longest first)
    const memo = new Map();      // text -> translation, or null when the catalog has none
    const missing = new Set();   // English text seen on screen without a translation (for translators)

    const NUM_RE = /\d+(?:[.,:/]\d+)*/g;
    const PLACEHOLDER_RE = /\{(\w+)\}/g;
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const norm = s => String(s).replace(/\s+/g, ' ').trim();

    function register(code, entries) {
        if (code !== lang || !entries) return;
        memo.clear();
        missing.clear();
        Object.keys(entries).forEach(rawKey => {
            const key = norm(rawKey);
            const value = entries[rawKey];
            if (!key || typeof value !== 'string' || !value) return;
            all.set(key, value);
            const names = [...key.matchAll(PLACEHOLDER_RE)].map(m => m[1]);
            if (!names.length) { exact.set(key, value); return; }
            if (names.every(n => n === 'n')) { numeric.set(key, value); return; }
            // Literal text around the placeholders; the longest piece is a cheap pre-check before the regex
            const literals = key.split(PLACEHOLDER_RE).filter((_, i) => i % 2 === 0);
            const anchor = literals.reduce((a, b) => (b.trim().length > a.length ? b.trim() : a), '');
            const source = '^' + key.split(PLACEHOLDER_RE).map((part, i) => (i % 2 === 0 ? escapeRe(part) : (part === 'n' ? '(\\d+(?:[.,:/]\\d+)*)' : '(.+?)'))).join('') + '$';
            patterns.push({ re: new RegExp(source), names, value, anchor, weight: literals.join('').length });
        });
        patterns.sort((a, b) => b.weight - a.weight);
    }

    function fill(template, values) {
        return template.replace(PLACEHOLDER_RE, (m, name) => (Object.prototype.hasOwnProperty.call(values, name) ? values[name] : m));
    }

    // Punctuation that may sit around a catalog string: 'Status:' uses the entry for 'Status'
    const SEPARATORS = [' • ', ' — ', ' – ', ' | '];
    const SUFFIXES = [' *', '*', ':', '...', '…', ' →', '→', '•', '.', '!', '?', ')'];
    const PREFIXES = [['← ', '← '], ['•', '• '], ['(', '('], ['— ', '— ']];

    function lookup(text, depth) {
        if (depth === 0 && memo.has(text)) return memo.get(text);
        let out = exact.has(text) ? exact.get(text) : null;

        if (out === null && /\d/.test(text)) {
            const nums = text.match(NUM_RE) || [];
            const tpl = text.replace(NUM_RE, '{n}');
            if (numeric.has(tpl)) {
                let i = 0;
                out = numeric.get(tpl).replace(/\{n\}/g, () => nums[i++]);
            }
        }
        if (out === null) {
            for (const p of patterns) {
                if (p.anchor && !text.includes(p.anchor)) continue;
                const m = p.re.exec(text);
                if (!m) continue;
                const values = {};
                p.names.forEach((name, i) => {
                    const v = m[i + 1];
                    values[name] = name === 'n' ? v : (depth < 2 ? (lookup(norm(v), depth + 1) || v) : v);
                });
                out = fill(p.value, values);
                break;
            }
        }
        // Composite labels ("Weekly Quiz • Online", "08:00 AM – 09:30 AM"): translate each part that the catalog knows
        if (out === null && depth < 2) {
            for (const sep of SEPARATORS) {
                if (!text.includes(sep)) continue;
                let changed = false;
                const parts = text.split(sep).map(part => {
                    const t = part.trim();
                    const tr = /[A-Za-z]/.test(t) ? lookup(t, depth + 1) : null;
                    if (tr === null) return t;
                    changed = true;
                    return tr;
                });
                if (changed) { out = parts.join(sep); break; }
            }
        }
        if (out === null && depth < 2) {
            for (const s of SUFFIXES) {
                if (text.length > s.length && text.endsWith(s)) {
                    const inner = lookup(text.slice(0, -s.length).trim(), depth + 1);
                    if (inner !== null) { out = inner + (s === '?' ? '؟' : s); break; }
                }
            }
        }
        if (out === null && depth < 2) {
            for (const [s, joined] of PREFIXES) {
                if (text.length > s.length && text.startsWith(s)) {
                    const inner = lookup(text.slice(s.length).trim(), depth + 1);
                    if (inner !== null) { out = joined + inner; break; }
                }
            }
        }
        if (depth === 0) {
            if (memo.size > 50000) memo.clear();
            memo.set(text, out);
        }
        return out;
    }

    // Translates a piece of on-screen text, keeping the surrounding white space
    function translateText(raw) {
        if (lang === 'en' || !raw) return raw;
        const text = norm(raw);
        if (!text || !/[A-Za-z]/.test(text)) return raw;
        const out = lookup(text, 0);
        if (out === null) {
            // Text already in Urdu / Arabic script (a translation, or names typed in Urdu) is not reported
            if (missing.size < 5000 && !/[؀-ۿ]/.test(text)) missing.add(text);
            return raw;
        }
        const lead = raw.match(/^\s*/)[0];
        const trail = raw.match(/\s*$/)[0];
        return (lead ? ' ' : '') + out + (trail ? ' ' : '');
    }

    // Multi-line messages (alerts, confirms) are translated line by line
    function translateMessage(message) {
        if (lang === 'en' || message === undefined || message === null) return message;
        const whole = translateText(String(message));
        if (whole !== String(message)) return whole;
        return String(message).split('\n').map(line => translateText(line)).join('\n');
    }

    // I18n.t('Welcome, {name}', { name }) — for strings built in code. Values are inserted as given.
    function t(key, params) {
        let template = key;
        if (lang !== 'en') {
            const k = norm(key);
            if (all.has(k)) template = all.get(k);
            else if (missing.size < 5000) missing.add(k);
        }
        return params ? fill(template, params) : template;
    }

    // ---------------------------------------------------------------------
    // Live DOM translation
    // ---------------------------------------------------------------------
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'TEMPLATE', 'svg', 'SVG']);
    const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tooltip'];
    const BUTTON_INPUTS = new Set(['button', 'submit', 'reset']);

    function skipElement(el) {
        return SKIP_TAGS.has(el.tagName) || el.getAttribute('translate') === 'no' || el.isContentEditable;
    }

    function translateTextNode(node) {
        const before = node.nodeValue;
        const after = translateText(before);
        if (after === before) return;
        const parent = node.parentNode;
        // An <option> without a value submits its text: keep submitting the English text
        if (parent && parent.tagName === 'OPTION' && !parent.hasAttribute('value')) {
            parent.setAttribute('value', parent.value);
        }
        node.nodeValue = after;
    }

    function translateAttributes(el) {
        for (const attr of ATTRS) {
            const v = el.getAttribute(attr);
            if (v) {
                const tv = translateText(v);
                if (tv !== v) el.setAttribute(attr, tv);
            }
        }
        if (el.tagName === 'INPUT' && BUTTON_INPUTS.has(el.type) && el.value) {
            const tv = translateText(el.value);
            if (tv !== el.value) el.value = tv;
        }
    }

    function walk(node) {
        if (node.nodeType === 3) {
            const p = node.parentNode;
            if (p && p.nodeType === 1 && (skipElement(p) || (p.closest && p.closest('[translate="no"]')))) return;
            translateTextNode(node);
            return;
        }
        if (node.nodeType !== 1 && node.nodeType !== 11) return;
        if (node.nodeType === 1) {
            if (skipElement(node)) return;
            translateAttributes(node);
        }
        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeType === 3) translateTextNode(child);
            else walk(child);
        }
    }

    function translateTree(rootNode) {
        if (lang === 'en' || !rootNode) return;
        if (rootNode.nodeType === 1 && rootNode.closest && rootNode.closest('[translate="no"]')) return;
        walk(rootNode);
    }

    let observer = null;
    function startObserver() {
        if (lang === 'en' || observer || typeof MutationObserver === 'undefined') return;
        observer = new MutationObserver(records => {
            for (const r of records) {
                if (r.type === 'childList') {
                    r.addedNodes.forEach(n => {
                        if (n.nodeType === 3) {
                            const p = n.parentNode;
                            if (p && p.nodeType === 1 && !skipElement(p) && !(p.closest && p.closest('[translate="no"]'))) translateTextNode(n);
                        } else if (n.isConnected) translateTree(n);
                    });
                } else if (r.type === 'characterData') {
                    const p = r.target.parentNode;
                    if (p && p.nodeType === 1 && !skipElement(p) && !(p.closest && p.closest('[translate="no"]'))) translateTextNode(r.target);
                } else if (r.type === 'attributes') {
                    const el = r.target;
                    if (!(el.closest && el.closest('[translate="no"]'))) translateAttributes(el);
                }
            }
        });
        observer.observe(document.documentElement, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ATTRS.concat(['value'])
        });
    }

    // ---------------------------------------------------------------------
    // Native dialogs
    // ---------------------------------------------------------------------
    if (lang !== 'en') {
        const nativeAlert = window.alert.bind(window);
        const nativeConfirm = window.confirm.bind(window);
        const nativePrompt = window.prompt.bind(window);
        window.alert = message => nativeAlert(translateMessage(message));
        window.confirm = message => nativeConfirm(translateMessage(message));
        window.prompt = (message, value) => nativePrompt(translateMessage(message), value);
    }

    // ---------------------------------------------------------------------
    // Language choice
    // ---------------------------------------------------------------------
    // Saves the choice on this device and (when signed in) on the account, then reloads in the new language
    let signedIn = false;   // set once the server confirms a session (the login page has none)

    async function setLanguage(code) {
        if (!LANGUAGES[code]) return;
        writeStored(code);
        await saveToAccount(code);
        if (code !== lang) window.location.reload();
    }

    async function saveToAccount(code) {
        if (!signedIn) return;
        try {
            await fetch('/api/auth/language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: code }),
                keepalive: true
            });
        } catch (e) { /* signed out or offline: the device keeps the choice */ }
    }

    /**
     * Called once the server says who is signed in. The account's saved language wins over this device's,
     * so the choice follows the person to every device; an account without one adopts this device's choice.
     * Returns true when the page is reloading into another language.
     */
    function applyAccountLanguage(accountLang) {
        signedIn = true;
        if (LANGUAGES[accountLang]) {
            if (accountLang !== lang) {
                writeStored(accountLang);
                window.location.reload();
                return true;
            }
            writeStored(accountLang);
            return false;
        }
        if (readStored()) saveToAccount(lang);
        return false;
    }

    // ---------------------------------------------------------------------
    // Language menu: <div data-language-switcher></div> anywhere on a page
    // ---------------------------------------------------------------------
    function mountSwitchers(scope) {
        (scope || document).querySelectorAll('[data-language-switcher]:not([data-ready])').forEach(host => {
            host.setAttribute('data-ready', '1');
            host.setAttribute('translate', 'no');
            host.classList.add('lang-switcher');
            const compact = host.getAttribute('data-language-switcher') === 'compact';
            const menuId = 'lang-menu-' + Math.random().toString(36).slice(2, 8);
            host.innerHTML = `
                <button type="button" class="lang-switcher-btn" aria-haspopup="true" aria-expanded="false" aria-controls="${menuId}"
                        aria-label="${escapeHtml(labelFor('Language'))}: ${escapeHtml(meta.name)}" title="${escapeHtml(labelFor('Language'))}">
                    <i class="fas fa-globe" aria-hidden="true"></i>
                    <span class="lang-switcher-current${compact ? ' lang-switcher-current-compact' : ''}" lang="${lang}">${escapeHtml(meta.name)}</span>
                    <i class="fas fa-chevron-down lang-switcher-caret" aria-hidden="true"></i>
                </button>
                <ul class="lang-switcher-menu" id="${menuId}" role="menu">
                    ${Object.keys(LANGUAGES).map(code => `
                        <li role="none">
                            <button type="button" role="menuitemradio" aria-checked="${code === lang}" class="lang-switcher-option${code === lang ? ' active' : ''}" data-lang="${code}">
                                <span lang="${code}" dir="${LANGUAGES[code].dir}">${escapeHtml(LANGUAGES[code].name)}</span>
                                ${code === lang ? '<i class="fas fa-check" aria-hidden="true"></i>' : ''}
                            </button>
                        </li>`).join('')}
                </ul>`;
            const btn = host.querySelector('.lang-switcher-btn');
            const menu = host.querySelector('.lang-switcher-menu');
            const options = Array.from(menu.querySelectorAll('.lang-switcher-option'));
            const open = focusFirst => {
                host.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                if (focusFirst) (options.find(o => o.classList.contains('active')) || options[0]).focus();
            };
            const close = () => {
                host.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            };
            btn.addEventListener('click', e => {
                e.stopPropagation();
                host.classList.contains('open') ? close() : open(false);
            });
            btn.addEventListener('keydown', e => {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
            });
            menu.addEventListener('keydown', e => {
                const i = options.indexOf(document.activeElement);
                if (e.key === 'ArrowDown') { e.preventDefault(); options[(i + 1) % options.length].focus(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); options[(i - 1 + options.length) % options.length].focus(); }
                else if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); }
                else if (e.key === 'Tab') close();
            });
            options.forEach(o => o.addEventListener('click', e => {
                e.stopPropagation();
                const code = o.getAttribute('data-lang');
                close();
                if (code !== lang) {
                    host.classList.add('busy');
                    setLanguage(code);
                }
            }));
            document.addEventListener('click', e => { if (!host.contains(e.target)) close(); });
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Translated label (catalog may not be loaded yet when the switcher mounts early)
    function labelFor(text) {
        return lang === 'en' ? text : (exact.get(text) || text);
    }

    // ---------------------------------------------------------------------
    // Formatting
    // ---------------------------------------------------------------------
    function formatDate(value, options) {
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d)) return String(value || '');
        return d.toLocaleDateString(meta.locale, options || { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function formatDateTime(value, options) {
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d)) return String(value || '');
        return d.toLocaleString(meta.locale, options || { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function formatTime(value, options) {
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d)) return String(value || '');
        return d.toLocaleTimeString(meta.locale, options || { hour: '2-digit', minute: '2-digit' });
    }

    window.I18n = {
        lang,
        dir: meta.dir,
        isRtl: meta.dir === 'rtl',
        locale: meta.locale,
        languages: LANGUAGES,
        register,
        t,
        translateText,
        translateTree,
        setLanguage,
        applyAccountLanguage,
        // Remembers the account's language on this device after sign-in (the next page opens in it)
        remember(code) { if (LANGUAGES[code]) writeStored(code); },
        mountSwitchers,
        formatDate,
        formatDateTime,
        formatTime,
        // The language was chosen on this device (as opposed to the browser default)
        get explicit() { return !!LANGUAGES[readStored()]; },
        // English text shown without a translation — run I18n.missingStrings() in the console
        missingStrings() { return Array.from(missing).sort(); }
    };

    // Load the catalog before the page body is parsed, so the first paint is already translated
    if (lang !== 'en') {
        const current = document.currentScript && document.currentScript.src;
        const base = current ? current.replace(/i18n\.js(\?.*)?$/, '') : 'js/';
        document.write(`<script src="${base}i18n/${lang}.js?v=${CATALOG_VERSION}"><\/script>`);
        startObserver();
    }

    document.addEventListener('DOMContentLoaded', () => {
        translateTree(document.head);
        translateTree(document.body);
        mountSwitchers(document);
    });
})();
