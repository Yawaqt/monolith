// Admin: content of the public team page – "about us" text and group photos (captains and admins).
import { db } from './db.js?v=202611251746';
import { t } from './i18n.js?v=202611251746';
import { state, esc, $, act, toast, pageHead, resizeImage, safeImg, confirmBox } from './core.js?v=202611251746';
import { md } from './pages-news.js?v=202611251746';

const site = () => (state.pub && state.pub.site) || {};
const save = (key, value) => act(() => db.upsert('site_content', { key, value, updated_at: new Date().toISOString() }), ['site_content']);

export function editor(el) {
  const about = (site().about && site().about.text) || '';
  const photos = (site().group_photos || []).filter(safeImg);
  el.innerHTML = pageHead(t('nav_site'), t('site_intro'), `<a class="btn ghost" href="#/team">${esc(t('site_view'))}</a>`) +
    `<form class="card form" id="about"><h2>${esc(t('about_us'))}</h2>
      <div class="nsplit"><label class="ntext">${esc(t('news_text'))}<textarea name="text" rows="8" maxlength="3000">${esc(about)}</textarea></label>
      <div class="npreview"><span class="lbl">${esc(t('news_preview'))}</span><div class="post-body about" id="apv">${md(about)}</div></div></div>
      <p class="mute small">${esc(t('news_help'))}</p>
      <div class="form-actions"><button class="btn primary">${esc(t('save'))}</button></div></form>
    <section class="card"><h2>${esc(t('group_photos'))}</h2><p class="mute">${esc(t('group_photos_hint'))}</p>
      <div class="gphotos">${photos.map((u, i) => `<figure><img src="${esc(u)}" alt="${esc(t('group_photo'))} ${i + 1}"><figcaption>
        <button type="button" class="icon xs" data-mv="${i}:-1" aria-label="${esc(t('move_left'))}"${i ? '' : ' disabled'}>←</button>
        <button type="button" class="icon xs" data-mv="${i}:1" aria-label="${esc(t('move_right'))}"${i < photos.length - 1 ? '' : ' disabled'}>→</button>
        <button type="button" class="icon xs" data-rmp="${i}" aria-label="${esc(t('delete'))}">🗑</button></figcaption></figure>`).join('')}
        <label class="gadd"><input type="file" accept="image/*" multiple data-gadd hidden><span>+</span>${esc(t('photos_add'))}</label></div></section>`;
  const f = $('#about');
  f.text.addEventListener('input', () => { $('#apv').innerHTML = md(f.text.value); });
  f.onsubmit = e => { e.preventDefault(); save('about', { text: f.text.value.trim() }); };
  el.onclick = async e => {
    const mv = e.target.closest('[data-mv]');
    if (mv) { const [i, d] = mv.dataset.mv.split(':').map(Number); const list = photos.slice(); [list[i], list[i + d]] = [list[i + d], list[i]]; return save('group_photos', list); }
    const rm = e.target.closest('[data-rmp]');
    if (rm && await confirmBox(t('group_photo') + ' ' + (+rm.dataset.rmp + 1))) { const list = photos.slice(); list.splice(+rm.dataset.rmp, 1); return save('group_photos', list); }
  };
  el.onchange = async e => {
    if (!e.target.matches('[data-gadd]')) return;
    const files = [...e.target.files]; if (!files.length) return;
    const list = photos.slice();
    try {
      for (const [i, file] of files.entries()) {
        toast(`${t('uploading')} (${i + 1}/${files.length})`);
        const blob = await resizeImage(file, 2000);
        list.push(await db.upload(`team/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, blob));
      }
      await save('group_photos', list);
    } catch (err) { toast(t('error') + ': ' + err.message, true); if (list.length > photos.length) save('group_photos', list); }
  };
}
