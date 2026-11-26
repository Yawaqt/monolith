// Team events (5s / 8s): line-up with rule checks, prediction heatmap, pairings, results, live sharing.
import { db } from './db.js?v=202611261504';
import { t } from './i18n.js?v=202611261504';
import { state, can, myPlayer, esc, $, $$, opts, players, playerById, pname, fmtDate, act, modal, confirmBox, empty, pageHead, toast, resultBadge, loadData, setting, evRange } from './core.js?v=202611261504';
import { FACTIONS, MATRIX_COLS, DISPOSITIONS, gp, resultOf, scoreStr, records, avg, fmt1, today } from './data.js?v=202611261504';

const D = () => state.data;
const CHAPTERS = ['Black Templars', 'Blood Angels', 'Dark Angels', 'Deathwatch', 'Imperial Fists', 'Iron Hands', 'Raven Guard', 'Salamanders', 'Space Wolves', 'Ultramarines', 'White Scars'];
const RATING_GP = { 1: 3, 1.5: 4.5, 2: 6, 2.5: 8, 3: 10, 3.5: 12, 4: 14, 4.5: 15.5, 5: 17 };
const PRED_VALUES = [2, 4, 6, 8, 9, 10, 11, 12, 14, 16, 18];
let sel = null;          // selected team event id
let roundSel = 1;        // selected round number
let step = 'lineup';     // lineup | matrix | opps | rounds
let allCols = false;     // matrix: show all factions
let oppOpen = null;      // opponent team shown open
const pending = new Map(); // debounced saves: key -> timer

const heat = v => v == null || v === '' ? 'h0' : v <= 6 ? 'h1' : v < 9 ? 'h2' : v <= 11 ? 'h3' : v < 14 ? 'h4' : 'h5';
const short = f => (f || '').replace('Adeptus ', 'A. ').replace('Adepta ', 'A. ').replace('Chaos Space Marines', 'CSM').replace('Space Marines', 'SM').replace('Leagues of Votann', 'Votann').replace('Genestealer Cults', 'GSC').replace("Emperor's Children", 'EC');

// ---------- rules
export function checkLineup(lineup, rules) {
  const errs = []; const r = rules || {};
  const norm = f => (r.chapters_as_sm && CHAPTERS.includes(f)) ? 'Space Marines' : f;
  const by = new Map();
  lineup.forEach((l, i) => { if (!l.faction) return; const k = norm(l.faction); if (!by.has(k)) by.set(k, []); by.get(k).push(i + 1); });
  if (r.no_dup) for (const [f, s] of by) if (s.length > 1) errs.push({ slots: s, msg: t('err_dup', { f, s: s.join(', ') }) });
  if (r.disp_max) {
    const d = new Map(); lineup.forEach((l, i) => { if (!l.disposition) return; if (!d.has(l.disposition)) d.set(l.disposition, []); d.get(l.disposition).push(i + 1); });
    for (const [k, s] of d) if (s.length > r.disp_max) errs.push({ slots: s, msg: t('err_disp', { d: k, n: s.length, m: r.disp_max }) });
  }
  const pl = new Map(); lineup.forEach((l, i) => { if (!l.player_id) return; if (!pl.has(l.player_id)) pl.set(l.player_id, []); pl.get(l.player_id).push(i + 1); });
  for (const [p, s] of pl) if (s.length > 1) errs.push({ slots: s, msg: t('err_player', { p: pname(p) }) });
  return errs;
}

// ---------- suggestions from the match log / master matrix
function suggest(slot, oppFaction) {
  if (!slot || !slot.faction || !oppFaction) return null;
  const recs = records(D().matches || []);
  const own = recs.filter(r => r.player_id === +slot.player_id && r.army === slot.faction && r.opp === oppFaction);
  if (own.length) return { v: avg(own.map(r => r.g)), n: own.length, src: 'p' };
  const team = recs.filter(r => r.army === slot.faction && r.opp === oppFaction);
  if (team.length) return { v: avg(team.map(r => r.g)), n: team.length, src: 't' };
  const rating = (D().ratings || []).find(r => r.player_id === +slot.player_id && r.faction === oppFaction);
  if (rating) return { v: RATING_GP[+rating.value] ?? 10, n: 0, src: 'm' };
  return null;
}

// ---------- event matrix (our army vs. opponent faction, rating 1–5)
// Taken from the Live Matrix when the event is created; editable afterwards.
const RATINGS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
const gpToRating = g => { const r = Math.round(g); return r <= 4 ? 1 : r <= 7 ? 2 : r <= 9 ? 2.5 : r === 10 ? 3 : r <= 12 ? 3.5 : r <= 14 ? 4 : 5; };
const mkey = (army, f) => `${army}|${f}`;
function teamArmies() {
  return [...new Set([...setting('matrix_armies', []), ...players().flatMap(p => (p.armies || []).map(a => a.army)).filter(Boolean)])];
}
function liveRatings(armies, onlyMissing = {}) {
  const recs = records(D().matches || []); const out = {};
  for (const a of armies) for (const f of FACTIONS) {
    const k = mkey(a, f); if (onlyMissing[k] != null) continue;
    const l = recs.filter(r => r.army === a && r.opp === f);
    if (l.length) out[k] = gpToRating(avg(l.map(r => r.g)));
  }
  return out;
}
const rateOf = (e, army, f) => { const v = (e.matrix || {})[mkey(army, f)]; return v == null ? null : +v; };
const rtClass = v => v == null ? '' : 'rt' + Math.round(v);
// Best pairing: every possible assignment (fine up to 8 players), highest predicted total wins
function bestPairing(n, value) {
  const idx = [...Array(n).keys()]; let best = null, bestSum = -1;
  const perm = (arr, k) => { if (k === arr.length) { let s = 0; for (let i = 0; i < n; i++) s += value(i, arr[i]); if (s > bestSum) { bestSum = s; best = arr.slice(); } return; }
    for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; } };
  if (n) perm(idx, 0); return { map: best, total: bestSum };
}
const newOpp = size => ({ id: Math.random().toString(36).slice(2, 10), name: '', note: '', players: [...Array(size)].map(() => ({ faction: '', disposition: '', name: '', note: '' })) });

