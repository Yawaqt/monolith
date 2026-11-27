// Community apps: paint recipes (everyone), score tracker + chess clock, MathHammer, pairing trainer (admins while in test).
import { db, DEMO } from './db.js?v=202611271005';
import { t, getLang } from './i18n.js?v=202611271005';
import { state, can, esc, $, $$, opts, toast, modal, confirmBox, empty, resizeImage, safeImg, fmtDate } from './core.js?v=202611271005';
import { FACTIONS } from './data.js?v=202611271005';
import { lightbox } from './pages-news.js?v=202611271005';

const L = (de, en) => getLang() === 'de' ? de : en;
const head = (title, intro, actions = '') => `<div class="page-head"><div><p class="eyebrow"><a href="#/apps">${esc(t('p_apps'))}</a></p><h1>${esc(title)}</h1>${intro ? `<p class="intro">${esc(intro)}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>`;
const uid = () => state.session?.user?.id || null;
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
const factionList = () => `<datalist id="factions">${FACTIONS.map(f => `<option value="${esc(f)}">`).join('')}</datalist>`;
const signInLink = () => `<a class="btn primary sm" href="#/login" data-return="#/${location.hash.slice(2)}">${esc(t('sign_in'))}</a>`;
document.addEventListener('click', e => { const a = e.target.closest('[data-return]'); if (a) { try { sessionStorage.setItem('monolith.return', a.dataset.return); } catch (_) {} } });

// ====================================================================== Paint recipes
const TECHS = [['prime', 'Grundierung', 'Prime'], ['base', 'Basecoat', 'Basecoat'], ['contrast', 'Contrast', 'Contrast'], ['shade', 'Wash / Shade', 'Wash / shade'], ['layer', 'Layer', 'Layer'],
  ['highlight', 'Highlight', 'Highlight'], ['edge', 'Kantenhighlight', 'Edge highlight'], ['glaze', 'Glaze / Lasur', 'Glaze'], ['drybrush', 'Drybrush', 'Drybrush'],
  ['airbrush', 'Airbrush', 'Airbrush'], ['technical', 'Technical / Effekt', 'Technical / effect'], ['varnish', 'Lack / Versiegeln', 'Varnish'], ['other', 'Sonstiges', 'Other']];
const techLabel = k => { const x = TECHS.find(t => t[0] === k); return x ? L(x[1], x[2]) : ''; };
let rcTab = 'shared', rcQuery = '', rcFaction = '', rcList = null;

export async function recipes(el) {
  el.innerHTML = head(L('Farbschemata', 'Paint schemes'), L('Geteilte Bemalschemata der Community. Eigene Schemata legst du im Collection Tracker bei der jeweiligen Armee an.', 'Paint schemes shared by the community. Add your own in the collection tracker under each army.')) + `<p class="mute">${esc(t('loading'))}</p>`;
  try { rcList = await db.list('paint_recipes', ['updated_at', 'desc']); } catch (e) { el.innerHTML += `<div class="notice bad">${esc(e.message)}</div>`; return; }
  if (location.hash !== '#/recipes') return;
  drawRecipes(el);
}
function drawRecipes(el) {
  const me = uid();
  if (!me) rcTab = 'shared';
  const pool = rcList.filter(r => rcTab === 'mine' ? r.user_id === me : r.shared);
  const q = rcQuery.trim().toLowerCase();
  const list = pool.filter(r => (!rcFaction || r.faction === rcFaction) && (!q || [r.title, r.faction, r.part, r.author_name, ...(r.steps || []).map(s => s.paint)].join(' ').toLowerCase().includes(q)));
  const facs = [...new Set(pool.map(r => r.faction).filter(Boolean))].sort();
  el.innerHTML = head(L('Farbschemata', 'Paint schemes'), L('Geteilte Bemalschemata der Community. Eigene Schemata legst du im Collection Tracker bei der jeweiligen Armee an.', 'Paint schemes shared by the community. Add your own in the collection tracker under each army.'),
      `<a class="btn primary" href="apps/collection/">${esc(L('Eigene Schemata im Collection Tracker', 'Own schemes in the collection tracker'))}</a>`) +
    `<div class="seg ev-tabs" role="tablist"><button role="tab" data-tab="shared" aria-selected="${rcTab === 'shared'}">${esc(L('Geteilt', 'Shared'))}</button>${me ? `<button role="tab" data-tab="mine" aria-selected="${rcTab === 'mine'}">${esc(L('Meine Rezepte', 'My recipes'))}</button>` : ''}</div>
    <form class="filters card" id="rcf"><label>${esc(L('Suche', 'Search'))}<input type="search" name="q" value="${esc(rcQuery)}" placeholder="${esc(L('Titel, Farbe, Fraktion …', 'Title, paint, faction …'))}"></label>
      <label>${esc(t('faction'))}<select name="f">${opts([['', L('Alle', 'All')], ...facs.map(f => [f, f])], rcFaction)}</select></label></form>
    ${list.length ? `<div class="recipes">${list.map(card).join('')}</div>` : empty(rcTab === 'mine' ? L('Noch keine eigenen Rezepte.', 'No recipes yet.') : L('Noch keine geteilten Rezepte.', 'No shared recipes yet.'))}`;
  const f = $('#rcf');
  f.addEventListener('input', () => { rcQuery = f.q.value; rcFaction = f.f.value; const pos = f.q.selectionStart; drawRecipes(el); const n = $('#rcf').q; n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} });
  el.onclick = async e => {
    const tab = e.target.closest('[data-tab]'); if (tab) { rcTab = tab.dataset.tab; rcFaction = ''; return drawRecipes(el); }
    if (e.target.closest('[data-new]')) return editRecipe(el, null);
    const c = e.target.closest('[data-rc]'); if (c) return showRecipe(el, rcList.find(r => r.id === +c.dataset.rc));
  };
}
const card = r => { const img = safeImg((r.photos || [])[0]);
  return `<button type="button" class="recipe-card" data-rc="${r.id}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="recipe-ph" aria-hidden="true">${esc((r.title || '?').slice(0, 1))}</span>`}
    <span class="rc-body"><b>${esc(r.title)}</b><small class="mute">${esc([r.faction, r.part].filter(Boolean).join(' · '))}</small>
    <small class="mute">${esc(L(`${(r.steps || []).length} Schritte`, `${(r.steps || []).length} steps`))}${r.author_name && r.shared ? ' · ' + esc(r.author_name) : ''}${!r.shared ? ' · ' + esc(L('privat', 'private')) : ''}</small></span></button>`; };

async function showRecipe(el, r) {
  if (!r) return;
  const mine = r.user_id === uid(), mod = can('admin');
  const body = `${(r.photos || []).length ? `<div class="rc-photos">${r.photos.map((p, i) => safeImg(p) ? `<button type="button" data-ph="${i}"><img src="${esc(safeImg(p))}" alt="" loading="lazy"></button>` : '').join('')}</div>` : ''}
    <p class="mute">${esc([r.faction, r.part].filter(Boolean).join(' · '))}${r.author_name ? ` · ${esc(L('von', 'by'))} ${esc(r.author_name)}` : ''} · ${esc(fmtDate(r.updated_at.slice(0, 10)))}</p>
    <ol class="rc-steps">${(r.steps || []).map(s => `<li><b>${esc(s.paint || '')}</b>${s.tech ? ` <span class="tag">${esc(techLabel(s.tech))}</span>` : ''}${s.note ? `<br><small class="mute">${esc(s.note)}</small>` : ''}</li>`).join('')}</ol>
    ${r.notes ? `<p class="rc-notes">${esc(r.notes)}</p>` : ''}
    ${mine || mod ? `<div class="row-actions">${mine ? `<button type="button" class="btn ghost sm" data-edit>${esc(t('edit'))}</button>` : ''}<button type="button" class="btn ghost sm" data-del>${esc(t('delete'))}</button></div>` : ''}`;
  const p = modal(r.title, body, { submit: t('close'), wide: true, onOpen: f => {
    f.addEventListener('click', async e => {
      const ph = e.target.closest('[data-ph]'); if (ph) { e.preventDefault(); return lightbox(r.photos.filter(safeImg), +ph.dataset.ph); }
      if (e.target.closest('[data-edit]')) { e.preventDefault(); $('#modal [data-x]').click(); return editRecipe(el, r); }
      if (e.target.closest('[data-del]')) { e.preventDefault(); $('#modal [data-x]').click();
        if (!(await confirmBox(r.title))) return;
        try { await db.remove('paint_recipes', { id: r.id }); rcList = rcList.filter(x => x.id !== r.id); toast(L('Gelöscht', 'Deleted')); drawRecipes(el); } catch (err) { toast(t('error') + ': ' + err.message, true); } }
    }); } });
  await p;
}

function stepRow(s = {}) {
  return `<div class="rc-step"><span class="handle num"></span><input name="paint" maxlength="60" placeholder="${esc(L('Farbe, z. B. Mephiston Red', 'Paint, e.g. Mephiston Red'))}" value="${esc(s.paint || '')}">
    <select name="tech" aria-label="${esc(L('Technik', 'Technique'))}">${opts([['', L('Technik', 'Technique')], ...TECHS.map(x => [x[0], L(x[1], x[2])])], s.tech || '')}</select>
    <input name="note" maxlength="120" placeholder="${esc(L('Hinweis (optional)', 'Note (optional)'))}" value="${esc(s.note || '')}">
    <span class="rc-step-btns"><button type="button" class="icon xs" data-up aria-label="${esc(L('Nach oben', 'Move up'))}">↑</button><button type="button" class="icon xs" data-rm aria-label="${esc(t('delete'))}">✕</button></span></div>`;
}
async function editRecipe(el, r) {
  const me = uid(); if (!me) return;
  let photos = [...(r?.photos || [])];
  const photoHtml = () => `${photos.map((p, i) => `<span class="rc-thumb"><img src="${esc(safeImg(p))}" alt=""><button type="button" class="icon xs" data-rmph="${i}" aria-label="${esc(t('delete'))}">✕</button></span>`).join('')}${photos.length < 6 ? `<label class="btn ghost sm rc-add-ph">${esc(L('+ Foto', '+ Photo'))}<input type="file" accept="image/*" multiple hidden data-ph></label>` : ''}`;
  const body = `${factionList()}<label>${esc(L('Titel', 'Title'))}<input name="title" required maxlength="80" value="${esc(r?.title || '')}" placeholder="${esc(L('z. B. Blood Angels Rüstung', 'e.g. Blood Angels armour'))}"></label>
    <div class="grid2"><label>${esc(t('faction'))}<input name="faction" list="factions" maxlength="60" value="${esc(r?.faction || '')}"></label><label>${esc(L('Bereich', 'Part'))}<input name="part" maxlength="60" value="${esc(r?.part || '')}" placeholder="${esc(L('Rüstung, Haut, Base …', 'Armour, skin, base …'))}"></label></div>
    <fieldset class="rc-steps-edit"><legend>${esc(L('Schritte', 'Steps'))}</legend><div id="rcsteps">${(r?.steps?.length ? r.steps : [{}, {}, {}]).map(stepRow).join('')}</div>
      <button type="button" class="btn ghost sm" data-addstep>${esc(L('+ Schritt', '+ Step'))}</button></fieldset>
    <fieldset><legend>${esc(L('Fotos (max. 6)', 'Photos (max 6)'))}</legend><div class="rc-photo-edit" id="rcph">${photoHtml()}</div></fieldset>
    <label>${esc(L('Notizen', 'Notes'))}<textarea name="notes" rows="3" maxlength="2000">${esc(r?.notes || '')}</textarea></label>
    <label class="check"><input type="checkbox" name="shared"${r?.shared ? ' checked' : ''}> ${esc(L('Für alle teilen (öffentlich, mit deinem Namen)', 'Share with everyone (public, with your name)'))}</label>`;
  let stepsOut = null;
  const res = await modal(r ? L('Rezept bearbeiten', 'Edit recipe') : L('Neues Rezept', 'New recipe'), body, { wide: true, onOpen: f => {
    const box = $('#rcsteps', f);
    f.addEventListener('click', e => {
      if (e.target.closest('[data-addstep]')) { box.insertAdjacentHTML('beforeend', stepRow()); $$('.rc-step', box).at(-1).querySelector('input').focus(); }
      const rm = e.target.closest('[data-rm]'); if (rm) { rm.closest('.rc-step').remove(); if (!$('.rc-step', box)) box.insertAdjacentHTML('beforeend', stepRow()); }
      const up = e.target.closest('[data-up]'); if (up) { const row = up.closest('.rc-step'); if (row.previousElementSibling) box.insertBefore(row, row.previousElementSibling); }
      const rp = e.target.closest('[data-rmph]'); if (rp) { photos.splice(+rp.dataset.rmph, 1); $('#rcph', f).innerHTML = photoHtml(); }
    });
    f.addEventListener('change', async e => {
      if (!e.target.matches('[data-ph]')) return;
      const files = [...e.target.files].slice(0, 6 - photos.length); const holder = $('#rcph', f); holder.insertAdjacentHTML('beforeend', `<span class="mute">${esc(t('loading'))}</span>`);
      for (const file of files) { try { const blob = await resizeImage(file, 1400); const url = DEMO ? await db.upload('x', blob) : await db.upload(`recipes/${me}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, blob); photos.push(url); } catch (err) { toast(t('error') + ': ' + err.message, true); } }
      holder.innerHTML = photoHtml();
    });
    f.addEventListener('submit', () => { stepsOut = $$('.rc-step', box).map(row => ({ paint: row.querySelector('[name=paint]').value.trim(), tech: row.querySelector('[name=tech]').value, note: row.querySelector('[name=note]').value.trim() })).filter(s => s.paint || s.note); }, true);
  } });
  if (!res) return;
  const row = { title: res.title.trim(), faction: (res.faction || '').trim() || null, part: (res.part || '').trim() || null, notes: (res.notes || '').trim() || null, steps: stepsOut || [], photos, shared: !!res.shared };
  try {
    if (r) { const out = await db.update('paint_recipes', { id: r.id }, row); Object.assign(r, Array.isArray(out) ? out[0] || row : row); }
    else { const out = await db.insert('paint_recipes', { ...row, user_id: me, ...(DEMO ? { author_name: state.me?.display_name || 'Demo', updated_at: new Date().toISOString() } : {}) }); rcList.unshift(out); rcTab = 'mine'; }
    toast(L('Gespeichert', 'Saved')); drawRecipes(el);
  } catch (err) { toast(t('error') + ': ' + err.message, true); }
}

