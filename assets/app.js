// App shell: public site + team area, authentication, routing, profile, members.
import { CONFIG } from './config.js?v=202611251803';
import { db, DEMO, resetDemo, demoRole, setDemoRole } from './db.js?v=202611251803';
import { t, setLang, getLang } from './i18n.js?v=202611251803';
import { state, role, can, esc, $, opts, players, pname, loadData, act, toast, pageHead } from './core.js?v=202611251803';
import * as T from './pages-team.js?v=202611251803';
import * as A from './pages-analysis.js?v=202611251803';
import * as P from './pages-public.js?v=202611251803';
import * as TE from './pages-teams.js?v=202611251803';
import { FACTIONS } from './data.js?v=202611251803';
import * as SITE from './pages-site.js?v=202611251803';
import * as N from './pages-news.js?v=202611251803';

// Public pages (top navigation)
const PUBLIC = [['home', 'p_home', P.home], ['news', 'p_news', N.list], ['team', 'p_team', P.team], ['results', 'p_results', P.results], ['upcoming', 'p_events', P.upcoming], ['apps', 'p_apps', P.apps]];
// Team area (needs an account); grouped for the sub-navigation
const PORTAL = [
  { group: null, items: [['portal', 'nav_home', 'guest', T.home]] },
  { group: 'nav_team', items: [['matches', 'nav_matches', 'team', T.matches], ['archive', 'nav_archive', 'team', T.archive], ['events', 'nav_events', 'team', T.events],
    ['teams', 'nav_teams', 'team', TE.teams], ['newsedit', 'nav_newsedit', 'team', N.editor], ['roster', 'nav_roster', 'team', T.roster]] },
  { group: 'nav_analysis', items: [['matrix', 'nav_matrix', 'team', A.matrix], ['stats', 'nav_stats', 'team', A.stats]] },
  { group: 'nav_admin', items: [['site', 'nav_site', 'captain', SITE.editor], ['members', 'nav_members', 'captain', members], ['profile', 'nav_profile', 'guest', profile]] },
];
const ROUTES = Object.fromEntries([
  ...PUBLIC.map(([k, label, fn]) => [k, { label, min: 'anon', fn, pub: true }]),
  ...PORTAL.flatMap(g => g.items).map(([k, label, min, fn]) => [k, { label, min, fn }]),
]);
// Official logo (mark + MONOLITH)
export const IG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
const igLink = cls => CONFIG.INSTAGRAM ? `<a class="${cls}" href="${esc(CONFIG.INSTAGRAM)}" target="_blank" rel="noopener" aria-label="Instagram">${IG_ICON}</a>` : '';
const BRAND = `<span class="lockup"><img src="assets/logo-mark.svg" alt="" width="130" height="250"><span class="wm">MONOLITH</span></span>`;

