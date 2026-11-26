// Match History (every account, also guests) and the anonymous "Data" page.
// Completely separate from the team's own match log.
import { db } from './db.js?v=202611261415';
import { t } from './i18n.js?v=202611261415';
import { state, esc, $, $$, opts, fmtDate, act, confirmBox, empty, pageHead, toast, resultBadge, modal } from './core.js?v=202611261415';
import { FACTIONS, fmt1, pct, today } from './data.js?v=202611261415';

let games = null;            // own games (cached)
let loading = false;
const LAST = 'monolith.history.last';
const res = g => g.my_score > g.opp_score ? 'win' : g.my_score < g.opp_score ? 'loss' : 'draw';
const short = f => (f || '').replace('Adeptus ', 'A. ').replace('Adepta ', 'A. ').replace('Chaos Space Marines', 'CSM').replace('Leagues of Votann', 'Votann').replace('Genestealer Cults', 'GSC');
function sumUp(list) {
  const s = { n: list.length, w: 0, d: 0, l: 0, pf: 0, pa: 0 };
  for (const g of list) { const r = res(g); if (r === 'win') s.w++; else if (r === 'loss') s.l++; else s.d++; s.pf += g.my_score; s.pa += g.opp_score; }
  s.rate = s.n ? (s.w + s.d / 2) / s.n : null; s.avgF = s.n ? s.pf / s.n : null; s.avgA = s.n ? s.pa / s.n : null; return s;
}
const group = (list, key) => { const m = new Map(); for (const g of list) { const k = key(g); if (!m.has(k)) m.set(k, []); m.get(k).push(g); } return m; };
const rateBar = r => r == null ? '' : `<span class="rbar"><i style="width:${Math.round(r * 100)}%"></i></span>`;
const rec = s => `${s.w}-${s.d}-${s.l}`;

async function load() {
  if (loading) return; loading = true;
  try { games = await db.list('personal_games', ['played_on', 'desc']); } catch (e) { games = []; toast(t('error') + ': ' + e.message, true); }
  loading = false; state.render();
}
const save = (fn, msg) => act(async () => { await fn(); games = await db.list('personal_games', ['played_on', 'desc']); }, null, msg);

