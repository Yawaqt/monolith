// Shared state and UI helpers.
import { db, TABLES } from './db.js?v=202611251610';
import { t } from './i18n.js?v=202611251610';

export const state = { session: null, me: null, data: {}, loadedAt: 0, render: () => {} };
const RANK = { anon: 0, guest: 1, team: 2, captain: 3, admin: 4 };
export const role = () => (state.me && state.me.role) || (state.session ? 'guest' : 'anon');
export const can = min => RANK[role()] >= RANK[min];
export const myPlayer = () => state.me && state.me.player_id;
export const isMe = pid => pid != null && pid === myPlayer();

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const opts = (list, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') +
  list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(l)}</option>`; }).join('');

export const players = (all = false) => (state.data.players || []).filter(p => all || p.active).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
export const playerById = id => (state.data.players || []).find(p => p.id === +id);
export const pname = id => playerById(id)?.name || '?';
export const setting = (k, d) => { const s = (state.data.settings || []).find(x => x.key === k); return s ? s.value : d; };

export function fmtDate(iso, opt) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'de-AT', opt || { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
export const money = n => (Number(n) || 0).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'de-AT', { style: 'currency', currency: 'EUR' });

export async function loadData(tables = TABLES) {
  const res = await Promise.allSettled(tables.map(tb => db.list(tb)));
  res.forEach((r, i) => { if (r.status === 'fulfilled') state.data[tables[i]] = r.value; else if (!state.data[tables[i]]) state.data[tables[i]] = []; });
  state.loadedAt = Date.now();
}
// Run a write, reload the affected tables, re-render, and report errors.
export async function act(fn, tables, okMsg) {
  try { await fn(); if (tables) await loadData(tables); if (tables && state.reloadPublic && tables.some(x => ['matches', 'players', 'events', 'news'].includes(x))) await state.reloadPublic().catch(() => {}); state.render(); if (okMsg !== false) toast(okMsg || t('saved')); return true; }
  catch (e) { toast(t('error') + ': ' + (e.message || e), true); return false; }
}

let toastTimer;
export function toast(msg, bad) {
  const el = $('#toast'); el.textContent = msg; el.className = 'toast on' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = 'toast', bad ? 5000 : 2200);
}

// Modal dialog with a form. Resolves with FormData-like object or null.
export function modal(title, body, { submit = t('save'), danger = false, wide = false, onOpen } = {}) {
  return new Promise(resolve => {
    const wrap = $('#modal'); const prev = document.activeElement;
    wrap.innerHTML = `<form class="dialog${wide ? ' wide' : ''}" novalidate><header><h2>${esc(title)}</h2><button type="button" class="icon" data-x aria-label="${esc(t('close'))}">✕</button></header>
      <div class="dialog-body">${body}</div><footer><button type="button" class="btn ghost" data-x>${esc(t('cancel'))}</button><button class="btn ${danger ? 'danger' : 'primary'}">${esc(submit)}</button></footer></form>`;
    wrap.classList.add('on');
    const form = $('form', wrap);
    const close = v => { wrap.classList.remove('on'); wrap.innerHTML = ''; if (prev) prev.focus(); resolve(v); };
    form.addEventListener('submit', e => { e.preventDefault(); if (!form.reportValidity()) return; const o = {}; for (const el of form.elements) if (el.name) { if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value; } close(o); });
    $$('[data-x]', wrap).forEach(b => b.addEventListener('click', () => close(null)));
    wrap.onclick = e => { if (e.target === wrap) close(null); };
    form.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    if (onOpen) onOpen(form);
    const first = $('input,select,textarea', form); (first || $('button.primary,button.danger', form)).focus();
  });
}
export const confirmBox = msg => modal(t('confirm_delete'), `<p>${esc(msg)}</p>`, { submit: t('delete'), danger: true });

export const resultBadge = r => r ? `<span class="res ${r}">${esc(t(r))}</span>` : '';
export const gpClass = g => g == null ? 'na' : g > 10.0001 ? 'up' : g < 9.9999 ? 'down' : 'even';
export const empty = msg => `<div class="empty">${esc(msg || t('none'))}</div>`;
export const pageHead = (title, intro, actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${intro ? `<p class="intro">${esc(intro)}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>`;

// Shrinks a picture in the browser before upload (JPEG). square = crop to a centred square (profile photos).
export function resizeImage(file, max = 1600, square = false) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error(t('img_type')));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
      const k = Math.min(1, max / Math.max(sw, sh)); const c = document.createElement('canvas');
      c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error(t('img_type'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('img_type'))); };
    img.src = url;
  });
}
// Only pictures from our own storage, https or the demo's data URLs may be shown.
export const safeImg = u => typeof u === 'string' && (/^https:\/\/[^\s"'<>]+$/.test(u) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u)) ? u : '';
