// Data access: Supabase when configured, otherwise a demo backend in localStorage.
import { CONFIG } from './config.js';

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
export const TABLES = ['players', 'matches', 'events', 'rsvps', 'payments', 'ratings', 'opponent_teams', 'pairings', 'settings'];
const KEYS = { rsvps: ['event_id', 'player_id'], ratings: ['player_id', 'faction'], settings: ['key'], collections: ['user_id'], profiles: ['id'] };

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
    const c = await client(); let q = c.from(table).select('*');
    if (order) q = q.order(order[0], { ascending: order[1] !== 'desc' });
    const { data, error } = await q; if (error) fail(error); return data || [];
  },
  async insert(table, row) { const c = await client(); const { data, error } = await c.from(table).insert(row).select().single(); if (error) fail(error); return data; },
  async update(table, match, patch) { const c = await client(); const { data, error } = await c.from(table).update(patch).match(match).select(); if (error) fail(error); if (!data || !data.length) fail({ message: 'not allowed' }); return data[0]; },
  async remove(table, match) { const c = await client(); const { error } = await c.from(table).delete().match(match); if (error) fail(error); },
  async upsert(table, row) { const c = await client(); const { data, error } = await c.from(table).upsert(row, { onConflict: (KEYS[table] || ['id']).join(',') }).select().single(); if (error) fail(error); return data; },
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
    return JSON.parse(JSON.stringify(rows));
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
};

export const db = DEMO ? demo : real;