// ====================================================================== Score tracker + chess clock
const SK = 'monolith.score.v1';
const blankSide = name => ({ name, army: '', cp: 0, prim: [0, 0, 0, 0, 0, 0], sec: [0, 0, 0, 0, 0, 0], painted: false, used: 0 });
const newGame = (min = 90) => ({ round: 1, minutes: min, a: blankSide(L('Ich', 'Me')), b: blankSide(L('Gegner', 'Opponent')), active: null, since: null });
let G = null, tick = null, wake = null;
const P_MAX = 45, S_MAX = 45;
const total = s => Math.min(P_MAX, s.prim.reduce((a, b) => a + b, 0)) + Math.min(S_MAX, s.sec.reduce((a, b) => a + b, 0)) + (s.painted ? 10 : 0);
const usedMs = k => G[k].used + (G.active === k && G.since ? Date.now() - G.since : 0);
const clockTxt = k => { const left = G.minutes * 60000 - usedMs(k); const neg = left < 0; const s = Math.floor(Math.abs(left) / 1000); return (neg ? '−' : '') + Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const saveG = () => store(SK, G);
async function keepAwake(on) { try { if (on && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } if (!on && wake) { await wake.release(); wake = null; } } catch (_) {} }
function setActive(k) {
  const now = Date.now();
  if (G.active && G.since) G[G.active].used += now - G.since;
  if (G.active) G.last = G.active;
  G.active = k; G.since = k ? now : null; saveG(); keepAwake(!!k);
}

export function score(el) {
  G = store(SK) || newGame();
  for (const k of ['a', 'b']) for (const f of ['prim', 'sec']) while (G[k][f].length < 6) G[k][f].push(0);
  clearInterval(tick);
  const END = G.round === 6; const rl = n => n === 6 ? L('Ende', 'End') : 'R' + n;
  const sumP = s => Math.min(P_MAX, s.prim.reduce((a, b) => a + b, 0)), sumS = s => Math.min(S_MAX, s.sec.reduce((a, b) => a + b, 0));
  // Both clocks side by side, always visible (sticky); tap your half to pass the turn.
  const clock = k => { const s = G[k];
    return `<button type="button" class="sc-clock${G.active === k ? ' on' : ''}" data-clock="${k}"><span class="sc-who">${esc(s.name || '–')}</span>
      <span class="num sc-time" data-time="${k}">${clockTxt(k)}</span><span class="sc-pts"><b class="num">${total(s)}</b> ${esc(L('Pkt', 'pts'))}</span></button>`; };
  const col = k => { const s = G[k]; const r = G.round - 1;
    return `<section class="sc-col" data-side="${k}">
      <input class="sc-name" data-f="name" maxlength="30" value="${esc(s.name)}" aria-label="${esc(L('Name', 'Name'))}">
      <input class="sc-army" data-f="army" list="factions" maxlength="60" placeholder="${esc(t('army'))}" value="${esc(s.army)}">
      <div class="sc-f"><span>${esc(END ? L('Primär Spielende', 'End of game primary') : L('Primär', 'Primary') + ' R' + G.round)}</span>${stepper(k, 'prim', s.prim[r])}<small class="mute num">${sumP(s)}/${P_MAX}</small></div>
      ${END ? '' : `<div class="sc-f"><span>${esc(L('Sekundär', 'Secondary'))} R${G.round}</span>${stepper(k, 'sec', s.sec[r])}<small class="mute num">${sumS(s)}/${S_MAX}</small></div>`}
      <div class="sc-f"><span>CP</span>${stepper(k, 'cp', s.cp)}</div>
      <label class="check sc-paint"><input type="checkbox" data-f="painted"${s.painted ? ' checked' : ''}> ${esc(L('Bemalt +10', 'Painted +10'))}</label>
    </section>`; };
  const rounds = ['a', 'b'].map(k => G[k]);
  el.innerHTML = factionList() + `<p class="eyebrow"><a href="#/apps">← ${esc(t('p_apps'))}</a> · ${esc(t('app_score'))}</p><div class="sc-app">
    <div class="sc-clocks">${clock('a')}<button type="button" class="sc-pause" data-pause aria-label="${esc(L('Pause', 'Pause'))}">${G.active ? '❚❚' : '▶'}</button>${clock('b')}</div>
    <div class="sc-rounds seg" role="group" aria-label="${esc(L('Runde', 'Round'))}">${[1, 2, 3, 4, 5, 6].map(n => `<button type="button" data-round="${n}" aria-pressed="${G.round === n}"${n === 6 ? ` title="${esc(L('Primärpunkte am Spielende, nach Runde 5', 'End of game primary, after round 5'))}"` : ''}>${esc(rl(n))}</button>`).join('')}</div>
    <div class="sc-grid">${col('a')}${col('b')}</div>
    <div class="card sc-table"><div class="scroll"><table class="compact-stat"><thead><tr><th></th>${[1, 2, 3, 4, 5, 6].map(n => `<th class="r${G.round === n ? ' cur' : ''}">${esc(rl(n))}</th>`).join('')}<th class="r">Σ</th></tr></thead><tbody>
      ${rounds.map(s => `<tr><td><b>${esc(s.name || '–')}</b></td>${s.prim.map((p, i) => `<td class="r num${G.round === i + 1 ? ' cur' : ''}">${i === 5 ? p : p + '+' + s.sec[i]}</td>`).join('')}<td class="r num"><b>${total(s)}</b></td></tr>`).join('')}</tbody></table></div>
      <p class="mute small">${esc(L(`Primär + Sekundär pro Runde, „Ende“ = Primär am Spielende. Max. ${P_MAX} Primär (inkl. Spielende), ${S_MAX} Sekundär, +10 bemalt.`, `Primary + secondary per round, “End” = end of game primary. Max ${P_MAX} primary (incl. end of game), ${S_MAX} secondary, +10 painted.`))}</p></div>
    <div class="sc-end"><label class="sc-min">${esc(L('Minuten pro Spieler', 'Minutes per player'))}<input type="number" min="5" max="300" step="5" value="${G.minutes}" data-min></label>
      <div class="row-actions"><button type="button" class="btn primary" data-save>${esc(L('In Match History speichern', 'Save to match history'))}</button><button type="button" class="btn ghost" data-reset>${esc(L('Neues Spiel', 'New game'))}</button></div></div>
  </div>`;
  const refreshClock = () => { if (!document.body.contains(el) || location.hash !== '#/score') return clearInterval(tick); for (const k of ['a', 'b']) { const n = $(`[data-time="${k}"]`, el); if (n) { n.textContent = clockTxt(k); n.classList.toggle('over', G.minutes * 60000 - usedMs(k) < 0); } } };
  tick = setInterval(refreshClock, 500); refreshClock();
  if (G.active) keepAwake(true);
  el.onclick = async e => {
    const c = e.target.closest('[data-clock]'); if (c) { const k = c.dataset.clock; setActive(G.active === k ? (k === 'a' ? 'b' : 'a') : k); if (navigator.vibrate) navigator.vibrate(30); return score(el); }
    if (e.target.closest('[data-pause]')) { setActive(G.active ? null : (G.last || 'a')); return score(el); }
    const rd = e.target.closest('[data-round]'); if (rd) { G.round = +rd.dataset.round; saveG(); return score(el); }
    const st = e.target.closest('[data-step]'); if (st) { const [k, f, d] = st.dataset.step.split('|'); const s = G[k];
      if (f === 'cp') s.cp = Math.max(0, s.cp + +d); else { const r = G.round - 1; s[f][r] = Math.max(0, Math.min(f === 'prim' ? P_MAX : S_MAX, s[f][r] + +d)); }
      saveG(); return score(el); }
    if (e.target.closest('[data-reset]')) { if (!(await modal(L('Neues Spiel', 'New game'), `<p>${esc(L('Punkte und Uhr zurücksetzen?', 'Reset points and clock?'))}</p>`, { submit: L('Zurücksetzen', 'Reset'), danger: true }))) return; setActive(null); const keep = G.a.name; G = newGame(G.minutes); G.a.name = keep; saveG(); return score(el); }
    if (e.target.closest('[data-save]')) return saveScore(el);
  };
  el.onchange = e => {
    const sideEl = e.target.closest('[data-side]');
    if (e.target.matches('[data-min]')) { G.minutes = Math.max(5, Math.min(300, +e.target.value || 90)); saveG(); return refreshClock(); }
    if (!sideEl) return; const s = G[sideEl.dataset.side]; const f = e.target.dataset.f;
    if (f === 'painted') { s.painted = e.target.checked; saveG(); return score(el); }
    if (f) { s[f] = e.target.value.trim(); saveG(); if (f === 'name') score(el); }
  };
}
const stepper = (k, f, v) => `<span class="stepper"><button type="button" class="icon" data-step="${k}|${f}|-1" aria-label="−1">−</button><b class="num">${v}</b><button type="button" class="icon" data-step="${k}|${f}|1" aria-label="+1">+</button></span>`;
async function saveScore(el) {
  if (!state.session) { toast(L('Zum Speichern bitte anmelden.', 'Please sign in to save.'), true); return; }
  const a = G.a, b = G.b;
  if (!a.army || !b.army) { toast(L('Bitte beide Armeen eintragen.', 'Please enter both armies.'), true); return; }
  const ok = await modal(L('In Match History speichern', 'Save to match history'), `<p><b>${esc(a.army)}</b> ${total(a)} : ${total(b)} <b>${esc(b.army)}</b></p><p class="mute">${esc(L('Wird als freies Spiel mit heutigem Datum gespeichert.', 'Saved as a casual game with today\'s date.'))}</p>`, { submit: L('Speichern', 'Save') });
  if (!ok) return;
  const d = new Date(); const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  try { await db.insert('personal_games', { played_on: today, army: a.army, opp_army: b.army, my_score: total(a), opp_score: total(b), kind: 'Casual', event: null, notes: b.name && b.name !== L('Gegner', 'Opponent') ? `vs ${b.name}` : null, ...(DEMO ? { user_id: 'demo-user' } : {}) });
    toast(L('In Match History gespeichert', 'Saved to match history')); } catch (err) { toast(t('error') + ': ' + err.message, true); }
}

// ====================================================================== MathHammer
const MK = 'monolith.mathhammer.v1';
const MH0 = { attacks: '10', models: 1, skill: 3, s: 4, ap: 0, dmg: '1', t: 4, sv: 3, inv: 0, fnp: 0, w: 1, hitMod: 0, woundMod: 0, hitRr: 'none', woundRr: 'none', torrent: false, lethal: false, sustained: 0, dev: false, critHit: 6, anti: 0 };
function parseDice(expr) { // "2D6+1", "D3", "4"
  const m = String(expr || '').toUpperCase().replace(/\s/g, '').match(/^(\d*)D(3|6)([+-]\d+)?$|^(\d+)$/);
  if (!m) return null;
  if (m[4]) return { n: 0, d: 0, k: +m[4] };
  return { n: +(m[1] || 1), d: +m[2], k: +(m[3] || 0) };
}
const roll = d => 1 + Math.floor(Math.random() * d);
const rollExpr = p => { let s = p.k; for (let i = 0; i < p.n; i++) s += roll(p.d); return Math.max(0, s); };
const woundTarget = (s, t) => s >= 2 * t ? 2 : s > t ? 3 : s === t ? 4 : 2 * s <= t ? 6 : 5;
function simulate(o, runs = 20000) {
  const A = parseDice(o.attacks), D = parseDice(o.dmg); if (!A || !D) return null;
  const wt = woundTarget(+o.s, +o.t);
  const saveBase = Math.min(7, +o.sv + +o.ap); // AP given as a positive number (2 = AP -2) makes the save worse
  const save = +o.inv ? Math.min(saveBase, +o.inv) : saveBase;
  const hist = new Map(); let sumHits = 0, sumWounds = 0, sumUnsaved = 0, sumDmg = 0, sumKills = 0;
  const hitMod = Math.max(-1, Math.min(1, +o.hitMod)), woundMod = Math.max(-1, Math.min(1, +o.woundMod));
  const ch = +o.critHit === 5 ? 5 : 6, cw = +o.anti >= 2 && +o.anti <= 6 ? +o.anti : 6;
  for (let r = 0; r < runs; r++) {
    let attacks = 0; for (let m = 0; m < Math.max(1, +o.models); m++) attacks += rollExpr(A);
    let hits = 0, autoW = 0;
    for (let i = 0; i < attacks; i++) {
      if (o.torrent) { hits++; continue; }
      let d = roll(6);
      const crit = x => x >= ch; // critical hit: unmodified 6, or 5+ with the option
      const fail = x => !crit(x) && (x === 1 || x + hitMod < +o.skill);
      if (fail(d) && (o.hitRr === 'all' || (o.hitRr === 'ones' && d === 1))) d = roll(6);
      if (fail(d)) continue;
      if (crit(d) && o.lethal) autoW++; else hits++;
      if (crit(d) && +o.sustained) hits += +o.sustained;
    }
    let wounds = 0, mortalDmg = 0, normal = autoW;
    for (let i = 0; i < hits; i++) {
      let d = roll(6);
      const crit = x => x >= cw; // critical wound: unmodified 6, or Anti-X+
      const fail = x => !crit(x) && (x === 1 || x + woundMod < wt);
      if (fail(d) && (o.woundRr === 'all' || (o.woundRr === 'ones' && d === 1))) d = roll(6);
      if (fail(d)) continue;
      if (crit(d) && o.dev) { for (let k = 0; k < 1; k++) mortalDmg += rollExpr(D); wounds++; } else { normal++; wounds++; }
    }
    wounds += autoW;
    let unsaved = 0; const dmgs = [];
    for (let i = 0; i < normal; i++) { const d = roll(6); if (d === 1 || d < save || save >= 7) { unsaved++; dmgs.push(rollExpr(D)); } }
    // feel no pain per point of damage
    const fnp = x => { if (!+o.fnp) return x; let s = 0; for (let i = 0; i < x; i++) if (roll(6) < +o.fnp) s++; return s; };
    let dmg = 0, kills = 0, cur = Math.max(1, +o.w);
    for (const d0 of dmgs) { const d = Math.min(fnp(d0), cur); dmg += d; cur -= d; if (cur <= 0) { kills++; cur = Math.max(1, +o.w); } }
    let mw = fnp(mortalDmg); dmg += mw; while (mw > 0) { const d = Math.min(mw, cur); cur -= d; mw -= d; if (cur <= 0) { kills++; cur = Math.max(1, +o.w); } }
    sumHits += hits + autoW; sumWounds += wounds; sumUnsaved += unsaved; sumDmg += dmg; sumKills += kills;
    hist.set(dmg, (hist.get(dmg) || 0) + 1);
  }
  const max = Math.max(...hist.keys()); const atLeast = []; let acc = 0;
  for (let d = max; d >= 0; d--) { acc += hist.get(d) || 0; atLeast[d] = acc / runs; }
  return { hits: sumHits / runs, wounds: sumWounds / runs, unsaved: sumUnsaved / runs, dmg: sumDmg / runs, kills: sumKills / runs, atLeast, wt, save, ch, cw };
}
export function mathhammer(el) {
  const o = { ...MH0, ...(store(MK) || {}) };
  const num = (k, label, min, max, step = 1) => `<label>${esc(label)}<input type="number" name="${k}" min="${min}" max="${max}" step="${step}" value="${esc(o[k])}"></label>`;
  const sel = (k, label, list) => `<label>${esc(label)}<select name="${k}">${opts(list, String(o[k]))}</select></label>`;
  const chk = (k, label) => `<label class="check"><input type="checkbox" name="${k}"${o[k] ? ' checked' : ''}> ${esc(label)}</label>`;
  const rr = [['none', L('kein', 'none')], ['ones', L('1er', '1s')], ['all', L('alle', 'all')]];
  el.innerHTML = head('MathHammer', L('Erwarteter Schaden einer Waffe gegen ein Ziel – 20.000 simulierte Würfe pro Berechnung.', 'Expected damage of a weapon against a target – 20,000 simulated rolls per calculation.')) +
    `<section class="card mh-out" id="mhout"></section><form class="card mh" id="mh"><h2>${esc(L('Angreifer', 'Attacker'))}</h2><div class="mh-grid">
      <label>${esc(L('Attacken pro Modell', 'Attacks per model'))}<input name="attacks" value="${esc(o.attacks)}" placeholder="10, D6, 2D6+1"></label>${num('models', L('Modelle', 'Models'), 1, 30)}
      ${sel('skill', L('BS / WS', 'BS / WS'), [2, 3, 4, 5, 6].map(x => [String(x), x + '+']))}${num('s', L('Stärke', 'Strength'), 1, 30)}
      ${sel('ap', 'AP', [0, 1, 2, 3, 4, 5, 6].map(x => [String(x), x ? '−' + x : '0']))}<label>${esc(L('Schaden', 'Damage'))}<input name="dmg" value="${esc(o.dmg)}" placeholder="1, D3, D6+1"></label>
      ${sel('hitMod', L('Trefferwurf', 'Hit roll'), [['-1', '−1'], ['0', '±0'], ['1', '+1']])}${sel('hitRr', L('Treffer wiederholen', 'Re-roll hits'), rr)}
      ${sel('woundMod', L('Verwundungswurf', 'Wound roll'), [['-1', '−1'], ['0', '±0'], ['1', '+1']])}${sel('woundRr', L('Verwunden wiederholen', 'Re-roll wounds'), rr)}
      ${sel('sustained', 'Sustained Hits', [0, 1, 2, 3].map(x => [String(x), x ? String(x) : L('nein', 'no')]))}
      ${sel('critHit', L('Kritischer Treffer', 'Critical hit'), [['6', '6+'], ['5', '5+']])}
      ${sel('anti', L('Anti-X+ (krit. Verwundung)', 'Anti-X+ (crit. wound)'), [['0', L('nein', 'no')], ['2', '2+'], ['3', '3+'], ['4', '4+'], ['5', '5+']])}</div>
      <div class="chips mh-checks">${chk('torrent', 'Torrent')}${chk('lethal', 'Lethal Hits')}${chk('dev', 'Devastating Wounds')}</div>
      <h2>${esc(L('Ziel', 'Target'))}</h2><div class="mh-grid">${num('t', L('Widerstand', 'Toughness'), 1, 20)}${sel('sv', L('Rüstung', 'Save'), [2, 3, 4, 5, 6, 7].map(x => [String(x), x === 7 ? L('keine', 'none') : x + '+']))}
      ${sel('inv', L('Rettungswurf', 'Invuln'), [0, 2, 3, 4, 5, 6].map(x => [String(x), x ? x + '++' : L('keiner', 'none')]))}${sel('fnp', 'Feel No Pain', [0, 4, 5, 6].map(x => [String(x), x ? x + '+++' : L('keiner', 'none')]))}
      ${num('w', L('Lebenspunkte pro Modell', 'Wounds per model'), 1, 30)}</div></form>`;
  const f = $('#mh');
  const calc = () => {
    const v = {}; for (const e of f.elements) if (e.name) v[e.name] = e.type === 'checkbox' ? e.checked : e.value;
    store(MK, v);
    const r = simulate(v); const out = $('#mhout');
    if (!r) { out.innerHTML = `<p class="notice bad">${esc(L('Attacken oder Schaden ungültig. Erlaubt: Zahl, D3, D6, 2D6+1 …', 'Invalid attacks or damage. Allowed: number, D3, D6, 2D6+1 …'))}</p>`; return; }
    const f1 = x => (Math.round(x * 10) / 10).toLocaleString(getLang() === 'de' ? 'de-AT' : 'en-GB');
    const rows = r.atLeast.map((p, d) => [d, p]).filter(([d, p]) => d > 0 && p >= 0.01).slice(0, 40);
    out.innerHTML = `<div class="stats mh-stats"><div><b class="num">${f1(r.dmg)}</b><span>${esc(L('Ø Schaden', 'Avg damage'))}</span></div><div><b class="num">${f1(r.kills)}</b><span>${esc(L('Ø Modelle tot', 'Avg models killed'))}</span></div><div><b class="num">${f1(r.hits)}</b><span>${esc(L('Ø Treffer', 'Avg hits'))}</span></div><div><b class="num">${f1(r.unsaved)}</b><span>${esc(L('Ø nicht gerettet', 'Avg unsaved'))}</span></div></div>
      <p class="mute">${esc(L(`Verwunden auf ${r.wt}+ · Rettung auf ${r.save >= 7 ? '–' : r.save + '+'} · krit. Treffer ${r.ch}+ · krit. Verwundung ${r.cw}+`, `Wound on ${r.wt}+ · save on ${r.save >= 7 ? '–' : r.save + '+'} · crit hit ${r.ch}+ · crit wound ${r.cw}+`))}</p>
      <h3>${esc(L('Wahrscheinlichkeit für mindestens … Schaden', 'Chance of at least … damage'))}</h3>
      <div class="mh-bars">${rows.map(([d, p]) => `<div><span class="num">${d}</span><i style="--p:${Math.round(p * 100)}%"></i><b class="num">${Math.round(p * 100)}%</b></div>`).join('')}</div>`;
  };
  let tm; f.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(calc, 200); }); f.addEventListener('submit', e => e.preventDefault());
  calc();
}

