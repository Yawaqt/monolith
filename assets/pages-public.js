// Public pages: visible to everyone, built only from the safe public data.
import { t } from './i18n.js';
import { state, esc, $, opts, fmtDate, resultBadge, empty } from './core.js';
import { gp, resultOf, scoreStr, summarize, groupBy, fmt1, pct } from './data.js';
import { appsCards } from './pages-team.js';

const PUB = () => state.pub || { players: [], results: [], events: [] };
const recs = list => list.map(r => { const g = gp(r.our_score, r.opp_score); return { r, our: r.our_score, theirs: r.opp_score, g: g[0] }; });
const tournaments = () => {
  const by = groupBy(PUB().results, r => r.tournament || '—');
  return [...by.entries()].map(([name, list]) => ({ name, list, from: list.reduce((a, r) => r.played_on < a ? r.played_on : a, list[0].played_on), to: list.reduce((a, r) => r.played_on > a ? r.played_on : a, list[0].played_on) }))
    .sort((a, b) => b.to.localeCompare(a.to));
};
const record = s => `${s.w}-${s.d}-${s.l}`;
const dateRange = (a, b) => a === b ? fmtDate(a, { day: 'numeric', month: 'long', year: 'numeric' }) : `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;

function eventRow(e) {
  return `<li class="pev"><div class="pev-date"><b>${esc(fmtDate(e.starts_on, { day: '2-digit' }))}</b><span>${esc(fmtDate(e.starts_on, { month: 'short' }))}</span></div>
    <div><h3>${esc(e.title)}</h3><p class="mute">${esc(fmtDate(e.starts_on, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${e.start_time ? ' · ' + esc(e.start_time) : ''}${e.location ? ' · ' + esc(e.location) : ''}</p></div>
    ${e.kind ? `<span class="tag">${esc(e.kind)}</span>` : ''}</li>`;
}
function playerCard(p, all) {
  const s = summarize(recs(all.filter(r => r.player === p.name)));
  return `<article class="pcard"><div class="pcard-top"><span class="avatar" aria-hidden="true">${esc(p.name.slice(0, 1))}</span><div><h3>${esc(p.name)}</h3>${s.n ? `<p class="mute small">${esc(t('t_games', { n: s.n }))} · <span class="num">${record(s)}</span></p>` : ''}</div></div>
    ${p.armies.length ? `<div class="chips">${p.armies.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>` : ''}</article>`;
}
function tourCard(tn, open) {
  const s = summarize(recs(tn.list));
  const byP = groupBy(tn.list, r => r.player);
  return `<article class="tour${open ? ' open' : ''}"><header><div><h3>${esc(tn.name)}</h3><p class="mute">${esc(dateRange(tn.from, tn.to))} · ${esc(t('n_games', { n: tn.list.length }))}</p></div><div class="tour-rec num">${record(s)}<small>${pct(s.rate)}</small></div></header>
    <ul class="glist">${[...byP.values()].flat().map(r => { const g = gp(r.our_score, r.opp_score); return `<li><b class="g-p">${esc(r.player)}</b><span class="g-m">${esc(r.army)} <span class="mute">vs</span> ${esc(r.opp_faction)}</span><span class="g-s"><span class="num mute">${esc(r.our_score)}:${esc(r.opp_score)}</span> <b class="num">${scoreStr(g)}</b> ${resultBadge(resultOf(g))}</span></li>`; }).join('')}</ul></article>`;
}

export function home(el) {
  const { players, results, events } = PUB();
  const all = summarize(recs(results)); const tours = tournaments();
  el.innerHTML = `<section class="hero"><div class="hero-text"><p class="kicker">${esc(t('hero_kicker'))}</p><h1 class="hero-title">Monolith 40k</h1><p class="lead">${esc(t('hero_text'))}</p>
      <div class="hero-cta"><a class="btn primary" href="#/results">${esc(t('see_results'))}</a><a class="btn ghost" href="#/upcoming">${esc(t('see_events'))}</a></div></div>
      ${events[0] ? `<a class="hero-card" href="#/upcoming"><span class="kicker">${esc(t('next_up'))}</span><b class="hero-date">${esc(fmtDate(events[0].starts_on, { day: 'numeric', month: 'long' }))}</b><span class="hero-ev">${esc(events[0].title)}</span><span class="mute">${esc([events[0].location, events[0].start_time].filter(Boolean).join(' · '))}</span></a>` : ''}</section>
    <section class="stats">
      <div><b class="num">${players.length}</b><span>${esc(t('s_players'))}</span></div>
      <div><b class="num">${tours.length}</b><span>${esc(t('s_tournaments'))}</span></div>
      <div><b class="num">${all.n}</b><span>${esc(t('s_games'))}</span></div>
      <div><b class="num">${record(all)}</b><span>${esc(t('s_record'))}</span></div></section>
    <section class="block"><div class="block-head"><h2>${esc(t('next_up'))}</h2><a href="#/upcoming">${esc(t('all_events'))} →</a></div>
      ${events.length ? `<ul class="plist">${events.slice(0, 3).map(eventRow).join('')}</ul>` : empty(t('no_events'))}</section>
    ${tours[0] ? `<section class="block"><div class="block-head"><h2>${esc(t('latest_tournament'))}</h2><a href="#/results">${esc(t('all_results'))} →</a></div>${tourCard(tours[0], true)}</section>` : ''}
    <section class="block"><div class="block-head"><h2>${esc(t('meet_team'))}</h2><a href="#/team">${esc(t('whole_team'))} →</a></div>
      <div class="pgrid">${players.slice(0, 6).map(p => playerCard(p, results)).join('')}</div></section>
    <section class="block"><div class="block-head"><h2>${esc(t('p_apps'))}</h2></div>${appsCards()}</section>`;
}
export function team(el) {
  const { players, results } = PUB();
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('meet_team'))}</h1><p class="intro">${esc(t('team_intro'))}</p></div></div>
    <div class="pgrid">${players.map(p => playerCard(p, results)).join('') || empty()}</div>`;
}
let rPlayer = '';
export function results(el) {
  const { players } = PUB();
  const tours = tournaments().map(tn => Object.assign({}, tn, { list: rPlayer ? tn.list.filter(r => r.player === rPlayer) : tn.list })).filter(tn => tn.list.length);
  const s = summarize(recs(tours.flatMap(tn => tn.list)));
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('p_results'))}</h1><p class="intro">${esc(t('results_intro'))}</p></div>
      <label class="inline">${esc(t('filter_player'))}<select id="rp">${opts(players.map(p => p.name), rPlayer, t('all'))}</select></label></div>
    <section class="stats"><div><b class="num">${tours.length}</b><span>${esc(t('s_tournaments'))}</span></div><div><b class="num">${s.n}</b><span>${esc(t('s_games'))}</span></div>
      <div><b class="num">${record(s)}</b><span>${esc(t('s_record'))}</span></div><div><b class="num">${pct(s.rate)}</b><span>${esc(t('winrate'))}</span></div></section>
    <div class="tours">${tours.map((tn, i) => tourCard(tn, i === 0)).join('') || empty()}</div>`;
  $('#rp').addEventListener('change', e => { rPlayer = e.target.value; results(el); });
}
export function upcoming(el) {
  const { events } = PUB();
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('p_events'))}</h1><p class="intro">${esc(t('events_pub_intro'))}</p></div></div>
    ${events.length ? `<ul class="plist">${events.map(eventRow).join('')}</ul>` : empty(t('no_events'))}`;
}
export function apps(el) {
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('p_apps'))}</h1><p class="intro">${esc(t('apps_pub_intro'))}</p></div></div>${appsCards()}`;
}
