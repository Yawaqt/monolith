// Analysis pages: live matrix, statistics, master matrix, master team, pairing.
import { db } from './db.js?v=202611271019';
import { t } from './i18n.js?v=202611271019';
import { state, can, myPlayer, isMe, esc, $, $$, opts, players, playerById, pname, setting, act, modal, confirmBox, gpClass, empty, pageHead, toast } from './core.js?v=202611271019';
import { ownGames } from './pages-history.js?v=202611271019';
import { FACTIONS, MATRIX_COLS, DISPOSITIONS, RATING_LEGEND, records, summarize, groupBy, avg, fmt1, pct, matrixCell, typeLabel } from './data.js?v=202611271019';

const D = () => state.data;
const short = f => f.replace('Adeptus ', 'A. ').replace('Adepta ', 'A. ').replace('Chaos Space Marines', 'CSM').replace('Space Marines', 'SM').replace('Leagues of Votann', 'Votann').replace('Genestealer Cults', 'GSC').replace("Emperor's Children", 'EC').replace('Imperial Knights', 'Imp. Knights');

// ---------------------------------------------------------------- Live matrix
let mxSince = '';
export function matrix(el) {
  const rows = setting('matrix_armies', []);
  const recs = records(D().matches || [], { since: mxSince });
  const byKey = groupBy(recs, r => r.army + '|' + r.opp);
  const cell = (a, f) => { const list = byKey.get(a + '|' + f) || []; return { n: list.length, g: list.length ? avg(list.map(r => r.g)) : null }; };
  const ourArmies = [...new Set(players().flatMap(p => (p.armies || []).map(x => x.army)).filter(Boolean))].filter(a => !rows.includes(a));
  el.innerHTML = pageHead(t('nav_matrix'), t('matrix_intro')) +
    `<form class="filters card"><label>${esc(t('since'))}<input type="date" id="mxs" value="${esc(mxSince)}"></label>
      ${can('captain') ? `<label>${esc(t('add_army'))}<select id="mxadd">${opts([...ourArmies, ...FACTIONS.filter(f => !rows.includes(f) && !ourArmies.includes(f))], '', '–')}</select></label>` : ''}
      <div class="legend"><span class="up">${esc(t('ahead'))}</span><span class="even">${esc(t('even'))}</span><span class="down">${esc(t('behind'))}</span></div></form>
    ${rows.length ? `<div class="scroll matrix-wrap"><table class="matrix"><thead><tr><th class="corner">${esc(t('our_armies'))}</th>${MATRIX_COLS.map(f => `<th class="vert" title="${esc(f)}"><span>${esc(short(f))}</span></th>`).join('')}</tr></thead><tbody>
      ${rows.map(a => `<tr><th>${esc(a)}${can('captain') ? ` <button class="icon xs" data-rm="${esc(a)}" aria-label="${esc(t('delete'))} ${esc(a)}">✕</button>` : ''}</th>${MATRIX_COLS.map(f => { const c = cell(a, f); const s = matrixCell(c.g);
        return `<td class="${gpClass(c.g)}" title="${esc(a)} vs ${esc(f)}: ${esc(t('n_games', { n: c.n }))}">${s ? `${s[0]}-${s[1]}` : '–'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>` : empty()}`;
  $('#mxs').addEventListener('change', e => { mxSince = e.target.value; matrix(el); });
  const add = $('#mxadd'); if (add) add.addEventListener('change', e => { if (e.target.value) saveRows([...rows, e.target.value]); });
  el.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) saveRows(rows.filter(x => x !== b.dataset.rm)); };
}
const saveRows = list => act(() => db.upsert('settings', { key: 'matrix_armies', value: list }), ['settings']);

const fmtD = x => x == null ? '' : (x > 0 ? '+' : '') + fmt1(x);
const dCls = x => x == null ? '' : x > 0 ? 'up' : x < 0 ? 'down' : '';
const CLOSE = 10; // a game is "close" when the raw point difference is at most 10
const isClose = r => Math.abs(r.our - r.theirs) <= CLOSE;
const WGW_MIN = 2, GAP_MAX = 3;
const rankKey = s => [s.rate ?? -1, s.avgDiff ?? -999, s.n];
const byRank = (a, b) => { const x = rankKey(a.s), y = rankKey(b.s); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; };
const fmtS = s => `${s.w}-${s.d}-${s.l} · ${pct(s.rate)}`;
function closeSection(recsByPlayer) {
  const rows = recsByPlayer.map(([name, list, me]) => { const c = summarize(list.filter(isClose)), o = summarize(list.filter(r => !isClose(r))); return { name, c, o, me }; }).filter(x => x.c.n + x.o.n);
  return `<section class="card"><h2>${esc(t('close_games'))}</h2><p class="mute">${esc(t('close_hint', { n: CLOSE }))}</p><div class="scroll"><table class="compact-stat"><thead><tr><th>${esc(t('player'))}</th><th>${esc(t('close_s'))}</th><th class="r">%</th><th>${esc(t('clear_s'))}</th><th class="r">%</th></tr></thead><tbody>
    ${rows.map(({ name, c, o, me }) => `<tr${me ? ' class="me"' : ''}><td><b>${esc(name)}</b></td><td class="num">${c.w}-${c.d}-${c.l}</td>${rateCell(c)}<td class="num">${o.w}-${o.d}-${o.l}</td>${rateCell(o)}</tr>`).join('')}</tbody></table></div></section>`;
}
function wgwSection(recs) {
  const byF = groupBy(recs, r => r.opp);
  const rows = MATRIX_COLS.map(f => { const list = byF.get(f) || []; const best = [...groupBy(list, r => r.player_id)].map(([pid, l]) => ({ pid, s: summarize(l) })).filter(x => x.s.n >= WGW_MIN).sort(byRank).slice(0, 3); return { f, n: list.length, best }; }).filter(x => x.best.length);
  return `<section class="card"><h2>${esc(t('wgw'))}</h2><p class="mute">${esc(t('wgw_hint', { n: WGW_MIN }))}</p>${rows.length ? `<div class="scroll"><table class="compact-stat wgw"><thead><tr><th>${esc(t('vs_faction_s'))}</th><th>${esc(t('wgw_best'))}</th></tr></thead><tbody>
    ${rows.map(({ f, n, best }) => `<tr><td><b>${esc(f)}</b><br><small class="mute">${esc(t('n_games', { n }))}</small></td><td>${best.map((x, i) => `<div class="${i ? 'mute' : ''}"><b>${esc(pname(x.pid))}</b> <span class="num">${x.s.n} · ${fmtS(x.s)} · ${fmtD(x.s.avgDiff)}</span></div>`).join('')}</td></tr>`).join('')}</tbody></table></div>` : empty()}</section>`;
}
function gapSection(recs) {
  const cnt = new Map(MATRIX_COLS.map(f => [f, 0])); for (const r of recs) if (cnt.has(r.opp)) cnt.set(r.opp, cnt.get(r.opp) + 1);
  const gaps = [...cnt].filter(([, n]) => n < GAP_MAX).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return `<section class="card"><h2>${esc(t('gaps'))}</h2><p class="mute">${esc(t('gaps_hint', { n: GAP_MAX }))}</p>${gaps.length ? `<div class="chips">${gaps.map(([f, n]) => `<span class="chip${n ? '' : ' zero'}">${esc(f)} <b>${n}</b></span>`).join('')}</div>` : `<p>${esc(t('gaps_none'))}</p>`}</section>`;
}
// ---------------------------------------------------------------- Statistics
const SF = { type: '', since: '' };
export function stats(el) {
  const recs = records(D().matches || [], SF);
  const byP = groupBy(recs, r => r.player_id);
  const prow = players(true).map(p => { const list = byP.get(p.id) || []; const s = summarize(list); const top = [...groupBy(list, r => r.army)].sort((a, b) => b[1].length - a[1].length)[0]; return { p, s, top }; })
    .filter(x => x.s.n || x.p.active).sort((a, b) => a.p.name.localeCompare(b.p.name));
  const byA = groupBy(recs, r => r.army), vsF = groupBy(recs, r => r.opp);
  const armies = [...new Set([...byA.keys(), ...vsF.keys()])].sort();
  const internal = recs.filter(r => r.internal && !r.mirrored);
  const pairs = groupBy(internal, r => [r.player_id, r.vsPlayer].sort((a, b) => a - b).join('-'));
  const types = [...new Set((D().matches || []).map(m => m.type))];
  el.innerHTML = pageHead(t('nav_stats'), t('stats_intro')) +
    `<form class="filters card" id="sf"><label>${esc(t('type'))}<select name="type">${opts([['', t('st_all_games')], ['__tour', t('st_all_tours')], ...types.map(x => [x, typeLabel(x, t)])], SF.type)}</select></label><label>${esc(t('since'))}<input type="date" name="since" value="${esc(SF.since)}"></label></form>
    <section class="card"><h2>${esc(t('players'))}</h2><div class="scroll"><table class="stack"><thead><tr><th>${esc(t('player'))}</th><th class="r">${esc(t('games'))}</th><th class="r">${esc(t('wins'))}</th><th class="r">${esc(t('draws'))}</th><th class="r">${esc(t('losses'))}</th><th class="r">${esc(t('winrate'))}</th><th class="r">${esc(t('avg_gp'))}</th><th class="r">${esc(t('avg_diff'))}</th><th>${esc(t('most_played'))}</th><th class="r">${esc(t('games_with'))}</th></tr></thead><tbody>
      ${prow.map(({ p, s, top }) => `<tr${isMe(p.id) ? ' class="me"' : ''}><td><b>${esc(p.name)}</b></td><td class="r num">${s.n}</td><td class="r num">${s.w}</td><td class="r num">${s.d}</td><td class="r num">${s.l}</td><td class="r num">${pct(s.rate)}</td><td class="r num ${gpClass(s.avgGp)}">${fmt1(s.avgGp)}</td><td class="r num ${dCls(s.avgDiff)}">${fmtD(s.avgDiff)}</td><td>${esc(top ? top[0] : '')}</td><td class="r num">${top ? top[1].length : ''}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="card"><h2>${esc(t('armies'))}</h2><div class="scroll"><table class="stack"><thead><tr><th>${esc(t('army'))}</th><th class="r">${esc(t('as_ours'))}</th><th class="r">${esc(t('wins'))}</th><th class="r">${esc(t('draws'))}</th><th class="r">${esc(t('losses'))}</th><th class="r">${esc(t('winrate'))}</th><th class="r">${esc(t('avg_gp'))}</th><th class="r">${esc(t('avg_diff'))}</th><th class="r">${esc(t('vs_faction'))}</th><th class="r">${esc(t('our_gp_vs'))}</th><th class="r">${esc(t('avg_diff'))}</th></tr></thead><tbody>
      ${armies.map(a => { const s = summarize(byA.get(a) || []), v = summarize(vsF.get(a) || []); return `<tr><td><b>${esc(a)}</b></td><td class="r num">${s.n}</td><td class="r num">${s.w}</td><td class="r num">${s.d}</td><td class="r num">${s.l}</td><td class="r num">${pct(s.rate)}</td><td class="r num ${gpClass(s.avgGp)}">${fmt1(s.avgGp)}</td><td class="r num ${dCls(s.avgDiff)}">${fmtD(s.avgDiff)}</td><td class="r num">${v.n}</td><td class="r num ${gpClass(v.avgGp)}">${fmt1(v.avgGp)}</td><td class="r num ${dCls(v.avgDiff)}">${fmtD(v.avgDiff)}</td></tr>`; }).join('')}
    </tbody></table></div></section>
    ${wgwSection(recs)}
    ${gapSection(recs)}
    ${closeSection(prow.map(({ p }) => [p.name, byP.get(p.id) || [], isMe(p.id)]))}
    <section class="card"><h2>${esc(t('pvp'))}</h2>${pairs.size ? `<table class="stack"><thead><tr><th>${esc(t('player'))}</th><th class="r">${esc(t('games'))}</th><th>${esc(t('result'))}</th><th class="r">${esc(t('avg_gp'))}</th><th class="r">${esc(t('avg_diff'))}</th></tr></thead><tbody>
      ${[...pairs.entries()].map(([k, list]) => { const [a, b] = k.split('-').map(Number); const mine = records(list.map(r => r.m)).filter(r => r.player_id === a); const s = summarize(mine);
        return `<tr><td><b>${esc(pname(a))}</b> ${esc(t('vs'))} <b>${esc(pname(b))}</b></td><td class="r num">${s.n}</td><td class="num">${s.w}-${s.d}-${s.l}</td><td class="r num">${fmt1(s.avgGp)} : ${fmt1(20 - s.avgGp)}</td><td class="r num">${fmtD(s.avgDiff)}</td></tr>`; }).join('')}</tbody></table>` : empty()}</section>`;
  const f = $('#sf'); f.addEventListener('change', () => { SF.type = f.type.value; SF.since = f.since.value; stats(el); });
}

// ---------------------------------------------------------------- My statistics (own games only)
const MF = { type: '', since: '' };
const MIN_VS = 6; // opponents are listed only with more than 5 games
const oppKey = r => r.oppKey != null ? r.oppKey : r.vsPlayer != null ? 'p' + r.vsPlayer : (r.m.opp_name || '').trim().toLowerCase();
const oppLabel = r => r.oppName != null ? r.oppName : r.vsPlayer != null ? pname(r.vsPlayer) : (r.m.opp_name || '').trim();
const wdl = s => `${s.w}-${s.d}-${s.l}`;
const rateCell = s => `<td class="r num ${s.rate == null ? '' : s.rate >= 0.55 ? 'up' : s.rate <= 0.45 ? 'down' : 'even'}">${pct(s.rate)}</td>`;
const statRows = (map, head) => `<div class="scroll"><table class="compact-stat"><thead><tr><th>${esc(head)}</th><th class="r" title="${esc(t('games'))}">${esc(t('games_s'))}</th><th title="${esc(t('result'))}">${esc(t('wdl_s'))}</th><th class="r">%</th><th class="r" title="${esc(t('avg_diff'))}">Ø ±</th></tr></thead><tbody>
  ${[...map].map(([k, list]) => [k, summarize(list)]).sort((a, b) => b[1].n - a[1].n || String(a[0]).localeCompare(String(b[0]))).map(([k, s]) => `<tr><td><b>${esc(k || '—')}</b></td><td class="r num">${s.n}</td><td class="num">${wdl(s)}</td>${rateCell(s)}<td class="r num ${dCls(s.avgDiff)}">${fmtD(s.avgDiff)}</td></tr>`).join('')}</tbody></table></div>`;
function myClose(recs) {
  const c = summarize(recs.filter(isClose)), o = summarize(recs.filter(r => !isClose(r)));
  return `<section class="card"><h2>${esc(t('close_games'))}</h2><p class="mute">${esc(t('close_hint', { n: CLOSE }))}</p><div class="scroll"><table class="compact-stat"><thead><tr><th></th><th class="r">${esc(t('games_s'))}</th><th>${esc(t('wdl_s'))}</th><th class="r">%</th></tr></thead><tbody>
    <tr><td><b>${esc(t('close_s'))}</b></td><td class="r num">${c.n}</td><td class="num">${c.w}-${c.d}-${c.l}</td>${rateCell(c)}</tr>
    <tr><td><b>${esc(t('clear_s'))}</b></td><td class="r num">${o.n}</td><td class="num">${o.w}-${o.d}-${o.l}</td>${rateCell(o)}</tr></tbody></table></div></section>`;
}
// Shared by "Meine Statistik" and the Match History: opponents (> 5 games), close games, own factions, against factions.
// recs need army, opp, our, theirs, res; opponents come from oppKey/oppName (or vsPlayer / m.opp_name for team games).
export function personalBlocks(recs) {
  const named = recs.filter(r => oppKey(r));
  const byOpp = [...groupBy(named, oppKey)].filter(([, l]) => l.length >= MIN_VS).sort((a, b) => b[1].length - a[1].length);
  const oppCard = ([, list]) => { const os = summarize(list);
    return `<details class="card opp-stat"><summary><b>${esc(oppLabel(list[0]))}</b>${list[0].vsPlayer != null ? ` <span class="tag">${esc(t('internal'))}</span>` : ''} <span class="mute">· ${esc(t('n_games', { n: os.n }))} · ${wdl(os)} · ${pct(os.rate)} · Ø ${fmtD(os.avgDiff)}</span></summary>
      <h3>${esc(t('my_factions'))}</h3>${statRows(groupBy(list, r => r.army), t('army'))}
      <h3>${esc(t('their_factions'))}</h3>${statRows(groupBy(list, r => r.opp), t('faction'))}</details>`; };
  return `<section><h2>${esc(t('my_opponents'))}</h2><p class="mute">${esc(t('my_opponents_hint'))}</p>${byOpp.length ? byOpp.map(oppCard).join('') : `<p class="notice">${esc(t('my_opponents_none'))}</p>`}</section>
    ${myClose(recs)}
    <section class="card"><h2>${esc(t('my_factions'))}</h2>${statRows(groupBy(recs, r => r.army), t('army'))}</section>
    <section class="card"><h2>${esc(t('vs_factions'))}</h2>${statRows(groupBy(recs, r => r.opp), t('faction'))}</section>`;
}
export { fmtD as fmtDiff, dCls as diffCls };
let msTab = 'team'; // team games and casual games are kept completely apart
export function mystats(el) {
  const me = myPlayer();
  if (me == null) { el.innerHTML = pageHead(t('nav_mystats'), t('mystats_intro')) + `<p class="notice">${esc(t('mystats_noplayer'))}</p>`; return; }
  const CAS = msTab === 'casual';
  let recs, pg = null;
  if (CAS) {
    pg = ownGames();
    recs = (pg || []).filter(g => g.kind === 'Casual' && (!MF.since || g.played_on >= MF.since)).map(g => { const d = g.my_score - g.opp_score;
      return { m: g, army: g.army, opp: g.opp_army, our: g.my_score, theirs: g.opp_score, g: 0, res: d > 0 ? 'win' : d < 0 ? 'loss' : 'draw', oppKey: (g.opp_name || '').trim().toLowerCase(), oppName: (g.opp_name || '').trim() }; });
  } else {
    if (MF.type === '__casual' || MF.type === '__team') MF.type = '';
    recs = records(D().matches || [], MF).filter(r => r.player_id === me);
  }
  const s = summarize(recs);
  const types = [...new Set((D().matches || []).map(m => m.type))];
  el.innerHTML = pageHead(t('nav_mystats'), t(CAS ? 'mystats_intro_casual' : 'mystats_intro')) +
    `<div class="seg ev-tabs" role="tablist"><button role="tab" data-mstab="team" aria-selected="${!CAS}">${esc(t('ms_team'))}</button><button role="tab" data-mstab="casual" aria-selected="${CAS}">${esc(t('type_casual'))}</button></div>
    <form class="filters card" id="mf">${CAS ? '' : `<label>${esc(t('type'))}<select name="type">${opts([['', t('st_all_games')], ['__tour', t('st_all_tours')], ...types.map(x => [x, typeLabel(x, t)])], MF.type)}</select></label>`}<label>${esc(t('since'))}<input type="date" name="since" value="${esc(MF.since)}"></label></form>
    <section class="stats"><div><b class="num">${s.n}</b><span>${esc(t('games'))}</span></div><div><b class="num">${wdl(s)}</b><span>${esc(t('result'))}</span></div><div><b class="num">${pct(s.rate) || '–'}</b><span>${esc(t('winrate'))}</span></div><div><b class="num ${dCls(s.avgDiff)}">${s.n ? fmtD(s.avgDiff) : '–'}</b><span>${esc(t('avg_diff'))}</span></div></section>
    ${CAS && pg == null ? `<p class="mute">${esc(t('loading'))}</p>` : s.n ? personalBlocks(recs) : empty(CAS ? t('ms_casual_none') : '')}`;
  const f = $('#mf'); f.addEventListener('change', () => { if (f.type) MF.type = f.type.value; MF.since = f.since.value; mystats(el); });
  el.onclick = e => { const b = e.target.closest('[data-mstab]'); if (b) { msTab = b.dataset.mstab; mystats(el); } };
}

// ---------------------------------------------------------------- Master matrix (manual ratings)
const ratingOf = (pid, f) => (D().ratings || []).find(r => r.player_id === pid && r.faction === f)?.value;
const RATING_VALUES = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
export function master(el) {
  const ps = players();
  const canEdit = pid => can('captain') || isMe(pid);
  const rowAvg = f => avg(ps.map(p => ratingOf(p.id, f)).filter(v => v != null).map(Number));
  const colAvg = pid => avg(FACTIONS.map(f => ratingOf(pid, f)).filter(v => v != null).map(Number));
  el.innerHTML = pageHead(t('nav_master'), t('master_intro')) +
    `<div class="scroll matrix-wrap"><table class="matrix ratings"><thead><tr><th class="corner">${esc(t('faction'))}</th>${ps.map(p => `<th${isMe(p.id) ? ' class="me"' : ''}>${esc(p.name)}</th>`).join('')}<th>${esc(t('avg_score'))}</th></tr></thead><tbody>
      ${FACTIONS.map(f => `<tr><th>${esc(f)}</th>${ps.map(p => { const v = ratingOf(p.id, f);
        return `<td class="rt rt${v != null ? Math.round(v) : ''}">${canEdit(p.id) ? `<select data-r="${p.id}" data-f="${esc(f)}" aria-label="${esc(p.name)} vs ${esc(f)}">${opts(RATING_VALUES, v != null ? String(+v) : '', '·')}</select>` : esc(v != null ? String(+v) : '')}</td>`; }).join('')}<td class="num">${fmt1(rowAvg(f))}</td></tr>`).join('')}
      <tr class="sum"><th>${esc(t('avg_score'))}</th>${ps.map(p => `<td class="num">${fmt1(colAvg(p.id))}</td>`).join('')}<td></td></tr></tbody></table></div>
    ${legendCard()}`;
  el.onchange = e => { const s = e.target.closest('[data-r]'); if (!s) return; const pid = +s.dataset.r, f = s.dataset.f;
    act(() => s.value ? db.upsert('ratings', { player_id: pid, faction: f, value: +s.value }) : db.remove('ratings', { player_id: pid, faction: f }), ['ratings'], false); };
}
const legendCard = () => `<section class="card"><h2>${esc(t('legend'))}</h2><div class="chips">${RATING_LEGEND.map(([d, v]) => `<span class="chip rt rt${Math.round(+v)}">${esc(d)} → <b>${esc(v)}</b></span>`).join('')}</div></section>`;

// ---------------------------------------------------------------- Master team
let mtSel = null;
export function masterteam(el) {
  const teams = (D().opponent_teams || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!teams.find(x => x.id === mtSel)) mtSel = teams[0]?.id ?? null;
  const tm = teams.find(x => x.id === mtSel); const ps = players();
  let body = empty();
  if (tm) {
    const rows = (tm.rows || []).filter(r => r.faction);
    const pAvg = pid => avg(rows.map(r => ratingOf(pid, r.faction)).filter(v => v != null).map(Number));
    body = `<div class="scroll matrix-wrap"><table class="matrix ratings"><thead><tr><th class="corner">${esc(t('faction'))}</th><th>${esc(t('disposition'))}</th>${ps.map(p => `<th>${esc(p.name)}</th>`).join('')}<th>${esc(t('avg_score'))}</th></tr></thead><tbody>
      ${rows.map(r => { const vals = ps.map(p => ratingOf(p.id, r.faction)); return `<tr><th>${esc(r.faction)}</th><td>${esc(r.disposition || '')}</td>${vals.map(v => `<td class="rt rt${v != null ? Math.round(v) : ''}">${esc(v != null ? String(+v) : '')}</td>`).join('')}<td class="num">${fmt1(avg(vals.filter(v => v != null).map(Number)))}</td></tr>`; }).join('')}
      <tr class="sum"><th colspan="2">${esc(t('avg_player'))}</th>${ps.map(p => `<td class="num">${fmt1(pAvg(p.id))}</td>`).join('')}<td></td></tr></tbody></table></div>${tm.note ? `<p class="mute">${esc(tm.note)}</p>` : ''}`;
  }
  el.innerHTML = pageHead(t('nav_masterteam'), t('mteam_intro'), can('captain') ? `<button class="btn primary" data-new>${esc(t('new_team'))}</button>` : '') +
    `<form class="filters card"><label>${esc(t('choose_team'))}<select id="mts">${opts(teams.map(x => [x.id, x.name]), mtSel, teams.length ? null : '–')}</select></label>
      ${tm && can('captain') ? `<div class="row-actions"><button type="button" class="btn ghost sm" data-edit>${esc(t('edit'))}</button><button type="button" class="btn ghost sm" data-del>${esc(t('delete'))}</button></div>` : ''}</form>` + body + legendCard();
  $('#mts')?.addEventListener('change', e => { mtSel = +e.target.value; masterteam(el); });
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.new !== undefined) return editTeam(null);
    if (b.dataset.edit !== undefined) return editTeam(tm);
    if (b.dataset.del !== undefined && await confirmBox(tm.name)) act(() => db.remove('opponent_teams', { id: tm.id }), ['opponent_teams']);
  };
}
async function editTeam(tm) {
  const x = tm || { name: '', rows: [], note: '' };
  const rows = [...Array(8)].map((_, i) => x.rows[i] || {});
  const r = await modal(tm ? tm.name : t('new_team'), `<label>${esc(t('opp_team'))}<input name="name" required maxlength="60" value="${esc(x.name)}"></label>
    ${rows.map((r, i) => `<div class="grid2"><label>${esc(t('faction'))} ${i + 1}<select name="f${i}">${opts(FACTIONS, r.faction, '–')}</select></label><label>${esc(t('disposition'))}<select name="d${i}">${opts(DISPOSITIONS, r.disposition, '–')}</select></label></div>`).join('')}
    <label>${esc(t('note'))}<input name="note" maxlength="200" value="${esc(x.note || '')}"></label>`, { wide: true });
  if (!r) return;
  const row = { name: r.name.trim(), rows: rows.map((_, i) => ({ faction: r['f' + i], disposition: r['d' + i] })).filter(q => q.faction), note: r.note.trim() || null };
  await act(async () => { const saved = tm ? await db.update('opponent_teams', { id: tm.id }, row) : await db.insert('opponent_teams', row); mtSel = saved.id; }, ['opponent_teams']);
}

// ---------------------------------------------------------------- Pairing
let pr = null; // working copy
const blankPairing = () => ({ id: null, title: '', basis: 'team', opp: ['', '', '', '', ''], ours: [0, 1, 2, 3, 4].map(() => ({ player_id: '', army: '' })) });
export function pairing(el) {
  const saved = (D().pairings || []).slice().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  if (!pr) pr = saved[0] ? JSON.parse(JSON.stringify(saved[0])) : blankPairing();
  while (pr.opp.length < 5) pr.opp.push(''); while (pr.ours.length < 5) pr.ours.push({ player_id: '', army: '' });
  const recs = records(D().matches || []);
  const opp = pr.opp, ours = pr.ours.filter(o => o.army);
  const cellRecs = (o, f) => recs.filter(r => r.army === o.army && r.opp === f && (pr.basis === 'team' || r.player_id === +o.player_id));
  const M = ours.map(o => opp.map(f => { if (!f) return { n: 0, g: null }; const l = cellRecs(o, f); return { n: l.length, g: l.length ? avg(l.map(r => r.g)) : null }; }));
  const rowAvg = M.map(row => avg(row.filter(c => c.g != null).map(c => c.g)));
  const best = arr => { let bi = -1, bv = -1; arr.forEach((v, i) => { if (v != null && v > bv) { bv = v; bi = i; } }); return bi; };
  const label = o => `${o.player_id ? pname(o.player_id) + ' · ' : ''}${o.army}`;
  const defender = best(rowAvg);
  el.innerHTML = pageHead(t('nav_pairing'), t('pairing_intro')) +
    `<form class="card form" id="pf"><div class="grid3">
      <label>${esc(t('saved_pairings'))}<select name="load">${opts(saved.map(s => [s.id, s.title || '#' + s.id]), pr.id, t('new'))}</select></label>
      <label>${esc(t('opp_team'))}<input name="title" maxlength="60" value="${esc(pr.title)}"></label>
      <label>${esc(t('basis'))}<select name="basis">${opts([['team', t('basis_team')], ['player', t('basis_player')]], pr.basis)}</select></label></div>
      <div class="pair-grid"><fieldset><legend>${esc(t('opp_armies'))}</legend>${opp.map((f, i) => `<select name="o${i}" aria-label="${esc(t('opp_faction'))} ${i + 1}">${opts(FACTIONS, f, `${t('opp_faction')} ${i + 1}`)}</select>`).join('')}</fieldset>
      <fieldset><legend>${esc(t('our_lineup'))}</legend>${pr.ours.map((o, i) => { const pl = playerById(o.player_id); const list = [...new Set([...(pl?.armies || []).map(a => a.army).filter(Boolean), ...FACTIONS])];
        return `<div class="grid2 tight"><select name="p${i}" aria-label="${esc(t('player'))} ${i + 1}">${opts(players().map(p => [p.id, p.name]), o.player_id, `${t('player')} ${i + 1}`)}</select><select name="a${i}" aria-label="${esc(t('army'))} ${i + 1}">${opts(list, o.army, t('army'))}</select></div>`; }).join('')}</fieldset></div>
      <div class="form-actions">${can('captain') ? `<button type="button" class="btn primary" data-save>${esc(t('save'))}</button>${pr.id ? `<button type="button" class="btn ghost" data-del>${esc(t('delete'))}</button>` : ''}` : `<small class="mute">${esc(t('only_captain_save'))}</small>`}</div></form>
    ${ours.length && opp.some(Boolean) ? `<section class="card"><div class="scroll matrix-wrap"><table class="matrix pairing"><thead><tr><th class="corner">${esc(t('player'))} / ${esc(t('army'))}</th>${opp.map(f => `<th>${esc(f ? short(f) : '–')}</th>`).join('')}<th>${esc(t('avg_total'))}</th><th>${esc(t('best_matchup'))}</th></tr></thead><tbody>
      ${ours.map((o, i) => { const bi = best(M[i].map(c => c.g)); return `<tr${i === defender ? ' class="def"' : ''}><th>${esc(label(o))}${i === defender ? ` <span class="tag">${esc(t('defender'))}</span>` : ''}</th>${M[i].map(c => `<td class="${gpClass(c.g)}${c.n && c.n < 3 ? ' thin' : ''}">${c.g != null ? fmt1(c.g) : ''}</td>`).join('')}<td class="num">${fmt1(rowAvg[i])}</td><td>${bi >= 0 ? esc(short(opp[bi])) : ''}</td></tr>`; }).join('')}
      <tr class="sum"><th>${esc(t('best_counter'))}</th>${opp.map((f, j) => { const bi = best(M.map(r => r[j].g)); return `<td>${bi >= 0 ? esc(ours[bi].player_id ? pname(ours[bi].player_id) : ours[bi].army) : ''}</td>`; }).join('')}<td colspan="2">${defender >= 0 ? `${esc(t('defender'))}: <b>${esc(label(ours[defender]))}</b>` : ''}</td></tr></tbody></table></div></section>
    <section class="card"><h2>${esc(t('game_counts'))}</h2><div class="scroll"><table class="matrix counts"><thead><tr><th class="corner">${esc(t('player'))}</th>${opp.map(f => `<th>${esc(f ? short(f) : '–')}</th>`).join('')}<th>${esc(t('total'))}</th></tr></thead><tbody>
      ${ours.map((o, i) => `<tr><th>${esc(label(o))}</th>${M[i].map(c => `<td class="${c.n < 3 ? 'few' : ''}">${c.n}</td>`).join('')}<td class="num">${M[i].reduce((a, c) => a + c.n, 0)}</td></tr>`).join('')}</tbody></table></div><p class="mute small">${esc(t('few_games'))}</p></section>` : ''}`;
  const f = $('#pf');
  f.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'load') { const s = saved.find(x => x.id === +e.target.value); pr = s ? JSON.parse(JSON.stringify(s)) : blankPairing(); return pairing(el); }
    pr.title = f.title.value; pr.basis = f.basis.value;
    pr.opp = [0, 1, 2, 3, 4].map(i => f['o' + i].value);
    pr.ours = [0, 1, 2, 3, 4].map(i => { const pid = f['p' + i].value; let army = f['a' + i].value;
      if (n === 'p' + i) { const a = (playerById(pid)?.armies || []).find(x => x.army); army = a ? a.army : army; }
      return { player_id: pid ? +pid : '', army }; });
    pairing(el);
  });
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.save !== undefined) { pr.title = f.title.value; const row = { title: pr.title, basis: pr.basis, opp: pr.opp, ours: pr.ours, updated_at: new Date().toISOString() };
      await act(async () => { const s = pr.id ? await db.update('pairings', { id: pr.id }, row) : await db.insert('pairings', row); pr = JSON.parse(JSON.stringify(s)); }, ['pairings']); }
    if (b.dataset.del !== undefined && await confirmBox(pr.title || '#' + pr.id)) { const id = pr.id; pr = null; act(() => db.remove('pairings', { id }), ['pairings']); }
  };
}