// ====================================================================== Pairing trainer
const PK = 'monolith.pairtrain.v1';
const LEVELS = [[4, '−−'], [7, '−'], [10, '±'], [13, '+'], [16, '++']];
const PT0 = size => ({ size, ours: Array(size).fill(''), theirs: Array(size).fill(''), mx: Array(size).fill(0).map(() => Array(size).fill(10)), run: null });
let PT = null;
const savePT = () => store(PK, PT);
const val = (i, j) => PT.mx[i][j];
function aiDefender(ourLeft, theirLeft) { // the defender whose worst case for them is best
  let best = null, bs = -1; for (const j of theirLeft) { const worst = Math.min(...ourLeft.map(i => 20 - val(i, j))); const avgv = ourLeft.reduce((a, i) => a + 20 - val(i, j), 0) / ourLeft.length; const sc = worst * 2 + avgv + Math.random(); if (sc > bs) { bs = sc; best = j; } } return best;
}
function aiAttackers(ourDef, theirLeft, theirDef) { return theirLeft.filter(j => j !== theirDef).sort((x, y) => (20 - val(ourDef, y)) - (20 - val(ourDef, x)) + (Math.random() - 0.5)).slice(0, 2); }
function aiChoose(theirDef, ourAtt) { return ourAtt.slice().sort((x, y) => val(x, theirDef) - val(y, theirDef))[0]; } // their defender takes the attacker that is worst for us

