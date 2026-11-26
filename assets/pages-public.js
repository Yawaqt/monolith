// Public pages: visible to everyone, built only from the safe public data.
import { t } from './i18n.js?v=202611261155';
import { state, can, esc, fmtDate, empty, safeImg, evRange, evKind } from './core.js?v=202611261155';
import { newsCard, md } from './pages-news.js?v=202611261155';
import { typeLabel, pct } from './data.js?v=202611261155';
import { appsCards } from './pages-team.js?v=202611261155';
import { CONFIG } from './config.js?v=202611261155';
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
    <div><h3>${esc(e.title)}</h3><p class="mute">${esc(evRange(e, true))}${e.location ? ' · ' + esc(e.location) : ''}</p><span class="tag kind${e.kind === 'Team Tournament' ? ' team' : ''}">${esc(evKind(e))}</span></div></li>`;
}
function playerCard(p, full = false) {
  const photo = `<span class="avatar${safeImg(p.photo_url) ? ' photo' : ''}" aria-hidden="true">${safeImg(p.photo_url) ? `<img src="${esc(safeImg(p.photo_url))}" alt="" loading="lazy">` : esc(p.name.slice(0, 1))}</span>`;
  const armies = p.armies.length ? `<div class="chips">${p.armies.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>` : `<span class="mute">–</span>`;
  if (!full) return `<article class="pcard"><div class="pcard-top">${photo}<div><h3>${esc(p.name)}</h3></div></div>${p.armies.length ? armies : ''}</article>`;
  // Profile sheet: every field is always shown, empty ones with a dash
  const empty = `<span class="mute">–</span>`;
  return `<article class="pcard sheet"><div class="pcard-top">${photo}<h3>${esc(p.name)}</h3></div>
    <dl class="sheet-dl">
      <dt>${esc(t('fav_army'))}</dt><dd>${p.fav_army ? `<b>${esc(p.fav_army)}</b>` : empty}</dd>
      <dt>${esc(t('played_at_tours'))}</dt><dd>${armies}</dd>
      <dt>${esc(t('bio'))}</dt><dd class="bio">${p.bio ? esc(p.bio) : empty}</dd>
    </dl></article>`;
}
// Group photo slideshow: swipe on the phone, arrows and dots, advances by itself every 6 s
export function slideshow(photos) {
  const list = (photos || []).map(safeImg).filter(Boolean); if (!list.length) return '';
  return `<div class="slides" data-slides><div class="slides-track">${list.map((u, i) => `<figure class="slide"><img src="${esc(u)}" alt="${esc(t('group_photo'))} ${i + 1}" loading="${i ? 'lazy' : 'eager'}"></figure>`).join('')}</div>
    ${list.length > 1 ? `<button type="button" class="slides-nav prev" data-sl="-1" aria-label="${esc(t('sl_prev'))}">‹</button><button type="button" class="slides-nav next" data-sl="1" aria-label="${esc(t('sl_next'))}">›</button>
    <div class="slides-dots">${list.map((_, i) => `<button type="button" data-dot="${i}" aria-label="${esc(t('group_photo'))} ${i + 1}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>` : ''}</div>`;
}
let slideTimer = null;
export function bindSlides(root) {
  clearInterval(slideTimer);
  const box = root.querySelector('[data-slides]'); if (!box) return;
  const track = box.querySelector('.slides-track'); const n = track.children.length; if (n < 2) return;
  const cur = () => Math.round(track.scrollLeft / track.clientWidth);
  const go = i => track.scrollTo({ left: ((i + n) % n) * track.clientWidth, behavior: 'smooth' });
  track.addEventListener('scroll', () => { const c = cur(); box.querySelectorAll('[data-dot]').forEach((d, i) => d.toggleAttribute('aria-current', i === c)); }, { passive: true });
  box.addEventListener('click', e => { const s = e.target.closest('[data-sl]'); if (s) go(cur() + +s.dataset.sl); const d = e.target.closest('[data-dot]'); if (d) go(+d.dataset.dot); restart(); });
  const restart = () => { clearInterval(slideTimer); slideTimer = setInterval(() => { if (!document.body.contains(box)) return clearInterval(slideTimer); if (!document.hidden) go(cur() + 1); }, 6000); };
  box.addEventListener('pointerdown', restart); restart();
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
    ${(state.pub.news || []).length ? `<section class="block"><div class="block-head"><h2>${esc(t('news_latest'))}</h2><a href="#/news">${esc(t('news_all'))} →</a></div><div class="ngrid">${state.pub.news.slice(0, 3).map(newsCard).join('')}</div></section>` : ''}
    <section class="block"><div class="block-head"><h2>${esc(t('next_up'))}</h2><a href="#/upcoming">${esc(t('all_events'))} →</a></div>
      ${events.length ? `<ul class="plist">${events.slice(0, 3).map(eventRow).join('')}</ul>` : empty(t('no_events'))}</section>
    ${tours[0] ? `<section class="block"><div class="block-head"><h2>${esc(t('latest_tournament'))}</h2><a href="#/results">${esc(t('all_results'))} →</a></div>${tourCard(tours[0])}</section>` : ''}
    <section class="block"><div class="block-head"><h2>${esc(t('meet_team'))}</h2><a href="#/team">${esc(t('whole_team'))} →</a></div>
      <div class="pgrid">${players.slice(0, 6).map(p => playerCard(p, true)).join('')}</div></section>
    ${CONFIG.INSTAGRAM ? `<section class="block"><a class="follow" href="${esc(CONFIG.INSTAGRAM)}" target="_blank" rel="noopener"><span class="follow-ico">${IG_ICON}</span><span><b>${esc(t('follow_title'))}</b><span class="mute">${esc(t('follow_text'))}</span></span><span class="btn primary sm">${esc(t('follow_btn'))} ↗</span></a></section>` : ''}
    <section class="block"><div class="block-head"><h2>${esc(t('p_apps'))}</h2></div>${appsCards()}</section>`;
}
export function team(el) {
  const { players } = PUB(); const site = PUB().site || {};
  const about = site.about && site.about.text;
  el.innerHTML = `<div class="page-head"><div><h1>${esc(t('meet_team'))}</h1></div>${can('captain') ? `<a class="btn ghost sm" href="#/site">${esc(t('edit'))}</a>` : ''}</div>
    ${about ? `<div class="about">${md(about)}</div>` : ''}
    ${slideshow(site.group_photos)}
    <h2 class="sec">${esc(t('profiles'))}</h2>
    <div class="pgrid">${players.map(p => playerCard(p, true)).join('') || empty()}</div>`;
  bindSlides(el);
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
