// Game constants and all calculations (same rules as the Google Sheet).
export const FACTIONS = ['Adepta Sororitas','Adeptus Custodes','Adeptus Mechanicus','Aeldari','Agents of the Imperium','Astra Militarum','Black Templars','Blood Angels',
  'Chaos Daemons','Chaos Knights','Chaos Space Marines','Dark Angels','Death Guard','Deathwatch','Drukhari',"Emperor's Children",'Genestealer Cults','Grey Knights',
  'Imperial Fists','Imperial Knights','Iron Hands','Leagues of Votann','Necrons','Orks','Raven Guard','Salamanders','Space Marines','Space Wolves',"T'au Empire",
  'Thousand Sons','Tyranids','Ultramarines','White Scars','World Eaters'];
// Column order of the sheet's Live Matrix (opponent factions)
export const MATRIX_COLS = ['Adepta Sororitas','Adeptus Custodes','Adeptus Mechanicus','Astra Militarum','Black Templars','Blood Angels','Dark Angels','Deathwatch','Grey Knights',
  'Imperial Knights','Space Marines','Space Wolves','Chaos Daemons','Chaos Knights','Chaos Space Marines','Death Guard',"Emperor's Children",'Thousand Sons','World Eaters',
  'Aeldari','Drukhari','Genestealer Cults','Leagues of Votann','Necrons','Orks',"T'au Empire",'Tyranids'];
export const DISPOSITIONS = ['Take and Hold','Purge The Foe','Disruption','Reconnaissance','Priority Assets'];
export const GAME_TYPES = ['Practice','Tournament','Team Tournament'];
// Team tournaments and practice are scored 20-0 … 0-20 (0–5 points apart = draw).
// Singles tournaments: more points wins, equal points is a draw (89-90 = loss).
export const teamScored = type => type !== 'Tournament';
export const typeLabel = (type, t) => ({ Practice: t('type_practice'), Tournament: t('type_singles'), 'Team Tournament': t('type_team') })[type] || type;
export function outcome(type, our, opp) {
  if (our == null || opp == null || our === '' || opp === '') return null;
  if (teamScored(type)) return resultOf(gp(our, opp));
  return +our > +opp ? 'win' : +our < +opp ? 'loss' : 'draw';
}
export const RATING_LEGEND = [['1–4','1'],['5–7','2'],['8–9','2.5'],['10','3'],['11–12','3.5'],['13–14','4'],['15+','5']];

// Team score from the point difference: 0–5 = 10-10, 6–10 = 11-9, one step per 5 points, over 50 = 20-0.
export function gp(our, opp) {
  if (our == null || opp == null || our === '' || opp === '') return null;
  const d = Number(our) - Number(opp), a = Math.abs(d);
  const w = a <= 5 ? 10 : Math.min(20, 10 + Math.ceil((a - 5) / 5));
  return d >= 0 ? [w, 20 - w] : [20 - w, w];
}
export const resultOf = g => g == null ? null : g[0] > 10 ? 'win' : g[0] < 10 ? 'loss' : 'draw';
export const scoreStr = g => g ? `${g[0]}-${g[1]}` : '–';

// Every game as seen by each team player involved: internal games appear twice (mirrored).
export function records(matches, { type = '', since = '' } = {}) {
  const out = [];
  for (const m of matches) {
    if (type === '__tour' ? m.type === 'Practice' : type && m.type !== type) continue;
    if (since && m.played_on < since) continue;
    const g = gp(m.our_score, m.opp_score);
    if (!g) continue;
    const res = outcome(m.type, m.our_score, m.opp_score), flip = { win: 'loss', loss: 'win', draw: 'draw' };
    out.push({ m, player_id: m.player_id, army: m.army, disp: m.disposition, opp: m.opp_faction, oppDisp: m.opp_disposition, our: +m.our_score, theirs: +m.opp_score, g: g[0], res, internal: !!m.opp_player_id, vsPlayer: m.opp_player_id });
    if (m.opp_player_id) out.push({ m, player_id: m.opp_player_id, army: m.opp_faction, disp: m.opp_disposition, opp: m.army, oppDisp: m.disposition, our: +m.opp_score, theirs: +m.our_score, g: g[1], res: flip[res], internal: true, vsPlayer: m.player_id, mirrored: true });
  }
  return out;
}
export function summarize(recs) {
  const s = { n: recs.length, w: 0, d: 0, l: 0, gp: 0, diff: 0 };
  for (const r of recs) { s.gp += r.g; s.diff += r.our - r.theirs; const res = r.res || resultOf([r.g]); if (res === 'win') s.w++; else if (res === 'loss') s.l++; else s.d++; }
  s.avgGp = s.n ? s.gp / s.n : null; s.avgDiff = s.n ? s.diff / s.n : null; s.rate = s.n ? (s.w + s.d / 2) / s.n : null;
  return s;
}
export function groupBy(arr, fn) { const m = new Map(); for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }
export const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
export function fmt1(x) { return x == null || isNaN(x) ? '' : (Math.round(x * 10) / 10).toFixed(1); }
export function pct(x) { return x == null ? '' : Math.round(x * 100) + '%'; }
export function matrixCell(gpAvg) { if (gpAvg == null) return null; const r = Math.round(gpAvg); return [r, 20 - r]; }
export function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
