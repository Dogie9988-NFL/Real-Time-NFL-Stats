
// =========================================================
//   TEAM IDENTITY — colors, abbreviations and a helmet drawing for every team
// =========================================================
const TEAM_STYLE = {
  'Harbor City Hammerheads': { abbr: 'HAM', c1: '#E8590C', c2: '#14203A' },
  'Lakeshore Gulls': { abbr: 'LAK', c1: '#1B9AAA', c2: '#FFFFFF' },
  'Desert Vipers': { abbr: 'DES', c1: '#D4A017', c2: '#1A1A1A' },
  'Northfork Lumberjacks': { abbr: 'NFK', c1: '#2E5E3A', c2: '#C8102E' },
  'Steel Valley Smelters': { abbr: 'SVS', c1: '#4A4F55', c2: '#F2C200' },
  'Capital Monarchs': { abbr: 'CAP', c1: '#5B2A86', c2: '#D4AF37' },
  'Gulf Coast Hurricanes': { abbr: 'GCH', c1: '#0B3D91', c2: '#7FD3F7' },
  'Frontier Mustangs': { abbr: 'FRM', c1: '#B22234', c2: '#FFFFFF' },
  'Prairie Bison': { abbr: 'PRB', c1: '#7A4B26', c2: '#E8D5A3' },
  'Neon City Jackpots': { abbr: 'NCJ', c1: '#E10098', c2: '#FFD700' },
  'Redwood Grizzlies': { abbr: 'RWG', c1: '#7A1F1F', c2: '#9FBF8F' },
  'Empire Sentinels': { abbr: 'EMP', c1: '#1C1C1C', c2: '#C0C0C0' },
};
// Teams added later (e.g. a new season's schedule) get a stable style from their name.
function teamStyle(name) {
  if (TEAM_STYLE[name]) return TEAM_STYLE[name];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const words = String(name).split(' ');
  const abbr = (words.length > 1 ? words[0].slice(0, 1) + words[1].slice(0, 2) : words[0].slice(0, 3)).toUpperCase();
  return (TEAM_STYLE[name] = { abbr, c1: `hsl(${hue} 55% 38%)`, c2: `hsl(${(hue + 180) % 360} 70% 80%)` });
}
const HOME_TEAM = 'Harbor City Hammerheads';
// Side view of a helmet. flip = facing left.
function helmetSVG(name, flip) {
  const t = teamStyle(name);
  return `<svg class="helmet" viewBox="0 0 64 48" aria-hidden="true"${flip ? ' style="transform:scaleX(-1)"' : ''}>
    <path d="M6 30C6 14 19 4 35 4c14 0 23 9 23 22v6l-12 2-2 6-15 2C17 42 6 38 6 30z" fill="${t.c1}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
    <path d="M12 16C17 9 25 5.5 35 5.5c9 0 16 3.5 20 9.5" fill="none" stroke="${t.c2}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="27" cy="25" r="4.2" fill="rgba(0,0,0,.28)"/>
    <path d="M44 22h16M44 29h16M58 18v18M50 22v12" fill="none" stroke="#D9DDE1" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M14 34c6 4 14 5 22 4" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

// Home or away for a slate. Schedule entries may say venue: 'home' | 'away' | 'neutral' (or home: true/false);
// otherwise Year One uses the fixed table below and later years alternate. The Championship is neutral.
const HOME_Y1 = { 0: 1, 2: 1, 5: 1, 7: 1, 9: 1 };
function venueOf(n) {
  const o = oppOf(n) || {};
  if (o.venue) return o.venue;
  if (typeof o.home === 'boolean') return o.home ? 'home' : 'away';
  if (n === 12) return 'neutral';
  if (n === 10) return 'away';                                    // Wild Card: on the road, in the mud
  if (n === 11) return S && S.record && S.record.w >= 8 ? 'home' : 'away'; // the better seed hosts
  if (((S && S.year) || 1) === 1) return HOME_Y1[n] ? 'home' : 'away';
  return n % 2 === 0 ? 'home' : 'away';
}
