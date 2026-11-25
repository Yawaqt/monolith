// Team events (5s / 8s): line-up with rule checks, prediction heatmap, pairings, results, live sharing.
import { db } from './db.js';
import { t } from './i18n.js';
import { state, can, myPlayer, esc, $, $$, opts, players, playerById, pname, fmtDate, act, modal, confirmBox, empty, pageHead, toast, resultBadge, loadData } from './core.js';
import { FACTIONS, DISPOSITIONS, gp, resultOf, scoreStr, records, avg, fmt1, today } from './data.js';

const D = () => state.data;
const CHAPTERS = ['Black Templars', 'Blood Angels', 'Dark Angels', 'Deathwatch', 'Imperial Fists', 'Iron Hands', 'Raven Guard', 'Salamanders', 'Space Wolves', 'Ultramarines', 'White Scars'];
const RATING_GP = { 1: 3, 1.5: 4.5, 2: 6, 2.5: 8, 3: 10, 3.5: 12, 4: 14, 4.5: 15.5, 5: 17 };
const PRED_VALUES = [2, 4, 6, 8, 9, 10, 11, 12, 14, 16, 18];
let sel = null;          // selected team event id
let roundSel = 1;        // selected round number
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

// ---------- saving (debounced, so live typing doesn't spam the database)
function saveLater(key, fn, ms = 700) {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(async () => { pending.delete(key); try { await fn(); } catch (e) { toast(t('error') + ': ' + e.message, true); } }, ms));
}
const tev = () => (D().tevents || []).find(e => e.id === sel);
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
        <span class="tag${errs.length ? ' warn-tag' : ''}">${errs.length ? '⚠ ' + errs.length : '✓'} ${esc(t('te_lineup'))}</span></button>`; }).join('')}</div>` : empty(t('te_none')));
  el.onclick = e => {
    const o = e.target.closest('[data-open]'); if (o) { sel = +o.dataset.open; roundSel = 1; state.render(); return; }
    if (e.target.closest('[data-new]')) editEvent(null);
  };
}