const route = () => { const h = location.hash.replace(/^#\/?/, '').split('?')[0]; return h || 'home'; };
const label = (k, l) => k === 'cash' && !can('admin') ? t('cash_own') : t(l);

function header() {
  const r = route(); const signed = !!state.session;
  const acct = !signed ? `<a class="btn primary sm" href="#/login">${esc(t('sign_in'))}</a>`
    : `<a class="btn ${ROUTES[r]?.pub ? 'primary' : 'dark'} sm" href="#/portal">${esc(can('team') ? t('portal') : t('my_account'))}</a>`;
  $('#top').innerHTML = `<div class="top-in"><a class="brand" href="#/home" aria-label="Monolith 40k">${BRAND}</a>
    <nav class="pubnav" aria-label="Main">${PUBLIC.map(([k, l]) => `<a href="#/${k}"${r === k ? ' aria-current="page"' : ''}>${esc(t(l))}</a>`).join('')}</nav>
    <div class="top-tools">${igLink('ig')}<div class="lang" role="group" aria-label="${esc(t('language'))}"><button type="button" data-lang="de" aria-pressed="${getLang() === 'de'}">DE</button><button type="button" data-lang="en" aria-pressed="${getLang() === 'en'}">EN</button></div>${acct}${signed ? `<button type="button" class="btn ghost sm out-top" data-out>${esc(t('sign_out'))}</button>` : ''}
    <button class="icon menu" id="menuBtn" aria-label="${esc(t('menu'))}" aria-expanded="false">☰</button></div></div>
    <nav class="mobnav" aria-label="Mobile">${PUBLIC.map(([k, l]) => `<a href="#/${k}">${esc(t(l))}</a>`).join('')}${CONFIG.INSTAGRAM ? `<a href="${esc(CONFIG.INSTAGRAM)}" target="_blank" rel="noopener">Instagram ↗</a>` : ''}${signed ? `<button type="button" class="mob-out" data-out>${esc(t('sign_out'))}</button>` : ''}<div class="lang mob" role="group" aria-label="${esc(t('language'))}"><button type="button" data-lang="de" aria-pressed="${getLang() === 'de'}">Deutsch</button><button type="button" data-lang="en" aria-pressed="${getLang() === 'en'}">English</button></div></nav>`;
  let fab = $('#fab');
  if (!fab) { fab = document.createElement('button'); fab.id = 'fab'; fab.className = 'fab'; fab.type = 'button'; document.body.appendChild(fab); fab.onclick = () => T.quickResult(); }
  fab.innerHTML = `<span aria-hidden="true">+</span> ${esc(t('quick_btn'))}`; fab.hidden = !(signed && can('team')) || r === 'login' || r.startsWith('live/');
  $('.foot-in').innerHTML = `<div>${BRAND}<p class="mute">${esc(t('footer_text'))}</p></div>
    <nav aria-label="Footer">${PUBLIC.slice(1).map(([k, l]) => `<a href="#/${k}">${esc(t(l))}</a>`).join('')}<a href="#/portal">${esc(t('portal'))}</a>${CONFIG.INSTAGRAM ? `<a href="${esc(CONFIG.INSTAGRAM)}" target="_blank" rel="noopener" class="ig-text">${IG_ICON} Instagram</a>` : ''}</nav>
    <p class="small mute">© ${new Date().getFullYear()} Monolith 40k · ${esc(t('footer_note'))}</p>`;
}
function subnav() {
  const r = route(); const el = $('#sub');
  if (ROUTES[r]?.pub || r === 'login' || r.startsWith('live/') || r.startsWith('news/') || !state.session) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  const items = PORTAL.flatMap(g => g.items.filter(([, , min]) => can(min)).map((it, i) => ({ it, first: i === 0 && g.group })));
  el.innerHTML = `<div class="sub-in"><nav class="subnav scroll" aria-label="${esc(t('portal'))}">${items.map(({ it: [k, l], first }) => `${first ? '<span class="sep" aria-hidden="true"></span>' : ''}<a href="#/${k}"${r === k ? ' aria-current="page"' : ''}>${esc(label(k, l))}${k === 'members' && pendingList().length ? ` <span class="badge">${pendingList().length}</span>` : ''}</a>`).join('')}</nav>
    <div class="who"><span>${esc(state.me?.display_name || '')}</span><span class="tag role-${esc(role())}">${esc(t('r_' + role()))}</span>${DEMO ? '' : `<button class="link" data-out>${esc(t('sign_out'))}</button>`}</div></div>
    ${DEMO ? `<div class="demo"><b>${esc(t('demo'))}</b> · ${esc(t('demo_as'))} <select id="demoRole" aria-label="${esc(t('demo_as'))}">${opts(['guest', 'team', 'captain', 'admin'].map(x => [x, t('r_' + x)]), demoRole())}</select><button class="link" data-reset>${esc(t('demo_reset'))}</button></div>` : ''}`;
  const cur = $('[aria-current]', el); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
}

export function render() {
  header(); subnav(); pendingPopup();
  document.body.classList.remove('nav-open');
  const el = $('#view'); el.onclick = null; el.onchange = null;
  const r = route();
  document.body.dataset.area = ROUTES[r]?.pub || r === 'login' ? 'public' : 'portal';
  if (r === 'quick') { location.replace('#/portal'); if (can('team')) setTimeout(() => T.quickResult(), 50); return; }
  if (r === 'login') {
    if (!state.session) return login(el);
    // Back to an app (e.g. the collection tracker) that sent the user here to sign in
    let back = null; try { back = sessionStorage.getItem('monolith.return'); sessionStorage.removeItem('monolith.return'); } catch (e) {}
    if (back && back.startsWith('apps/')) { location.href = back; return; }
    return (location.hash = '#/portal');
  }
  if (r.startsWith('news/')) { document.body.dataset.area = 'public'; return N.article(el, r.slice(5)); }
  if (r.startsWith('live/')) { document.body.dataset.area = 'public'; document.title = `${t('live_title')} · ${CONFIG.TEAM_NAME || 'Monolith'}`; return TE.live(el, r.slice(5)); }
  const R = ROUTES[r];
  if (!R) { location.hash = '#/home'; return; }
  if (R.min !== 'anon' && !state.session) return login(el);
  if (R.min !== 'anon' && !can(R.min)) { el.innerHTML = pageHead(t(R.label), '') + `<div class="notice">${esc(t('no_access'))}</div>`; return; }
  try { R.fn(el); } catch (e) { console.error(e); el.innerHTML = `<div class="notice bad">${esc(t('error'))}: ${esc(e.message)}</div>`; }
  document.title = r === 'home' ? (CONFIG.TEAM_NAME || 'Monolith 40k') : `${t(R.label)} · ${CONFIG.TEAM_NAME || 'Monolith'}`;
}
state.render = render;

// ---------------------------------------------------------------- Auth
let authMode = 'in', authMsg = '';
function login(el) {
  const up = authMode === 'up';
  el.innerHTML = `<div class="auth"><form class="card form" id="auth" novalidate><h1>${esc(authMode === 'reset' ? t('forgot') : up ? t('sign_up') : t('sign_in'))}</h1><p class="mute">${esc(t('login_sub'))}</p>
      ${up ? `<label>${esc(t('display_name'))}<input name="name" required maxlength="40" autocomplete="nickname"></label>` : ''}
      <label>${esc(t('email'))}<input name="email" type="email" required autocomplete="email"></label>
      ${authMode !== 'reset' ? `<label>${esc(t('password'))}<input name="password" type="password" required minlength="8" autocomplete="${up ? 'new-password' : 'current-password'}"></label>` : ''}
      <button class="btn primary block">${esc(authMode === 'reset' ? t('forgot') : up ? t('sign_up') : t('sign_in'))}</button>
      ${CONFIG.GOOGLE_LOGIN && authMode !== 'reset' ? `<button type="button" class="btn ghost block" data-google>${esc(t('google'))}</button>` : ''}
      ${authMsg ? `<p class="notice" role="status">${esc(authMsg)}</p>` : ''}
      <p class="auth-links"><button type="button" class="link" data-mode="${up ? 'in' : 'up'}">${esc(up ? t('have_account') : t('no_account'))}</button>${!up && authMode !== 'reset' ? `<button type="button" class="link" data-mode="reset">${esc(t('forgot'))}</button>` : ''}${authMode === 'reset' ? `<button type="button" class="link" data-mode="in">${esc(t('sign_in'))}</button>` : ''}</p></form></div>`;
  const f = $('#auth');
  f.addEventListener('submit', async e => {
    e.preventDefault(); if (!f.reportValidity()) return; authMsg = '';
    try {
      if (authMode === 'reset') { await db.reset(f.email.value.trim()); authMsg = t('reset_sent'); }
      else if (up) { const confirm = await db.signUp(f.email.value.trim(), f.password.value, f.name.value.trim()); if (confirm) authMsg = t('check_mail'); }
      else await db.signIn(f.email.value.trim(), f.password.value);
    } catch (err) { authMsg = t('error') + ': ' + err.message; }
    render();
  });
  el.onclick = e => { const m = e.target.closest('[data-mode]'); if (m) { authMode = m.dataset.mode; authMsg = ''; login(el); } if (e.target.closest('[data-google]')) db.google().catch(err => toast(err.message, true)); };
}

// ---------------------------------------------------------------- Profile
function profile(el) {
  const me = state.me || {};
  el.innerHTML = pageHead(t('nav_profile'), '') + `<div class="cols"><form class="card form" id="pf"><h2>${esc(t('account'))}</h2>
      <label>${esc(t('display_name'))}<input name="display_name" required maxlength="40" value="${esc(me.display_name || '')}"></label>
      <label>${esc(t('language'))}<select name="lang">${opts([['de', 'Deutsch'], ['en', 'English']], me.lang || getLang())}</select></label>
      <p class="mute">${esc(t('role'))}: <b>${esc(t('r_' + role()))}</b> · ${esc(t('linked_player'))}: <b>${esc(me.player_id ? pname(me.player_id) : t('none_linked'))}</b></p>
      <div class="form-actions"><button class="btn primary">${esc(t('save'))}</button>${DEMO ? '' : `<button type="button" class="btn ghost" data-out>${esc(t('sign_out'))}</button>`}</div></form>
    ${me.player_id && can('team') ? (() => { const pl = (state.data.players || []).find(x => x.id === me.player_id) || { name: pname(me.player_id) }; return `<form class="card form" id="bio"><h2>${esc(t('my_profile'))}</h2>
      <p class="mute small">${esc(t('my_profile_hint'))}</p>
      <div class="photo-edit">${T.avatar(pl, 'lg')}<div><p class="mute small">${esc(t('photo_hint'))}</p><button type="button" class="btn ghost sm" data-myphoto="${me.player_id}">${esc(t('photo_pick'))}</button></div></div>
      <label>${esc(t('fav_army'))}<select name="fav_army">${opts(FACTIONS, pl.fav_army || '', '–')}</select></label>
      <label>${esc(t('bio'))}<textarea name="bio" rows="4" maxlength="600" placeholder="${esc(t('bio_ph'))}">${esc(pl.bio || '')}</textarea><small class="mute"><span data-bioc>${(pl.bio || '').length}</span>/600</small></label>
      <div class="form-actions"><button class="btn primary">${esc(t('save'))}</button><a class="btn ghost" href="#/team">${esc(t('site_view'))}</a></div></form>`; })() : ''}
    ${DEMO ? '' : `<form class="card form" id="pw"><h2>${esc(t('password'))}</h2><label>${esc(t('new_password'))}<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><div class="form-actions"><button class="btn primary">${esc(t('save_password'))}</button></div></form>`}</div>`;
  $('#pf').addEventListener('submit', async e => { e.preventDefault(); const f = e.target; if (!f.reportValidity()) return;
    const patch = { display_name: f.display_name.value.trim(), lang: f.lang.value };
    if (await act(() => db.update('profiles', { id: me.id }, patch), null)) { Object.assign(state.me, patch); setLang(patch.lang); try { localStorage.setItem('monolith.lang', patch.lang); } catch (_) {} render(); } });
  el.onclick = e => { const b = e.target.closest('[data-myphoto]'); if (b) T.changePhoto(+b.dataset.myphoto); };
  const bio = $('#bio'); if (bio) {
    bio.bio.addEventListener('input', () => { $('[data-bioc]', bio).textContent = bio.bio.value.length; });
    bio.addEventListener('submit', async e => { e.preventDefault();
      await act(() => db.update('players', { id: me.player_id }, { fav_army: bio.fav_army.value || null, bio: bio.bio.value.trim() || null }), ['players'], t('profile_saved')); }); }
  const pw = $('#pw'); if (pw) pw.addEventListener('submit', async e => { e.preventDefault(); if (!pw.reportValidity()) return; await act(() => db.setPassword(pw.password.value), null); pw.reset(); });
}

// ---------------------------------------------------------------- Members
async function members(el) {
  el.innerHTML = pageHead(t('nav_members'), t('members_intro')) + `<p class="mute">${esc(t('loading'))}</p>`;
  let list = [];
  try { list = await db.list('profiles', ['created_at', 'desc']); } catch (e) { el.innerHTML += `<div class="notice bad">${esc(e.message)}</div>`; return; }
  if (location.hash !== '#/members') return;
  const admin = can('admin');
  list.sort((a, b) => (a.role === 'guest' ? 0 : 1) - (b.role === 'guest' ? 0 : 1) || (b.created_at || '').localeCompare(a.created_at || ''));
  el.innerHTML = pageHead(t('nav_members'), t('members_intro')) + `<section class="card"><div class="scroll"><table class="stack"><thead><tr><th>${esc(t('display_name'))}</th><th>${esc(t('role'))}</th><th>${esc(t('linked_player'))}</th><th>${esc(t('joined'))}</th></tr></thead><tbody>
    ${list.map(p => `<tr${p.role === 'guest' && !p.reviewed_at ? ' class="pending"' : ''}><td><b>${esc(p.display_name || '')}</b>${p.role === 'guest' && !p.reviewed_at ? ` <span class="tag warn-tag">${esc(t('waiting'))}</span>${admin ? `<span class="pend-btns"><button type="button" class="btn primary xs" data-approve="${esc(p.id)}">${esc(t('pend_approve'))}</button><button type="button" class="btn ghost xs" data-keepguest="${esc(p.id)}">${esc(t('pend_keep'))}</button></span>` : ''}` : ''}${state.me && p.id === state.me.id ? ' <span class="tag">★</span>' : ''}</td>
      <td>${admin && p.id !== state.me?.id ? `<select data-role="${esc(p.id)}" aria-label="${esc(t('role'))}">${opts(['guest', 'team', 'captain', 'admin'].map(r => [r, t('r_' + r)]), p.role)}</select>` : `<span class="tag role-${esc(p.role)}">${esc(t('r_' + p.role))}</span>`}</td>
      <td>${admin ? `<select data-link="${esc(p.id)}" aria-label="${esc(t('linked_player'))}">${opts(players(true).map(q => [q.id, q.name]), p.player_id, t('none_linked'))}</select>` : esc(p.player_id ? pname(p.player_id) : '–')}</td>
      <td class="nowrap">${esc((p.created_at || '').slice(0, 10))}</td></tr>`).join('')}</tbody></table></div></section>`;
  el.onclick = async e => {
    const ap = e.target.closest('[data-approve]'), kg = e.target.closest('[data-keepguest]');
    if (ap) { if (await act(() => db.update('profiles', { id: ap.dataset.approve }, { role: 'team', reviewed_at: new Date().toISOString() }), null, t('pend_approved'))) { await loadPending(); render(); } }
    if (kg) { if (await act(() => db.update('profiles', { id: kg.dataset.keepguest }, { reviewed_at: new Date().toISOString() }), null, t('pend_kept'))) { await loadPending(); render(); } }
  };
  el.onchange = async e => {
    const r = e.target.closest('[data-role]'), l = e.target.closest('[data-link]');
    if (r) { await act(() => db.update('profiles', { id: r.dataset.role }, { role: r.value, reviewed_at: new Date().toISOString() }), null); await loadPending(); render(); }
    if (l) await act(() => db.update('profiles', { id: l.dataset.link }, { player_id: l.value ? +l.value : null }), null);
  };
}

// ---------------------------------------------------------------- Boot
async function loadPublic() {
  const [players, results, events, news, siteRows] = await Promise.all([...['public_players', 'public_results', 'public_events'].map(n => db.rpc(n).catch(() => [])),
    db.list('news', ['created_at', 'desc']).catch(() => []), db.list('site_content').catch(() => [])]);
  const site = Object.fromEntries((siteRows || []).map(r => [r.key, r.value]));
  state.pub = { players, results, events, news: news.filter(n => n.published), site };
}
state.reloadPublic = loadPublic;
async function refreshMe() {
  if (!state.session) { state.me = null; return; }
  try { state.me = await db.me(state.session.user.id); } catch (e) { state.me = null; }
  if (DEMO && state.me) state.me.role = demoRole();
  if (state.me && state.me.lang) { setLang(state.me.lang); try { localStorage.setItem('monolith.lang', state.me.lang); } catch (_) {} }
  await loadPending();
}
// ---------------------------------------------------------------- New sign-ups waiting for an admin
const pendingList = () => (can('admin') && state.pending) || [];
async function loadPending() {
  if (!can('admin')) { state.pending = []; return; }
  try { state.pending = (await db.list('profiles', ['created_at', 'desc'])).filter(p => p.role === 'guest' && !p.reviewed_at && p.id !== state.me?.id); } catch (e) { state.pending = []; }
}
function pendingPopup() {
  let box = $('#pending');
  const list = pendingList(); const r = route();
  let hidden = false; try { hidden = sessionStorage.getItem('monolith.pendingSeen') === list.map(p => p.id).join(','); } catch (_) {}
  if (!list.length || hidden || r === 'members' || r === 'login' || r.startsWith('live/')) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('aside'); box.id = 'pending'; box.className = 'pending-pop'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  box.innerHTML = `<div><b>🔔 ${esc(t(list.length === 1 ? 'pend_one' : 'pend_many', { n: list.length }))}</b><p class="mute small">${list.slice(0, 3).map(p => esc(p.display_name || '?')).join(', ')}${list.length > 3 ? ' …' : ''}</p></div>
    <div class="pp-actions"><a class="btn primary sm" href="#/members">${esc(t('pend_open'))}</a><button type="button" class="btn ghost sm" data-pendlater>${esc(t('pend_later'))}</button></div>`;
  box.onclick = e => { if (e.target.closest('[data-pendlater]')) { try { sessionStorage.setItem('monolith.pendingSeen', list.map(p => p.id).join(',')); } catch (_) {} box.remove(); } };
}
setInterval(async () => { if (can('admin') && !document.hidden) { const before = pendingList().length; await loadPending(); if (pendingList().length !== before) render(); } }, 60000);
async function boot() {
  let saved = null; try { saved = localStorage.getItem('monolith.lang'); } catch (e) {}
  setLang(saved || CONFIG.DEFAULT_LANG || (navigator.language || 'de').slice(0, 2));
  $('#view').innerHTML = `<p class="mute">${esc(t('loading'))}</p>`;
  try { state.session = await db.session(); } catch (e) { state.session = null; }
  await Promise.all([refreshMe(), loadPublic()]);
  if (can('team')) await loadData(); else if (state.session) await loadData(['players']).catch(() => {});
  render();
  db.onAuth(async (ev, session) => {
    if (ev === 'TOKEN_REFRESHED' || ev === 'INITIAL_SESSION') { state.session = session; return; }
    if (ev === 'PASSWORD_RECOVERY') { state.session = session; location.hash = '#/profile'; }
    state.session = session; await refreshMe(); if (can('team')) await loadData(); render();
  });
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
// Phone tables: label each cell with its column header
new MutationObserver(() => { for (const td of document.querySelectorAll('table.stack td:not([data-l])')) { const tb = td.closest('table'); const th = tb.tHead && tb.tHead.rows[0] && tb.tHead.rows[0].cells[td.cellIndex]; td.dataset.l = th ? th.textContent : ''; } })
  .observe(document.getElementById('view'), { childList: true, subtree: true });
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.lang) { setLang(b.dataset.lang); try { localStorage.setItem('monolith.lang', b.dataset.lang); } catch (_) {} if (state.me) { state.me.lang = b.dataset.lang; db.update('profiles', { id: state.me.id }, { lang: b.dataset.lang }).catch(() => {}); } render(); }
  if (b.dataset.out !== undefined) { document.body.classList.remove('nav-open');
    db.signOut().then(() => { state.session = null; state.me = null; state.data = {}; location.hash = '#/home'; render(); toast(t('signed_out')); }); }
  if (b.dataset.reset !== undefined) resetDemo();
  if (b.id === 'menuBtn') { const o = document.body.classList.toggle('nav-open'); b.setAttribute('aria-expanded', o); }
});
document.addEventListener('change', async e => { if (e.target.id === 'demoRole') { setDemoRole(e.target.value); await refreshMe(); await loadData(); render(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - state.loadedAt > 60000) Promise.all([loadPublic(), can('team') ? loadData() : null]).then(render); });
boot();