function gameForm(g = {}) {
  let last = {}; try { last = JSON.parse(localStorage.getItem(LAST)) || {}; } catch (_) {}
  const kind = g.kind || last.kind || 'Casual';
  return `<div class="quick">
    <div class="seg type-seg" role="group" aria-label="${esc(t('type'))}">${[['Casual', t('h_casual')], ['Tournament', t('h_tournament')]].map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${kind === k}">${esc(l)}</button>`).join('')}</div>
    <input type="hidden" name="kind" value="${esc(kind)}">
    <label class="ev-name"${kind === 'Tournament' ? '' : ' hidden'}>${esc(t('tour_name'))}<input name="event" maxlength="80" value="${esc(g.event || (kind === 'Tournament' ? last.event || '' : ''))}"></label>
    <div class="grid2">
      <label>${esc(t('h_my_army'))}<select name="army" required>${opts(FACTIONS, g.army || last.army || '', '–')}</select></label>
      <label>${esc(t('opp_faction'))}<select name="opp_army" required>${opts(FACTIONS, g.opp_army || '', '–')}</select></label>
      <label>${esc(t('h_my_points'))}<input name="my_score" type="number" inputmode="numeric" min="0" max="200" required value="${esc(g.my_score ?? '')}"></label>
      <label>${esc(t('opp_score'))}<input name="opp_score" type="number" inputmode="numeric" min="0" max="200" required value="${esc(g.opp_score ?? '')}"></label>
    </div>
    <div class="preview" aria-live="polite"></div>
    <div class="grid2"><label>${esc(t('date'))}<input name="played_on" type="date" required value="${esc(g.played_on || today())}"></label>
      <label>${esc(t('notes'))}<input name="notes" maxlength="300" value="${esc(g.notes || '')}"></label></div></div>`;
}
function bindForm(f) {
  const upd = () => { const a = f.my_score.value, b = f.opp_score.value;
    $('.preview', f).innerHTML = a !== '' && b !== '' ? `${esc(t('diff'))} <b class="num">${a - b}</b> · ${resultBadge(+a > +b ? 'win' : +a < +b ? 'loss' : 'draw')}` : `<small class="mute">${esc(t('score_rule_singles'))}</small>`; };
  f.addEventListener('input', upd);
  f.addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; f.kind.value = b.dataset.kind;
    $$('[data-kind]', f).forEach(x => x.setAttribute('aria-pressed', x === b)); $('.ev-name', f).hidden = b.dataset.kind !== 'Tournament'; });
  upd();
}
function rowOf(r) {
  const o = { played_on: r.played_on, army: r.army, opp_army: r.opp_army, my_score: +r.my_score, opp_score: +r.opp_score, kind: r.kind === 'Tournament' ? 'Tournament' : 'Casual',
    event: r.kind === 'Tournament' ? (r.event || '').trim() || null : null, notes: (r.notes || '').trim() || null };
  try { localStorage.setItem(LAST, JSON.stringify({ army: o.army, kind: o.kind, event: o.event })); } catch (_) {}
  return o;
}

// ---------------------------------------------------------------- My match history
let hArmy = '', hKind = '';
export function history(el) {
  if (games == null) { el.innerHTML = pageHead(t('nav_history'), t('history_intro')) + `<p class="mute">${esc(t('loading'))}</p>`; load(); return; }
  let list = games.slice();
  if (hArmy) list = list.filter(g => g.army === hArmy);
  if (hKind) list = list.filter(g => g.kind === hKind);
  const s = sumUp(list);
  // streak and form (newest first)
  const sorted = list.slice().sort((a, b) => b.played_on.localeCompare(a.played_on) || b.id - a.id);
  let streak = 0, sr = sorted[0] ? res(sorted[0]) : null; for (const g of sorted) { if (res(g) === sr) streak++; else break; }
  const form = sorted.slice(0, 10).reverse();
  const byArmy = [...group(list, g => g.army).entries()].map(([a, l]) => [a, sumUp(l)]).sort((a, b) => b[1].n - a[1].n);
  const vs = [...group(list, g => g.opp_army).entries()].map(([a, l]) => [a, sumUp(l)]).sort((a, b) => b[1].n - a[1].n || (b[1].rate ?? 0) - (a[1].rate ?? 0));
  const best = vs.filter(([, x]) => x.n >= 2).sort((a, b) => b[1].rate - a[1].rate)[0], worst = vs.filter(([, x]) => x.n >= 2).sort((a, b) => a[1].rate - b[1].rate)[0];
  const armies = [...new Set(games.map(g => g.army))].sort();
  el.innerHTML = pageHead(t('nav_history'), t('history_intro'), `<button class="btn primary" data-hadd>+ ${esc(t('h_add'))}</button>`) +
    (games.length ? `<form class="filters card" id="hf"><label>${esc(t('army'))}<select name="army">${opts(armies, hArmy, t('all'))}</select></label>
      <label>${esc(t('type'))}<select name="kind">${opts([['Casual', t('h_casual')], ['Tournament', t('h_tournament')]], hKind, t('all'))}</select></label></form>
    <div class="tiles">
      <div class="tile main"><div class="tile-l">${esc(t('h_record'))}</div><div class="tile-big num">${rec(s)}</div><div class="tile-s">${pct(s.rate)} ${esc(t('winrate'))} · ${esc(t('n_games', { n: s.n }))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('h_avg_points'))}</div><div class="tile-big num">${s.n ? Math.round(s.avgF) + ' : ' + Math.round(s.avgA) : '–'}</div><div class="tile-s">${esc(t('h_avg_sub'))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('h_streak'))}</div><div class="tile-big num">${sr ? streak + '× ' : '–'}</div><div class="tile-s">${sr ? esc(t(sr)) : ''}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('h_form'))}</div><div class="form-dots">${form.map(g => `<span class="fd ${res(g)}" title="${esc(fmtDate(g.played_on))} · ${esc(g.army)} vs ${esc(g.opp_army)} ${g.my_score}:${g.opp_score}"></span>`).join('') || '–'}</div><div class="tile-s">${esc(t('h_form_sub'))}</div></div>
    </div>
    ${best || worst ? `<div class="cols2">${best ? `<div class="notice ok">💪 ${esc(t('h_best', { f: best[0] }))} <b>${pct(best[1].rate)}</b> <span class="mute">(${esc(t('n_games', { n: best[1].n }))})</span></div>` : ''}${worst ? `<div class="notice bad">⚠ ${esc(t('h_worst', { f: worst[0] }))} <b>${pct(worst[1].rate)}</b> <span class="mute">(${esc(t('n_games', { n: worst[1].n }))})</span></div>` : ''}</div>` : ''}
    <div class="cols">
      <section class="card"><h2>${esc(t('h_by_army'))}</h2>${statTable(byArmy)}</section>
      <section class="card"><h2>${esc(t('h_vs'))}</h2>${statTable(vs)}</section></div>
    <section class="card"><h2>${esc(t('h_games'))}</h2><ul class="list hlist">${sorted.map(g => `<li><span><b>${esc(g.army)}</b> <span class="mute">${esc(t('vs'))}</span> ${esc(g.opp_army)}<br><small class="mute">${esc(fmtDate(g.played_on))}${g.kind === 'Tournament' ? ' · ' + esc(g.event || t('h_tournament')) : ''}${g.notes ? ' · ' + esc(g.notes) : ''}</small></span>
      <span class="nowrap"><b class="num">${g.my_score}:${g.opp_score}</b> ${resultBadge(res(g))} <button class="icon" data-hedit="${g.id}" aria-label="${esc(t('edit'))}">✎</button><button class="icon" data-hdel="${g.id}" aria-label="${esc(t('delete'))}">🗑</button></span></li>`).join('')}</ul></section>`
    : `<div class="empty-start card"><h2>${esc(t('h_empty_title'))}</h2><p class="mute">${esc(t('h_empty'))}</p><button class="btn primary" data-hadd>+ ${esc(t('h_add'))}</button></div>`) +
    `<p class="mute small">${esc(t('h_privacy'))} <a href="#/data">${esc(t('nav_data'))} →</a></p>`;
  const hf = $('#hf'); if (hf) hf.onchange = () => { hArmy = hf.army.value; hKind = hf.kind.value; history(el); };
  el.onclick = async e => {
    if (e.target.closest('[data-hadd]')) return addGame();
    const ed = e.target.closest('[data-hedit]'); if (ed) return editGame(games.find(g => g.id === +ed.dataset.hedit));
    const del = e.target.closest('[data-hdel]');
    if (del) { const g = games.find(x => x.id === +del.dataset.hdel); if (g && await confirmBox(`${g.army} vs ${g.opp_army} · ${g.my_score}:${g.opp_score} · ${fmtDate(g.played_on)}`)) save(() => db.remove('personal_games', { id: g.id })); }
  };
}
function statTable(rows) {
  if (!rows.length) return empty();
  return `<div class="scroll"><table class="stats-t"><thead><tr><th></th><th class="r">${esc(t('games'))}</th><th class="r">S-U-N</th><th>${esc(t('winrate'))}</th></tr></thead><tbody>
    ${rows.map(([k, s]) => `<tr><th>${esc(k)}</th><td class="r num">${s.n}</td><td class="r num">${rec(s)}</td><td class="nowrap">${rateBar(s.rate)} <span class="num">${pct(s.rate)}</span></td></tr>`).join('')}</tbody></table></div>`;
}
export async function addGame() {
  const r = await modal(t('h_add'), gameForm(), { submit: t('save_game'), onOpen: f => { bindForm(f); setTimeout(() => f.opp_army.focus(), 30); } });
  if (!r) return;
  await save(() => db.insert('personal_games', rowOf(r)), t('quick_saved'));
}
async function editGame(g) {
  const r = await modal(t('edit_game'), gameForm(g), { submit: t('save'), onOpen: bindForm });
  if (!r) return;
  await save(() => db.update('personal_games', { id: g.id }, rowOf(r)));
}
// Signing out or switching accounts must not show someone else's games
export function resetHistory() { games = null; }

// ---------------------------------------------------------------- Data (everyone's games, anonymous)
let stats = null, dArmy = '', statsAt = 0;
export function data(el) {
  if (!stats || Date.now() - statsAt > 60000) {
    el.innerHTML = pageHead(t('nav_data'), t('data_intro')) + `<p class="mute">${esc(t('loading'))}</p>`;
    db.rpc('game_stats').then(x => { stats = x || { games: 0, players: 0, rows: [] }; statsAt = Date.now(); if (location.hash === '#/data') data(el); }).catch(e => { el.innerHTML += `<div class="notice bad">${esc(e.message)}</div>`; });
    if (!stats) return;
  }
  // Every game counts for both armies: the reported army and, mirrored, the opponent's army
  const both = [];
  for (const r of stats.rows || []) {
    both.push({ a: r.army, b: r.opp_army, n: r.games, w: r.wins, d: r.draws, l: r.losses, pf: r.pts_for, pa: r.pts_against });
    both.push({ a: r.opp_army, b: r.army, n: r.games, w: r.losses, d: r.draws, l: r.wins, pf: r.pts_against, pa: r.pts_for });
  }
  const agg = list => { const s = { n: 0, w: 0, d: 0, l: 0, pf: 0 }; for (const x of list) { s.n += x.n; s.w += x.w; s.d += x.d; s.l += x.l; s.pf += x.pf; } s.rate = s.n ? (s.w + s.d / 2) / s.n : null; s.avg = s.n ? s.pf / s.n : null; return s; };
  const fac = [...group(both, x => x.a).entries()].map(([f, l]) => [f, agg(l)]).sort((a, b) => b[1].n - a[1].n);
  const appear = fac.reduce((a, [, s]) => a + s.n, 0);
  const ranked = fac.filter(([, s]) => s.n >= 3).sort((a, b) => b[1].rate - a[1].rate);
  const armies = fac.map(([f]) => f).sort();
  if (dArmy && !armies.includes(dArmy)) dArmy = '';
  const mu = dArmy ? [...group(both.filter(x => x.a === dArmy), x => x.b).entries()].map(([f, l]) => [f, agg(l)]).sort((a, b) => b[1].n - a[1].n) : [];
  el.innerHTML = pageHead(t('nav_data'), t('data_intro')) +
    `<div class="tiles"><div class="tile"><div class="tile-l">${esc(t('d_games'))}</div><div class="tile-big num">${stats.games}</div><div class="tile-s">${esc(t('d_players', { n: stats.players }))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('d_factions'))}</div><div class="tile-big num">${fac.length}</div><div class="tile-s">${esc(t('d_factions_sub'))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('d_top'))}</div><div class="tile-big small-big">${ranked[0] ? esc(short(ranked[0][0])) : '–'}</div><div class="tile-s">${ranked[0] ? pct(ranked[0][1].rate) + ' · ' + esc(t('n_games', { n: ranked[0][1].n })) : esc(t('d_min3'))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('d_popular'))}</div><div class="tile-big small-big">${fac[0] ? esc(short(fac[0][0])) : '–'}</div><div class="tile-s">${fac[0] ? pct(fac[0][1].n / appear) + ' ' + esc(t('d_of_games')) : ''}</div></div></div>
    ${stats.games ? `<div class="cols">
      <section class="card"><h2>${esc(t('d_winrates'))}</h2><p class="mute small">${esc(t('d_min3_note'))}</p>${ranked.length ? statTable(ranked) : empty(t('d_min3'))}</section>
      <section class="card"><h2>${esc(t('d_popularity'))}</h2><ul class="pop">${fac.map(([f, s]) => `<li><span>${esc(f)}</span><span class="pbar"><i style="width:${Math.round(s.n / fac[0][1].n * 100)}%"></i></span><span class="num">${s.n}</span></li>`).join('')}</ul></section></div>
    <section class="card"><div class="block-head"><h2>${esc(t('d_matchups'))}</h2><label class="inline">${esc(t('army'))}<select id="dsel">${opts(armies, dArmy, t('d_pick'))}</select></label></div>
      ${dArmy ? (mu.length ? statTable(mu) : empty()) : `<p class="mute">${esc(t('d_pick_hint'))}</p>`}</section>` : empty(t('d_none'))}
    <p class="mute small">${esc(t('d_note'))}</p>`;
  const ds = $('#dsel'); if (ds) ds.onchange = () => { dArmy = ds.value; data(el); };
}
