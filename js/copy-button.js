/**
 * JAMIA ASHRAFIA LAHORE - COPY TO CLIPBOARD
 * One copy button for IDs, usernames, passwords and tracking numbers across the portal and the login page.
 *
 *   CopyButton.html('ASH-ADM-2024-133', 'Copy tracking number')   button that copies the given text
 *   CopyButton.html(all, 'Copy all login details', { text: 'Copy all' })   the same with visible text
 *   CopyButton.forInput('reg-t-pwd', 'Copy password')              button that copies an input's current value
 *   CopyButton.wrapInput('<input id="x" …>', 'x')                  input with the copy button inside it
 *
 * Clicking shows a check mark and "Copied" for a moment, then the copy icon again.
 * Works on plain http:// LAN addresses too, where navigator.clipboard is not available.
 */
(function () {
    'use strict';

    const RESET_MS = 1600;
    const timers = new WeakMap();

    const esc = value => String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // opts.text: visible text beside the icon (e.g. 'Copy all'); without it the button is icon-only
    function button(attr, label, opts = {}) {
        const title = esc(label || 'Copy');
        const rest = esc(opts.text || '');
        return `<button type="button" class="copy-btn${opts.text ? ' copy-btn-text' : ''}" ${attr} title="${title}" aria-label="${title}" data-rest-label="${rest}">`
            + `<i class="fas fa-copy" aria-hidden="true"></i><span class="copy-btn-label" aria-live="polite">${rest}</span></button>`;
    }

    // Fallback for pages served without HTTPS (e.g. http://192.168.x.x:3001), where the async Clipboard API is missing
    function legacyCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position: fixed; top: 0; inset-inline-start: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
        const active = document.activeElement;
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        if (active && typeof active.focus === 'function') active.focus({ preventScroll: true });
        return ok;
    }

    async function copy(text) {
        const value = String(text === undefined || text === null ? '' : text);
        if (!value) return false;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch (e) { /* permission denied or document not focused: try the fallback */ }
        }
        return legacyCopy(value);
    }

    function showResult(btn, ok) {
        const icon = btn.querySelector('i');
        const label = btn.querySelector('.copy-btn-label');
        clearTimeout(timers.get(btn));
        btn.classList.toggle('is-copied', ok);
        btn.classList.toggle('is-failed', !ok);
        if (icon) icon.className = ok ? 'fas fa-check' : 'fas fa-exclamation-circle';
        if (label) label.textContent = ok ? 'Copied' : 'Copy failed';
        timers.set(btn, setTimeout(() => {
            btn.classList.remove('is-copied', 'is-failed');
            if (icon) icon.className = 'fas fa-copy';
            if (label) label.textContent = btn.getAttribute('data-rest-label') || '';
        }, RESET_MS));
    }

    function textFor(btn) {
        if (btn.hasAttribute('data-copy')) return btn.getAttribute('data-copy');
        const target = document.getElementById(btn.getAttribute('data-copy-target') || '');
        if (!target) return '';
        return 'value' in target ? String(target.value).trim() : target.textContent.trim();
    }

    // Capture phase: copy buttons sit inside rows, cards and links with their own click handlers, which must not fire
    document.addEventListener('click', async e => {
        const btn = e.target.closest && e.target.closest('.copy-btn');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        showResult(btn, await copy(textFor(btn)));
    }, true);

    window.CopyButton = {
        copy,

        html(text, label, opts) {
            if (text === undefined || text === null || String(text) === '') return '';
            return button(`data-copy="${esc(text)}"`, label, opts);
        },

        // Copies whatever the input holds when clicked (so a regenerated password copies the new one)
        forInput(inputId, label) {
            return button(`data-copy-target="${esc(inputId)}"`, label || 'Copy');
        },

        wrapInput(inputHtml, inputId, label) {
            return `<div class="copy-input">${inputHtml}${this.forInput(inputId, label)}</div>`;
        }
    };
})();