export function pairtrain(el) {
  PT = store(PK) || PT0(5);
  const R = PT.run;
  if (!R) return ptSetup(el);
  ptStep(el);
}
function ptSetup(el) {
  const n = PT.size;
  el.innerHTML = head(L('Pairing-Trainer', 'Pairing trainer'), L('Pairing-Verfahren üben: Verteidiger, zwei Angreifer, Wahl – gegen einen Computer-Gegner. Die Matrix gibst du selbst ein (aus eurer Sicht).', 'Practise the pairing process – defender, two attackers, choice – against a computer opponent. You enter the matrix (from your side).')) + factionList() +
    `<form class="filters card" id="pts"><label>${esc(L('Teamgröße', 'Team size'))}<select name="size">${opts([['3', '3'], ['5', '5'], ['8', '8']], String(n))}</select></label>
      <button type="button" class="btn ghost sm" data-rand>${esc(L('Zufällige Matrix', 'Random matrix'))}</button><button type="button" class="btn ghost sm" data-clear>${esc(L('Leeren', 'Clear'))}</button></form>
    <div class="scroll"><table class="matrix pt-mx"><thead><tr><th class="corner">${esc(L('Wir ↓ / Gegner →', 'Us ↓ / them →'))}</th>${PT.theirs.map((a, j) => `<th><input data-th="${j}" list="factions" value="${esc(a)}" placeholder="${esc(L('Gegner', 'Opp'))} ${j + 1}"></th>`).join('')}</tr></thead><tbody>
      ${PT.ours.map((a, i) => `<tr><th><input data-ou="${i}" list="factions" value="${esc(a)}" placeholder="${esc(L('Wir', 'Us'))} ${i + 1}"></th>${PT.theirs.map((_, j) => `<td class="rt rt${Math.round((val(i, j) - 4) / 3) + 1}"><select data-mx="${i}|${j}" aria-label="${i + 1} vs ${j + 1}">${opts(LEVELS.map(([v, l]) => [String(v), l]), String(val(i, j)))}</select></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <p class="mute">${esc(L('−− klar schlecht (≈4 Punkte) · ± ausgeglichen (10) · ++ klar gut (≈16), jeweils aus unserer Sicht.', '−− clearly bad (≈4 points) · ± even (10) · ++ clearly good (≈16), from our side.'))}</p>
    <div class="row-actions"><button type="button" class="btn primary" data-start>${esc(L('Pairing starten', 'Start pairing'))}</button></div>`;
  el.onchange = e => {
    if (e.target.name === 'size') { PT = PT0(+e.target.value); savePT(); return ptSetup(el); }
    const m = e.target.dataset.mx; if (m) { const [i, j] = m.split('|').map(Number); PT.mx[i][j] = +e.target.value; savePT(); return ptSetup(el); }
    if (e.target.dataset.ou != null) { PT.ours[+e.target.dataset.ou] = e.target.value.trim(); savePT(); }
    if (e.target.dataset.th != null) { PT.theirs[+e.target.dataset.th] = e.target.value.trim(); savePT(); }
  };
  el.onclick = e => {
    if (e.target.closest('[data-rand]')) { PT.mx = PT.mx.map(r => r.map(() => LEVELS[Math.floor(Math.random() * 5)][0])); savePT(); return ptSetup(el); }
    if (e.target.closest('[data-clear]')) { PT = PT0(PT.size); savePT(); return ptSetup(el); }
    if (e.target.closest('[data-start]')) { PT.run = { ourLeft: [...Array(PT.size).keys()], theirLeft: [...Array(PT.size).keys()], games: [], phase: 'def', ourDef: null, theirDef: null, ourAtt: [], theirAtt: [] }; savePT(); return ptStep(el); }
  };
}
const oName = i => PT.ours[i] || `${L('Wir', 'Us')} ${i + 1}`;
const tName = j => PT.theirs[j] || `${L('Gegner', 'Opp')} ${j + 1}`;
function finishRound(R) {
  // our defender plays the attacker it chose (R.pick), their defender plays the attacker they chose
  const ourPick = R.pick, theirPick = aiChoose(R.theirDef, R.ourAtt);
  R.games.push([R.ourDef, ourPick, L('Unser Verteidiger', 'Our defender')], [theirPick, R.theirDef, L('Ihr Verteidiger', 'Their defender')]);
  R.ourLeft = R.ourLeft.filter(i => i !== R.ourDef && i !== theirPick); R.theirLeft = R.theirLeft.filter(j => j !== R.theirDef && j !== ourPick);
  const ourRef = R.ourAtt.find(i => i !== theirPick), theirRef = R.theirAtt.find(j => j !== ourPick);
  if (R.ourLeft.length === 1 && R.theirLeft.length === 1) { R.games.push([R.ourLeft[0], R.theirLeft[0], L('Abgelehnte Angreifer', 'Refused attackers')]); R.ourLeft = []; R.theirLeft = []; }
  else if (R.ourLeft.length === 2 && R.theirLeft.length === 2) { // 8-player final: refused attacker vs. the other side's last player
    const ourLast = R.ourLeft.find(i => i !== ourRef), theirLast = R.theirLeft.find(j => j !== theirRef);
    R.games.push([ourRef, theirLast, L('Abgelehnt vs. Letzter', 'Refused vs. last')], [ourLast, theirRef, L('Letzter vs. abgelehnt', 'Last vs. refused')]); R.ourLeft = []; R.theirLeft = []; }
  R.last = { theirPick, ourPick }; R.phase = R.ourLeft.length ? 'def' : 'done'; R.ourDef = R.theirDef = R.pick = null; R.ourAtt = []; R.theirAtt = [];
}
function ptStep(el) {
  const R = PT.run; const n = PT.size;
  const sum = R.games.reduce((a, [i, j]) => a + val(i, j), 0);
  const best = n <= 8 ? bestAssign(n) : null;
  const gamesHtml = R.games.length ? `<ul class="list pt-games">${R.games.map(([i, j, why]) => `<li><span><b>${esc(oName(i))}</b> vs <b>${esc(tName(j))}</b><br><small class="mute">${esc(why)}</small></span><span class="num rt rt${Math.round((val(i, j) - 4) / 3) + 1}">${val(i, j)}</span></li>`).join('')}</ul>` : '';
  const pickList = (ids, name, sel, attr) => `<div class="pt-pick">${ids.map(i => `<button type="button" class="chip${sel.includes(i) ? ' on' : ''}" data-${attr}="${i}">${esc(name(i))}</button>`).join('')}</div>`;
  let body = '';
  if (R.phase === 'def') body = `<h2>${esc(L('1. Wähle deinen Verteidiger', '1. Pick your defender'))}</h2>${pickList(R.ourLeft, oName, [], 'def')}`;
  else if (R.phase === 'att') body = `<p>${esc(L('Gegnerischer Verteidiger:', 'Their defender:'))} <b>${esc(tName(R.theirDef))}</b> · ${esc(L('Dein Verteidiger:', 'Your defender:'))} <b>${esc(oName(R.ourDef))}</b></p>
      <h2>${esc(L('2. Wähle zwei Angreifer gegen ihren Verteidiger', '2. Pick two attackers against their defender'))}</h2>${pickList(R.ourLeft.filter(i => i !== R.ourDef), oName, R.ourAtt, 'att')}
      <div class="row-actions"><button type="button" class="btn primary" data-sendatt${R.ourAtt.length === 2 ? '' : ' disabled'}>${esc(L('Angreifer schicken', 'Send attackers'))}</button></div>`;
  else if (R.phase === 'choose') body = `<p>${esc(L('Sie schicken gegen deinen Verteidiger', 'They send against your defender'))} <b>${esc(oName(R.ourDef))}</b>:</p>
      <h2>${esc(L('3. Gegen wen spielt dein Verteidiger?', '3. Who does your defender play?'))}</h2><div class="pt-pick">${R.theirAtt.map(j => `<button type="button" class="chip" data-pick="${j}">${esc(tName(j))} <span class="num rt rt${Math.round((val(R.ourDef, j) - 4) / 3) + 1}">${val(R.ourDef, j)}</span></button>`).join('')}</div>`;
  else body = `<h2>${esc(L('Fertig', 'Done'))}</h2><div class="stats"><div><b class="num">${sum}</b><span>${esc(L(`Erwartete Punkte (von ${n * 20})`, `Expected points (of ${n * 20})`))}</span></div>${best ? `<div><b class="num">${best}</b><span>${esc(L('Beste Zuordnung (ohne Verfahren)', 'Best assignment (no process)'))}</span></div>` : ''}<div><b class="num">${n * 10}</b><span>${esc(L('Ausgeglichen', 'Even'))}</span></div></div>`;
  el.innerHTML = head(L('Pairing-Trainer', 'Pairing trainer'), '') +
    `<section class="card">${R.last ? `<p class="mute">${esc(L(`Letzte Runde: Ihr Verteidiger nahm ${oName(R.last.theirPick)}, deiner ${tName(R.last.ourPick)}.`, `Last round: their defender took ${oName(R.last.theirPick)}, yours ${tName(R.last.ourPick)}.`))}</p>` : ''}${body}</section>
    ${R.games.length ? `<section class="card"><h2>${esc(L('Paarungen', 'Pairings'))} · ${sum} ${esc(L('Punkte', 'points'))}</h2>${gamesHtml}</section>` : ''}
    <div class="row-actions"><button type="button" class="btn ghost" data-again>${esc(L('Nochmal mit gleicher Matrix', 'Again with same matrix'))}</button><button type="button" class="btn ghost" data-edit>${esc(L('Matrix bearbeiten', 'Edit matrix'))}</button></div>`;
  el.onchange = null;
  el.onclick = e => {
    const d = e.target.closest('[data-def]'); if (d) { R.ourDef = +d.dataset.def; R.theirDef = aiDefender(R.ourLeft, R.theirLeft); R.phase = 'att'; savePT(); return ptStep(el); }
    const a = e.target.closest('[data-att]'); if (a) { const i = +a.dataset.att; R.ourAtt = R.ourAtt.includes(i) ? R.ourAtt.filter(x => x !== i) : [...R.ourAtt, i].slice(-2); savePT(); return ptStep(el); }
    if (e.target.closest('[data-sendatt]') && R.ourAtt.length === 2) { R.theirAtt = aiAttackers(R.ourDef, R.theirLeft, R.theirDef); R.phase = 'choose'; savePT(); return ptStep(el); }
    const p = e.target.closest('[data-pick]'); if (p) { R.pick = +p.dataset.pick; finishRound(R); savePT(); return ptStep(el); }
    if (e.target.closest('[data-again]')) { PT.run = null; savePT(); PT.run = { ourLeft: [...Array(n).keys()], theirLeft: [...Array(n).keys()], games: [], phase: 'def', ourDef: null, theirDef: null, ourAtt: [], theirAtt: [] }; savePT(); return ptStep(el); }
    if (e.target.closest('[data-edit]')) { PT.run = null; savePT(); return ptSetup(el); }
  };
}
function bestAssign(n) {
  const idx = [...Array(n).keys()]; let best = -1;
  const perm = (arr, k, s) => { if (k === n) { if (s > best) best = s; return; } for (let i = k; i < n; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1, s + val(k, arr[k])); [arr[k], arr[i]] = [arr[i], arr[k]]; } };
  perm(idx, 0, 0); return best;
}
