// Data access: Supabase when configured, otherwise a demo backend in localStorage.
import { CONFIG } from './config.js?v=202611251746';

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
export const TABLES = ['players', 'matches', 'events', 'rsvps', 'payments', 'ratings', 'opponent_teams', 'pairings', 'settings', 'tevents', 'tevent_rounds', 'news'];
// Tables whose API columns are restricted (never select *)
const COLS = { tevents: 'id,title,event_id,size,rules,lineup,share_code,created_by,created_at,updated_at,matrix,opponents,notes' };
const cols = t => COLS[t] || '*';
const KEYS = { rsvps: ['event_id', 'player_id'], ratings: ['player_id', 'faction'], settings: ['key'], collections: ['user_id'], profiles: ['id'], site_content: ['key'] };

let sb = null;
export async function client() {
  if (DEMO) return null;
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return sb;
}
const fail = e => { const err = new Error(e.message || String(e)); err.code = e.code; throw err; };

// ---------------- Supabase ----------------
const real = {
  async session() { const c = await client(); const { data } = await c.auth.getSession(); return data.session; },
  onAuth(cb) { client().then(c => c.auth.onAuthStateChange((ev, s) => cb(ev, s))); },
  async signIn(email, password) { const c = await client(); const { error } = await c.auth.signInWithPassword({ email, password }); if (error) fail(error); },
  async signUp(email, password, display_name) {
    const c = await client();
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { display_name }, emailRedirectTo: location.origin + location.pathname } });
    if (error) fail(error); return !data.session; // true = must confirm email
  },
  async google() { const c = await client(); const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); if (error) fail(error); },
  async reset(email) { const c = await client(); const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/profile' }); if (error) fail(error); },
  async setPassword(password) { const c = await client(); const { error } = await c.auth.updateUser({ password }); if (error) fail(error); },
  async signOut() { const c = await client(); await c.auth.signOut(); },
  async me(uid) { const c = await client(); const { data, error } = await c.from('profiles').select('*').eq('id', uid).maybeSingle(); if (error) fail(error); return data; },
  async list(table, order) {
    const c = await client(); let q = c.from(table).select(cols(table));
    if (order) q = q.order(order[0], { ascending: order[1] !== 'desc' });
    const { data, error } = await q; if (error) fail(error); return data || [];
  },
  async insert(table, row) { const c = await client(); const { data, error } = await c.from(table).insert(row).select(cols(table)).single(); if (error) fail(error); return data; },
  async update(table, match, patch) { const c = await client(); const { data, error } = await c.from(table).update(patch).match(match).select(cols(table)); if (error) fail(error); if (!data || !data.length) fail({ message: 'not allowed' }); return data[0]; },
  async remove(table, match) { const c = await client(); const { error } = await c.from(table).delete().match(match); if (error) fail(error); },
  async upsert(table, row) { const c = await client(); const { data, error } = await c.from(table).upsert(row, { onConflict: (KEYS[table] || ['id']).join(',') }).select(cols(table)).single(); if (error) fail(error); return data; },
  async rpc(name, args) { const c = await client(); const { data, error } = await c.rpc(name, args); if (error) fail(error); return data ?? []; },
  // Upload a picture to the public "media" bucket and return its public URL
  async upload(path, blob) {
    const c = await client(); const { error } = await c.storage.from('media').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true, cacheControl: '31536000' });
    if (error) fail(error); return c.storage.from('media').getPublicUrl(path).data.publicUrl;
  },
  // Live updates: calls cb() whenever one of the tables changes on the server
  subscribe(tables, cb) { client().then(c => { let ch = c.channel('live-' + tables.join('-')); for (const t of tables) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, cb); ch.subscribe(); }).catch(() => {}); },
};