// Prediction for a matchup: event matrix first, otherwise match log / master ratings
function predictFor(e, l, faction) {
  const r = l && l.faction && faction ? rateOf(e, l.faction, faction) : null;
  if (r != null) return { v: RATING_GP[r] ?? 10, n: 0, src: 'x', r };
  return suggest(l, faction);
}
// ---------- saving (debounced, so live typing doesn't spam the database)
function saveLater(key, fn, ms = 700) {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(async () => { pending.delete(key); try { await fn(); } catch (e) { toast(t('error') + ': ' + e.message, true); } }, ms));
}
const tev = () => (D().tevents || []).find(e => e.id === sel);
// Who may edit: players in the line-up, captains and admins. Everyone else in the team can look.
const inLineup = e => !!myPlayer() && (e.lineup || []).some(l => +l.player_id === +myPlayer());
const canEditTE = e => can('captain') || inLineup(e);
const rounds = id => (D().tevent_rounds || []).filter(r => r.tevent_id === id).sort((a, b) => a.round_no - b.round_no);
// Changes made in quick succession are merged, so none of them gets lost.
const queued = new Map();
function queue(key, table, id, patch) {
  const all = Object.assign(queued.get(key) || {}, patch); queued.set(key, all);
  saveLater(key, () => { const p = queued.get(key); queued.delete(key); return db.update(table, { id }, p); });
}
function patchEvent(patch) { const e = tev(); Object.assign(e, patch); queue('ev' + e.id, 'tevents', e.id, patch); }
function patchRound(r, patch) { Object.assign(r, patch); queue('r' + r.id, 'tevent_rounds', r.id, Object.assign({ updated_at: new Date().toISOString() }, patch)); }

// ---------- live updates from teammates
let subscribed = false, dirtyRemote = false;
function subscribeOnce() {
  if (subscribed) return; subscribed = true;
  let t0;
  db.subscribe(['tevents', 'tevent_rounds'], () => {
    clearTimeout(t0); t0 = setTimeout(async () => {
      if (pending.size) return; // our own save is still running
      await loadData(['tevents', 'tevent_rounds']);
      const view = $('#view');
      if (location.hash.startsWith('#/teams') && view && !view.contains(document.activeElement)) state.render(); else dirtyRemote = true;
    }, 400);
  });
  document.addEventListener('focusout', () => setTimeout(() => { if (dirtyRemote && location.hash.startsWith('#/teams') && !$('#view').contains(document.activeElement)) { dirtyRemote = false; state.render(); } }, 300));
}

