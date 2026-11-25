// Shared state and UI helpers.
import { db, TABLES } from './db.js';
import { t } from './i18n.js';

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
  try { await fn(); if (tables) await loadData(tables); state.render(); if (okMsg !== false) toast(okMsg || t('saved')); return true; }
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
