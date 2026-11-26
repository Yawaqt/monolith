// Team pages: home, roster, match log, archive, events, calendar, line-up, cash.
import { CONFIG } from './config.js?v=202611261656';
import { db } from './db.js?v=202611261656';
import { t } from './i18n.js?v=202611261656';
import { state, can, myPlayer, isMe, esc, $, $$, opts, resizeImage, safeImg, loadData, evRange, evKind, players, playerById, pname, fmtDate, money, act, modal, confirmBox, resultBadge, gpClass, empty, pageHead, toast } from './core.js?v=202611261656';
import { FACTIONS, DISPOSITIONS, GAME_TYPES, gp, resultOf, outcome, teamScored, typeLabel, scoreStr, records, summarize, fmt1, pct, today } from './data.js?v=202611261656';

const D = () => state.data;
const rsvpOf = (eid, pid) => (D().rsvps || []).find(r => r.event_id === eid && r.player_id === pid)?.status;
export const BCP_RE = /^https:\/\/([a-z0-9-]+\.)*bestcoastpairings\.com\//i;
const upcomingEvents = () => (D().events || []).filter(e => (e.ends_on || e.starts_on) >= today()).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
// Members edit and delete their own games (entered by them or played by them); admins all games.
const uidNow = () => state.session && state.session.user.id;
const canEditMatch = m => can('admin') || (can('team') && !!m && (m.created_by === uidNow() || (myPlayer() && (m.player_id === myPlayer() || m.opp_player_id === myPlayer()))));
// Link a team mate's existing game to a second player (own games directly, others via a safe server function)
const linkGame = (m, pid, disp) => canEditMatch(m) ? db.update('matches', { id: m.id }, { opp_player_id: pid, opp_disposition: m.opp_disposition || disp || null })
  : pid === myPlayer() ? db.rpc('link_internal_game', { p_id: m.id }) : Promise.reject(new Error(t('dup_no_right')));
const typeOpts = cur => opts([...new Set([...GAME_TYPES, ...(cur ? [cur] : [])])].map(x => [x, typeLabel(x, t)]), cur);
// Result cell: team-scored games show the 20-0 score, singles only the points.
export function resultHtml(m) {
  const res = outcome(m.type, m.our_score, m.opp_score); if (!res) return '';
  const pts = `<span class="num">${esc(m.our_score)}:${esc(m.opp_score)}</span>`;
  return teamScored(m.type) ? `${pts} · <b class="num">${scoreStr(gp(m.our_score, m.opp_score))}</b> ${resultBadge(res)}` : `<b>${pts}</b> ${resultBadge(res)}`;
}

// ---------------------------------------------------------------- Home
export function home(el) {
  const me = state.me; const name = me?.display_name || '';
  if (!can('team')) {
    el.innerHTML = pageHead(`${t('hello')} ${name}`, '', `<button type="button" class="btn ghost" data-out>${esc(t('sign_out'))}</button>`) + `<div class="notice">${esc(t('pending'))}</div>` + appsCards();
    return;
  }
  const pid = myPlayer();
  const recs = records(D().matches || []);
  const isTour = r => r.m.type !== 'Practice';
  const mineAll = recs.filter(r => r.player_id === pid);
  const mineT = summarize(mineAll.filter(isTour)), mineP = summarize(mineAll.filter(r => !isTour(r)));
  const teamT = summarize(recs.filter(r => !r.mirrored && isTour(r)));
  const isTrain = e => e.kind === 'Training' || e.kind === 'Training Match';
  const trains = upcomingEvents().filter(isTrain).slice(0, 3), tours = upcomingEvents().filter(e => !isTrain(e)).slice(0, 3);
  const recent = (D().matches || []).slice().sort((a, b) => b.played_on.localeCompare(a.played_on) || b.id - a.id).slice(0, 6);
  el.innerHTML = pageHead(`${t('hello')} ${name}`, '', `<a class="btn primary" href="#/matches">${esc(t('open_games'))}</a>`) +
    (!pid ? `<div class="notice">${esc(t('not_linked'))}</div>` : '') +
    `<div class="tiles">
      ${pid ? tile(t('my_tour'), `${mineT.w}-${mineT.d}-${mineT.l}`, mineT.n ? `${pct(mineT.rate)} ${t('winrate')} · ${t('n_games', { n: mineT.n })}` : t('no_games_yet'), 'main') : ''}
      ${pid ? tile(t('my_practice'), `${mineP.w}-${mineP.d}-${mineP.l}`, mineP.n ? `${pct(mineP.rate)} · ${t('avg_gp')} ${fmt1(mineP.avgGp)}` : t('no_games_yet'), 'minor') : ''}
      ${tile(t('team_tour'), `${teamT.w}-${teamT.d}-${teamT.l}`, `${pct(teamT.rate)} · ${t('n_games', { n: teamT.n })}`)}
      ${tile(t('next_training'), trains[0] ? fmtDate(trains[0].starts_on, { day: '2-digit', month: 'short' }) + (trains[0].start_time ? ' · ' + trains[0].start_time.slice(0, 5) : '') : '–', trains[0] ? trains[0].title : '')}
    </div>
    <div class="cols">
      <section class="card"><h2>${esc(t('next_trainings'))}</h2>${trains.length ? trains.map(e => eventMini(e)).join('') : empty()}<a class="more" href="#/events">${esc(t('nav_events'))} →</a></section>
      <section class="card"><h2>${esc(t('next_tours'))}</h2>${tours.length ? tours.map(e => eventMini(e)).join('') : empty()}<a class="more" href="#/events">${esc(t('nav_events'))} →</a></section>
    </div>
    <div class="cols">
      <section class="card"><h2>${esc(t('recent'))}</h2>${recent.length ? `<ul class="list">${recent.map(m => {
        return `<li><span><b>${esc(pname(m.player_id))}</b> <span class="mute">${esc(m.army)} ${esc(t('vs'))} ${esc(m.opp_faction)}</span><br><small class="mute">${esc(fmtDate(m.played_on))}${m.tournament ? ' · ' + esc(m.tournament) : ''}</small></span><span class="nowrap">${resultHtml(m)}</span></li>`; }).join('')}</ul>` : empty()}<a class="more" href="#/archive">${esc(t('nav_archive'))} →</a></section>
    </div>`;
  el.onclick = e => { const b = e.target.closest('[data-rsvp]'); if (b) setRsvp(+b.dataset.e, myPlayer(), b.dataset.rsvp); };
}
const tile = (label, big, sub, cls = '') => `<div class="tile ${cls}"><div class="tile-l">${esc(label)}</div><div class="tile-big num">${esc(big)}</div><div class="tile-s">${esc(sub)}</div></div>`;
function eventMini(e) {
  const mine = rsvpOf(e.id, myPlayer());
  return `<div class="ev-mini"><div><b>${esc(e.title)}</b><br><small class="mute">${esc(evRange(e))}${e.location ? ' · ' + esc(e.location) : ''}</small></div>
    ${myPlayer() ? `<div class="seg sm" role="group" aria-label="${esc(t('your_answer'))}">${['yes', 'maybe', 'no'].map(s => `<button type="button" data-e="${e.id}" data-rsvp="${s}" class="${s}" aria-pressed="${mine === s}">${esc(t(s))}</button>`).join('')}</div>` : ''}</div>`;
}
async function setRsvp(eid, pid, status) {
  if (!pid) return;
  await act(() => db.upsert('rsvps', { event_id: eid, player_id: pid, status, updated_at: new Date().toISOString() }), ['rsvps'], false);
}
export function appsCards() {
  return `<div class="apps">
    <a class="app-card" href="apps/collection/"><div class="app-ico" aria-hidden="true">${ICON_LIST}</div><div><h3>${esc(t('nav_collection'))}</h3><p>${esc(t('collection_desc'))}</p><span class="btn primary sm">${esc(t('open_app'))}</span></div></a>
    <a class="app-card" href="#/history"><div class="app-ico" aria-hidden="true">${ICON_CHART}</div><div><h3>${esc(t('nav_history'))}</h3><p>${esc(t('history_desc'))}</p><span class="btn primary sm">${esc(t('open_app'))}</span></div></a>
    ${can('admin') ? [['score', 'app_score', 'score_desc'], ['mathhammer', 'app_mathhammer', 'mathhammer_desc'], ['pairtrain', 'app_pairtrain', 'pairtrain_desc']].map(([r, n, d]) => `<a class="app-card" href="#/${r}"><div class="app-ico" aria-hidden="true">${ICON_LAB}</div><div><h3>${esc(t(n))} <span class="tag">${esc(t('admin_test'))}</span></h3><p>${esc(t(d))}</p><span class="btn primary sm">${esc(t('open_app'))}</span></div></a>`).join('') : ''}
    <div class="app-card soon"><div class="app-ico" aria-hidden="true">+</div><div><h3>${esc(t('more_apps'))}</h3><p>${esc(t('more_apps_desc'))}</p></div></div></div>`;
}
const ICON_BRUSH = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12l-3 3c-1 1 0 3 1 4s3 2 4 1l3-3"/></svg>';
const ICON_LAB = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v6L4 20h16L14 9V3"/></svg>';
const ICON_CHART = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';
const ICON_LIST = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/></svg>';