// ---------------------------------------------------------------- page
export function teams(el) {
  subscribeOnce();
  const list = (D().tevents || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (sel && !list.find(e => e.id === sel)) sel = null;
  if (!sel) return listView(el, list);
  detail(el);
}

function listView(el, list) {
  el.innerHTML = pageHead(t('nav_teams'), t('teams_intro'), can('captain') ? `<button class="btn primary" data-new>${esc(t('new_tevent'))}</button>` : '') +
    (list.length ? `<div class="te-list">${list.map(e => { const ev = (D().events || []).find(x => x.id === e.event_id); const rs = rounds(e.id);
      const errs = checkLineup(e.lineup || [], e.rules);
      return `<button class="te-card" data-open="${e.id}"><b>${esc(e.title)}</b><span class="mute">${e.size}er Team${ev ? ' · ' + esc(fmtDate(ev.starts_on)) : ''} · ${rs.length} ${esc(t('te_rounds'))}</span>
        <span class="tag${errs.length ? ' warn-tag' : ''}">${errs.length ? '⚠ ' + errs.length : '✓'} ${esc(t('te_lineup'))}</span>${inLineup(e) ? ` <span class="tag team">${esc(t('te_you_tag'))}</span>` : ''}</button>`; }).join('')}</div>` : empty(t('te_none')));
  el.onclick = e => {
    const o = e.target.closest('[data-open]'); if (o) { sel = +o.dataset.open; roundSel = 1; step = 'lineup'; state.render(); return; }
    if (e.target.closest('[data-new]')) editEvent(null);
  };
}

async function editEvent(ev) {
  const x = ev || { title: '', size: 5, event_id: null, rules: { no_dup: true, chapters_as_sm: true, disp_max: null } };
  const evs = (D().events || []).filter(e => e.kind === 'Team Tournament' || e.id === x.event_id).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const r = await modal(ev ? t('te_settings') : t('new_tevent'), `<label>${esc(t('title'))}<input name="title" required maxlength="80" value="${esc(x.title)}"></label>
    <div class="grid2"><label>${esc(t('te_size'))}<select name="size">${opts([[5, '5er Team'], [8, '8er Team'], [3, '3er Team'], [4, '4er Team'], [6, '6er Team']], x.size)}</select></label>
    <label>${esc(t('te_link_event'))}<select name="event_id">${opts(evs.map(e => [e.id, `${fmtDate(e.starts_on, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${e.title}`]), x.event_id, '–')}</select></label></div>
    <fieldset><legend>${esc(t('te_rules'))}</legend>
      <label class="check"><input type="checkbox" name="no_dup" ${x.rules.no_dup ? 'checked' : ''}> ${esc(t('rule_no_dup'))}</label>
      <label class="check"><input type="checkbox" name="chapters_as_sm" ${x.rules.chapters_as_sm ? 'checked' : ''}> ${esc(t('rule_chapters'))}</label>
      <label>${esc(t('rule_disp_max'))}<select name="disp_max">${opts([['', t('no_limit')], [1, '1'], [2, '2'], [3, '3'], [4, '4']], x.rules.disp_max ?? '')}</select></label></fieldset>`,
    { onOpen: f => f.event_id.addEventListener('change', () => { const e = evs.find(q => q.id === +f.event_id.value); if (e) { if (!f.title.value) f.title.value = e.title; if (e.team_size) f.size.value = e.team_size; } }) });
  if (!r) return;
  const row = { title: r.title.trim(), size: +r.size, event_id: r.event_id ? +r.event_id : null, rules: { no_dup: !!r.no_dup, chapters_as_sm: !!r.chapters_as_sm, disp_max: r.disp_max ? +r.disp_max : null } };
  if (ev) return act(() => db.update('tevents', { id: ev.id }, row), ['tevents']);
  await act(async () => {
    const lineup = [...Array(row.size)].map(() => ({ player_id: null, faction: '', disposition: '' }));
    const saved = await db.insert('tevents', Object.assign(row, { lineup, matrix: liveRatings(teamArmies()), opponents: [] }));
    await db.insert('tevent_rounds', { tevent_id: saved.id, round_no: 1, opp_name: '', opp: [...Array(row.size)].map(() => ({ faction: '', disposition: '', name: '' })), predictions: {}, pairings: [] });
    sel = saved.id; roundSel = 1; step = 'lineup';
  }, ['tevents', 'tevent_rounds']);
}

function detail(el) {
  const e = tev(); const size = e.size;
  const lineup = [...Array(size)].map((_, i) => Object.assign({ player_id: null, faction: '', disposition: '' }, (e.lineup || [])[i] || {}));
  // Older events have no matrix yet: take it from the Live Matrix once
  const ro = !canEditTE(e);
  if (!ro && (!e.matrix || !Object.keys(e.matrix).length)) { const m = liveRatings(teamArmies()); if (Object.keys(m).length) patchEvent({ matrix: m }); }
  const errs = checkLineup(lineup, e.rules); const bad = new Set(errs.flatMap(x => x.slots));
  const rs = rounds(e.id); if (!rs.find(r => r.round_no === roundSel)) roundSel = rs[0]?.round_no || 1;
  const rd = rs.find(r => r.round_no === roundSel);
  const ev = (D().events || []).find(x => x.id === e.event_id);
  const opps = e.opponents || [];
  const filled = lineup.filter(l => l.player_id && l.faction).length;
  const steps = [['lineup', t('st_lineup'), filled === size && !errs.length], ['matrix', t('st_matrix'), Object.keys(e.matrix || {}).length > 0], ['opps', t('st_opps'), opps.length > 0], ['rounds', t('st_rounds'), rs.some(r => r.logged)]];
  const rulesTxt = [e.rules?.no_dup && t('rule_no_dup'), e.rules?.chapters_as_sm && t('rule_chapters'), e.rules?.disp_max && `${t('rule_disp_max')}: ${e.rules.disp_max}`].filter(Boolean);
  let body = '';
  if (step === 'lineup') body = `<section class="card"><h2>${esc(t('te_lineup'))}</h2>
      <div class="chips te-rules">${rulesTxt.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
      <div class="lineup">${lineup.map((l, i) => { const pl = playerById(l.player_id); const armies = (pl?.armies || []).map(a => a.army).filter(Boolean);
        return `<div class="lu${bad.has(i + 1) ? ' bad' : ''}" data-slot="${i}"><span class="lu-n">${i + 1}</span>
          <select data-f="player_id" aria-label="${esc(t('player'))} ${i + 1}">${opts(players().map(p => [p.id, p.name]), l.player_id, t('player'))}</select>
          <select data-f="faction" aria-label="${esc(t('faction'))} ${i + 1}">${opts([...new Set([...armies, ...FACTIONS])], l.faction, t('faction'))}</select>
          <select data-f="disposition" aria-label="${esc(t('disposition'))} ${i + 1}">${opts(DISPOSITIONS, l.disposition, t('disposition'))}</select></div>`; }).join('')}</div>
      <div class="rule-msgs" aria-live="polite">${errs.length ? errs.map(x => `<p class="rule-err">⚠ ${esc(x.msg)}</p>`).join('') : `<p class="rule-ok">✓ ${esc(t('te_ok'))}</p>`}</div></section>
    <section class="card"><h2>${esc(t('te_notes'))}</h2><textarea class="notes" data-evnotes rows="4" maxlength="8000" placeholder="${esc(t('te_notes_ph'))}">${esc(e.notes || '')}</textarea></section>`;
  if (step === 'matrix') body = matrixView(e, lineup);
  if (step === 'opps') body = oppsView(e, lineup);
  if (step === 'rounds') body = `<div class="round-tabs" role="tablist">${rs.map(r => `<button role="tab" type="button" data-round="${r.round_no}" aria-selected="${r.round_no === roundSel}">${esc(t('round'))} ${r.round_no}${r.opp_name ? ` · ${esc(r.opp_name)}` : ''}${r.logged ? ' ✓' : ''}</button>`).join('')}
      <button type="button" class="add-round" data-addround>${esc(t('add_round_te'))}</button></div>${rd ? roundView(e, lineup, rd) : ''}
    ${rd && can('captain') ? `<div class="form-actions"><button type="button" class="btn ghost sm danger-text" data-rddel="${rd.id}">${esc(t('rd_delete', { n: rd.round_no }))}</button></div>` : ''}`;
  el.innerHTML = `<button class="link" data-back>${esc(t('te_back'))}</button>
    ${pageHead(e.title, `${size}er Team${ev ? ' · ' + evRange(ev) + (ev.location ? ' · ' + ev.location : '') : ''} · ${t('te_saved_auto')}`,
      `<span class="live-dot" title="${esc(t('te_live'))}">● ${esc(t('te_live'))}</span>${can('captain') ? `<button class="btn ghost sm" data-share>${esc(t('te_share'))}</button><button class="btn ghost sm" data-settings>${esc(t('te_settings'))}</button><button class="btn ghost sm danger-text" data-tedel>${esc(t('delete'))}</button>` : ''}`)}
    ${ro ? `<p class="notice">👁 ${esc(t('te_readonly'))}</p>` : inLineup(e) && !can('captain') ? `<p class="notice ok">✓ ${esc(t('te_you_play'))}</p>` : ''}
    <nav class="te-tabs" role="tablist" aria-label="${esc(t('st_nav'))}">${steps.map(([k, l]) => `<button type="button" role="tab" data-step="${k}" aria-selected="${step === k}"><span class="tab-ico" aria-hidden="true">${TAB_ICONS[k]}</span>${esc(l)}</button>`).join('')}</nav>
    ${body}`;
  bind(el, e, lineup, rd, ro);
  if (rd && step === 'rounds') updateTotals(rd);
  // Read-only: lock every field and remove the editing buttons (navigation stays)
  if (!can('captain')) $$('[data-slot] select', el).forEach(x => { x.disabled = true; });
  if (ro) {
    $$('input, select, textarea', el).forEach(x => { if (x.dataset.allcols === undefined) x.disabled = true; });
    $$('[data-oppadd],[data-oppdel],[data-mxfill],[data-mxreset],[data-apply],[data-usepair],[data-tolog],[data-addround],[data-oppround]', el).forEach(b => b.remove());
  }
}
const TAB_ICONS = { lineup: '👥', matrix: '▦', opps: '⚔', rounds: '⇄' };

function matrixCols(e) {
  const fromOpps = [...new Set((e.opponents || []).flatMap(o => o.players.map(p => p.faction)).filter(Boolean))];
  return allCols || !fromOpps.length ? MATRIX_COLS : fromOpps;
}
function matrixView(e, lineup) {
  const rows = lineup.filter(l => l.faction); const cols = matrixCols(e);
  const hasOpps = (e.opponents || []).some(o => o.players.some(p => p.faction));
  return `<section class="card"><div class="block-head"><h2>${esc(t('st_matrix'))}</h2>
      <div class="row-actions">${hasOpps ? `<label class="check small"><input type="checkbox" data-allcols${allCols ? ' checked' : ''}> ${esc(t('mx_all'))}</label>` : ''}
      <button type="button" class="btn ghost sm" data-mxfill>${esc(t('mx_fill'))}</button>${can('captain') ? `<button type="button" class="btn ghost sm" data-mxreset>${esc(t('mx_reset'))}</button>` : ''}</div></div>
      <p class="mute small">${esc(t('mx_intro'))}</p>
      ${rows.length ? `<div class="scroll matrix-wrap"><table class="matrix ratings evmx"><thead><tr><th class="corner">${esc(t('our_lineup'))}</th>${cols.map(f => `<th class="vert" title="${esc(f)}"><span>${esc(short(f))}</span></th>`).join('')}<th>Ø</th></tr></thead><tbody>
        ${rows.map(l => { const vals = cols.map(f => rateOf(e, l.faction, f)); const ok = vals.filter(v => v != null);
          return `<tr><th>${esc(l.player_id ? pname(l.player_id) : '')}<br><small class="mute">${esc(short(l.faction))}</small></th>${cols.map((f, j) => `<td class="rt ${rtClass(vals[j])}"><select data-mx="${esc(mkey(l.faction, f))}" aria-label="${esc(l.faction)} vs ${esc(f)}">${opts(RATINGS, vals[j] != null ? String(vals[j]) : '', '·')}</select></td>`).join('')}
            <td class="num">${ok.length ? fmt1(avg(ok)) : ''}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="chips mx-legend">${[['1', 'mx_l1'], ['2', 'mx_l2'], ['3', 'mx_l3'], ['4', 'mx_l4'], ['5', 'mx_l5']].map(([v, k]) => `<span class="chip rt rt${v}"><b>${v}</b> ${esc(t(k))}</span>`).join('')}</div>`
      : `<p class="notice">${esc(t('mx_need_lineup'))}</p>`}</section>`;
}

function oppsView(e, lineup) {
  const opps = e.opponents || []; const ours = lineup.filter(l => l.faction);
  return `<p class="mute">${esc(t('opps_intro'))}</p>
    ${opps.map((o, oi) => { const isOpen = oppOpen === o.id || (oppOpen == null && oi === opps.length - 1);
      const factions = o.players.filter(p => p.faction);
      const pv = (l, p) => rateOf(e, l.faction, p.faction);
      return `<details class="card opp" data-opp="${o.id}"${isOpen ? ' open' : ''}><summary><b>${esc(o.name || t('opp_unnamed'))}</b> <span class="mute small">${factions.map(p => esc(short(p.faction))).join(' · ') || ''}</span></summary>
      <div class="grid2"><label>${esc(t('opp_team_name'))}<input data-oname value="${esc(o.name)}" maxlength="60"></label><span></span></div>
      <div class="opp-rows">${o.players.map((p, j) => `<div class="opp-row" data-op="${j}"><span class="lu-n">${String.fromCharCode(65 + j)}</span>
        <select data-k="faction" aria-label="${esc(t('opp_faction'))} ${j + 1}">${opts(FACTIONS, p.faction, t('opp_faction'))}</select>
        <select data-k="disposition" aria-label="${esc(t('opp_disp'))} ${j + 1}">${opts(DISPOSITIONS, p.disposition, t('opp_disp'))}</select>
        <input data-k="name" value="${esc(p.name || '')}" maxlength="40" placeholder="${esc(t('opp_name'))}">
        <input data-k="note" class="wide" value="${esc(p.note || '')}" maxlength="200" placeholder="${esc(t('opp_player_note'))}"></div>`).join('')}</div>
      ${ours.length && factions.length ? `<h3 class="sub">${esc(t('mt_title'))}</h3><div class="scroll matrix-wrap"><table class="matrix ratings"><thead><tr><th class="corner"></th>${ours.map(l => `<th>${esc(l.player_id ? pname(l.player_id) : '')}<br><small class="mute">${esc(short(l.faction))}</small></th>`).join('')}<th>Ø</th></tr></thead><tbody>
        ${factions.map(p => { const vals = ours.map(l => pv(l, p)); const ok = vals.filter(v => v != null); return `<tr><th>${esc(short(p.faction))}${p.disposition ? `<br><small class="mute">${esc(p.disposition)}</small>` : ''}</th>${vals.map(v => `<td class="rt ${rtClass(v)}">${v ?? '·'}</td>`).join('')}<td class="num">${ok.length ? fmt1(avg(ok)) : ''}</td></tr>`; }).join('')}
        <tr class="sum"><th>Ø</th>${ours.map(l => { const ok = factions.map(p => pv(l, p)).filter(v => v != null); return `<td class="num">${ok.length ? fmt1(avg(ok)) : ''}</td>`; }).join('')}<td></td></tr></tbody></table></div>` : ''}
      <label>${esc(t('opp_team_note'))}<textarea class="notes" data-onote rows="3" maxlength="2000">${esc(o.note || '')}</textarea></label>
      <div class="form-actions"><button type="button" class="btn primary sm" data-oppround="${o.id}"${factions.length ? '' : ' disabled'}>${esc(t('opp_to_round'))}</button>${can('captain') ? `<button type="button" class="btn ghost sm" data-oppdel="${o.id}">${esc(t('delete'))}</button>` : ''}</div></details>`; }).join('')}
    <button type="button" class="btn ghost" data-oppadd>+ ${esc(t('opp_add'))}</button>`;
}

function roundView(e, lineup, rd) {
  const size = e.size;
  const opp = [...Array(size)].map((_, i) => Object.assign({ faction: '', disposition: '', name: '' }, (rd.opp || [])[i] || {}));
  const pred = rd.predictions || {}; const pairs = rd.pairings || [];
  const pairOf = o => pairs.find(p => p.o === o);
  const used = new Set(pairs.filter(p => p.t != null && p.t !== '').map(p => +p.t));
  let predTot = 0, predN = 0, ourTot = 0, theirTot = 0, done = 0;
  const rows = lineup.map((l, o) => {
    const p = pairOf(o) || {}; const tIdx = p.t === '' || p.t == null ? null : +p.t;
    const pv = tIdx != null ? pred[`${o}-${tIdx}`] : null;
    const g = tIdx != null ? gp(p.us, p.them) : null;
    if (pv != null && tIdx != null) { predTot += +pv; predN++; }
    if (g) { ourTot += g[0]; theirTot += g[1]; done++; }
    const delta = g && pv != null ? g[0] - pv : null;
    return `<tr data-o="${o}"><th>${esc(pname(l.player_id) === '?' ? `${t('te_slot')} ${o + 1}` : pname(l.player_id))}<br><small class="mute">${esc(l.faction || '–')}</small></th>
      <td><select data-pair="${o}" aria-label="${esc(t('te_vs'))}">${opts(opp.map((x, j) => [j, `${x.name ? x.name + ' · ' : ''}${x.faction || t('te_slot') + ' ' + (j + 1)}`]).filter(([j]) => j === tIdx || !used.has(j)), tIdx, t('unpaired'))}</select></td>
      <td class="num ${heat(pv)}">${pv != null ? esc(pv) : '–'}</td>
      <td class="nowrap"><input class="sc" data-us="${o}" type="number" inputmode="numeric" min="0" max="200" value="${esc(p.us ?? '')}" aria-label="${esc(t('our_score'))}" ${tIdx == null ? 'disabled' : ''}> : <input class="sc" data-them="${o}" type="number" inputmode="numeric" min="0" max="200" value="${esc(p.them ?? '')}" aria-label="${esc(t('opp_score'))}" ${tIdx == null ? 'disabled' : ''}></td>
      <td class="nowrap" data-res="${o}">${resCell(g)}</td>
      <td class="num ${deltaCls(delta)}" data-delta="${o}">${deltaTxt(delta)}</td></tr>`;
  }).join('');
  const allDone = done === size && size > 0;
  const linked = (e.opponents || []).find(o => o.id === rd.opp_team);
  // Best pairing from the predictions (or the matrix where nothing was entered)
  const val = (o, j) => { const v = pred[`${o}-${j}`]; if (v != null) return +v; const sg = predictFor(e, lineup[o], opp[j].faction); return sg ? sg.v : 10; };
  const ready = opp.every(x => x.faction) && lineup.every(l => l.faction);
  const bp = ready ? bestPairing(size, val) : null;
  return `<section class="card"><div class="grid2"><label>${esc(t('rd_opp_team'))}<select data-opplink>${opts((e.opponents || []).map(o => [o.id, o.name || t('opp_unnamed')]), rd.opp_team || '', t('rd_manual'))}</select></label>
      <label>${esc(t('opp_team_name'))}<input data-oppname value="${esc(rd.opp_name || '')}" maxlength="60"${linked ? ' readonly' : ''}></label></div>
      ${linked ? `<div class="chips opp-chips">${opp.map((x, j) => `<span class="chip"><b>${String.fromCharCode(65 + j)}</b> ${esc(x.faction || '–')}${x.disposition ? ` · <small>${esc(x.disposition)}</small>` : ''}${x.name ? ` · <small>${esc(x.name)}</small>` : ''}</span>`).join('')}</div><p class="mute small">${esc(t('rd_linked_hint'))}</p>` : `<h3 class="sub">${esc(t('te_opp_lineup'))}</h3>
      <div class="lineup">${opp.map((x, j) => `<div class="lu" data-oslot="${j}"><span class="lu-n">${String.fromCharCode(65 + j)}</span>
        <select data-of="faction" aria-label="${esc(t('opp_faction'))} ${j + 1}">${opts(FACTIONS, x.faction, t('opp_faction'))}</select>
        <select data-of="disposition" aria-label="${esc(t('opp_disp'))} ${j + 1}">${opts(DISPOSITIONS, x.disposition, t('opp_disp'))}</select>
        <input data-of="name" value="${esc(x.name || '')}" maxlength="40" placeholder="${esc(t('opp_name'))}" aria-label="${esc(t('opp_name'))} ${j + 1}"></div>`).join('')}</div>`}</section>
    <section class="card"><div class="block-head"><h2>${esc(t('te_matrix'))}</h2><button class="btn ghost sm" data-apply>${esc(t('te_apply'))}</button></div>
      <div class="scroll matrix-wrap"><table class="matrix heat"><thead><tr><th class="corner"></th>${opp.map((x, j) => `<th><span class="oh">${String.fromCharCode(65 + j)}</span>${esc(short(x.faction) || '–')}${x.name ? `<br><small class="mute">${esc(x.name)}</small>` : ''}</th>`).join('')}<th>Ø</th></tr></thead><tbody>
      ${lineup.map((l, o) => { const vals = [];
        const cells = opp.map((x, j) => { const v = pred[`${o}-${j}`]; const sg = predictFor(e, l, x.faction); if (v != null) vals.push(+v);
          const paired = (pairOf(o) || {}).t; const isPair = paired !== '' && paired != null && +paired === j;
          return `<td class="${heat(v ?? null)}${isPair ? ' paired' : ''}"><select data-pred="${o}-${j}" aria-label="${esc(pname(l.player_id))} vs ${esc(x.faction || '')}">${opts(PRED_VALUES.map(n => [n, String(n)]), v ?? '', '·')}</select>
            ${sg ? `<small class="sg" title="${esc(sg.src === 'x' ? t('st_matrix') + ' ' + sg.r : sg.src === 'm' ? 'Master Matrix' : sg.src === 'p' ? t('player') : 'Team')}">≈${esc(fmt1(sg.v).replace('.0', ''))}${sg.n ? ` (${sg.n})` : ''}</small>` : ''}</td>`; }).join('');
        return `<tr><th>${esc(l.player_id ? pname(l.player_id) : t('te_slot') + ' ' + (o + 1))}<br><small class="mute">${esc(short(l.faction) || '–')}</small></th>${cells}<td class="num ${heat(vals.length ? avg(vals) : null)}">${vals.length ? fmt1(avg(vals)) : ''}</td></tr>`; }).join('')}
      </tbody></table></div><p class="mute small">${esc(t('te_suggest_note2'))}</p></section>
    <section class="card"><h2>${esc(t('te_pairings'))}</h2>
      ${bp ? `<div class="pair-sug"><div><b>${esc(t('ps_title'))}</b> <span class="mute">≈ ${fmt1(bp.total).replace('.0', '')} GP</span><br><small>${bp.map.map((j, o) => `${esc(lineup[o].player_id ? pname(lineup[o].player_id) : t('te_slot') + ' ' + (o + 1))} → ${String.fromCharCode(65 + j)} ${esc(short(opp[j].faction))}`).join(' · ')}</small></div>
        <button type="button" class="btn ghost sm" data-usepair="${bp.map.join(',')}">${esc(t('ps_use'))}</button></div>` : `<p class="mute small">${esc(t('ps_need'))}</p>`}
      <div class="scroll"><table class="pairs"><thead><tr><th>${esc(t('player'))}</th><th>${esc(t('te_vs'))}</th><th>${esc(t('te_pred'))}</th><th>${esc(t('te_scores'))}</th><th>${esc(t('te_actual'))}</th><th>${esc(t('te_delta'))}</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><th colspan="2">${esc(t('te_total'))}</th><td class="num" data-tot="pred">${predN ? fmt1(predTot).replace('.0', '') : '–'}</td><td></td><td><b class="num" data-tot="act">${done ? `${ourTot}–${theirTot}` : '–'}</b></td><td class="num" data-tot="delta"></td></tr></tfoot></table></div>
      <div class="form-actions">${rd.logged ? `<span class="tag">✓ ${esc(t('te_logged'))}</span>` : can('captain') ? `<button class="btn primary sm" data-tolog ${allDone ? '' : 'disabled'}>${esc(t('te_to_log'))}</button>` : `<small class="mute">${esc(t('te_log_captain'))}</small>`}</div></section>
    <section class="card"><h2>${esc(t('rd_notes'))}</h2><textarea class="notes" data-rdnotes rows="4" maxlength="8000" placeholder="${esc(t('rd_notes_ph'))}">${esc(rd.notes || '')}</textarea></section>`;
}

// Opponent teams are kept on the event; rounds linked to a team follow its changes until they are logged.
function patchOpps(e, opponents) {
  patchEvent({ opponents });
  for (const r of rounds(e.id)) { const o = opponents.find(x => x.id === r.opp_team); if (!o || r.logged) continue;
    const opp = o.players.map(p => ({ faction: p.faction, disposition: p.disposition, name: p.name }));
    if (JSON.stringify(opp) !== JSON.stringify(r.opp) || r.opp_name !== o.name) patchRound(r, { opp, opp_name: o.name }); }
}
function editOpp(e, id, fn) { const list = JSON.parse(JSON.stringify(e.opponents || [])); const o = list.find(x => x.id === id); if (!o) return; fn(o); patchOpps(e, list); }
function fillPred(e, lineup, oppPlayers, cur) {
  const pred = Object.assign({}, cur || {});
  lineup.forEach((l, o) => oppPlayers.forEach((x, j) => { const k = `${o}-${j}`; if (pred[k] == null) { const sg = predictFor(e, l, x.faction); if (sg) pred[k] = Math.round(sg.v); } }));
  return pred;
}
async function roundForOpp(e, lineup, oid) {
  const o = (e.opponents || []).find(x => x.id === oid); if (!o) return;
  const rs = rounds(e.id);
  const existing = rs.find(r => r.opp_team === oid);
  if (existing) { roundSel = existing.round_no; step = 'rounds'; return state.render(); }
  const empty = rs.find(r => !r.logged && !r.opp_team && !(r.opp || []).some(x => x.faction) && !(r.pairings || []).length);
  const patch = { opp_team: o.id, opp_name: o.name, opp: o.players.map(p => ({ faction: p.faction, disposition: p.disposition, name: p.name })), predictions: fillPred(e, lineup, o.players, {}) };
  if (empty) { patchRound(empty, patch); roundSel = empty.round_no; step = 'rounds'; return state.render(); }
  const n = Math.max(0, ...rs.map(r => r.round_no)) + 1;
  await act(async () => { await db.insert('tevent_rounds', Object.assign({ tevent_id: e.id, round_no: n, pairings: [] }, patch)); roundSel = n; step = 'rounds'; }, ['tevent_rounds'], false);
}
function bind(el, e, lineup, rd, ro) {
  el.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.back !== undefined) { sel = null; return state.render(); }
    if (b.dataset.step) { step = b.dataset.step; return state.render(); }
    if (ro && !b.dataset.round && b.dataset.back === undefined) return;
    if (b.dataset.tedel !== undefined && can('captain')) {
      if (!await confirmBox(t('te_delete_q', { title: e.title }))) return;
      const id = e.id; sel = null; return act(() => db.remove('tevents', { id }), ['tevents', 'tevent_rounds'], t('te_deleted')); }
    if (b.dataset.rddel && can('captain')) {
      if (!await confirmBox(t('rd_delete_q', { n: rd.round_no }))) return;
      roundSel = 1; return act(() => db.remove('tevent_rounds', { id: +b.dataset.rddel }), ['tevent_rounds']); }
    if (b.dataset.mxfill !== undefined) { const add = liveRatings([...new Set([...lineup.map(l => l.faction).filter(Boolean), ...teamArmies()])], e.matrix || {});
      patchEvent({ matrix: Object.assign({}, e.matrix, add) }); toast(t('mx_filled', { n: Object.keys(add).length })); return state.render(); }
    if (b.dataset.mxreset !== undefined) { if (!await confirmBox(t('mx_reset_q'))) return; patchEvent({ matrix: liveRatings([...new Set([...lineup.map(l => l.faction).filter(Boolean), ...teamArmies()])]) }); return state.render(); }
    if (b.dataset.oppadd !== undefined) { const o = newOpp(e.size); oppOpen = o.id; patchOpps(e, [...(e.opponents || []), o]); return state.render(); }
    if (b.dataset.oppdel) { const o = (e.opponents || []).find(x => x.id === b.dataset.oppdel); if (o && await confirmBox(o.name || t('opp_unnamed'))) { patchOpps(e, e.opponents.filter(x => x.id !== o.id)); state.render(); } return; }
    if (b.dataset.oppround) return roundForOpp(e, lineup, b.dataset.oppround);
    if (b.dataset.usepair && rd) { const map = b.dataset.usepair.split(',').map(Number); const old = rd.pairings || [];
      const pairs = map.map((j, o) => { const p = old.find(x => x.o === o && +x.t === j) || {}; return { o, t: j, us: p.us ?? '', them: p.them ?? '' }; });
      patchRound(rd, { pairings: pairs }); return state.render(); }
    if (b.dataset.round) { roundSel = +b.dataset.round; return state.render(); }
    if (b.dataset.settings !== undefined) return editEvent(e);
    if (b.dataset.share !== undefined) return share(e);
    if (b.dataset.addround !== undefined) {
      const n = Math.max(0, ...rounds(e.id).map(r => r.round_no)) + 1;
      return act(async () => { await db.insert('tevent_rounds', { tevent_id: e.id, round_no: n, opp_name: '', opp: [...Array(e.size)].map(() => ({ faction: '', disposition: '', name: '' })), predictions: {}, pairings: [] }); roundSel = n; }, ['tevent_rounds'], false);
    }
    if (b.dataset.apply !== undefined && rd) {
      const pred = Object.assign({}, rd.predictions);
      lineup.forEach((l, o) => (rd.opp || []).forEach((x, j) => { const k = `${o}-${j}`; if (pred[k] == null) { const sg = predictFor(e, l, x.faction); if (sg) pred[k] = Math.round(sg.v); } }));
      patchRound(rd, { predictions: pred }); return state.render();
    }
    if (b.dataset.tolog !== undefined && rd) {
      const rows = (rd.pairings || []).filter(p => p.t != null && p.t !== '' && gp(p.us, p.them)).map(p => { const l = lineup[p.o], x = (rd.opp || [])[+p.t] || {};
        return { type: 'Team Tournament', tournament: e.title, played_on: today(), player_id: +l.player_id, army: l.faction, disposition: l.disposition || null, opp_faction: x.faction, opp_disposition: x.disposition || null,
          opp_player_id: null, opp_name: x.name || null, our_score: +p.us, opp_score: +p.them, notes: rd.opp_name ? `${t('round')} ${rd.round_no} vs ${rd.opp_name}` : `${t('round')} ${rd.round_no}` }; });
      if (rows.some(r => !r.player_id || !r.army || !r.opp_faction)) return toast(t('rounds_missing'), true);
      return act(async () => { for (const m of rows) await db.insert('matches', m); await db.update('tevent_rounds', { id: rd.id }, { logged: true }); }, ['matches', 'tevent_rounds'], t('rounds_saved', { n: rows.length }));
    }
  };
  el.onchange = ev => {
    const s = ev.target;
    if (s.dataset.allcols !== undefined) { allCols = s.checked; return state.render(); }
    if (ro) return;
    if (s.closest('[data-slot]') && !can('captain')) return;
    if (s.dataset.mx) { const m = Object.assign({}, e.matrix); if (s.value === '') delete m[s.dataset.mx]; else m[s.dataset.mx] = +s.value; patchEvent({ matrix: m }); return state.render(); }
    if (s.dataset.allcols !== undefined) { allCols = s.checked; return state.render(); }
    const oc = s.closest('[data-opp]'); const orow = s.closest('[data-op]');
    if (oc && orow && s.tagName === 'SELECT') { oppOpen = oc.dataset.opp; editOpp(e, oc.dataset.opp, o => { o.players[+orow.dataset.op][s.dataset.k] = s.value; }); return state.render(); }
    if (s.dataset.opplink !== undefined && rd) { const o = (e.opponents || []).find(x => x.id === s.value);
      if (o) patchRound(rd, Object.assign({ opp_team: o.id, opp_name: o.name, opp: o.players.map(p => ({ faction: p.faction, disposition: p.disposition, name: p.name })) }, { predictions: fillPred(e, lineup, o.players, rd.predictions) }));
      else patchRound(rd, { opp_team: null });
      return state.render(); }
    const lu = s.closest('[data-slot]');
    if (lu && s.dataset.f) {
      const i = +lu.dataset.slot; const next = lineup.map(x => Object.assign({}, x));
      next[i][s.dataset.f] = s.dataset.f === 'player_id' ? (s.value ? +s.value : null) : s.value;
      if (s.dataset.f === 'player_id' && s.value) { const a = (playerById(s.value)?.armies || []).find(x => x.army); if (a && !next[i].faction) { next[i].faction = a.army; next[i].disposition = next[i].disposition || a.d1 || ''; } }
      if (s.dataset.f === 'faction') { const a = (playerById(next[i].player_id)?.armies || []).find(x => x.army === s.value); if (a && a.d1 && !next[i].disposition) next[i].disposition = a.d1; }
      const missing = liveRatings(next.map(x => x.faction).filter(Boolean), e.matrix || {});
      patchEvent(Object.keys(missing).length ? { lineup: next, matrix: Object.assign({}, e.matrix, missing) } : { lineup: next }); return state.render();
    }
    if (!rd) return;
    const os = s.closest('[data-oslot]');
    if (os && s.dataset.of && s.tagName === 'SELECT') { const opp = (rd.opp || []).map(x => Object.assign({}, x)); while (opp.length < e.size) opp.push({ faction: '', disposition: '', name: '' }); opp[+os.dataset.oslot][s.dataset.of] = s.value; patchRound(rd, { opp }); return state.render(); }
    if (s.dataset.pred) { const pred = Object.assign({}, rd.predictions); if (s.value === '') delete pred[s.dataset.pred]; else pred[s.dataset.pred] = +s.value; patchRound(rd, { predictions: pred }); return state.render(); }
    if (s.dataset.pair !== undefined) { const o = +s.dataset.pair; const pairs = (rd.pairings || []).filter(p => p.o !== o); const old = (rd.pairings || []).find(p => p.o === o) || {};
      if (s.value !== '') pairs.push({ o, t: +s.value, us: old.us ?? '', them: old.them ?? '' }); patchRound(rd, { pairings: pairs.sort((a, b) => a.o - b.o) }); return state.render(); }
    if (s.dataset.us !== undefined || s.dataset.them !== undefined) { scoreInput(s, rd); return; }
  };
  el.oninput = ev => {
    const s = ev.target; if (ro) return;
    if (s.dataset.evnotes !== undefined) return patchEvent({ notes: s.value });
    const oc = s.closest('[data-opp]');
    if (oc) { oppOpen = oc.dataset.opp; const orow = s.closest('[data-op]');
      if (s.dataset.oname !== undefined) { editOpp(e, oc.dataset.opp, o => { o.name = s.value; }); const sum = oc.querySelector('summary b'); if (sum) sum.textContent = s.value || t('opp_unnamed'); }
      if (s.dataset.onote !== undefined) editOpp(e, oc.dataset.opp, o => { o.note = s.value; });
      if (orow && s.tagName === 'INPUT') editOpp(e, oc.dataset.opp, o => { o.players[+orow.dataset.op][s.dataset.k] = s.value; });
      return; }
    if (!rd) return;
    if (s.dataset.rdnotes !== undefined) return patchRound(rd, { notes: s.value });
    if (s.dataset.oppname !== undefined) patchRound(rd, { opp_name: s.value });
    const os = s.closest('[data-oslot]'); if (os && s.dataset.of === 'name') { const opp = (rd.opp || []).map(x => Object.assign({}, x)); while (opp.length < e.size) opp.push({ faction: '', disposition: '', name: '' }); opp[+os.dataset.oslot].name = s.value; patchRound(rd, { opp }); }
    if (s.dataset.us !== undefined || s.dataset.them !== undefined) scoreInput(s, rd);
  };
}
const resCell = g => g ? `<b class="num">${scoreStr(g)}</b> ${resultBadge(resultOf(g))}` : '';
const deltaCls = d => d == null ? '' : d > 0 ? 'up' : d < 0 ? 'down' : '';
const deltaTxt = d => d == null ? '' : (d > 0 ? '+' : '') + fmt1(d).replace('.0', '');
function scoreInput(s, rd) {
  const o = +(s.dataset.us ?? s.dataset.them); const pairs = (rd.pairings || []).map(p => Object.assign({}, p)); const p = pairs.find(x => x.o === o); if (!p) return;
  if (s.dataset.us !== undefined) p.us = s.value === '' ? '' : +s.value; else p.them = s.value === '' ? '' : +s.value;
  patchRound(rd, { pairings: pairs });
  updateTotals(rd);
}
// Update result cells in place, so typing a score never moves the cursor away.
function updateTotals(rd) {
  const pred = rd.predictions || {}; let predTot = 0, predN = 0, us = 0, them = 0, done = 0;
  for (const p of rd.pairings || []) {
    if (p.t === '' || p.t == null) continue;
    const g = gp(p.us, p.them); const pv = pred[`${p.o}-${p.t}`]; const d = g && pv != null ? g[0] - pv : null;
    if (pv != null) { predTot += +pv; predN++; } if (g) { us += g[0]; them += g[1]; done++; }
    const rc = document.querySelector(`[data-res="${p.o}"]`); if (rc) rc.innerHTML = resCell(g);
    const dc = document.querySelector(`[data-delta="${p.o}"]`); if (dc) { dc.className = 'num ' + deltaCls(d); dc.textContent = deltaTxt(d); }
  }
  const a = document.querySelector('[data-tot="act"]'); if (a) a.textContent = done ? `${us}–${them}` : '–';
  const dt = document.querySelector('[data-tot="delta"]'); if (dt) { const d = done && predN === done ? us - predTot : null; dt.className = 'num ' + deltaCls(d); dt.textContent = deltaTxt(d); }
  const tl = document.querySelector('[data-tolog]'); if (tl) { const size = tev()?.size || 0; tl.disabled = !(done === size && size > 0); }
}

async function share(e) {
  const hasPw = await db.rpc('tevent_has_password', { p_id: e.id }).catch(() => false);
  const link = e.share_code ? `${location.origin}${location.pathname}#/live/${e.share_code}` : '';
  const r = await modal(t('te_share'), `<p class="mute">${esc(t('te_share_intro'))}</p>
    ${link ? `<div class="share-link"><input readonly value="${esc(link)}" aria-label="Link"><button type="button" class="btn ghost sm" data-copy>${esc(t('copy_link'))}</button></div>
      <label>${esc(t('te_pw'))}<input name="pw" type="text" autocomplete="off" placeholder="${hasPw ? esc(t('te_pw_set')) + ' ••••' : ''}"></label>
      <div class="form-actions"><button type="button" class="btn ghost sm" data-pwsave>${esc(t('te_pw_save'))}</button>${hasPw ? `<button type="button" class="btn ghost sm" data-pwclear>${esc(t('te_pw_clear'))}</button>` : ''}<button type="button" class="btn ghost sm" data-kill>${esc(t('te_kill_link'))}</button></div>`
      : `<button type="button" class="btn primary" data-make>${esc(t('te_make_link'))}</button>`}`, { submit: t('close'), onOpen: f => {
    f.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.copy !== undefined) { try { await navigator.clipboard.writeText(link); toast(t('copied')); } catch (_) { $('.share-link input', f).select(); } }
      if (b.dataset.make !== undefined) { const code = [...crypto.getRandomValues(new Uint8Array(9))].map(x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('') + 'm'; $('#modal').classList.remove('on'); $('#modal').innerHTML = '';
        await act(() => db.update('tevents', { id: e.id }, { share_code: code }), ['tevents'], false); share(tev()); }
      if (b.dataset.kill !== undefined) { $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; await act(() => db.update('tevents', { id: e.id }, { share_code: null }), ['tevents']); }
      if (b.dataset.pwsave !== undefined) { const v = f.pw.value; if (!v) return; await act(() => db.rpc('set_tevent_password', { p_id: e.id, p_password: v }), null); f.pw.value = ''; f.pw.placeholder = t('te_pw_set') + ' ••••'; }
      if (b.dataset.pwclear !== undefined) { await act(() => db.rpc('set_tevent_password', { p_id: e.id, p_password: '' }), null); b.remove(); f.pw.placeholder = ''; }
    });
  } });
  return r;
}

// ---------------------------------------------------------------- public view-only page (#/live/<code>)
let liveTimer = null;
export async function live(el, code) {
  clearInterval(liveTimer);
  const pwKey = 'monolith.livepw.' + code;
  let pw = null; try { pw = sessionStorage.getItem(pwKey); } catch (_) {}
  let data;
  try { data = await db.rpc('public_tevent', { p_code: code, p_password: pw }); } catch (err) { el.innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; return; }
  if (!location.hash.startsWith('#/live/')) return;
  if (data.error === 'not_found') { el.innerHTML = pageHead(t('live_title'), '') + `<div class="notice">${esc(t('live_nf'))}</div>`; return; }
  if (data.error === 'password') {
    el.innerHTML = `<div class="auth"><form class="card form" id="lpw"><h1>${esc(t('live_title'))}</h1><p class="mute">${esc(t('live_pw'))}</p><label>${esc(t('password'))}<input name="pw" type="password" required autocomplete="off"></label>${pw ? `<p class="rule-err">${esc(t('error'))}</p>` : ''}<button class="btn primary block">${esc(t('open_app'))}</button></form></div>`;
    $('#lpw').addEventListener('submit', ev => { ev.preventDefault(); try { sessionStorage.setItem(pwKey, ev.target.pw.value); } catch (_) {} live(el, code); });
    return;
  }
  const size = data.size;
  el.innerHTML = pageHead(data.title, `${size}er Team · ${t('live_refresh')}`, `<span class="live-dot">● ${esc(t('te_live'))}</span>`) +
    `<section class="card"><h2>${esc(t('te_lineup'))}</h2><ol class="live-lu">${(data.lineup || []).map(l => `<li><b>${esc(l.player || '–')}</b> <span class="mute">${esc(l.faction || '')}${l.disposition ? ' · ' + esc(l.disposition) : ''}</span></li>`).join('')}</ol></section>` +
    (data.rounds || []).map(r => {
      const pairs = r.pairings || []; let us = 0, them = 0, n = 0;
      const lines = pairs.filter(p => p.t !== '' && p.t != null).map(p => { const l = (data.lineup || [])[p.o] || {}, x = (r.opp || [])[+p.t] || {}; const g = gp(p.us, p.them); if (g) { us += g[0]; them += g[1]; n++; }
        const pv = (r.predictions || {})[`${p.o}-${p.t}`];
        return `<li><span><b>${esc(l.player || '')}</b> <span class="mute">${esc(l.faction || '')}</span> ${esc(t('te_vs'))} <span class="mute">${esc(x.faction || '')}${x.name ? ' (' + esc(x.name) + ')' : ''}</span></span><span>${pv != null ? `<span class="tag ${heat(pv)}">${esc(t('te_pred'))} ${esc(pv)}</span> ` : ''}${g ? `<b class="num">${scoreStr(g)}</b> ${resultBadge(resultOf(g))}` : ''}</span></li>`; }).join('');
      return `<section class="card"><div class="block-head"><h2>${esc(t('round'))} ${r.round_no}${r.opp_name ? ' · ' + esc(r.opp_name) : ''}</h2>${n ? `<b class="num live-score">${us}–${them}</b>` : ''}</div>${lines ? `<ul class="list live-pairs">${lines}</ul>` : `<p class="mute">${esc(t('unpaired'))}</p>`}</section>`;
    }).join('');
  liveTimer = setInterval(() => { if (location.hash === '#/live/' + code) live(el, code); else clearInterval(liveTimer); }, 30000);
}
