// News: public blog pages and the editor for members (Team role and above).
import { db } from './db.js?v=202611261656';
import { t } from './i18n.js?v=202611261656';
import { state, can, isContent, esc, $, $$, fmtDate, act, confirmBox, empty, pageHead, toast, resizeImage, safeImg, myPlayer, playerById } from './core.js?v=202611261656';

const D = () => state.data;
const PUBN = () => (state.pub && state.pub.news) || [];
const uid = () => state.session && state.session.user.id;
const canEdit = n => can('captain') || isContent() || (can('team') && n.author_id === uid());
const longDate = d => fmtDate(String(d).slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' });

// ---------- Small, safe text formatting (everything is escaped first)
//   # Heading   ## Subheading   **bold**   *italic*   [Text](https://…)   - list   ![](picture)
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)"<>]+)\)/g, (m, txt, url) => `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`);
}
export function md(src) {
  const lines = esc(src || '').replace(/\r/g, '').split('\n');
  const out = []; let para = [], list = [];
  const flushP = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  const flushL = () => { if (list.length) out.push(`<ul>${list.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`); list = []; };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const img = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) { flushP(); flushL(); const u = safeImg(img[2].replace(/&amp;/g, '&')); if (u) out.push(`<figure><img src="${esc(u)}" alt="${img[1]}" loading="lazy"></figure>`); continue; }
    if (/^## /.test(l)) { flushP(); flushL(); out.push(`<h3>${inline(l.slice(3))}</h3>`); continue; }
    if (/^# /.test(l)) { flushP(); flushL(); out.push(`<h2>${inline(l.slice(2))}</h2>`); continue; }
    if (/^[-*] /.test(l)) { flushP(); list.push(l.slice(2)); continue; }
    if (!l.trim()) { flushP(); flushL(); continue; }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  return out.join('');
}
const plain = s => (s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^\s*(#{1,6}|[-*])\s+/gm, '').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\s+/g, ' ').trim();
const excerpt = s => { const p = plain(s); return p.length > 180 ? p.slice(0, 177).replace(/\s\S*$/, '') + ' …' : p; };
const cover = (n, cls) => safeImg(n.cover_url) ? `<img class="${cls}" src="${esc(safeImg(n.cover_url))}" alt="" loading="lazy">` : '';
const byline = n => `${esc(longDate(n.created_at))}${n.author_name ? ' · ' + esc(n.author_name) : ''}`;

const firstImg = n => safeImg(n.cover_url) || (n.images || []).map(safeImg).find(Boolean) || '';
export const newsCard = n => `<a class="ncard" href="#/news/${n.id}">${firstImg(n) ? `<img class="ncard-img" src="${esc(firstImg(n))}" alt="" loading="lazy">` : ''}<div class="ncard-b"><p class="mute small"><span class="cat cat-${catKey(n.category)}">${esc(catLabel(n.category || 'News'))}</span> ${byline(n)}</p><h3>${esc(n.title)}</h3><p>${esc(excerpt(n.body))}</p></div></a>`;

// ---------- Public
const catKey = c => ({ 'Tournament Recap': 'recap', Advertisement: 'ad', Member: 'member' }[c] || 'news');
let catSel = '';
export function list(el) {
  const all = PUBN(); const items = catSel ? all.filter(n => (n.category || 'News') === catSel) : all;
  const used = CATS.filter(c => all.some(n => (n.category || 'News') === c));
  el.innerHTML = pageHead(t('p_news'), t('news_intro'), can('news') ? `<a class="btn ghost" href="#/newsedit">${esc(t('news_write'))}</a>` : '') +
    (used.length > 1 ? `<div class="chips cat-filter" role="group" aria-label="${esc(t('news_category'))}"><button type="button" class="chip${catSel ? '' : ' on'}" data-cf="">${esc(t('all'))}</button>${used.map(c => `<button type="button" class="chip${catSel === c ? ' on' : ''}" data-cf="${c}">${esc(catLabel(c))}</button>`).join('')}</div>` : '') +
    (items.length ? `<div class="ngrid">${items.map(newsCard).join('')}</div>` : empty(t('news_none')));
  el.onclick = e => { const b = e.target.closest('[data-cf]'); if (b) { catSel = b.dataset.cf; list(el); } };
}
export function article(el, id) {
  const n = PUBN().find(x => String(x.id) === String(id)) || (D() && (D().news || []).find(x => String(x.id) === String(id)));
  if (!n) { el.innerHTML = `<p><a href="#/news">${esc(t('news_back'))}</a></p>` + empty(t('news_nf')); return; }
  document.title = n.title;
  el.innerHTML = `<article class="post"><p><a class="mute" href="#/news">${esc(t('news_back'))}</a></p>
    <p class="cat-line"><span class="cat cat-${catKey(n.category)}">${esc(catLabel(n.category || 'News'))}</span>${(n.tournaments || []).map(x => ` <a class="chip" href="#/gallery" data-gt="${esc(x)}">🏆 ${esc(x)}</a>`).join('')}</p>
    <h1>${esc(n.title)}</h1><p class="mute">${byline(n)}${n.published ? '' : ` · <span class="tag">${esc(t('news_draft'))}</span>`}</p>
    ${cover(n, 'post-cover')}<div class="post-body">${md(n.body)}</div>
    ${(n.images || []).filter(safeImg).length ? `<div class="pgal">${n.images.filter(safeImg).map((u, i) => `<button type="button" class="pgal-i" data-lb="${i}" aria-label="${esc(t('news_image'))} ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    ${canEdit(n) ? `<p><a class="btn ghost sm" href="#/newsedit" data-goedit="${n.id}">${esc(t('edit'))}</a></p>` : ''}</article>`;
  el.onclick = e => { const g = e.target.closest('[data-goedit]'); if (g) editing = +g.dataset.goedit;
    const lb = e.target.closest('[data-lb]'); if (lb) lightbox(n.images.filter(safeImg), +lb.dataset.lb);
    const gt = e.target.closest('[data-gt]'); if (gt) galSel = gt.dataset.gt; };
}

// ---------- Editor (portal)
let editing = null; // null = list, 'new' or an article id
let draft = null;
export function editor(el) {
  if (editing != null) return form(el);
  const items = (D().news || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  el.innerHTML = pageHead(t('nav_newsedit'), t('news_edit_intro'), `<button class="btn primary" data-new>${esc(t('news_new'))}</button>`) +
    `<section class="card">${items.length ? `<ul class="list">${items.map(n => `<li><span>${safeImg(n.cover_url) ? `<img class="nthumb" src="${esc(safeImg(n.cover_url))}" alt="">` : ''}<span><b>${esc(n.title)}</b> ${n.published ? '' : `<span class="tag">${esc(t('news_draft'))}</span>`}<br><small class="mute">${byline(n)}</small></span></span>
      <span class="nowrap"><a class="icon" href="#/news/${n.id}" aria-label="${esc(t('news_view'))}">👁</a>${canEdit(n) ? `<button class="icon" data-edit="${n.id}" aria-label="${esc(t('edit'))}">✎</button><button class="icon" data-del="${n.id}" aria-label="${esc(t('delete'))}">🗑</button>` : ''}</span></li>`).join('')}</ul>` : empty(t('news_none'))}</section>`;
  el.onclick = async e => {
    if (e.target.closest('[data-new]')) { editing = 'new'; draft = null; return state.render(); }
    const ed = e.target.closest('[data-edit]'); if (ed) { editing = +ed.dataset.edit; draft = null; return state.render(); }
    const del = e.target.closest('[data-del]');
    if (del) { const n = D().news.find(x => x.id === +del.dataset.del); if (n && await confirmBox(n.title)) await act(() => db.remove('news', { id: n.id }), ['news']); }
  };
}
function authorName() {
  const p = playerById(myPlayer()); return p ? p.name : (state.me && state.me.display_name) || '';
}
export const CATS = ['News', 'Advertisement', 'Tournament Recap', 'Member'];
export const catLabel = c => t({ News: 'cat_news', Advertisement: 'cat_ad', 'Tournament Recap': 'cat_recap', Member: 'cat_member' }[c] || 'cat_news');
// Known tournaments: from the match log and the events list, newest first
function knownTours() {
  const m = new Map();
  for (const x of D().matches || []) if (x.tournament && x.type !== 'Practice') { const d = m.get(x.tournament); if (!d || x.played_on > d) m.set(x.tournament, x.played_on); }
  for (const e of D().events || []) if (e.title && !m.has(e.title)) m.set(e.title, e.starts_on);
  for (const r of (state.pub && state.pub.results) || []) if (r.tournament && !m.has(r.tournament)) m.set(r.tournament, r.date_to);
  for (const e of (state.pub && state.pub.events) || []) if (e.title && !m.has(e.title)) m.set(e.title, e.starts_on);
  return [...m.entries()].sort((a, b) => String(b[1]).localeCompare(String(a[1]))).map(x => x[0]);
}
function tourPicker() {
  const all = [...new Set([...draft.tournaments, ...knownTours()])];
  return `<div class="tpick"><span class="lbl">${esc(t('news_tours'))}</span><p class="mute small">${esc(t('news_tours_hint'))}</p>
    <div class="tlist">${all.map(x => `<label class="tchk"><input type="checkbox" data-tour value="${esc(x)}"${draft.tournaments.includes(x) ? ' checked' : ''}> ${esc(x)}</label>`).join('')}</div>
    <div class="tnew"><input data-tnew maxlength="80" placeholder="${esc(t('news_tour_other'))}"><button type="button" class="btn ghost sm" data-tadd>+ ${esc(t('add'))}</button></div></div>`;
}
const TOOLS = [['b', 'B', 'news_t_bold'], ['i', 'I', 'news_t_italic'], ['h', 'H', 'news_t_head'], ['l', '•', 'news_t_list'], ['a', '🔗', 'news_t_link'], ['img', '🖼', 'news_t_img']];
function form(el) {
  const n = editing === 'new' ? null : (D().news || []).find(x => x.id === editing);
  if (editing !== 'new' && (!n || !canEdit(n))) { editing = null; return editor(el); }
  if (!draft) draft = { title: n ? n.title : '', body: n ? n.body : '', cover_url: n ? n.cover_url : null, published: n ? n.published : true, category: n?.category || 'News', images: (n?.images || []).slice(), tournaments: (n?.tournaments || []).slice() };
  el.innerHTML = pageHead(n ? t('news_edit') : t('news_new'), '') + `<form class="card form neditor" id="nf" novalidate>
    <label>${esc(t('news_title'))}<input name="title" required maxlength="160" value="${esc(draft.title)}"></label>
    <div><span class="lbl">${esc(t('news_category'))}</span><div class="seg cat-seg" role="group" aria-label="${esc(t('news_category'))}">${CATS.map(c => `<button type="button" data-cat="${c}" aria-pressed="${draft.category === c}">${esc(catLabel(c))}</button>`).join('')}</div></div>
    ${draft.category === 'Tournament Recap' ? tourPicker() : ''}
    <div class="ncover"><span class="lbl">${esc(t('news_cover'))}</span>${safeImg(draft.cover_url) ? `<img src="${esc(safeImg(draft.cover_url))}" alt="">` : ''}
      <label class="btn ghost sm file">${esc(draft.cover_url ? t('news_cover_change') : t('news_cover_add'))}<input type="file" accept="image/*" data-cover hidden></label>
      ${draft.cover_url ? `<button type="button" class="btn ghost sm" data-nocover>${esc(t('remove'))}</button>` : ''}</div>
    <div class="ntools" role="toolbar" aria-label="${esc(t('news_format'))}">${TOOLS.map(([k, s, l]) => `<button type="button" class="tool" data-tool="${k}" title="${esc(t(l))}" aria-label="${esc(t(l))}">${s}</button>`).join('')}
      <input type="file" accept="image/*" data-bodyimg hidden></div>
    <div class="nsplit"><label class="ntext">${esc(t('news_text'))}<textarea name="body" rows="16" maxlength="40000">${esc(draft.body)}</textarea></label>
      <div class="npreview"><span class="lbl">${esc(t('news_preview'))}</span><div class="post-body" id="npv">${md(draft.body)}</div></div></div>
    <p class="mute small">${esc(t('news_help'))}</p>
    <div class="nimgs"><span class="lbl">${esc(t('news_images'))} <span class="mute small">(${draft.images.length})</span></span>
      <p class="mute small">${esc(draft.category === 'Tournament Recap' ? t('news_images_hint_recap') : t('news_images_hint'))}</p>
      <div class="gphotos">${draft.images.map((u, i) => `<figure><img src="${esc(safeImg(u))}" alt="${esc(t('news_image'))} ${i + 1}"><figcaption>
        <button type="button" class="icon xs" data-imv="${i}:-1" aria-label="${esc(t('move_left'))}"${i ? '' : ' disabled'}>←</button>
        <button type="button" class="icon xs" data-imv="${i}:1" aria-label="${esc(t('move_right'))}"${i < draft.images.length - 1 ? '' : ' disabled'}>→</button>
        <button type="button" class="icon xs" data-irm="${i}" aria-label="${esc(t('delete'))}">🗑</button></figcaption></figure>`).join('')}
        <label class="gadd"><input type="file" accept="image/*" multiple data-imgs hidden><span>+</span>${esc(t('photos_add'))}</label></div></div>
    <label class="check"><input type="checkbox" name="published"${draft.published ? ' checked' : ''}> ${esc(t('news_publish'))}</label>
    <div class="form-actions"><button type="button" class="btn ghost" data-cancel>${esc(t('cancel'))}</button><button class="btn primary">${esc(t('save'))}</button></div></form>`;
  const f = $('#nf'), ta = f.body;
  const sync = () => { draft.title = f.title.value; draft.body = ta.value; draft.published = f.published.checked; };
  const wrap = (a, b, ph) => { const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph; ta.setRangeText(a + sel + b, s, e, 'end'); ta.focus(); upd(); };
  const linePrefix = p => { const s = ta.selectionStart; const ls = ta.value.lastIndexOf('\n', s - 1) + 1; ta.setRangeText(p, ls, ls, 'end'); ta.focus(); upd(); };
  const insertBlock = txt => { const s = ta.selectionStart; const pre = s && ta.value[s - 1] !== '\n' ? '\n\n' : ''; ta.setRangeText(pre + txt + '\n', s, ta.selectionEnd, 'end'); ta.focus(); upd(); };
  const upd = () => { sync(); $('#npv').innerHTML = md(ta.value); };
  ta.addEventListener('input', upd); f.title.addEventListener('input', sync); f.published.addEventListener('change', sync);
  const up = async (file, kind) => {
    const blob = await resizeImage(file, kind === 'cover' ? 1600 : 1400);
    toast(t('uploading'));
    return db.upload(`news/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, blob);
  };
  f.onclick = async e => {
    const tb = e.target.closest('[data-tool]');
    if (tb) { const k = tb.dataset.tool;
      if (k === 'b') wrap('**', '**', t('news_t_bold'));
      if (k === 'i') wrap('*', '*', t('news_t_italic'));
      if (k === 'h') linePrefix('## ');
      if (k === 'l') linePrefix('- ');
      if (k === 'a') { const url = prompt(t('news_link_prompt'), 'https://'); if (url && /^https:\/\/\S+$/.test(url)) wrap('[', `](${url})`, t('news_link_text')); }
      if (k === 'img') $('[data-bodyimg]', f).click();
    }
    if (e.target.closest('[data-nocover]')) { sync(); draft.cover_url = null; form(el); }
    const cb = e.target.closest('[data-cat]'); if (cb) { sync(); draft.category = cb.dataset.cat; return form(el); }
    const imv = e.target.closest('[data-imv]'); if (imv) { sync(); const [i, d] = imv.dataset.imv.split(':').map(Number); [draft.images[i], draft.images[i + d]] = [draft.images[i + d], draft.images[i]]; return form(el); }
    const irm = e.target.closest('[data-irm]'); if (irm) { sync(); draft.images.splice(+irm.dataset.irm, 1); return form(el); }
    const trm = e.target.closest('[data-trm]'); if (trm) { sync(); draft.tournaments = draft.tournaments.filter(x => x !== trm.dataset.trm); return form(el); }
    if (e.target.closest('[data-tadd]')) { sync(); const inp = $('[data-tnew]', f); const v = (inp.value || '').trim(); if (v && !draft.tournaments.includes(v)) draft.tournaments.push(v); return form(el); }
    if (e.target.closest('[data-cancel]')) { editing = null; draft = null; state.render(); }
  };
  f.onchange = async e => {
    if (e.target.matches('[data-tour]')) { sync(); const v = e.target.value; draft.tournaments = e.target.checked ? [...new Set([...draft.tournaments, v])] : draft.tournaments.filter(x => x !== v); return form(el); }
    if (e.target.matches('[data-imgs]') && e.target.files.length) { sync(); const files = [...e.target.files];
      try { for (const [i, file] of files.entries()) { toast(`${t('uploading')} (${i + 1}/${files.length})`); const blob = await resizeImage(file, 2000);
        draft.images.push(await db.upload(`news/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, blob)); } } catch (err) { toast(t('error') + ': ' + err.message, true); }
      return form(el); }
    if (e.target.matches('[data-cover]') && e.target.files[0]) { sync(); try { draft.cover_url = await up(e.target.files[0], 'cover'); form(el); } catch (err) { toast(t('error') + ': ' + err.message, true); } }
    if (e.target.matches('[data-bodyimg]') && e.target.files[0]) { try { const u = await up(e.target.files[0], 'body'); insertBlock(`![](${u})`); } catch (err) { toast(t('error') + ': ' + err.message, true); } }
  };
  f.onsubmit = async e => {
    e.preventDefault(); sync(); if (!draft.title.trim()) { f.title.focus(); return toast(t('news_need_title'), true); }
    if (draft.category === 'Tournament Recap' && !draft.tournaments.length) return toast(t('news_need_tour'), true);
    const row = { title: draft.title.trim(), body: draft.body, cover_url: draft.cover_url || null, published: draft.published, category: draft.category,
      images: draft.images.filter(safeImg), tournaments: draft.category === 'Tournament Recap' ? draft.tournaments : [], updated_at: new Date().toISOString() };
    const ok = await act(() => n ? db.update('news', { id: n.id }, row) : db.insert('news', Object.assign(row, { author_id: uid(), author_name: authorName(), created_at: new Date().toISOString() })), ['news']);
    if (ok) { editing = null; draft = null; state.render(); }
  };
}

// ---------- Lightbox: big picture, arrows, swipe, Esc
export function lightbox(list, start = 0) {
  let i = start; const box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  const draw = () => { box.innerHTML = `<button type="button" class="lb-x" data-lbx aria-label="${esc(t('close'))}">✕</button>
    ${list.length > 1 ? `<button type="button" class="lb-n prev" data-lbn="-1" aria-label="${esc(t('sl_prev'))}">‹</button><button type="button" class="lb-n next" data-lbn="1" aria-label="${esc(t('sl_next'))}">›</button>` : ''}
    <img src="${esc(list[i])}" alt=""><div class="lb-c">${i + 1} / ${list.length}</div>`; };
  const close = () => { box.remove(); document.removeEventListener('keydown', key); };
  const go = d => { i = (i + d + list.length) % list.length; draw(); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
  box.onclick = e => { if (e.target.closest('[data-lbx]') || e.target === box) return close(); const n = e.target.closest('[data-lbn]'); if (n) go(+n.dataset.lbn); };
  let x0 = null; box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
  document.addEventListener('keydown', key); draw(); document.body.appendChild(box);
}

// ---------- Public gallery: every picture from tournament recaps, grouped by tournament
let galSel = '';
export function gallery(el) {
  const res = (state.pub && state.pub.results) || [];
  const dateOf = name => { const r = res.filter(x => x.tournament === name).map(x => x.date_to).sort().pop(); return r || null; };
  const groups = new Map();
  for (const n of PUBN()) {
    if (n.category !== 'Tournament Recap') continue;
    const pics = [safeImg(n.cover_url), ...(n.images || []).map(safeImg)].filter(Boolean); if (!pics.length) continue;
    for (const tn of n.tournaments || []) { const g = groups.get(tn) || { name: tn, pics: [], posts: [], date: dateOf(tn) || String(n.created_at).slice(0, 10) };
      for (const u of pics) if (!g.pics.includes(u)) g.pics.push(u); g.posts.push(n); groups.set(tn, g); }
  }
  const list = [...groups.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const shown = galSel && groups.has(galSel) ? [groups.get(galSel)] : list;
  el.innerHTML = pageHead(t('p_gallery'), t('gallery_intro')) +
    (list.length > 1 ? `<div class="chips cat-filter"><button type="button" class="chip${galSel ? '' : ' on'}" data-gs="">${esc(t('all'))}</button>${list.map(g => `<button type="button" class="chip${galSel === g.name ? ' on' : ''}" data-gs="${esc(g.name)}">${esc(g.name)}</button>`).join('')}</div>` : '') +
    (shown.length ? shown.map((g, gi) => `<section class="gal-group"><div class="block-head"><h2>${esc(g.name)}</h2><span class="mute">${esc(fmtDate(g.date, { month: 'long', year: 'numeric' }))} · ${esc(t('n_photos', { n: g.pics.length }))}</span></div>
      <div class="pgal">${g.pics.map((u, i) => `<button type="button" class="pgal-i" data-g="${gi}" data-i="${i}" aria-label="${esc(g.name)} ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>
      <p class="small">${g.posts.map(p => `<a href="#/news/${p.id}">${esc(p.title)} →</a>`).join(' · ')}</p></section>`).join('') : empty(t('gallery_none')));
  el.onclick = e => { const s2 = e.target.closest('[data-gs]'); if (s2) { galSel = s2.dataset.gs; return gallery(el); }
    const b = e.target.closest('[data-g]'); if (b) lightbox(shown[+b.dataset.g].pics, +b.dataset.i); };
}
