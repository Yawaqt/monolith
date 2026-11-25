// News: public blog pages and the editor for members (Team role and above).
import { db } from './db.js?v=202611251754';
import { t } from './i18n.js?v=202611251754';
import { state, can, esc, $, $$, fmtDate, act, confirmBox, empty, pageHead, toast, resizeImage, safeImg, myPlayer, playerById } from './core.js?v=202611251754';

const D = () => state.data;
const PUBN = () => (state.pub && state.pub.news) || [];
const uid = () => state.session && state.session.user.id;
const canEdit = n => can('captain') || (can('team') && n.author_id === uid());
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

export const newsCard = n => `<a class="ncard" href="#/news/${n.id}">${cover(n, 'ncard-img')}<div class="ncard-b"><p class="mute small">${byline(n)}</p><h3>${esc(n.title)}</h3><p>${esc(excerpt(n.body))}</p></div></a>`;

// ---------- Public
export function list(el) {
  const items = PUBN();
  el.innerHTML = pageHead(t('p_news'), t('news_intro'), can('team') ? `<a class="btn ghost" href="#/newsedit">${esc(t('news_write'))}</a>` : '') +
    (items.length ? `<div class="ngrid">${items.map(newsCard).join('')}</div>` : empty(t('news_none')));
}
export function article(el, id) {
  const n = PUBN().find(x => String(x.id) === String(id)) || (D() && (D().news || []).find(x => String(x.id) === String(id)));
  if (!n) { el.innerHTML = `<p><a href="#/news">${esc(t('news_back'))}</a></p>` + empty(t('news_nf')); return; }
  document.title = n.title;
  el.innerHTML = `<article class="post"><p><a class="mute" href="#/news">${esc(t('news_back'))}</a></p>
    <h1>${esc(n.title)}</h1><p class="mute">${byline(n)}${n.published ? '' : ` · <span class="tag">${esc(t('news_draft'))}</span>`}</p>
    ${cover(n, 'post-cover')}<div class="post-body">${md(n.body)}</div>
    ${canEdit(n) ? `<p><a class="btn ghost sm" href="#/newsedit" data-goedit="${n.id}">${esc(t('edit'))}</a></p>` : ''}</article>`;
  el.onclick = e => { const g = e.target.closest('[data-goedit]'); if (g) editing = +g.dataset.goedit; };
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
const TOOLS = [['b', 'B', 'news_t_bold'], ['i', 'I', 'news_t_italic'], ['h', 'H', 'news_t_head'], ['l', '•', 'news_t_list'], ['a', '🔗', 'news_t_link'], ['img', '🖼', 'news_t_img']];
function form(el) {
  const n = editing === 'new' ? null : (D().news || []).find(x => x.id === editing);
  if (editing !== 'new' && (!n || !canEdit(n))) { editing = null; return editor(el); }
  if (!draft) draft = { title: n ? n.title : '', body: n ? n.body : '', cover_url: n ? n.cover_url : null, published: n ? n.published : true };
  el.innerHTML = pageHead(n ? t('news_edit') : t('news_new'), '') + `<form class="card form neditor" id="nf" novalidate>
    <label>${esc(t('news_title'))}<input name="title" required maxlength="160" value="${esc(draft.title)}"></label>
    <div class="ncover"><span class="lbl">${esc(t('news_cover'))}</span>${safeImg(draft.cover_url) ? `<img src="${esc(safeImg(draft.cover_url))}" alt="">` : ''}
      <label class="btn ghost sm file">${esc(draft.cover_url ? t('news_cover_change') : t('news_cover_add'))}<input type="file" accept="image/*" data-cover hidden></label>
      ${draft.cover_url ? `<button type="button" class="btn ghost sm" data-nocover>${esc(t('remove'))}</button>` : ''}</div>
    <div class="ntools" role="toolbar" aria-label="${esc(t('news_format'))}">${TOOLS.map(([k, s, l]) => `<button type="button" class="tool" data-tool="${k}" title="${esc(t(l))}" aria-label="${esc(t(l))}">${s}</button>`).join('')}
      <input type="file" accept="image/*" data-bodyimg hidden></div>
    <div class="nsplit"><label class="ntext">${esc(t('news_text'))}<textarea name="body" rows="16" maxlength="40000">${esc(draft.body)}</textarea></label>
      <div class="npreview"><span class="lbl">${esc(t('news_preview'))}</span><div class="post-body" id="npv">${md(draft.body)}</div></div></div>
    <p class="mute small">${esc(t('news_help'))}</p>
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
    if (e.target.closest('[data-cancel]')) { editing = null; draft = null; state.render(); }
  };
  f.onchange = async e => {
    if (e.target.matches('[data-cover]') && e.target.files[0]) { sync(); try { draft.cover_url = await up(e.target.files[0], 'cover'); form(el); } catch (err) { toast(t('error') + ': ' + err.message, true); } }
    if (e.target.matches('[data-bodyimg]') && e.target.files[0]) { try { const u = await up(e.target.files[0], 'body'); insertBlock(`![](${u})`); } catch (err) { toast(t('error') + ': ' + err.message, true); } }
  };
  f.onsubmit = async e => {
    e.preventDefault(); sync(); if (!draft.title.trim()) { f.title.focus(); return toast(t('news_need_title'), true); }
    const row = { title: draft.title.trim(), body: draft.body, cover_url: draft.cover_url || null, published: draft.published, updated_at: new Date().toISOString() };
    const ok = await act(() => n ? db.update('news', { id: n.id }, row) : db.insert('news', Object.assign(row, { author_id: uid(), author_name: authorName(), created_at: new Date().toISOString() })), ['news']);
    if (ok) { editing = null; draft = null; state.render(); }
  };
}
