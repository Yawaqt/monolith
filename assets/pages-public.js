// Public pages: visible to everyone, built only from the safe public data.
import { t } from './i18n.js';
import { state, esc, fmtDate, empty } from './core.js';
import { typeLabel, pct } from './data.js';
import { appsCards } from './pages-team.js';
import { CONFIG } from './config.js';
const IG_ICON = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';

const PUB = () => state.pub || { players: [], results: [], events: [] };
// Public results are team totals per tournament only (no player names, no single games).
const tournaments = () => PUB().results.slice().sort((a, b) => String(b.date_to).localeCompare(String(a.date_to)));
const sum = list => { const s = { n: 0, w: 0, d: 0, l: 0 }; for (const r of list) { s.n += r.games; s.w += r.wins; s.d += r.draws; s.l += r.losses; } s.rate = s.n ? (s.w + s.d / 2) / s.n : null; return s; };
const tourCount = list => new Set(list.map(r => r.tournament)).size;
const record = s => `${s.w}-${s.d}-${s.l}`;
const dateRange = (a, b) => a === b ? fmtDate(a, { day: 'numeric', month: 'long', year: 'numeric' }) : `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;

function eventRow(e) {
  return `<li class="pev"><div class="pev-date"><b>${esc(fmtDate(e.starts_on, { day: '2-digit' }))}</b><span>${esc(fmtDate(e.starts_on, { month: 'short' }))}</span></div>
    <div><h3>${esc(e.title)}</h3><p class="mute">${esc(fmtDate(e.starts_on, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${e.start_time ? ' · ' + esc(e.start_time) : ''}${e.location ? ' · ' + esc(e.location) : ''}</p></div>
    ${e.kind ? `<span class="tag">${esc(e.kind)}</span>` : ''}</li>`;
}
function playerCard(p) {
  return `<article class="pcard"><div class="pcard-top"><span class="avatar" aria-hidden="true">${esc(p.name.slice(0, 1))}</span><div><h3>${esc(p.name)}</h3></div></div>
    ${p.armies.length ? `<div class="chips">${p.armies.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>` : ''}
    ${p.bcp_url && /^https:\/\/([a-z0-9-]+\.)*bestcoastpairings\.com\//i.test(p.bcp_url) ? `<a class="pcard-link" href="${esc(p.bcp_url)}" target="_blank" rel="noopener">${esc(t('bcp_profile'))} ↗</a>` : ''}</article>`;
}
function tourCard(r) {
  const s = sum([r]);
  return `<article class="tour"><header><div><h3>${esc(r.tournament)}</h3><p class="mute">${esc(dateRange(r.date_from, r.date_to))} · <span class="tag">${esc(typeLabel(r.type, t))}</span> · ${esc(t('n_games', { n: r.games }))}</p></div>
    <div class="tour-rec num">${record(s)}<small>${pct(s.rate)}</small></div></header>
    <div class="wdl" aria-hidden="true"><i class="w" style="flex:${r.wins}"></i><i class="d" style="flex:${r.draws}"></i><i class="l" style="flex:${r.losses}"></i></div></article>`;
}

export function home(el) {
  const { players, results, events } = PUB();
  const all = sum(results); const tours = tournaments();
  el.innerHTML = `<section class="hero"><div class="hero-text"><p class="kicker">${esc(t('hero_kicker'))}</p><h1 class="hero-title">Monolith 40k</h1><p class="lead">${esc(t('hero_text'))}</p>
      <div class="hero-cta"><a class="btn primary" href="#/results">${esc(t('see_results'))}</a><a class="btn ghost" href="#/upcoming">${esc(t('see_events'))}</a></div></div>
      <div class="hero-mark" aria-hidden="true"><img src="assets/logo-mark.svg" alt="" width="130" height="250"></div></section>
    <section class="stats">
      <div><b class="num">${players.length}</b><span>${esc(t('s_players'))}</span></div>
      <div><b class="num">${tourCount(tours)}</b><span>${esc(t('s_tournaments'))}</span></div>
      <div><b class="num">${all.n}</b><span>${esc(t('s_games'))}</span></div>
      <div><b class="num">${record(all)}</b><span>${esc(t('s_record'))}</span></div></section>
    <section class="block"><div class="block-head"><h2>${esc(t('next_up'))}</h2><a href="#/upcoming">${esc(t('all_events'))} →</a></div>
      ${events.length ? `<ul class="plist">${events.slice(0, 3).map(eventRow).join('')}</ul>` : empty(t('no_events'))}</section>
    ${tours[0] ? `<section class="block"><div class="block-head"><h2>${esc(t('latest_tournament'))}</h2><a href="#/results">${esc(t('all_results'))} →</a></div>${tourCard(tours[0])}</section>` : ''}
    <section class="block"><div class="block-head"><h2>${esc(t('meet_team'))}</h2><a href="#/team">${esc(t('whole_team'))} →</a></div>
      <div class="pgrid">${players.slice(0, 6).map(playerCard).join('')}</div></section>
    ${CONFIG.INSTAGRAM ? `<section class="block"><a class="follow" href="${esc(CONFIG.INSTAGRAM)}" target="_blank" rel="noopener"><span class="follow-ico">${IG_ICON}</span><span><b>${esc(t('follow_title'))}</b><span class="mute">${esc(t('follow_text'))}</span></span><span class="btn primary sm">${esc(t('follow_btn'))} ↗</span></a></section>` : ''}
    <section class="block"><div class="block-head"><h2>${esc(t('p_apps'))}</h2></div>${appsCards()}</section>`;
}
export function team(el) {
  const { players } = PUB();
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('meet_team'))}</h1><p class="intro">${esc(t('team_intro'))}</p></div></div>
    <div class="pgrid">${players.map(playerCard).join('') || empty()}</div>`;
}
export function results(el) {
  const tours = tournaments(); const s = sum(tours);
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('p_results'))}</h1><p class="intro">${esc(t('results_intro'))}</p></div></div>
    <section class="stats"><div><b class="num">${tourCount(tours)}</b><span>${esc(t('s_tournaments'))}</span></div><div><b class="num">${s.n}</b><span>${esc(t('s_games'))}</span></div>
      <div><b class="num">${record(s)}</b><span>${esc(t('s_record'))}</span></div><div><b class="num">${pct(s.rate)}</b><span>${esc(t('winrate'))}</span></div></section>
    <div class="tours">${tours.map(tourCard).join('') || empty()}</div>`;
}
export function upcoming(el) {
  const { events } = PUB();
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('p_events'))}</h1><p class="intro">${esc(t('events_pub_intro'))}</p></div></div>
    ${events.length ? `<ul class="plist">${events.map(eventRow).join('')}</ul>` : empty(t('no_events'))}`;
}
export function apps(el) {
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('p_apps'))}</h1><p class="intro">${esc(t('apps_pub_intro'))}</p></div></div>${appsCards()}`;
}