// ---------------- Demo (localStorage) ----------------
const DK = 'monolith.demo.v1';
let store = null;
function load() {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(DK)); } catch (e) { store = null; }
  if (!store) resetDemo(false);
  return store;
}
function persist() { try { localStorage.setItem(DK, JSON.stringify(store)); } catch (e) {} }
export function resetDemo(reload = true) {
  const d = JSON.parse(JSON.stringify(window.DEMO_DATA || {}));
  store = { tables: {}, profiles: [], seq: {}, role: 'admin' };
  for (const t of TABLES) store.tables[t] = d[t] || [];
  store.tables.collections = [];
  store.tables.site_content = [{ key: 'about', value: { text: 'Wir sind Monolith 40k – ein kompetitives Warhammer-40k-Team aus Wien. Wir spielen Singles und Teamturniere in ganz Österreich und trainieren jede Woche zusammen.' } }];
  for (const e of store.tables.events || []) { e.ends_on = e.ends_on || e.starts_on; if (e.kind !== 'Singles' && e.kind !== 'Team Tournament') e.kind = /\bteams?\b/i.test(e.title) ? 'Team Tournament' : 'Singles'; if (e.kind === 'Singles') e.team_size = null; }
  if (!store.tables.news.length) store.tables.news = [{ id: 1, title: 'Willkommen auf der neuen Monolith-Seite', body: 'Ab sofort findet ihr hier **Turnierberichte**, Ergebnisse und alles rund ums Team.\n\n## Was kommt\n- Berichte von jedem Turnier\n- Bilder unserer Armeen\n\nFolgt uns auch auf [Instagram](https://www.instagram.com/monolith40k/).', cover_url: null, published: true, author_id: 'demo-user', author_name: 'Miki', created_at: '2026-11-25T10:00:00Z', updated_at: '2026-11-25T10:00:00Z' }];
  store.profiles = [
    { id: 'demo-user', display_name: 'Miki', role: 'admin', player_id: 2, lang: 'de', created_at: '2026-10-21T09:00:00Z' },
    { id: 'demo-2', display_name: 'David', role: 'team', player_id: 4, lang: 'de', created_at: '2026-10-22T09:00:00Z' },
    { id: 'demo-3', display_name: 'Georg', role: 'captain', player_id: 3, lang: 'de', created_at: '2026-10-22T10:00:00Z' },
    { id: 'demo-4', display_name: 'neuer.spieler', role: 'guest', player_id: null, lang: 'de', created_at: '2026-11-24T18:00:00Z' },
  ];
  persist(); if (reload) location.reload();
}
export function demoRole() { return load().role; }
export function setDemoRole(r) { load().role = r; store.profiles[0].role = r; persist(); }
const matches = (row, m) => Object.keys(m).every(k => String(row[k]) === String(m[k]));
const tbl = t => (t === 'profiles' ? load().profiles : (load().tables[t] = load().tables[t] || []));
const demo = {
  async session() { return { user: { id: 'demo-user', email: 'demo@monolith.local' } }; },
  onAuth() {},
  async signIn() {}, async signUp() { return false; }, async google() {}, async reset() {}, async setPassword() {}, async signOut() {},
  async me() { return load().profiles[0]; },
  async list(table, order) {
    const rows = tbl(table).slice();
    if (order) rows.sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : a[order[0]] < b[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1));
    return JSON.parse(JSON.stringify(rows)).map(r => { delete r._pw; return r; });
  },
  async insert(table, row) {
    const r = Object.assign({}, row);
    if (!KEYS[table]) { const s = load().seq; s[table] = Math.max(s[table] || 0, ...tbl(table).map(x => +x.id || 0)) + 1; r.id = s[table]; }
    if (table === 'matches' && !r.created_by) r.created_by = 'demo-user';
    tbl(table).push(r); persist(); return JSON.parse(JSON.stringify(r));
  },
  async update(table, m, patch) { const r = tbl(table).find(x => matches(x, m)); if (!r) fail({ message: 'not found' }); Object.assign(r, patch); persist(); return JSON.parse(JSON.stringify(r)); },
  async remove(table, m) { const a = tbl(table); for (let i = a.length - 1; i >= 0; i--) if (matches(a[i], m)) a.splice(i, 1); persist(); },
  async upsert(table, row) {
    const keys = KEYS[table] || ['id']; const m = {}; for (const k of keys) m[k] = row[k];
    const r = tbl(table).find(x => matches(x, m));
    if (r) { Object.assign(r, row); persist(); return JSON.parse(JSON.stringify(r)); }
    return demo.insert(table, row);
  },
  subscribe() {},
  // Demo: pictures are kept inside the browser as data URLs
  async upload(path, blob) { return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); },
  async rpc(name, args = {}) {
    // Public team page: only armies a player has used at tournaments, most played first
    const tourArmies = (ms, pid) => { const c = new Map(); for (const m of ms) if (m.player_id === pid && (m.type === 'Tournament' || m.type === 'Team Tournament')) c.set(m.army, (c.get(m.army) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); };
    const T = load().tables; const P = T.players || []; const nm = id => (P.find(p => p.id === id) || {}).name;
    const today = new Date().toISOString().slice(0, 10);
    if (name === 'public_players') return P.filter(p => p.active).sort((a, b) => a.sort - b.sort).map(p => ({ name: p.name, sort: p.sort, armies: tourArmies(T.matches || [], p.id), bcp_url: p.bcp_url || null, photo_url: p.photo_url || null, fav_army: p.fav_army || null, bio: p.bio || null }));
    if (name === 'public_results') {
      const by = new Map();
      for (const m of T.matches || []) {
        if (!['Tournament', 'Team Tournament'].includes(m.type) || m.our_score == null || m.opp_score == null) continue;
        const k = (m.tournament || '—') + '|' + m.type; const d = m.our_score - m.opp_score;
        const r = m.type === 'Team Tournament' ? (Math.abs(d) <= 5 ? 'd' : d > 0 ? 'w' : 'l') : (d === 0 ? 'd' : d > 0 ? 'w' : 'l');
        const x = by.get(k) || { tournament: m.tournament || '—', type: m.type, date_from: m.played_on, date_to: m.played_on, games: 0, wins: 0, draws: 0, losses: 0 };
        x.games++; x[{ w: 'wins', d: 'draws', l: 'losses' }[r]]++; if (m.played_on < x.date_from) x.date_from = m.played_on; if (m.played_on > x.date_to) x.date_to = m.played_on; by.set(k, x);
      }
      return [...by.values()].sort((a, b) => b.date_to.localeCompare(a.date_to));
    }
    if (name === 'public_events') return (T.events || []).filter(e => (e.ends_on || e.starts_on) >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map(e => ({ starts_on: e.starts_on, ends_on: e.ends_on || e.starts_on, title: e.title, location: e.location, kind: e.kind, team_size: e.team_size }));
    if (name === 'set_tevent_password') { const ev = (T.tevents || []).find(e => e.id === args.p_id); if (ev) { ev._pw = args.p_password || null; persist(); } return null; }
    if (name === 'tevent_has_password') return !!((T.tevents || []).find(e => e.id === args.p_id) || {})._pw;
    if (name === 'public_tevent') {
      const ev = (T.tevents || []).find(e => e.share_code && e.share_code === args.p_code);
      if (!ev) return { error: 'not_found' };
      if (ev._pw && ev._pw !== args.p_password) return { error: 'password' };
      return { title: ev.title, size: ev.size, updated_at: ev.updated_at, lineup: (ev.lineup || []).map(l => ({ player: nm(l.player_id), faction: l.faction, disposition: l.disposition })),
        rounds: (T.tevent_rounds || []).filter(r => r.tevent_id === ev.id).sort((a, b) => a.round_no - b.round_no).map(r => ({ round_no: r.round_no, opp_name: r.opp_name, opp: r.opp, predictions: r.predictions, pairings: r.pairings })) };
    }
    return [];
  },
};

export const db = DEMO ? demo : real;