async function editEvent(ev) {
  const x = ev || { title: '', size: 5, event_id: null, rules: { no_dup: true, chapters_as_sm: true, disp_max: null } };
  const evs = (D().events || []).slice().sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const r = await modal(ev ? t('te_settings') : t('new_tevent'), `<label>${esc(t('title'))}<input name="title" required maxlength="80" value="${esc(x.title)}"></label>
    <div class="grid2"><label>${esc(t('te_size'))}<select name="size">${opts([[5, '5er Team'], [8, '8er Team'], [3, '3er Team'], [4, '4er Team'], [6, '6er Team']], x.size)}</select></label>
    <label>${esc(t('te_link_event'))}<select name="event_id">${opts(evs.map(e => [e.id, `${fmtDate(e.starts_on, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${e.title}`]), x.event_id, '–')}</select></label></div>
    <fieldset><legend>${esc(t('te_rules'))}</legend>
      <label class="check"><input type="checkbox" name="no_dup" ${x.rules.no_dup ? 'checked' : ''}> ${esc(t('rule_no_dup'))}</label>
      <label class="check"><input type="checkbox" name="chapters_as_sm" ${x.rules.chapters_as_sm ? 'checked' : ''}> ${esc(t('rule_chapters'))}</label>
      <label>${esc(t('rule_disp_max'))}<select name="disp_max">${opts([['', t('no_limit')], [1, '1'], [2, '2'], [3, '3'], [4, '4']], x.rules.disp_max ?? '')}</select></label></fieldset>`,
    { onOpen: f => f.event_id.addEventListener('change', () => { if (!f.title.value) { const e = evs.find(q => q.id === +f.event_id.value); if (e) f.title.value = e.title; } }) });
  if (!r) return;
  const row = { title: r.title.trim(), size: +r.size, event_id: r.event_id ? +r.event_id : null, rules: { no_dup: !!r.no_dup, chapters_as_sm: !!r.chapters_as_sm, disp_max: r.disp_max ? +r.disp_max : null } };
  if (ev) return act(() => db.update('tevents', { id: ev.id }, row), ['tevents']);
  await act(async () => {
    const lineup = [...Array(row.size)].map(() => ({ player_id: null, faction: '', disposition: '' }));
    const saved = await db.insert('tevents', Object.assign(row, { lineup }));
    await db.insert('tevent_rounds', { tevent_id: saved.id, round_no: 1, opp_name: '', opp: [...Array(row.size)].map(() => ({ faction: '', disposition: '', name: '' })), predictions: {}, pairings: [] });
    sel = saved.id; roundSel = 1;
  }, ['tevents', 'tevent_rounds']);
}

function detail(el) {
  const e = tev(); const size = e.size;
  const lineup = [...Array(size)].map((_, i) => Object.assign({ player_id: null, faction: '', disposition: '' }, (e.lineup || [])[i] || {}));
  const errs = checkLineup(lineup, e.rules); const bad = new Set(errs.flatMap(x => x.slots));
  const rs = rounds(e.id); if (!rs.find(r => r.round_no === roundSel)) roundSel = rs[0]?.round_no || 1;
  const rd = rs.find(r => r.round_no === roundSel);
  const ev = (D().events || []).find(x => x.id === e.event_id);
  const rulesTxt = [e.rules?.no_dup && t('rule_no_dup'), e.rules?.chapters_as_sm && t('rule_chapters'), e.rules?.disp_max && `${t('rule_disp_max')}: ${e.rules.disp_max}`].filter(Boolean);
  el.innerHTML = `<button class="link" data-back>${esc(t('te_back'))}</button>
    ${pageHead(e.title, `${size}er Team${ev ? ' · ' + fmtDate(ev.starts_on) + (ev.location ? ' · ' + ev.location : '') : ''} · ${t('te_saved_auto')}`,
      `<span class="live-dot" title="${esc(t('te_live'))}">● ${esc(t('te_live'))}</span>${can('captain') ? `<button class="btn ghost sm" data-share>${esc(t('te_share'))}</button><button class="btn ghost sm" data-settings>${esc(t('te_settings'))}</button>` : ''}`)}
    <div class="chips te-rules">${rulesTxt.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    <section class="card"><h2>${esc(t('te_lineup'))}</h2>
      <div class="lineup">${lineup.map((l, i) => { const pl = playerById(l.player_id); const armies = (pl?.armies || []).map(a => a.army).filter(Boolean);
        return `<div class="lu${bad.has(i + 1) ? ' bad' : ''}" data-slot="${i}"><span class="lu-n">${i + 1}</span>
          <select data-f="player_id" aria-label="${esc(t('player'))} ${i + 1}">${opts(players().map(p => [p.id, p.name]), l.player_id, t('player'))}</select>
          <select data-f="faction" aria-label="${esc(t('faction'))} ${i + 1}">${opts([...new Set([...armies, ...FACTIONS])], l.faction, t('faction'))}</select>
          <select data-f="disposition" aria-label="${esc(t('disposition'))} ${i + 1}">${opts(DISPOSITIONS, l.disposition, t('disposition'))}</select></div>`; }).join('')}</div>
      <div class="rule-msgs" aria-live="polite">${errs.length ? errs.map(x => `<p class="rule-err">⚠ ${esc(x.msg)}</p>`).join('') : `<p class="rule-ok">✓ ${esc(t('te_ok'))}</p>`}</div></section>
    <div class="round-tabs" role="tablist">${rs.map(r => `<button role="tab" type="button" data-round="${r.round_no}" aria-selected="${r.round_no === roundSel}">${esc(t('round'))} ${r.round_no}${r.opp_name ? ` · ${esc(r.opp_name)}` : ''}</button>`).join('')}
      <button type="button" class="add-round" data-addround>${esc(t('add_round_te'))}</button></div>
    ${rd ? roundView(e, lineup, rd) : ''}`;
  bind(el, e, lineup, rd);
  if (rd) updateTotals(rd);
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
  return `<section class="card"><div class="grid2"><label>${esc(t('opp_team_name'))}<input data-oppname value="${esc(rd.opp_name || '')}" maxlength="60"></label></div>
      <h3 class="sub">${esc(t('te_opp_lineup'))}</h3>
      <div class="lineup">${opp.map((x, j) => `<div class="lu" data-oslot="${j}"><span class="lu-n">${String.fromCharCode(65 + j)}</span>
        <select data-of="faction" aria-label="${esc(t('opp_faction'))} ${j + 1}">${opts(FACTIONS, x.faction, t('opp_faction'))}</select>
        <select data-of="disposition" aria-label="${esc(t('opp_disp'))} ${j + 1}">${opts(DISPOSITIONS, x.disposition, t('opp_disp'))}</select>
        <input data-of="name" value="${esc(x.name || '')}" maxlength="40" placeholder="${esc(t('opp_name'))}" aria-label="${esc(t('opp_name'))} ${j + 1}"></div>`).join('')}</div></section>
    <section class="card"><div class="block-head"><h2>${esc(t('te_matrix'))}</h2><button class="btn ghost sm" data-apply>${esc(t('te_apply'))}</button></div>
      <div class="scroll matrix-wrap"><table class="matrix heat"><thead><tr><th class="corner"></th>${opp.map((x, j) => `<th><span class="oh">${String.fromCharCode(65 + j)}</span>${esc(short(x.faction) || '–')}${x.name ? `<br><small class="mute">${esc(x.name)}</small>` : ''}</th>`).join('')}<th>Ø</th></tr></thead><tbody>
      ${lineup.map((l, o) => { const vals = [];
        const cells = opp.map((x, j) => { const v = pred[`${o}-${j}`]; const sg = suggest(l, x.faction); if (v != null) vals.push(+v);
          const paired = (pairOf(o) || {}).t; const isPair = paired !== '' && paired != null && +paired === j;
          return `<td class="${heat(v ?? null)}${isPair ? ' paired' : ''}"><select data-pred="${o}-${j}" aria-label="${esc(pname(l.player_id))} vs ${esc(x.faction || '')}">${opts(PRED_VALUES.map(n => [n, String(n)]), v ?? '', '·')}</select>
            ${sg ? `<small class="sg" title="${esc(sg.src === 'm' ? 'Master Matrix' : sg.src === 'p' ? t('player') : 'Team')}">≈${esc(fmt1(sg.v).replace('.0', ''))}${sg.n ? ` (${sg.n})` : ''}</small>` : ''}</td>`; }).join('');
        return `<tr><th>${esc(l.player_id ? pname(l.player_id) : t('te_slot') + ' ' + (o + 1))}<br><small class="mute">${esc(short(l.faction) || '–')}</small></th>${cells}<td class="num ${heat(vals.length ? avg(vals) : null)}">${vals.length ? fmt1(avg(vals)) : ''}</td></tr>`; }).join('')}
      </tbody></table></div><p class="mute small">${esc(t('te_suggest_note'))}</p></section>
    <section class="card"><h2>${esc(t('te_pairings'))}</h2><div class="scroll"><table class="pairs"><thead><tr><th>${esc(t('player'))}</th><th>${esc(t('te_vs'))}</th><th>${esc(t('te_pred'))}</th><th>${esc(t('te_scores'))}</th><th>${esc(t('te_actual'))}</th><th>${esc(t('te_delta'))}</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><th colspan="2">${esc(t('te_total'))}</th><td class="num" data-tot="pred">${predN ? fmt1(predTot).replace('.0', '') : '–'}</td><td></td><td><b class="num" data-tot="act">${done ? `${ourTot}–${theirTot}` : '–'}</b></td><td class="num" data-tot="delta"></td></tr></tfoot></table></div>
      <div class="form-actions">${rd.logged ? `<span class="tag">✓ ${esc(t('te_logged'))}</span>` : can('captain') ? `<button class="btn primary sm" data-tolog ${allDone ? '' : 'disabled'}>${esc(t('te_to_log'))}</button>` : `<small class="mute">${esc(t('te_log_captain'))}</small>`}</div></section>`;
}

function bind(el, e, lineup, rd) {
  el.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.back !== undefined) { sel = null; return state.render(); }
    if (b.dataset.round) { roundSel = +b.dataset.round; return state.render(); }
    if (b.dataset.settings !== undefined) return editEvent(e);
    if (b.dataset.share !== undefined) return share(e);
    if (b.dataset.addround !== undefined) {
      const n = Math.max(0, ...rounds(e.id).map(r => r.round_no)) + 1;
      return act(async () => { await db.insert('tevent_rounds', { tevent_id: e.id, round_no: n, opp_name: '', opp: [...Array(e.size)].map(() => ({ faction: '', disposition: '', name: '' })), predictions: {}, pairings: [] }); roundSel = n; }, ['tevent_rounds'], false);
    }
    if (b.dataset.apply !== undefined && rd) {
      const pred = Object.assign({}, rd.predictions);
      lineup.forEach((l, o) => (rd.opp || []).forEach((x, j) => { const k = `${o}-${j}`; if (pred[k] == null) { const sg = suggest(l, x.faction); if (sg) pred[k] = Math.round(sg.v); } }));
      patchRound(rd, { predictions: pred }); return state.render();
    }
    if (b.dataset.tolog !== undefined && rd) {
      const rows = (rd.pairings || []).filter(p => p.t != null && p.t !== '' && gp(p.us, p.them)).map(p => { const l = lineup[p.o], x = (rd.opp || [])[+p.t] || {};
        return { type: 'Tournament', tournament: e.title, played_on: today(), player_id: +l.player_id, army: l.faction, disposition: l.disposition || null, opp_faction: x.faction, opp_disposition: x.disposition || null,
          opp_player_id: null, opp_name: x.name || null, our_score: +p.us, opp_score: +p.them, notes: rd.opp_name ? `${t('round')} ${rd.round_no} vs ${rd.opp_name}` : `${t('round')} ${rd.round_no}` }; });
      if (rows.some(r => !r.player_id || !r.army || !r.opp_faction)) return toast(t('rounds_missing'), true);
      return act(async () => { for (const m of rows) await db.insert('matches', m); await db.update('tevent_rounds', { id: rd.id }, { logged: true }); }, ['matches', 'tevent_rounds'], t('rounds_saved', { n: rows.length }));
    }
  };
  el.onchange = ev => {
    const s = ev.target;
    const lu = s.closest('[data-slot]');
    if (lu && s.dataset.f) {
      const i = +lu.dataset.slot; const next = lineup.map(x => Object.assign({}, x));
      next[i][s.dataset.f] = s.dataset.f === 'player_id' ? (s.value ? +s.value : null) : s.value;
      if (s.dataset.f === 'player_id' && s.value) { const a = (playerById(s.value)?.armies || []).find(x => x.army); if (a && !next[i].faction) { next[i].faction = a.army; next[i].disposition = next[i].disposition || a.d1 || ''; } }
      if (s.dataset.f === 'faction') { const a = (playerById(next[i].player_id)?.armies || []).find(x => x.army === s.value); if (a && a.d1 && !next[i].disposition) next[i].disposition = a.d1; }
      patchEvent({ lineup: next }); return state.render();
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
    const s = ev.target; if (!rd) return;
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