// ---------------------------------------------------------------- Roster (Anmeldung)
export const avatar = (p, cls = '') => `<span class="avatar ${cls}" aria-hidden="true">${safeImg(p.photo_url) ? `<img src="${esc(safeImg(p.photo_url))}" alt="" loading="lazy">` : esc((p.name || '?').slice(0, 1))}</span>`;
export function roster(el) {
  const ps = players(can('captain'));
  const cov = new Map();
  for (const p of players()) for (const a of p.armies || []) if (a.army) { if (!cov.has(a.army)) cov.set(a.army, new Set()); cov.get(a.army).add(p.name); }
  const missing = FACTIONS.filter(f => !cov.has(f));
  el.innerHTML = pageHead(t('nav_roster'), t('roster_intro'), can('captain') ? `<button class="btn primary" data-add>${esc(t('add_player'))}</button>` : '') +
    `<div class="roster">${ps.map(p => `<article class="card pl${p.active ? '' : ' inactive'}">
      <header><h3>${(can('captain') || isMe(p.id)) ? `<button type="button" class="ava-btn" data-photo-for="${p.id}" title="${esc(t('photo_pick'))}" aria-label="${esc(t('photo_pick'))}: ${esc(p.name)}">${avatar(p)}<span class="cam" aria-hidden="true">📷</span></button>` : avatar(p)}${esc(p.name)}${isMe(p.id) ? ' <span class="tag">★</span>' : ''}${p.bcp_url ? ` <a class="tag bcp" href="${esc(p.bcp_url)}" target="_blank" rel="noopener">BCP ↗</a>` : ''}</h3>${(can('captain') || isMe(p.id)) ? `<button class="btn ghost sm" data-edit="${p.id}">${esc(t('edit'))}</button>` : ''}</header>
      ${(p.armies || []).filter(a => a.army).length ? `<ol class="armies">${p.armies.filter(a => a.army).map(a => `<li><b>${esc(a.army)}</b><span class="mute">${[a.d1, a.d2].filter(Boolean).map(esc).join(' · ')}</span>${a.d1 && a.d1 === a.d2 ? ` <span class="warn" title="${esc(t('same_disp'))}">!</span>` : ''}</li>`).join('')}</ol>` : `<p class="mute">–</p>`}
    </article>`).join('')}</div>
    <section class="card"><h2>${esc(t('coverage'))}</h2><div class="chips">${[...cov.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([f, s]) => `<span class="chip on" title="${esc(t('covered_by'))}: ${esc([...s].join(', '))}">${esc(f)} <b>${s.size}</b></span>`).join('')}</div>
      ${missing.length ? `<h3 class="sub">${esc(t('not_covered'))}</h3><div class="chips">${missing.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}</section>`;
  el.onclick = async e => {
    const ph = e.target.closest('[data-photo-for]'); if (ph) return changePhoto(+ph.dataset.photoFor);
    const ed = e.target.closest('[data-edit]'); if (ed) return editPlayer(playerById(ed.dataset.edit));
    if (e.target.closest('[data-add]')) return editPlayer(null);
  };
}
// Pick a photo and upload it straight away (one tap from the roster card or the profile)
export function changePhoto(pid) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    try { const blob = await resizeImage(file, 600, true); toast(t('uploading'));
      const url = await db.upload(`players/${pid}-${Date.now()}.jpg`, blob);
      await act(() => db.update('players', { id: pid }, { photo_url: url }), ['players'], t('photo_saved'));
      if (state.reloadPublic) state.reloadPublic().then(() => state.render()).catch(() => {});
    } catch (err) { toast(t('error') + ': ' + err.message, true); }
  };
  inp.click();
}
async function editPlayer(p) {
  const isNew = !p; p = p || { name: '', sort: players(true).length + 1, active: true, armies: [] };
  const slots = [0, 1, 2, 3, 4].map(i => p.armies[i] || { army: '', d1: '', d2: '' });
  const body = `${can('captain') ? `<div class="grid2"><label>${esc(t('player'))}<input name="name" required maxlength="40" value="${esc(p.name)}"></label>
      <label>${esc(t('position'))}<input name="sort" type="number" min="0" max="99" value="${esc(p.sort)}"></label></div>
      <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> ${esc(t('active'))}</label>` : ''}
    <div class="photo-edit"><span class="avatar lg" data-pv>${safeImg(p.photo_url) ? `<img src="${esc(safeImg(p.photo_url))}" alt="">` : esc((p.name || '?').slice(0, 1))}</span>
      <div><b>${esc(t('photo'))}</b><p class="mute small">${esc(t('photo_hint'))}</p><label class="btn ghost sm file">${esc(t('photo_pick'))}<input type="file" accept="image/*" data-photo hidden></label>
      ${p.photo_url ? `<label class="check small"><input type="checkbox" name="photo_remove"> ${esc(t('photo_remove'))}</label>` : ''}</div></div>
    <div class="grid2"><label>${esc(t('fav_army'))}<select name="fav_army">${opts(FACTIONS, p.fav_army || '', '–')}</select></label><span></span></div>
    <label>${esc(t('bio'))}<textarea name="bio" rows="3" maxlength="600" placeholder="${esc(t('bio_ph'))}">${esc(p.bio || '')}</textarea></label>
    <label>${esc(t('bcp_profile'))}<input name="bcp_url" type="url" inputmode="url" placeholder="https://www.bestcoastpairings.com/…" value="${esc(p.bcp_url || '')}"><small class="mute">${esc(t('bcp_hint'))}</small></label>
    ${slots.map((a, i) => `<fieldset class="slot"><legend>${esc(t('army'))} ${i + 1}</legend><div class="grid3">
      <label>${esc(t('army'))}<select name="a${i}">${opts(FACTIONS, a.army, '–')}</select></label>
      <label>${esc(t('wish1'))}<select name="d1_${i}">${opts(DISPOSITIONS, a.d1, '–')}</select></label>
      <label>${esc(t('wish2'))}<select name="d2_${i}">${opts(DISPOSITIONS, a.d2, '–')}</select></label></div></fieldset>`).join('')}`;
  let photo = null;
  const r = await modal(isNew ? t('add_player') : p.name, body, { wide: true, onOpen: f => {
    $('[data-photo]', f).addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return;
      try { photo = await resizeImage(file, 600, true); $('[data-pv]', f).innerHTML = `<img src="${URL.createObjectURL(photo)}" alt="">`; } catch (err) { toast(err.message, true); } });
    const chk = () => $$('.slot', f).forEach((s, i) => { const a = f[`d1_${i}`].value, b = f[`d2_${i}`].value; s.classList.toggle('dup', !!a && a === b); });
    f.addEventListener('change', chk); chk(); } });
  if (!r) return;
  const armies = slots.map((_, i) => ({ army: r['a' + i], d1: r['d1_' + i], d2: r['d2_' + i] })).filter(a => a.army);
  const bcp = (r.bcp_url || '').trim();
  if (bcp && !/^https:\/\/([a-z0-9-]+\.)*bestcoastpairings\.com\//i.test(bcp)) return toast(t('bcp_invalid'), true);
  const patch = { armies, bcp_url: bcp || null, fav_army: r.fav_army || null, bio: (r.bio || '').trim() || null };
  if (r.photo_remove) patch.photo_url = null;
  if (photo) { try { toast(t('uploading')); patch.photo_url = await db.upload(`players/${p.id || 'new'}-${Date.now()}.jpg`, photo); } catch (err) { return toast(t('error') + ': ' + err.message, true); } }
  if (can('captain')) Object.assign(patch, { name: r.name.trim(), sort: +r.sort || 0, active: !!r.active });
  await act(() => isNew ? db.insert('players', patch) : db.update('players', { id: p.id }, patch), ['players']);
}

// ---------------------------------------------------------------- Match log
function matchForm(m = {}) {
  const pid = m.player_id ?? myPlayer();
  const pl = playerById(pid); const mineArmies = (pl?.armies || []).map(a => a.army).filter(Boolean);
  const armyList = [...new Set([...mineArmies, ...FACTIONS])];
  const plOpts = players(true).map(p => [p.id, p.name]);
  return `<div class="grid3">
    <label>${esc(t('type'))}<select name="type" required>${typeOpts(m.type || 'Practice')}</select></label>
    <label>${esc(t('tour_name'))}<input name="tournament" value="${esc(m.tournament || '')}" list="tours"><datalist id="tours">${[...new Set((D().matches || []).map(x => x.tournament).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>${esc(t('date'))}<input name="played_on" type="date" required value="${esc(m.played_on || today())}"></label>
    <label>${esc(t('our_player'))}<select name="player_id" required>${opts(plOpts, pid, '–')}</select></label>
    <label>${esc(t('our_army'))}<select name="army" required>${opts(armyList, m.army || mineArmies[0] || '', '–')}</select></label>
    <label>${esc(t('our_disp'))}<select name="disposition">${opts(DISPOSITIONS, m.disposition, '–')}</select></label>
    <label>${esc(t('opp_faction'))}<select name="opp_faction" required>${opts(FACTIONS, m.opp_faction, '–')}</select></label>
    <label>${esc(t('opp_disp'))}<select name="opp_disposition">${opts(DISPOSITIONS, m.opp_disposition, '–')}</select></label>
    <label>${esc(t('opp_player'))}<select name="opp_player_id">${opts(players().map(p => [p.id, p.name]), m.opp_player_id, t('external'))}</select></label>
    <label class="opp-name">${esc(t('opp_name'))}<input name="opp_name" maxlength="60" value="${esc(m.opp_name || '')}"></label>
    <label>${esc(t('our_score'))}<input name="our_score" type="number" inputmode="numeric" min="0" max="200" required value="${esc(m.our_score ?? '')}"></label>
    <label>${esc(t('opp_score'))}<input name="opp_score" type="number" inputmode="numeric" min="0" max="200" required value="${esc(m.opp_score ?? '')}"></label>
  </div>
  <label>${esc(t('notes'))}<input name="notes" maxlength="200" value="${esc(m.notes || '')}"></label>
  <div class="preview" aria-live="polite"></div>`;
}
function bindMatchForm(f) {
  const upd = () => {
    const ty = f.type.value, g = gp(f.our_score.value, f.opp_score.value), res = outcome(ty, f.our_score.value, f.opp_score.value);
    $('.preview', f).innerHTML = !g ? `<small class="mute">${esc(t(teamScored(ty) ? 'score_rule' : 'score_rule_singles'))}</small>`
      : teamScored(ty) ? `${esc(t('diff'))} <b class="num">${f.our_score.value - f.opp_score.value}</b> · ${esc(t('team_score'))} <b class="num">${scoreStr(g)}</b> ${resultBadge(res)}`
      : `${esc(t('diff'))} <b class="num">${f.our_score.value - f.opp_score.value}</b> · ${resultBadge(res)} <small class="mute">${esc(t('score_rule_singles'))}</small>`;
    $('.opp-name', f).style.display = f.opp_player_id.value ? 'none' : '';
  };
  f.addEventListener('input', upd); f.addEventListener('change', e => {
    if (e.target.name === 'player_id') { const pl = playerById(e.target.value); const a = (pl?.armies || []).find(x => x.army); if (a) { f.army.value = a.army; if (a.d1) f.disposition.value = a.d1; } }
    if (e.target.name === 'army') { const pl = playerById(f.player_id.value); const a = (pl?.armies || []).find(x => x.army === e.target.value); if (a && a.d1) f.disposition.value = a.d1; }
    upd();
  });
  upd();
}
function matchRow(r) {
  const out = { type: r.type || 'Practice', tournament: r.tournament.trim() || null, played_on: r.played_on, player_id: +r.player_id, army: r.army, disposition: r.disposition || null,
    opp_faction: r.opp_faction, opp_disposition: r.opp_disposition || null, opp_player_id: r.opp_player_id ? +r.opp_player_id : null, opp_name: r.opp_player_id ? null : (r.opp_name.trim() || null),
    our_score: r.our_score === '' ? null : +r.our_score, opp_score: r.opp_score === '' ? null : +r.opp_score, notes: r.notes.trim() || null };
  if (out.opp_player_id === out.player_id) throw new Error('Opponent = our player');
  return out;
}
// ---------------------------------------------------------------- Quick result (floating button, members and above)
// Everything is filled in from the player's last game, so usually only opponent and points are left.
function lastOwnGame(pid) {
  return (D().matches || []).filter(m => m.player_id === pid).sort((a, b) => b.played_on.localeCompare(a.played_on) || b.id - a.id)[0];
}
export async function quickResult() {
  if (!can('team')) return;
  if (!D() || !D().matches) { try { await loadData(); } catch (e) {} }
  const pid = myPlayer() || players()[0]?.id; const last = lastOwnGame(pid);
  const pl = playerById(pid); const firstArmy = (pl?.armies || []).find(a => a.army) || {};
  // Same tournament as the last game if that was within the last 3 days (rounds 2, 3 … of the weekend)
  const recent = last && (Date.now() - new Date(last.played_on).getTime()) < 3 * 864e5;
  const m = { type: recent ? last.type : (last ? last.type : 'Practice'), tournament: recent ? last.tournament : '', played_on: today(), player_id: pid,
    army: last ? last.army : firstArmy.army, disposition: last ? last.disposition : firstArmy.d1 };
  const plOpts = players(true).map(p => [p.id, p.name]);
  const armyList = [...new Set([...(pl?.armies || []).map(a => a.army).filter(Boolean), ...FACTIONS])];
  const body = `<div class="quick">
    <div class="seg type-seg" role="group" aria-label="${esc(t('type'))}">${GAME_TYPES.map(x => `<button type="button" data-type="${x}" aria-pressed="${m.type === x}">${esc(t({ Practice: 'type_practice', Tournament: 'type_singles_s', 'Team Tournament': 'type_team' }[x]))}</button>`).join('')}</div>
    <input type="hidden" name="type" value="${esc(m.type)}">
    <label class="tour-name"${m.type === 'Practice' ? ' hidden' : ''}>${esc(t('tour_name'))}<input name="tournament" value="${esc(m.tournament || '')}" list="qtours" maxlength="80"><datalist id="qtours">${[...new Set((D().matches || []).map(x => x.tournament).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <div class="grid2">
      <label>${esc(t('our_army'))}<select name="army" required>${opts(armyList, m.army || '', '–')}</select></label>
      <label>${esc(t('opp_faction'))}<select name="opp_faction" required>${opts(FACTIONS, '', '–')}</select></label>
      <label>${esc(t('our_score'))}<input name="our_score" type="number" inputmode="numeric" min="0" max="200" required></label>
      <label>${esc(t('opp_score'))}<input name="opp_score" type="number" inputmode="numeric" min="0" max="200" required></label>
    </div>
    <div class="preview" aria-live="polite"></div>
    <details class="more"><summary>${esc(t('quick_more'))}</summary><div class="grid2">
      <label>${esc(t('our_player'))}<select name="player_id" required>${opts(plOpts, pid, '–')}</select></label>
      <label>${esc(t('date'))}<input name="played_on" type="date" required value="${esc(m.played_on)}"></label>
      <label>${esc(t('our_disp'))}<select name="disposition">${opts(DISPOSITIONS, m.disposition || '', '–')}</select></label>
      <label>${esc(t('opp_disp'))}<select name="opp_disposition">${opts(DISPOSITIONS, '', '–')}</select></label>
      <label>${esc(t('opp_player'))}<select name="opp_player_id">${opts(players().map(p => [p.id, p.name]), '', t('external'))}</select></label>
      <label class="opp-name">${esc(t('opp_name'))}<input name="opp_name" maxlength="60"></label></div>
      <label>${esc(t('notes'))}<input name="notes" maxlength="200"></label></details></div>`;
  const r = await modal(t('quick_title'), body, { submit: t('save_game'), onOpen: f => {
    f.addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return;
      f.type.value = b.dataset.type; $$('[data-type]', f).forEach(x => x.setAttribute('aria-pressed', x === b));
      $('.tour-name', f).hidden = b.dataset.type === 'Practice'; f.dispatchEvent(new Event('change')); });
    bindMatchForm(f);
    setTimeout(() => f.opp_faction.focus(), 30);
  } });
  if (!r) return;
  if (r.type === 'Practice') r.tournament = '';
  let row; try { row = matchRow(r); } catch (err) { return toast(err.message, true); }
  if (await handleMirror(row)) return;
  await act(() => db.insert('matches', row), ['matches'], t('quick_saved'));
}

// ---------------------------------------------------------------- Games between two team mates are stored once
// An internal game is one row (player + opp_player_id) and counts for both players. When the same game is entered
// again for the other player, it is recognised: same day / tournament, the two players (or their armies) swapped and
// the points mirrored. Then it is not saved twice; the existing row is linked to the second player instead.
export function findMirror(row, pool = D().matches || []) {
  const sameEvent = m => m.played_on === row.played_on && (m.tournament || '') === (row.tournament || '');
  const mirrored = m => +m.our_score === +row.opp_score && +m.opp_score === +row.our_score;
  const same = m => m.id !== row.id && m.player_id === row.player_id && sameEvent(m) && m.opp_faction === row.opp_faction && m.army === row.army && +m.our_score === +row.our_score && +m.opp_score === +row.opp_score;
  const twin = pool.find(same); if (twin) return twin;
  return pool.find(m => m.id !== row.id && m.player_id !== row.player_id && sameEvent(m) && mirrored(m) && (
    (row.opp_player_id && m.player_id === row.opp_player_id) || m.opp_player_id === row.player_id ||
    (m.army === row.opp_faction && m.opp_faction === row.army)));
}
// Returns true when the row was handled as a duplicate (nothing more to save)
async function handleMirror(row) {
  const m = findMirror(row); if (!m) return false;
  const r = await modal(t('dup_title'), m.player_id === row.player_id ? `<p>${esc(t('dup_same', { a: pname(m.player_id), aa: m.army, f: m.opp_faction, s: `${m.our_score}:${m.opp_score}`, d: fmtDate(m.played_on) }))}</p><label class="check"><input type="checkbox" name="force"> ${esc(t('dup_force'))}</label>` : `<p>${esc(t('dup_text', { a: pname(m.player_id), aa: m.army, b: pname(row.player_id), ba: row.army, s: `${m.our_score}:${m.opp_score}`, d: fmtDate(m.played_on) }))}</p>
    <label class="check"><input type="checkbox" name="force"> ${esc(t('dup_force'))}</label>`, { submit: t('dup_ok') });
  if (!r) return true;                 // cancelled: save nothing
  if (r.force) return false;           // really a different game
  if (m.player_id === row.player_id) toast(t('dup_exists'));
  else if (!m.opp_player_id || m.opp_player_id !== row.player_id) await act(() => linkGame(m, row.player_id, row.disposition), ['matches'], t('dup_linked', { a: pname(m.player_id), b: pname(row.player_id) }));
  else toast(t('dup_exists'));
  return true;
}

export function matches(el) {
  const canLog = can('team');
  const latest = (D().matches || []).slice().sort((a, b) => b.id - a.id).slice(0, 8);
  el.innerHTML = pageHead(t('nav_matches'), t('log_intro'), canLog ? `<button class="btn primary" data-tour>${esc(t('tour_import'))}</button>` : '') +
    (canLog ? `<form class="card form" id="mform" novalidate>${matchForm()}<div class="form-actions"><button class="btn primary">${esc(t('save_game'))}</button></div></form>` : `<div class="notice">${esc(t('not_linked'))}</div>`) +
    `<section class="card"><h2>${esc(t('latest'))}</h2>${gamesTable(latest)}</section>`;
  const f = $('#mform');
  if (f) { bindMatchForm(f); f.addEventListener('submit', async e => { e.preventDefault(); if (!f.reportValidity()) return;
    const o = {}; for (const x of f.elements) if (x.name) o[x.name] = x.value;
    let row; try { row = matchRow(o); } catch (err) { return toast(err.message, true); }
    if (await handleMirror(row)) return;
    await act(() => db.insert('matches', row), ['matches']); }); }
  el.onclick = e => { if (e.target.closest('[data-tour]')) return tournamentImport(); return gamesClick(e); };
}
function gamesTable(list) {
  if (!list.length) return empty();
  return `<div class="scroll"><table class="games stack"><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('player'))}</th><th>${esc(t('army'))}</th><th>${esc(t('opp_faction'))}</th><th class="r">${esc(t('result'))}</th><th>${esc(t('type'))}</th><th>${esc(t('notes'))}</th><th></th></tr></thead><tbody>
  ${list.map(m => {
    return `<tr><td class="nowrap">${esc(fmtDate(m.played_on))}</td><td><b>${esc(pname(m.player_id))}</b></td><td>${esc(m.army)}<br><small class="mute">${esc(m.disposition || '')}</small></td>
    <td>${esc(m.opp_faction)}${m.opp_player_id ? ` <span class="tag">${esc(t('internal'))}: ${esc(pname(m.opp_player_id))}</span>` : m.opp_name ? ` <small class="mute">(${esc(m.opp_name)})</small>` : ''}<br><small class="mute">${esc(m.opp_disposition || '')}</small></td>
    <td class="r nowrap">${resultHtml(m)}</td>
    <td>${esc(typeLabel(m.type, t))}${m.tournament ? `<br><small class="mute">${esc(m.tournament)}</small>` : ''}</td><td><small>${esc(m.notes || '')}</small></td>
    <td class="r nowrap">${canEditMatch(m) ? `<button class="icon" data-medit="${m.id}" aria-label="${esc(t('edit'))}">✎</button><button class="icon" data-mdel="${m.id}" aria-label="${esc(t('delete'))}">🗑</button>` : ''}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
async function gamesClick(e) {
  {
    const ed = e.target.closest('[data-medit]'), del = e.target.closest('[data-mdel]');
    if (ed) { const m = D().matches.find(x => x.id === +ed.dataset.medit);
      const r = await modal(t('edit_game'), matchForm(m), { wide: true, onOpen: bindMatchForm }); if (!r) return;
      let row; try { row = matchRow(r); } catch (err) { return toast(err.message, true); }
      if (await handleMirror(Object.assign({ id: m.id }, row))) return;
      await act(() => db.update('matches', { id: m.id }, row), ['matches']); }
    if (del) { const m = D().matches.find(x => x.id === +del.dataset.mdel);
      if (await confirmBox(`${pname(m.player_id)} · ${m.army} vs ${m.opp_faction} · ${fmtDate(m.played_on)}`)) await act(() => db.remove('matches', { id: m.id }), ['matches']); }
  }
}

// ---------------------------------------------------------------- Archive
const AF = { player: '', army: '', type: '', from: '', to: '', sort: 'new', q: '' };
export function archive(el) {
  let list = (D().matches || []).slice();
  if (AF.player) list = list.filter(m => m.player_id === +AF.player || m.opp_player_id === +AF.player);
  if (AF.army) list = list.filter(m => m.army === AF.army || m.opp_faction === AF.army);
  if (AF.type) list = list.filter(m => m.type === AF.type);
  if (AF.from) list = list.filter(m => m.played_on >= AF.from);
  if (AF.to) list = list.filter(m => m.played_on <= AF.to);
  if (AF.q) { const q = AF.q.toLowerCase(); list = list.filter(m => [m.tournament, m.notes, m.opp_name].some(x => (x || '').toLowerCase().includes(q))); }
  const key = m => (gp(m.our_score, m.opp_score) || [0])[0];
  list.sort(AF.sort === 'old' ? (a, b) => a.played_on.localeCompare(b.played_on) || a.id - b.id : AF.sort === 'best' ? (a, b) => key(b) - key(a) : AF.sort === 'worst' ? (a, b) => key(a) - key(b) : (a, b) => b.played_on.localeCompare(a.played_on) || b.id - a.id);
  const s = summarize(records(list).filter(r => AF.player ? r.player_id === +AF.player : !r.mirrored));
  const types = [...new Set((D().matches || []).map(m => m.type))];
  el.innerHTML = pageHead(t('nav_archive'), t('archive_intro')) + `<form class="filters card" id="af">
    <label>${esc(t('player'))}<select name="player">${opts(players(true).map(p => [p.id, p.name]), AF.player, t('all'))}</select></label>
    <label>${esc(t('army'))}<select name="army">${opts(FACTIONS, AF.army, t('all'))}</select></label>
    <label>${esc(t('type'))}<select name="type">${opts(types.map(x => [x, typeLabel(x, t)]), AF.type, t('all'))}</select></label>
    <label>${esc(t('from'))}<input type="date" name="from" value="${esc(AF.from)}"></label>
    <label>${esc(t('to'))}<input type="date" name="to" value="${esc(AF.to)}"></label>
    <label>${esc(t('sort'))}<select name="sort">${opts([['new', t('newest')], ['old', t('oldest')], ['best', t('best')], ['worst', t('worst')]], AF.sort)}</select></label>
    <label>${esc(t('search'))}<input type="search" name="q" value="${esc(AF.q)}"></label></form>
    <p class="summary">${esc(t('n_games', { n: list.length }))} · <b>${s.w}-${s.d}-${s.l}</b> · ${esc(t('winrate'))} ${pct(s.rate)} · ${esc(t('avg_gp'))} ${fmt1(s.avgGp)}</p>
    <section class="card">${gamesTable(list)}</section>`;
  const f = $('#af');
  f.addEventListener('change', () => { for (const k in AF) if (f[k]) AF[k] = f[k].value; archive(el); });
  f.q.addEventListener('input', () => { clearTimeout(f._t); f._t = setTimeout(() => { AF.q = f.q.value; archive(el); const q = $('#af [name=q]'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 300); });
  el.onclick = gamesClick;
}

// ---------------------------------------------------------------- Events
let showPast = false;
let evTab = 'tour';
const isTraining = e => e.kind === 'Training' || e.kind === 'Training Match';
export function events(el) {
  const all = (D().events || []).filter(e => evTab === 'training' ? isTraining(e) : !isTraining(e));
  const list = showPast ? all.filter(e => (e.ends_on || e.starts_on) < today()).sort((a, b) => b.starts_on.localeCompare(a.starts_on)) : all.filter(e => (e.ends_on || e.starts_on) >= today()).sort((a, b) => a.starts_on.localeCompare(b.starts_on) || String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const ps = players();
  el.innerHTML = pageHead(t('nav_events'), t('events_intro'), can('captain') ? `<button class="btn primary" data-new>${esc(t('new_event'))}</button>` : '') +
    `<div class="seg ev-tabs" role="tablist"><button type="button" role="tab" data-evtab="tour" aria-selected="${evTab === 'tour'}">🏆 ${esc(t('ev_tab_tour'))}</button><button type="button" role="tab" data-evtab="training" aria-selected="${evTab === 'training'}">⚔ ${esc(t('ev_tab_training'))}</button></div>
    ${evTab === 'training' ? `<p class="mute small">${esc(t('ev_training_note'))}</p>` : ''}
    <div class="seg" role="group"><button type="button" data-past="0" aria-pressed="${!showPast}">${esc(t('upcoming'))}</button><button type="button" data-past="1" aria-pressed="${showPast}">${esc(t('past'))}</button></div>
    ${can('captain') ? `<p class="mute small">${esc(t('tap_to_set'))}</p>` : ''}
    <div class="events">${list.length ? list.map(e => {
      const st = s => ps.filter(p => rsvpOf(e.id, p.id) === s);
      const yes = st('yes'), maybe = st('maybe'), no = st('no');
      return `<article class="card ev" id="ev-${e.id}"><header><div class="ev-date"><b>${esc(fmtDate(e.starts_on, { day: '2-digit' }))}</b><span>${esc(fmtDate(e.starts_on, { month: 'short' }))}</span></div>
        <div class="ev-main"><h3>${esc(e.title)}</h3><p class="mute">${esc(evRange(e, true))}${isTraining(e) && e.start_time ? ' · ' + esc(String(e.start_time).slice(0, 5)) : ''}${e.location ? ' · ' + esc(e.location) : ''} · ${esc(evKind(e))}${e.series_id ? ' · 🔁' : ''}${BCP_RE.test(e.bcp_url || '') ? ` · <a href="${esc(e.bcp_url)}" target="_blank" rel="noopener">BCP ↗</a>` : ''}</p>${e.note ? `<p>${esc(e.note)}</p>` : ''}</div>
        ${can('captain') ? `<div class="ev-tools"><button class="icon" data-eedit="${e.id}" aria-label="${esc(t('edit'))}">✎</button><button class="icon" data-edel="${e.id}" aria-label="${esc(t('delete'))}">🗑</button></div>` : ''}</header>
        <p class="counts"><span class="yes">${esc(t('going'))} <b>${yes.length}</b></span><span class="maybe">${esc(t('maybe'))} <b>${maybe.length}</b></span><span class="no">${esc(t('no'))} <b>${no.length}</b></span></p>
        ${myPlayer() ? `<div class="mine"><span>${esc(t('your_answer'))}:</span><div class="seg sm">${['yes', 'maybe', 'no'].map(s => `<button type="button" data-e="${e.id}" data-rsvp="${s}" class="${s}" aria-pressed="${rsvpOf(e.id, myPlayer()) === s}">${esc(t(s))}</button>`).join('')}</div></div>` : ''}
        <div class="chips">${ps.map(p => { const s = rsvpOf(e.id, p.id) || 'none'; return `<${can('captain') ? `button type="button" data-cycle="${e.id}:${p.id}"` : 'span'} class="chip st-${s}" title="${esc(s === 'none' ? t('no_answer') : t(s))}">${esc(p.name)}</${can('captain') ? 'button' : 'span'}>`; }).join('')}</div></article>`;
    }).join('') : empty()}</div>`;
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.past) { showPast = b.dataset.past === '1'; return events(el); }
    if (b.dataset.evtab) { evTab = b.dataset.evtab; return events(el); }
    if (b.dataset.rsvp) return setRsvp(+b.dataset.e, myPlayer(), b.dataset.rsvp);
    if (b.dataset.cycle) { const [eid, pid] = b.dataset.cycle.split(':').map(Number); const order = ['yes', 'maybe', 'no', null]; const cur = rsvpOf(eid, pid) || null; const nx = order[(order.indexOf(cur) + 1) % 4];
      return act(() => nx ? db.upsert('rsvps', { event_id: eid, player_id: pid, status: nx }) : db.remove('rsvps', { event_id: eid, player_id: pid }), ['rsvps'], false); }
    if (b.dataset.new !== undefined) return editEvent(null, evTab === 'training' ? 'Training' : 'Singles');
    if (b.dataset.eedit) return editEvent(D().events.find(x => x.id === +b.dataset.eedit));
    if (b.dataset.edel) { const ev = D().events.find(x => x.id === +b.dataset.edel);
      const later = ev.series_id ? D().events.filter(x => x.series_id === ev.series_id && x.id !== ev.id && x.starts_on >= ev.starts_on) : [];
      if (!later.length) { if (await confirmBox(ev.title)) act(() => db.remove('events', { id: ev.id }), ['events', 'rsvps']); return; }
      const r = await modal(t('delete'), `<p>${esc(ev.title)} · ${esc(fmtDate(ev.starts_on))}</p><label class="check"><input type="checkbox" name="all"> ${esc(t('ev_del_series', { n: later.length }))}</label>`, { submit: t('delete'), danger: true });
      if (r) act(async () => { for (const x of r.all ? [ev, ...later] : [ev]) await db.remove('events', { id: x.id }); }, ['events', 'rsvps']); }
  };
}
async function editEvent(ev, defKind = 'Singles') {
  const e = ev || { starts_on: today(), ends_on: today(), title: '', location: '', kind: defKind, note: '', team_size: 5, start_time: '' };
  const KINDS = [['Singles', t('type_singles_s')], ['Team Tournament', t('type_team')], ['Training', t('ev_training')], ['Training Match', t('ev_tmatch')]];
  // which fields belong to which kind
  const show = { size: ['Team Tournament', 'Training Match'], opp: ['Training Match'], time: ['Training', 'Training Match'], bcp: ['Singles', 'Team Tournament'], until: ['Training', 'Training Match'], end: ['Singles', 'Team Tournament'] };
  const vis = (k, kind) => show[k].includes(kind) ? '' : ' hidden';
  const r = await modal(ev ? ev.title : t('new_event'), `
    <div class="seg ev-kind" role="group" aria-label="${esc(t('kind'))}">${KINDS.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${e.kind === k}">${esc(l)}</button>`).join('')}</div>
    <input type="hidden" name="kind" value="${esc(e.kind)}">
    <p class="mute small" data-f="privnote"${isTraining(e) ? '' : ' hidden'}>🔒 ${esc(t('ev_private'))}</p>
    <label data-f="opp"${vis('opp', e.kind)}>${esc(t('ev_opp_team'))}<input name="opp_team" maxlength="80" value="${esc(e.opp_team || '')}"></label>
    <label>${esc(t('event'))}<input name="title" required maxlength="80" value="${esc(e.title)}"></label>
    <div class="grid2"><label>${esc(t('date_from'))}<input type="date" name="starts_on" required value="${esc(e.starts_on)}"></label>
    <label data-f="end"${vis('end', e.kind)}>${esc(t('date_to'))}<input type="date" name="ends_on" value="${esc(e.ends_on || e.starts_on)}"></label>
    <label data-f="time"${vis('time', e.kind)}>${esc(t('time'))}<input type="time" name="start_time" value="${esc(String(e.start_time || '').slice(0, 5))}"></label></div>
    ${ev ? '' : `<div data-f="until"${vis('until', e.kind)}><label class="check"><input type="checkbox" name="repeat"> ${esc(t('ev_weekly'))}</label>
      <label class="rep-until" hidden>${esc(t('ev_until'))}<input type="date" name="until"></label></div>`}
    <div class="grid2"><label>${esc(t('location'))}<input name="location" maxlength="60" value="${esc(e.location || '')}"></label>
    <label data-f="size"${vis('size', e.kind)}>${esc(t('team_size'))}<select name="team_size">${opts([3, 4, 5, 6, 8].map(n => [n, String(n)]), e.team_size || 5)}</select></label></div>
    <label>${esc(t('note'))}<input name="note" maxlength="200" value="${esc(e.note || '')}"></label>
    <label data-f="bcp"${vis('bcp', e.kind)}>${esc(t('ev_bcp'))}<input name="bcp_url" type="url" inputmode="url" maxlength="300" placeholder="https://www.bestcoastpairings.com/event/…" value="${esc(e.bcp_url || '')}"><small class="mute">${esc(t('ev_bcp_hint'))}</small></label>`, { onOpen: f => {
      const apply = kind => { f.kind.value = kind; $$('[data-kind]', f).forEach(y => y.setAttribute('aria-pressed', y.dataset.kind === kind));
        for (const k of Object.keys(show)) { const n = $(`[data-f="${k}"]`, f); if (n) n.hidden = !show[k].includes(kind); }
        $('[data-f="privnote"]', f).hidden = !(kind === 'Training' || kind === 'Training Match');
        if (!ev && (!f.title.value || f.title.dataset.auto)) { const tt = kind === 'Training' ? t('ev_training') : kind === 'Training Match' ? `${t('ev_tmatch')}${f.opp_team.value ? ' vs ' + f.opp_team.value : ''}` : ''; if (tt || f.title.dataset.auto) { f.title.value = tt; f.title.dataset.auto = tt ? '1' : ''; } } };
      f.addEventListener('click', x => { const b = x.target.closest('[data-kind]'); if (b) apply(b.dataset.kind); });
      f.title.addEventListener('input', () => { f.title.dataset.auto = ''; });
      f.opp_team.addEventListener('input', () => { if (f.title.dataset.auto) apply(f.kind.value); });
      f.starts_on.addEventListener('change', () => { if (!f.ends_on.value || f.ends_on.value < f.starts_on.value) f.ends_on.value = f.starts_on.value; f.ends_on.min = f.starts_on.value; });
      if (f.repeat) f.repeat.addEventListener('change', () => { $('.rep-until', f).hidden = !f.repeat.checked; if (f.repeat.checked && !f.until.value) { const d = new Date(f.starts_on.value); d.setDate(d.getDate() + 7 * 11); f.until.value = d.toISOString().slice(0, 10); } });
      f.ends_on.min = f.starts_on.value; if (!ev) apply(e.kind);
    } });
  if (!r) return;
  const kind = ['Singles', 'Team Tournament', 'Training', 'Training Match'].includes(r.kind) ? r.kind : 'Singles';
  const training = kind === 'Training' || kind === 'Training Match';
  const ends = training ? r.starts_on : (r.ends_on || r.starts_on);
  if (ends < r.starts_on) return toast(t('date_order'), true);
  const bcp = training ? '' : (r.bcp_url || '').trim();
  if (bcp && !BCP_RE.test(bcp)) return toast(t('bcp_invalid'), true);
  const row = { starts_on: r.starts_on, ends_on: ends, title: r.title.trim(), location: r.location.trim() || null, kind, note: r.note.trim() || null,
    team_size: kind === 'Team Tournament' || kind === 'Training Match' ? +r.team_size || 5 : null, bcp_url: bcp || null,
    start_time: training && r.start_time ? r.start_time : (training ? null : e.start_time || null), opp_team: kind === 'Training Match' ? (r.opp_team || '').trim() || null : null };
  if (ev) return act(() => db.update('events', { id: ev.id }, row), ['events']);
  // weekly series: one event per week up to the chosen date (max. 52)
  const dates = [r.starts_on];
  if (training && r.repeat && r.until && r.until > r.starts_on) { const d = new Date(r.starts_on + 'T12:00:00'); for (let n = 0; n < 51; n++) { d.setDate(d.getDate() + 7); const iso = d.toISOString().slice(0, 10); if (iso > r.until) break; dates.push(iso); } }
  const series = dates.length > 1 ? Math.random().toString(36).slice(2, 12) : null;
  await act(async () => { for (const d of dates) await db.insert('events', Object.assign({}, row, { starts_on: d, ends_on: d, series_id: series })); }, ['events'], dates.length > 1 ? t('ev_series_saved', { n: dates.length }) : undefined);
}

// ---------------------------------------------------------------- Calendar
let calMonth = null;
// Personal calendar subscription (Google, Apple, Outlook) via the secret feed address
const calUrl = () => state.me?.cal_token && CONFIG.SUPABASE_URL ? `${CONFIG.SUPABASE_URL}/functions/v1/calendar?t=${state.me.cal_token}` : '';
function calSubscribe() {
  const u = calUrl();
  if (!u) return `<div class="notice">${esc(t('cal_demo'))}</div>`;
  const webcal = u.replace(/^https:/, 'webcal:');
  return `<section class="card cal-sub"><h2>📅 ${esc(t('cal_sub_title'))}</h2><p class="mute">${esc(t('cal_sub_intro'))}</p>
    <div class="form-actions"><a class="btn primary" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener">${esc(t('cal_google'))}</a>
      <a class="btn ghost" href="${esc(webcal)}">${esc(t('cal_apple'))}</a><button type="button" class="btn ghost" data-calcopy>${esc(t('copy_link'))}</button></div>
    <p class="mute small">${esc(t('cal_sub_hint'))} <button type="button" class="link" data-calreset>${esc(t('cal_reset'))}</button></p></section>`;
}
export function calendar(el) {
  if (!calMonth) { const d = new Date(); calMonth = [d.getFullYear(), d.getMonth()]; }
  const [y, mo] = calMonth; const first = new Date(y, mo, 1); const startDow = (first.getDay() + 6) % 7; const days = new Date(y, mo + 1, 0).getDate();
  const iso = d => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const evs = (D().events || []);
  const lang = document.documentElement.lang === 'en' ? 'en-GB' : 'de-AT';
  const wd = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'short' }));
  let cells = ''; for (let i = 0; i < startDow; i++) cells += '<div class="cal-c blank"></div>';
  for (let d = 1; d <= days; d++) { const list = evs.filter(e => e.starts_on === iso(d)); cells += `<div class="cal-c${iso(d) === today() ? ' today' : ''}${list.length ? ' has' : ''}"><span class="cal-d">${d}</span>${list.map(e => `<a href="#/events" class="cal-ev" title="${esc(e.title)}">${esc(e.title)}</a>`).join('')}</div>`; }
  const monthEvents = evs.filter(e => e.starts_on.startsWith(`${y}-${String(mo + 1).padStart(2, '0')}`)).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  el.innerHTML = pageHead(t('nav_calendar'), t('cal_intro')) + calSubscribe() + `<div class="cal-head"><button class="btn ghost" data-m="-1" aria-label="${esc(t('prev'))}">‹</button><h2>${esc(first.toLocaleDateString(lang, { month: 'long', year: 'numeric' }))}</h2><button class="btn ghost" data-m="1" aria-label="${esc(t('next'))}">›</button><button class="btn ghost sm" data-m="0">${esc(t('today'))}</button></div>
    <div class="cal">${wd.map(w => `<div class="cal-w">${esc(w)}</div>`).join('')}${cells}</div>
    <ul class="list cal-list">${monthEvents.map(e => `<li><span><b>${esc(fmtDate(e.starts_on))}</b>${e.start_time && (e.kind === 'Training' || e.kind === 'Training Match') ? ' ' + esc(String(e.start_time).slice(0, 5)) : ''} ${esc(e.title)}<br><small class="mute">${esc(evKind(e))}</small></span><span class="mute">${esc(e.location || '')}</span></li>`).join('')}</ul>`;
  el.onclick = async e => {
    if (e.target.closest('[data-calcopy]')) { try { await navigator.clipboard.writeText(calUrl()); toast(t('copied')); } catch (_) { prompt(t('copy_link'), calUrl()); } return; }
    if (e.target.closest('[data-calreset]')) { if (!await confirmBox(t('cal_reset_q'))) return; try { const tok = await db.rpc('reset_cal_token'); if (state.me) state.me.cal_token = tok; toast(t('cal_reset_done')); calendar(el); } catch (err) { toast(t('error') + ': ' + err.message, true); } return; }
    const b = e.target.closest('[data-m]'); if (!b) return; const n = +b.dataset.m; if (!n) { const d = new Date(); calMonth = [d.getFullYear(), d.getMonth()]; } else { const d = new Date(calMonth[0], calMonth[1] + n, 1); calMonth = [d.getFullYear(), d.getMonth()]; } calendar(el); };
}

// ---------------------------------------------------------------- Line-up (Aufstellung)
let lineupEvent = null;
export function lineup(el) {
  const evs = (D().events || []).slice().sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (!lineupEvent || !evs.find(e => e.id === lineupEvent)) lineupEvent = (upcomingEvents().find(e => /team/i.test(e.title + ' ' + (e.note || ''))) || upcomingEvents()[0] || evs[evs.length - 1] || {}).id;
  const ev = evs.find(e => e.id === lineupEvent);
  let body = empty();
  if (ev) {
    const yes = players().filter(p => rsvpOf(ev.id, p.id) === 'yes'), maybe = players().filter(p => rsvpOf(ev.id, p.id) === 'maybe');
    const cov = [...new Set(yes.flatMap(p => (p.armies || []).map(a => a.army).filter(Boolean)))].sort();
    const done = yes.length >= ev.team_size;
    const tableOf = list => `<div class="scroll"><table class="stack"><thead><tr><th>${esc(t('player'))}</th>${[1, 2, 3, 4, 5].map(i => `<th>${esc(t('army'))} ${i}</th>`).join('')}</tr></thead><tbody>${list.map(p => `<tr><td><b>${esc(p.name)}</b></td>${[0, 1, 2, 3, 4].map(i => `<td>${esc(p.armies?.[i]?.army || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    body = `<div class="tiles"><div class="tile ${done ? 'good' : 'bad'}"><div class="tile-l">${esc(t('confirmed'))}</div><div class="tile-big num">${yes.length} / ${esc(ev.team_size)}</div><div class="tile-s">${esc(done ? t('complete') : t('missing', { n: ev.team_size - yes.length }))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('maybe'))}</div><div class="tile-big num">${maybe.length}</div><div class="tile-s">${esc(maybe.map(p => p.name).join(', '))}</div></div>
      <div class="tile"><div class="tile-l">${esc(t('army_coverage'))}</div><div class="tile-big num">${cov.length}</div><div class="tile-s">${esc(t('armies'))}</div></div></div>
      <section class="card"><h2>${esc(t('confirmed'))}</h2>${yes.length ? tableOf(yes) : empty()}</section>
      ${maybe.length ? `<section class="card"><h2>${esc(t('maybe'))}</h2>${tableOf(maybe)}</section>` : ''}
      <section class="card"><h2>${esc(t('army_coverage'))}</h2><div class="chips">${cov.map(a => `<span class="chip on">${esc(a)}</span>`).join('') || '–'}</div></section>`;
  }
  el.innerHTML = pageHead(t('nav_lineup'), t('lineup_intro')) + `<form class="filters card"><label>${esc(t('choose_event'))}<select id="lev">${opts(evs.map(e => [e.id, `${fmtDate(e.starts_on, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${e.title}`]), lineupEvent)}</select></label></form>` + body;
  $('#lev')?.addEventListener('change', e => { lineupEvent = +e.target.value; lineup(el); });
}

// ---------------------------------------------------------------- Cash (Kasse)
export function cash(el) {
  const admin = can('admin');
  const pays = (D().payments || []).filter(p => admin || p.player_id === myPlayer()).slice().sort((a, b) => (b.due_on || '').localeCompare(a.due_on || '') || b.id - a.id);
  const per = new Map();
  for (const p of pays) { const s = per.get(p.player_id) || { total: 0, paid: 0 }; s.total += +p.amount; if (p.paid) s.paid += +p.amount; per.set(p.player_id, s); }
  const sum = [...per.values()].reduce((a, s) => ({ total: a.total + s.total, paid: a.paid + s.paid }), { total: 0, paid: 0 });
  el.innerHTML = pageHead(admin ? t('nav_cash') : t('cash_own'), t('cash_intro'), admin ? `<button class="btn primary" data-new>${esc(t('new_payment'))}</button>` : '') +
    `<div class="tiles"><div class="tile"><div class="tile-l">${esc(t('total'))}</div><div class="tile-big num">${esc(money(sum.total))}</div></div><div class="tile good"><div class="tile-l">${esc(t('paid'))}</div><div class="tile-big num">${esc(money(sum.paid))}</div></div><div class="tile bad"><div class="tile-l">${esc(t('open'))}</div><div class="tile-big num">${esc(money(sum.total - sum.paid))}</div></div></div>
    <div class="cols wide-first"><section class="card">${pays.length ? `<div class="scroll"><table class="stack"><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('event'))}</th><th>${esc(t('player'))}</th><th class="r">${esc(t('amount'))}</th><th>${esc(t('paid'))}</th><th>${esc(t('paid_on'))}</th><th>${esc(t('note'))}</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
      ${pays.map(p => `<tr class="${p.paid ? 'paid' : 'open'}"><td class="nowrap">${esc(fmtDate(p.due_on))}</td><td>${esc(p.event_title || (D().events || []).find(e => e.id === p.event_id)?.title || '')}</td><td><b>${esc(pname(p.player_id))}</b></td><td class="r num">${esc(money(p.amount))}</td>
      <td>${admin ? `<input type="checkbox" data-paid="${p.id}" ${p.paid ? 'checked' : ''} aria-label="${esc(t('paid'))}">` : (p.paid ? '✓' : '–')}</td><td class="nowrap">${esc(fmtDate(p.paid_on))}</td><td><small>${esc(p.note || '')}</small></td>
      ${admin ? `<td class="r nowrap"><button class="icon" data-pedit="${p.id}" aria-label="${esc(t('edit'))}">✎</button><button class="icon" data-pdel="${p.id}" aria-label="${esc(t('delete'))}">🗑</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : empty()}</section>
    ${admin ? `<section class="card"><h2>${esc(t('per_player'))}</h2><table><thead><tr><th>${esc(t('player'))}</th><th class="r">${esc(t('total'))}</th><th class="r">${esc(t('paid'))}</th><th class="r">${esc(t('open'))}</th></tr></thead><tbody>
      ${[...per.entries()].sort((a, b) => pname(a[0]).localeCompare(pname(b[0]))).map(([pid, s]) => `<tr><td>${esc(pname(pid))}</td><td class="r num">${esc(money(s.total))}</td><td class="r num">${esc(money(s.paid))}</td><td class="r num ${s.total - s.paid > 0 ? 'down' : ''}">${esc(money(s.total - s.paid))}</td></tr>`).join('')}
      <tr class="sum"><td>${esc(t('sum'))}</td><td class="r num">${esc(money(sum.total))}</td><td class="r num">${esc(money(sum.paid))}</td><td class="r num">${esc(money(sum.total - sum.paid))}</td></tr></tbody></table></section>` : ''}</div>`;
  if (!admin) return;
  el.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.new !== undefined) return editPayment(null);
    if (b.dataset.pedit) return editPayment(pays.find(p => p.id === +b.dataset.pedit));
    if (b.dataset.pdel) { const p = pays.find(x => x.id === +b.dataset.pdel); if (await confirmBox(`${pname(p.player_id)} · ${money(p.amount)}`)) act(() => db.remove('payments', { id: p.id }), ['payments']); }
  };
  el.onchange = e => { const c = e.target.closest('[data-paid]'); if (c) act(() => db.update('payments', { id: +c.dataset.paid }, { paid: c.checked, paid_on: c.checked ? today() : null }), ['payments']); };
}
async function editPayment(p) {
  const x = p || { due_on: today(), event_id: '', event_title: '', player_id: '', amount: '', paid: false, paid_on: '', note: '' };
  const evs = (D().events || []).slice().sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  const r = await modal(p ? t('edit') : t('new_payment'), `<div class="grid2"><label>${esc(t('date'))}<input type="date" name="due_on" value="${esc(x.due_on || '')}"></label>
    <label>${esc(t('event'))}<select name="event_id">${opts(evs.map(e => [e.id, e.title]), x.event_id, '–')}</select></label>
    <label>${esc(t('player'))}<select name="player_id" required>${opts(players(true).map(q => [q.id, q.name]), x.player_id, '–')}</select></label>
    <label>${esc(t('amount'))} (€)<input type="number" step="0.01" min="0" name="amount" required value="${esc(x.amount)}"></label>
    <label class="check"><input type="checkbox" name="paid" ${x.paid ? 'checked' : ''}> ${esc(t('paid'))}</label>
    <label>${esc(t('paid_on'))}<input type="date" name="paid_on" value="${esc(x.paid_on || '')}"></label></div>
    <label>${esc(t('note'))}<input name="note" maxlength="120" value="${esc(x.note || '')}"></label>${p ? '' : `<label class="check"><input type="checkbox" name="all"> ${esc(t('all'))} ${esc(t('players'))}</label>`}`);
  if (!r) return;
  const ev = evs.find(e => e.id === +r.event_id);
  const base = { due_on: r.due_on || null, event_id: ev ? ev.id : null, event_title: ev ? ev.title : (x.event_title || null), amount: +r.amount, paid: !!r.paid, paid_on: r.paid_on || (r.paid ? today() : null), note: r.note.trim() || null };
  if (p) return act(() => db.update('payments', { id: p.id }, Object.assign(base, { player_id: +r.player_id })), ['payments']);
  const targets = r.all ? players().map(q => q.id) : [+r.player_id];
  await act(async () => { for (const pid of targets) await db.insert('payments', Object.assign({}, base, { player_id: pid })); }, ['payments']);
}

// ---------------------------------------------------------------- Whole tournament at once
async function tournamentImport() {
  const pid = myPlayer() || players()[0]?.id;
  const pl = playerById(pid); const mine = (pl?.armies || []).find(a => a.army) || {};
  const plOpts = players(true).map(p => [p.id, p.name]);
  const tours = [...new Set((D().matches || []).map(x => x.tournament).filter(Boolean))];
  const roundRow = (i, date) => `<div class="rnd" data-r="${i}"><span class="rnd-n">${esc(t('round'))} <b>${i + 1}</b></span>
    <select name="of" aria-label="${esc(t('opp_faction'))}" required>${opts(FACTIONS, '', t('opp_faction'))}</select>
    <select name="od" aria-label="${esc(t('opp_disp'))}">${opts(DISPOSITIONS, '', t('opp_disp'))}</select>
    <select name="op" aria-label="${esc(t('opp_player'))}">${opts(players().map(p => [p.id, p.name]), '', t('external'))}</select>
    <input name="on" maxlength="60" placeholder="${esc(t('opp_name'))}" aria-label="${esc(t('opp_name'))}">
    <input name="us" type="number" inputmode="numeric" min="0" max="200" placeholder="${esc(t('our_score'))}" aria-label="${esc(t('our_score'))}" required>
    <input name="them" type="number" inputmode="numeric" min="0" max="200" placeholder="${esc(t('opp_score'))}" aria-label="${esc(t('opp_score'))}" required>
    <input name="d" type="date" value="${esc(date)}" aria-label="${esc(t('date'))}">
    <span class="rnd-res"></span><button type="button" class="icon xs" data-rm aria-label="${esc(t('remove_round'))}">✕</button></div>`;
  const body = `<p class="mute">${esc(t('tour_import_intro'))}</p>
    <div class="grid3"><label>${esc(t('tour_name'))}<input name="tournament" required list="tours2" maxlength="80"><datalist id="tours2">${tours.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>${esc(t('type'))}<select name="type" required>${opts([['Tournament', t('type_singles')], ['Team Tournament', t('type_team')]], 'Tournament')}</select></label>
    <label>${esc(t('date'))}<input name="start" type="date" required value="${esc(today())}"></label>
    <label>${esc(t('our_player'))}<select name="player_id" required>${opts(plOpts, pid)}</select></label>
    <label>${esc(t('our_army'))}<select name="army" required>${opts([...new Set([...(pl?.armies || []).map(a => a.army).filter(Boolean), ...FACTIONS])], mine.army || '', '–')}</select></label>
    <label>${esc(t('our_disp'))}<select name="disposition">${opts(DISPOSITIONS, mine.d1 || '', '–')}</select></label></div>
    <div class="rounds">${[0, 1, 2, 3, 4].map(i => roundRow(i, today())).join('')}</div>
    <div class="form-actions"><button type="button" class="btn ghost sm" data-add-round>${esc(t('add_round'))}</button><span class="rnd-total mute"></span></div>`;
  let rows = null;
  const r = await modal(t('tour_import'), body, { wide: true, submit: t('save'), onOpen: f => {
    const upd = () => {
      const rs = $$('.rnd', f); let w = 0, d = 0, l = 0;
      rs.forEach((el, i) => { $('.rnd-n b', el).textContent = i + 1; const us = el.querySelector('[name=us]').value, them = el.querySelector('[name=them]').value;
        const res = outcome(f.type.value, us, them), g = gp(us, them);
        $('.rnd-res', el).innerHTML = res ? `${teamScored(f.type.value) ? `<b class="num">${scoreStr(g)}</b> ` : ''}${resultBadge(res)}` : '';
        if (res === 'win') w++; else if (res === 'loss') l++; else if (res) d++; });
      $('.rnd-total', f).textContent = `${w}-${d}-${l}`;
      $('footer .btn.primary', f.closest('.dialog') || f).textContent = t('save_rounds', { n: rs.length });
    };
    f.addEventListener('input', upd);
    f.addEventListener('change', e => {
      if (e.target.name === 'start') $$('.rnd [name=d]', f).forEach(x => { if (!x.dataset.touched) x.value = e.target.value; });
      if (e.target.name === 'd') e.target.dataset.touched = '1';
      if (e.target.name === 'player_id') { const p2 = playerById(e.target.value); const a = (p2?.armies || []).find(x => x.army); if (a) { f.army.value = a.army; if (a.d1) f.disposition.value = a.d1; } }
      upd();
    });
    f.addEventListener('click', e => {
      if (e.target.closest('[data-add-round]')) { const n = $$('.rnd', f).length; $('.rounds', f).insertAdjacentHTML('beforeend', roundRow(n, f.start.value)); upd(); }
      const rm = e.target.closest('[data-rm]'); if (rm && $$('.rnd', f).length > 1) { rm.closest('.rnd').remove(); upd(); }
    });
    // collect rounds when the form is submitted (modal only returns named single fields)
    f.addEventListener('submit', () => { rows = $$('.rnd', f).map(el => ({ of: el.querySelector('[name=of]').value, od: el.querySelector('[name=od]').value, on: el.querySelector('[name=on]').value.trim(), op: el.querySelector('[name=op]').value,
      us: el.querySelector('[name=us]').value, them: el.querySelector('[name=them]').value, d: el.querySelector('[name=d]').value })); }, true);
    upd();
  } });
  if (!r || !rows) return;
  const base = { type: r.type || 'Tournament', tournament: r.tournament.trim(), player_id: +r.player_id, army: r.army, disposition: r.disposition || null };
  const list = rows.map(x => Object.assign({}, base, { played_on: x.d || r.start, opp_faction: x.of, opp_disposition: x.od || null, opp_player_id: x.op ? +x.op : null,
    opp_name: x.op ? null : x.on || null, our_score: +x.us, opp_score: +x.them, notes: null }));
  // Rounds against team mates that are already in the log are linked instead of saved twice
  const fresh = [], linked = [];
  for (const m of list) { const mm = findMirror(m); if (mm) linked.push([mm, m]); else fresh.push(m); }
  await act(async () => {
    for (const m of fresh) await db.insert('matches', m);
    for (const [mm, m] of linked) if (mm.opp_player_id !== m.player_id) await linkGame(mm, m.player_id, m.disposition);
  }, ['matches'], linked.length ? t('rounds_saved_dup', { n: fresh.length, d: linked.length }) : t('rounds_saved', { n: fresh.length }));
}
