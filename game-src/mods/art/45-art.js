// =========================================================
//   ART — character portraits, the player's look, scene banners and cover art.
//   Everything is inline SVG built from strings, in one flat sports-card style, and cached.
//   Public: ART.portrait(name, raw), ART.avatar(look, opts), ART.player(), ART.scene(id, opts),
//           ART.banner(id, opts) -> HTML, ART.BANNERS[pageId] = sceneId | (args) => ({ id, opts }) | null,
//           ART.lookOf(state), ART.SKINS, ART.HAIRS, ART.CAST (add a portrait: ART.CAST['Name'] = () => svg).
// =========================================================
const ART = (() => {
  const cache = new Map();
  function memo(key, fn) {
    if (cache.has(key)) return cache.get(key);
    const v = fn();
    if (cache.size > 400) cache.clear();
    cache.set(key, v);
    return v;
  }
  const r2 = v => Math.round(v * 100) / 100;

  // ---------- Color + random helpers ----------
  function rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const dk = (c, t) => mix(c, '#000000', t == null ? 0.2 : t);
  const lt = (c, t) => mix(c, '#ffffff', t == null ? 0.2 : t);
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) { let h = 2166136261; const str = String(s); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- SVG primitives ----------
  const ex = x => (x ? ' ' + x : '');
  const P_ = (d, fill, x) => `<path d="${d}" fill="${fill}"${ex(x)}/>`;
  const C_ = (cx, cy, r, fill, x) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${fill}"${ex(x)}/>`;
  const E_ = (cx, cy, rx, ry, fill, x) => `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${fill}"${ex(x)}/>`;
  const R_ = (x, y, w, h, fill, xx) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${fill}"${ex(xx)}/>`;
  const L_ = (d, stroke, w, x) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${ex(x)}/>`;
  const G_ = (inner, x) => `<g${ex(x)}>${inner}</g>`;
  const MIR = s => `<g transform="matrix(-1 0 0 1 64 0)">${s}</g>`;
  const FONT_NUM = `font-family="Graduate,'Arial Black',Impact,'Arial Narrow',sans-serif" font-weight="700"`;
  const FONT_LBL = `font-family="'Barlow Condensed','Arial Narrow',Arial,sans-serif" font-weight="700"`;
  const T_ = (x, y, text, size, fill, x2) => `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" fill="${fill}" text-anchor="middle"${ex(x2)}>${esc(text)}</text>`;
  const svg = (vb, inner, x) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" focusable="false" aria-hidden="true"${ex(x)}>${inner}</svg>`;

  // Team colors (fixed: they live on their own tiles and scenes).
  const TEAM = { main: '#E8590C', dark: '#B4460C', navy: '#16233F', navy2: '#22345A', white: '#F4F6F8', gold: '#F2C14E' };
  const INK = '#1E1612';

  // =========================================================
  //   PORTRAIT KIT — 64×64. Heads are authored at one standard size
  //   (x 21.5–42.5, y 12–40) and moved with a transform for kids and giants.
  // =========================================================
  function headD(L, R, t, b, jaw) {
    const cx = (L + R) / 2, hw = (R - L) / 2, hh = b - t, mid = t + hh * 0.45;
    return `M${r2(L)} ${r2(mid)}C${r2(L)} ${r2(t + hh * 0.1)} ${r2(cx - hw * 0.6)} ${r2(t)} ${r2(cx)} ${r2(t)}C${r2(cx + hw * 0.6)} ${r2(t)} ${r2(R)} ${r2(t + hh * 0.1)} ${r2(R)} ${r2(mid)}C${r2(R)} ${r2(mid + hh * 0.3)} ${r2(cx + hw * jaw)} ${r2(b)} ${r2(cx)} ${r2(b)}C${r2(cx - hw * jaw)} ${r2(b)} ${r2(L)} ${r2(mid + hh * 0.3)} ${r2(L)} ${r2(mid)}Z`;
  }
  const halfFaceD = (jaw, side) => side < 0
    ? `M32 12C25.7 12 21.5 14.8 21.5 24.6C21.5 33 ${r2(32 - 10.5 * jaw)} 40 32 40Z`
    : `M32 12C38.3 12 42.5 14.8 42.5 24.6C42.5 33 ${r2(32 + 10.5 * jaw)} 40 32 40Z`;
  const EX = [27.3, 36.7], EY = 26.9;

  function eyes(type, skin, lash) {
    let s = '';
    for (const x of EX) {
      if (type === 'happy') s += L_(`M${x - 1.7} 27.5Q${x} 25.4 ${x + 1.7} 27.5`, INK, 1.4);
      else if (type === 'shut') s += L_(`M${x - 1.6} 26.8Q${x} 28.4 ${x + 1.6} 26.8`, INK, 1.3);
      else if (type === 'tired') s += P_(`M${x - 1.6} 26.6Q${x} 29.2 ${x + 1.6} 26.6Z`, INK) + L_(`M${x - 1.9} 26.5L${x + 1.9} 26.5`, dk(skin, 0.45), 1.1);
      else if (type === 'none') { /* faceless */ }
      else {
        const big = type === 'wide' ? 1.15 : 1;
        s += E_(x, EY, 1.4 * big, 1.75 * big, INK) + C_(x + 0.5, EY - 0.6, 0.5, '#fff');
      }
      if (lash && type !== 'none') { const o = x < 32 ? -1 : 1; s += L_(`M${x + o * 1.3} ${EY - 1.1}l${o * 1} -.8`, INK, 0.8); }
    }
    return s;
  }
  function brows(type, c, w) {
    w = w || 1.5;
    const [a, b] = EX;
    const map = {
      flat: [`M${a - 2.1} 23.3L${a + 2.1} 23.3`, `M${b - 2.1} 23.3L${b + 2.1} 23.3`],
      arch: [`M${a - 2.2} 23.8Q${a} 22.1 ${a + 2.2} 23.4`, `M${b - 2.2} 23.4Q${b} 22.1 ${b + 2.2} 23.8`],
      down: [`M${a - 2.2} 22.6L${a + 2.1} 23.9`, `M${b - 2.1} 23.9L${b + 2.2} 22.6`],
      worry: [`M${a - 2.2} 23.8L${a + 2} 22.5`, `M${b - 2} 22.5L${b + 2.2} 23.8`],
      raise: [`M${a - 2.1} 23.4L${a + 2.1} 23.4`, `M${b - 2.2} 22.6Q${b} 20.8 ${b + 2.3} 22.2`],
    };
    const p = map[type] || map.flat;
    return L_(p[0], c, w) + L_(p[1], c, w);
  }
  function mouth(type, skin) {
    const lc = dk(skin, 0.5), dark = '#4A1A1A';
    switch (type) {
      case 'grin': return P_('M27.6 33.4Q32 39.6 36.4 33.4Z', dark) + P_('M28.2 33.6Q32 34.8 35.8 33.6L35.3 34.9Q32 36 28.7 34.9Z', '#FFFFFF');
      case 'big': return P_('M26.6 32.8Q32 41.4 37.4 32.8Z', dark) + P_('M27.3 33Q32 34.4 36.7 33L36.1 34.6Q32 35.8 27.9 34.6Z', '#FFFFFF') + P_('M29.6 37.8Q32 36.4 34.4 37.8Q32 39 29.6 37.8Z', '#C9545A');
      case 'gap': return P_('M27.6 33.4Q32 39.6 36.4 33.4Z', dark) + P_('M28.2 33.6Q32 34.8 35.8 33.6L35.3 34.9Q32 36 28.7 34.9Z', '#FFFFFF') + R_(32.6, 33.8, 1.3, 1.6, dark);
      case 'flat': return L_('M29 35.1L35 35.1', lc, 1.4);
      case 'smirk': return L_('M28.8 35.4Q32.6 36.4 35.8 33.9', lc, 1.4);
      case 'open': return P_('M28.4 33.4Q32 32.6 35.6 33.4Q35.6 38.6 32 38.8Q28.4 38.6 28.4 33.4Z', dark) + P_('M28.9 33.5Q32 32.9 35.1 33.5L34.9 34.5Q32 34.1 29.1 34.5Z', '#FFFFFF');
      case 'shout': return P_('M27.6 32.8Q32 31.8 36.4 32.8Q36.6 40 32 40.2Q27.4 40 27.6 32.8Z', dark) + P_('M28.2 33Q32 32.2 35.8 33L35.5 34.3Q32 33.7 28.5 34.3Z', '#FFFFFF') + E_(32, 38.6, 2.4, 1.1, '#C9545A');
      case 'frown': return L_('M29 36Q32 33.8 35 36', lc, 1.4);
      case 'soft': return L_('M29.2 34.6Q32 36.5 34.8 34.6', lc, 1.3);
      case 'worry': return L_('M29.4 35.6Q30.8 34.6 32 35.2Q33.2 35.8 34.6 34.8', lc, 1.3);
      default: return L_('M28.6 34.3Q32 37.3 35.4 34.3', lc, 1.4); // smile
    }
  }
  function tile(bg) {
    return R_(0, 0, 64, 64, bg) + C_(32, 26, 23, lt(bg, 0.13)) + P_('M-2 52L66 22V31L-2 61Z', '#FFFFFF', 'opacity=".06"');
  }
  function torsoD(cx, bw, sy) {
    return `M${r2(cx - bw)} 66C${r2(cx - bw)} ${r2(sy + 6)} ${r2(cx - bw * 0.66)} ${r2(sy + 0.5)} ${r2(cx - 7)} ${r2(sy - 1)}L${r2(cx + 7)} ${r2(sy - 1)}C${r2(cx + bw * 0.66)} ${r2(sy + 0.5)} ${r2(cx + bw)} ${r2(sy + 6)} ${r2(cx + bw)} 66Z`;
  }
  const torso = (c, bw, sy) => { bw = bw || 26; sy = sy || 48; return P_(torsoD(32, bw, sy), dk(c, 0.24)) + P_(torsoD(31, bw - 1.6, sy + 0.5), c); };
  const neck = (skin, nw, bot) => { nw = nw || 5.2; bot = bot || 51; return P_(`M${32 - nw} 33L${r2(32 - nw - 0.5)} ${bot}L${r2(32 + nw + 0.5)} ${bot}L${32 + nw} 33Z`, dk(skin, 0.2)) + E_(32, 40.4, 6.2, 2.2, dk(skin, 0.42), 'opacity=".55"'); };

  // Collars and clothes (drawn after the torso).
  const vneck = (trim, skin) => P_('M25 47L32 54.4L39 47L36.3 47L32 51.3L27.7 47Z', trim) + P_('M27.7 47L32 51.3L36.3 47Z', dk(skin, 0.2));
  const crew = trim => P_('M25.2 47.2Q32 52.8 38.8 47.2L37 46.9Q32 50.4 27 46.9Z', trim);
  const standCollar = (c, zip) => P_('M25.4 44.6L25.2 48.8Q32 51.8 38.8 48.8L38.6 44.6Q32 47.4 25.4 44.6Z', c) + L_('M32 48.9L32 66', zip, 0.9) + R_(31.1, 53.6, 1.8, 2.8, zip, 'rx=".5"');
  function polo(c, collar, skin) {
    return P_('M27 47L32 51.4L37 47Z', dk(skin, 0.2))
      + P_('M25 46.4L31.7 50.8L28.4 54.6L23.4 48.6Z', collar) + MIR(P_('M25 46.4L31.7 50.8L28.4 54.6L23.4 48.6Z', dk(collar, 0.12)))
      + R_(31.2, 50.6, 1.6, 9, dk(c, 0.14)) + C_(32, 53.6, 0.55, '#FFFFFF') + C_(32, 56.8, 0.55, '#FFFFFF');
  }
  function lapels(jacket, shirt, tie) {
    const lap = 'M25.8 46.2L22.8 51.6L26.2 53L24.6 55.2L31.2 64.6L30.6 60.4L26.8 48.4Z';
    return P_('M26 47L32 61L38 47Z', shirt)
      + (tie ? P_('M30.9 49.4L33.1 49.4L33.9 58.6L32 61.4L30.1 58.6Z', tie) + P_('M30.4 47.6L33.6 47.6L33.1 50L30.9 50Z', dk(tie, 0.18)) : '')
      + P_(lap, dk(jacket, 0.16)) + MIR(P_(lap, dk(jacket, 0.26)));
  }
  function jersey(o) {
    const bw = o.bw || 28, c = o.c, trim = o.trim || '#FFFFFF';
    let s = torso(c, bw, o.sy || 48);
    // shoulder-pad caps and sleeve stripes
    s += L_(`M${r2(32 - bw + 3.4)} 66C${r2(32 - bw + 3.2)} 58 ${r2(32 - bw + 5.4)} 53 ${r2(32 - bw + 8.6)} 50.6`, trim, 1.7);
    s += L_(`M${r2(32 + bw - 3.4)} 66C${r2(32 + bw - 3.2)} 58 ${r2(32 + bw - 5.4)} 53 ${r2(32 + bw - 8.6)} 50.6`, trim, 1.7);
    s += vneck(o.collar || trim, o.skin);
    if (o.num != null && o.num !== '') {
      const n = String(o.num), size = n.length > 1 ? 9.6 : 10.4;
      s += `<text x="32" y="64.6" font-size="${size}" fill="${o.numC || '#FFFFFF'}" text-anchor="middle" ${FONT_NUM}${o.outline ? ` stroke="${o.outline}" stroke-width=".9" paint-order="stroke"` : ''}>${esc(n)}</text>`;
    }
    if (o.logo) s += o.logo;
    return s;
  }
  // hands (body coords): a fist/palm blob with finger lines
  const hand = (x, y, skin, rot) => G_(P_('M-3.6 -1.6Q-3.8 -5 -1 -5.2L2.4 -5.2Q4.2 -5 4 -2.6L4 2.2Q3.8 4.6 1 4.6L-1.6 4.6Q-3.8 4.4 -3.6 1.8Z', skin) + L_('M-1.8 -1.6L2.6 -1.6M-1.8 .6L2.6 .6', dk(skin, 0.3), 0.6), `transform="translate(${x} ${y}) rotate(${rot || 0})"`);

  // ---- Hair (head coords) ----
  const HAIR_D = {
    cap: 'M21.2 26C20.6 15.4 25.5 10.6 32 10.6C38.5 10.6 43.4 15.4 42.8 26C42 21 40.2 18.2 37 17.4C34 16.7 30 16.7 27 17.4C23.8 18.2 22 21 21.2 26Z',
    flat: 'M22.1 21.4C21.5 14 22.5 8.6 24.6 6.6Q25.2 6 26.2 6L37.8 6Q38.8 6 39.4 6.6C41.5 8.6 42.5 14 41.9 21.4C40.6 18.8 38.6 17.6 36.4 17.2C33.6 16.8 30.4 16.8 27.6 17.2C25.4 17.6 23.4 18.8 22.1 21.4Z',
    swept: 'M21.4 25C20.4 14 25 9.4 32 9.4C39 9.4 43.6 14 42.6 25C41.6 20 39.6 17 35.4 16.2C31 15.6 26.2 16.6 24 19C22.6 20.6 21.8 22.6 21.4 25Z',
    slick: 'M21.4 24C20.6 13.4 25.6 8.2 32.6 8.3C39.6 8.4 43.8 13.4 42.6 24C42 19.4 40.4 16.4 37.6 15.6C33.4 14.6 27.6 15.4 25 17C23 18.3 21.8 21 21.4 24Z',
    bobBack: 'M19.6 37C18.2 22 21.4 9.6 32 9.6C42.6 9.6 45.8 22 44.4 37C42.2 38.2 41 37 40.6 34L23.4 34C23 37 21.8 38.2 19.6 37Z',
    bangs: 'M21.5 24.5C20.9 14.4 25.5 10.2 32 10.2C38.5 10.2 43.1 14.4 42.5 24.5C41.4 20.6 40.2 19.2 38.8 18.8C36 19.8 33 19.8 30 19.1C27 18.4 24.6 18.6 23.2 19.7C22.3 21 21.8 22.6 21.5 24.5Z',
  };
  const hairCap = c => P_(HAIR_D.cap, c);
  function hairStyle(style, c) {
    // returns { back, front } in head coords
    const hl = lt(c, 0.22);
    switch (style) {
      case 'buzz': return { back: '', front: P_(HAIR_D.cap, c, 'opacity=".92"') + L_('M24.6 15.6Q32 12.2 39.4 15.6', hl, 0.7, 'opacity=".45"') };
      case 'fade': return { back: '', front: P_(HAIR_D.cap, c, 'opacity=".55"') + P_(HAIR_D.flat, c) + L_('M25.4 9Q32 7.4 38.6 9', hl, 0.8, 'opacity=".5"') };
      case 'curls': {
        let s = P_(HAIR_D.cap, c);
        const pts = [[22.6, 19.4, 3.1], [24, 15, 3.4], [27.2, 11.6, 3.6], [31.6, 10, 3.7], [36.2, 11, 3.6], [39.8, 14.2, 3.4], [41.4, 18.8, 3.1], [29, 15.4, 3], [34.4, 14.8, 3]];
        for (const [x, y, r] of pts) s += C_(x, y, r, c);
        for (const [x, y] of pts.slice(1, 7)) s += C_(x - 0.8, y - 1.1, 0.9, hl, 'opacity=".5"');
        return { back: '', front: s };
      }
      case 'locs': {
        let back = '';
        for (const [x, len] of [[19.8, 47], [22.6, 50], [41.4, 50], [44.2, 47]]) back += R_(x - 1.5, 20, 3, len - 20, c, 'rx="1.5"');
        let front = P_(HAIR_D.cap, c) + C_(32, 7.6, 4.6, c) + R_(29, 9.8, 6, 2.2, TEAM.main, 'rx="1"');
        for (const x of [24.6, 28.4, 32, 35.6, 39.4]) front += L_(`M${x} 17.6Q${(x + 32) / 2} 13 32 10.6`, hl, 0.6, 'opacity=".5"');
        front += R_(20, 19.6, 3, 12, c, 'rx="1.5"') + R_(41, 19.6, 3, 12, c, 'rx="1.5"');
        return { back, front };
      }
      case 'flow': {
        const side = 'M20.4 21C18.6 29 19 37 21 43.4C22.4 41.4 23.8 42.4 25 44.2C24.6 38.6 23.8 33 23.6 27Z';
        return { back: P_(side, c) + MIR(P_(side, c)), front: P_(HAIR_D.swept, c) + L_('M25.6 15.4Q31 12.4 38.6 14.2', hl, 0.8, 'opacity=".55"') + L_('M24.4 18.4Q30 14.8 37.8 16.4', hl, 0.6, 'opacity=".35"') };
      }
      default: return { back: '', front: hairCap(c) };
    }
  }

  // ---- Generic portrait assembler ----
  // o: { bg, skin, jaw, head:{sx,sy,dx,dy}, back, backHead, body, under, brows:[type,color,w], eyes, lash, mouth,
  //      blush, freckles, paint, beard, stache, hair, acc, front, nose, earsOff, neck:[nw,bot], faceless }
  function portrait(o) {
    const skin = o.skin, shade = dk(skin, 0.16);
    const h = o.head || {};
    const sx = h.sx || 1, sy = h.sy || sx, dx = h.dx || 0, dy = h.dy || 0;
    // Every head is drawn a little larger than the body (reads better at 56px), anchored at the chin.
    const HS = o.hs || 1.12;
    const SX = sx * HS, SY = sy * HS;
    const tf = ` transform="matrix(${r2(SX)} 0 0 ${r2(SY)} ${r2(HS * (32 - 32 * sx + dx) + 32 - 32 * HS)} ${r2(HS * (27 - 27 * sy + dy) + 42 - 42 * HS)})"`;
    const jaw = o.jaw == null ? 0.62 : o.jaw;
    let s = tile(o.bg);
    if (o.back) s += o.back;
    if (o.backHead) s += `<g${tf}>${o.backHead}</g>`;
    if (!o.noNeck) s += neck(skin, (o.neck && o.neck[0]) || 5.2, (o.neck && o.neck[1]) || 51);
    s += o.body || '';
    s += o.under || '';
    let hd = '';
    if (!o.earsOff) hd += E_(21.7, 27.8, 2.1, 3, skin) + E_(42.3, 27.8, 2.1, 3, shade) + L_('M21.2 26.6Q22.2 27.8 21.4 29.2', dk(skin, 0.3), 0.6);
    hd += P_(headD(21.5, 42.5, 12, 40, jaw), shade);
    hd += P_(headD(21.5, 41.2, 12.2, 39, jaw), skin);
    if (!o.faceless) {
      hd += E_(28, 18.6, 4.4, 2.4, '#FFFFFF', 'opacity=".13"');
      if (o.paint) hd += o.paint;
      if (o.blush) hd += C_(26, 31.4, 1.9, '#E66F62', 'opacity=".3"') + C_(38, 31.4, 1.9, '#E66F62', 'opacity=".3"');
      if (o.freckles) for (const [x, y] of [[25.4, 30.6], [26.8, 31.6], [24.6, 31.8], [38.6, 30.6], [37.2, 31.6], [39.4, 31.8]]) hd += C_(x, y, 0.42, dk(skin, 0.35));
      hd += eyes(o.eyes || 'dot', skin, o.lash);
      if (o.under_eye) hd += o.under_eye;
      const b = o.brows || ['flat', dk(skin, 0.6)];
      hd += brows(b[0], b[1], b[2]);
      if (o.nose !== false) hd += L_('M32.4 28.3Q30.3 31.9 32.7 32.5', dk(skin, 0.3), 1.15);
      if (o.beard) hd += o.beard;
      hd += mouth(o.mouth || 'smile', skin);
      if (o.stache) hd += o.stache;
    }
    hd += o.hair || '';
    hd += o.acc || '';
    s += `<g${tf}>${hd}</g>`;
    s += o.front || '';
    return svg('0 0 64 64', s, 'class="pt"');
  }

  // ---- Reusable facial hair / accessories (head coords) ----
  const beardD = 'M21.6 25.4C21.4 34 25.6 41.6 32 41.6C38.4 41.6 42.6 34 42.4 25.4L40.6 25.6C40.6 30.4 38.6 33.2 36.2 33.4C34.4 32.6 29.6 32.6 27.8 33.4C25.4 33.2 23.4 30.4 23.4 25.6Z';
  const fullBeard = c => P_(beardD, c);
  const stubble = c => P_(beardD, c, 'opacity=".28"');
  const stache = (c, kind) => kind === 'broom'
    ? P_('M26.6 33.6Q27.4 31 32 31.4Q36.6 31 37.4 33.6Q35.6 34.4 34 33.4Q32 33.8 30 33.4Q28.4 34.4 26.6 33.6Z', c)
    : P_('M28 33.4Q29.4 31.8 32 32.2Q34.6 31.8 36 33.4Q34.4 33.8 32 33.3Q29.6 33.8 28 33.4Z', c);
  const roundGlasses = (c, lens) => C_(EX[0], EY, 3.3, lens || '#FFFFFF', 'opacity=".14"') + C_(EX[1], EY, 3.3, lens || '#FFFFFF', 'opacity=".14"')
    + `<circle cx="${EX[0]}" cy="${EY}" r="3.3" fill="none" stroke="${c}" stroke-width="1.05"/><circle cx="${EX[1]}" cy="${EY}" r="3.3" fill="none" stroke="${c}" stroke-width="1.05"/>`
    + L_(`M${EX[0] + 3.2} ${EY - 0.4}Q32 ${EY - 1.6} ${EX[1] - 3.2} ${EY - 0.4}`, c, 1) + L_(`M${EX[0] - 3.3} ${EY - 0.6}L21.6 ${EY - 1.4}M${EX[1] + 3.3} ${EY - 0.6}L42.4 ${EY - 1.4}`, c, 0.9);
  const rectGlasses = c => `<rect x="${EX[0] - 3.5}" y="${EY - 2.5}" width="7" height="5" rx="1.6" fill="#FFFFFF" fill-opacity=".14" stroke="${c}" stroke-width="1.05"/><rect x="${EX[1] - 3.5}" y="${EY - 2.5}" width="7" height="5" rx="1.6" fill="#FFFFFF" fill-opacity=".14" stroke="${c}" stroke-width="1.05"/>`
    + L_(`M${EX[0] + 3.5} ${EY - 0.8}Q32 ${EY - 1.8} ${EX[1] - 3.5} ${EY - 0.8}`, c, 1);
  const readers = c => `<path d="M${EX[0] - 3.4} ${EY + 1}L${EX[0] + 3.4} ${EY + 1}L${EX[0] + 3} ${EY + 3.6}Q${EX[0]} ${EY + 4.6} ${EX[0] - 3} ${EY + 3.6}Z" fill="#FFFFFF" fill-opacity=".16" stroke="${c}" stroke-width="1"/><path d="M${EX[1] - 3.4} ${EY + 1}L${EX[1] + 3.4} ${EY + 1}L${EX[1] + 3} ${EY + 3.6}Q${EX[1]} ${EY + 4.6} ${EX[1] - 3} ${EY + 3.6}Z" fill="#FFFFFF" fill-opacity=".16" stroke="${c}" stroke-width="1"/>` + L_(`M${EX[0] + 3.4} ${EY + 1.2}Q32 ${EY + 0.2} ${EX[1] - 3.4} ${EY + 1.2}`, c, 0.9);
  const shades = () => P_(`M${EX[0] - 3.9} ${EY - 2.2}L${EX[0] + 3.6} ${EY - 2.2}Q${EX[0] + 3.8} ${EY + 3.4} ${EX[0]} ${EY + 3.2}Q${EX[0] - 3.9} ${EY + 3} ${EX[0] - 3.9} ${EY - 2.2}Z`, '#14161C')
    + P_(`M${EX[1] - 3.6} ${EY - 2.2}L${EX[1] + 3.9} ${EY - 2.2}Q${EX[1] + 3.9} ${EY + 3} ${EX[1]} ${EY + 3.2}Q${EX[1] - 3.8} ${EY + 3.4} ${EX[1] - 3.6} ${EY - 2.2}Z`, '#14161C')
    + L_(`M${EX[0] - 4} ${EY - 2.2}L${EX[1] + 4} ${EY - 2.2}`, '#D9B44A', 1) + L_(`M${EX[0] - 2.2} ${EY - 0.6}L${EX[0] + 0.4} ${EY + 1.6}M${EX[1] - 2.2} ${EY - 0.6}L${EX[1] + 0.4} ${EY + 1.6}`, '#FFFFFF', 0.8, 'opacity=".55"');
  const eyeBlack = () => R_(EX[0] - 2.3, EY + 2.6, 4.6, 1.5, '#121212', 'rx=".6"') + R_(EX[1] - 2.3, EY + 2.6, 4.6, 1.5, '#121212', 'rx=".6"');
  function ballCap(c, brim, logo, logoC) {
    return P_('M20.8 21.4C20.4 12 25.6 7.4 32 7.4C38.4 7.4 43.6 12 43.2 21.4Z', c)
      + L_('M32 7.6L32 21M26 9.2Q27.2 15 27 21M38 9.2Q36.8 15 37 21', dk(c, 0.25), 0.6)
      + P_('M20.4 20.6Q32 16.8 46.8 21.2Q47.6 22.8 45.8 23.4Q33 20 21 23Z', brim || dk(c, 0.15))
      + C_(32, 7.6, 1.1, dk(c, 0.2))
      + (logo ? `<text x="32" y="17.6" font-size="7.6" fill="${logoC || TEAM.main}" text-anchor="middle" ${FONT_NUM}>${esc(logo)}</text>` : '');
  }
  function headset(c) {
    return L_('M20.4 25Q19.6 7.6 32 7.6Q44.4 7.6 43.6 25', c, 2.2)
      + R_(18.4, 23.6, 4.6, 7.4, c, 'rx="2"') + R_(41, 23.6, 4.6, 7.4, c, 'rx="2"')
      + L_('M20.4 29.6Q21 36 28.2 36.4', c, 1.1) + C_(28.8, 36.4, 1.3, '#2C2C2C');
  }

  // ---- Props (body coords) ----
  const whistle = () => L_('M27 47.6Q29 54.6 33.6 56.4M37 47.6Q36.6 53.6 34.6 56', '#F0F0F0', 0.8)
    + R_(31.6, 55.4, 6, 3.2, '#C9D0D6', 'rx="1.4"') + C_(36.6, 58.2, 2, '#B4BCC4') + R_(31.2, 55.8, 1.4, 2.4, '#8C949C', 'rx=".4"');
  const stopwatch = () => L_('M27 47.6Q29 54 31.8 56M37 47.6Q35.6 53.6 33.2 56', '#E8E8E8', 0.8)
    + C_(32.4, 58.8, 3.4, '#D7DCE0') + C_(32.4, 58.8, 2.5, '#FFFFFF') + L_('M32.4 58.8L32.4 57M32.4 58.8L33.8 59.4', '#222', 0.6) + R_(31.8, 54.6, 1.2, 1.2, '#B4BCC4');
  function mic(x, y, flag, flagC, skin) {
    return G_(R_(-1.1, 0, 2.2, 13, '#2A2E35', 'rx="1"') + C_(0, -1, 3.2, '#3A3F48') + C_(0, -1, 3.2, 'none', 'stroke="#777" stroke-width=".5" stroke-dasharray=".8 .8"')
      + (flag ? R_(-3.6, 2.4, 7.2, 5, flagC || '#C2272D', 'rx=".6"') + `<text x="0" y="6.2" font-size="3.6" fill="#FFFFFF" text-anchor="middle" ${FONT_LBL}>${esc(flag)}</text>` : '')
      + hand(0, 10.6, skin, 0), `transform="translate(${x} ${y}) rotate(-12)"`);
  }

  // =========================================================
  //   THE CAST
  // =========================================================
  const CAST = {};
  const vnum = () => (S && S.pos && typeof VANE_NUM !== 'undefined' ? VANE_NUM[S.pos] : 9);
  const pnum = () => (S && S.num != null ? S.num : 7);

  CAST['Coach Bramble'] = () => {
    const skin = '#E9B697';
    return portrait({ bg: '#2A3A57', skin, jaw: 0.78,
      body: torso('#1B2740', 26) + standCollar('#24345A', '#C7CDD6') + L_('M12 58L20 52', TEAM.main, 1.6) + L_('M52 58L44 52', TEAM.main, 1.6),
      front: whistle(),
      brows: ['down', '#9EA2A8', 1.9], eyes: 'dot', mouth: 'flat',
      hair: P_('M21 27C20.8 23.6 21.2 21.6 22.2 20.6L23.6 21L23.4 27Z', '#B9BCC0') + MIR(P_('M21 27C20.8 23.6 21.2 21.6 22.2 20.6L23.6 21L23.4 27Z', '#B9BCC0')),
      stache: stache('#C5C8CC', 'broom'),
      beard: L_('M24.6 33.4Q26 37.4 29 38.4M39.4 33.4Q38 37.4 35 38.4', dk(skin, 0.25), 0.7, 'opacity=".6"'),
      acc: ballCap('#1B2740', '#14203A', 'H', TEAM.main),
    });
  };
  CAST['Coach Okafor'] = () => {
    const skin = '#7B4A2C', hair = '#1B1311';
    let braids = '';
    for (let i = 0; i < 5; i++) braids += R_(17.6 + i * 1.2, 22 + i * 0.6, 2.6, 26 - i, hair, 'rx="1.3"');
    let grooves = '';
    for (const x of [24, 27.6, 32, 36.4, 40]) grooves += L_(`M${x} 18Q${(x + 32) / 2} 12.6 32 10.8`, '#3A2A24', 0.7);
    return portrait({ bg: '#1D5A5E', skin, jaw: 0.6, lash: true,
      backHead: braids + MIR(braids),
      body: torso(TEAM.main, 25) + polo(TEAM.main, TEAM.navy, skin) + C_(41, 54, 1.8, TEAM.navy) + `<text x="41" y="55.3" font-size="3" fill="${TEAM.main}" text-anchor="middle" ${FONT_NUM}>H</text>`,
      brows: ['raise', '#1B1311', 1.4], eyes: 'dot', mouth: 'smirk',
      hair: hairCap(hair) + grooves,
      acc: headset('#24282E'),
    });
  };
  CAST['Tiny'] = () => {
    const skin = '#A8714A', hair = '#16100E';
    const bowl = P_('M38 56Q38 64.6 48 64.6Q58 64.6 58 56Z', '#F4F1EA') + E_(48, 56, 10, 2.2, '#E7DCC6') + C_(44, 55.6, 1.2, '#F2C14E') + C_(47.4, 55.2, 1.2, '#E5621C') + C_(50.6, 55.8, 1.2, '#5BD68A') + C_(53, 55.2, 1.1, '#69C3E6')
      + R_(47, 46, 2, 11, '#C9D0D6', 'rx="1" transform="rotate(18 48 52)"') + E_(46.2, 45.2, 2.2, 3, '#DDE2E6', 'transform="rotate(18 46.2 45.2)"') + L_('M37.8 57.4Q48 60 58.2 57.4', '#D2C7B0', 0.8);
    return portrait({ bg: '#7A3A1C', skin, jaw: 0.78, head: { sx: 1.13, sy: 1.04, dy: 1 }, neck: [8, 51],
      body: torso(TEAM.navy, 33, 47) + crew(TEAM.main) + `<text x="20" y="62" font-size="8" fill="${TEAM.main}" text-anchor="middle" ${FONT_NUM}>71</text>`,
      front: bowl,
      brows: ['arch', hair, 1.7], eyes: 'happy', mouth: 'big', blush: true,
      hair: P_('M21.2 24C20.4 14 25.6 10 32 10C38.4 10 43.6 14 42.8 24C41.6 19.4 39.2 17 32 16.8C24.8 17 22.4 19.4 21.2 24Z', hair) + C_(32, 8.4, 3.6, hair) + R_(29.4, 10.6, 5.2, 1.8, TEAM.main, 'rx=".9"'),
    });
  };
  CAST['Marcus Vane'] = () => {
    const skin = '#6B3F26', hair = '#17110F', gray = '#B7B4AE';
    const temple = 'M21.3 26C21 22.4 21.6 19.8 22.8 18.2L24.6 18.8C23.6 20.8 23 23.4 23 26Z';
    return portrait({ bg: '#1C2A47', skin, jaw: 0.74,
      body: jersey({ c: TEAM.main, trim: TEAM.navy, collar: TEAM.navy, skin, num: vnum(), numC: '#FFFFFF', outline: TEAM.navy, bw: 28 }),
      brows: ['flat', '#120C0A', 1.7], eyes: 'dot', mouth: 'flat',
      beard: P_(beardD, hair, 'opacity=".9"') + P_('M30 39.4Q32 41.6 34 39.4L33.6 41.2Q32 41.8 30.4 41.2Z', gray, 'opacity=".9"') + L_('M24 32.4Q24.6 36 26.6 38.2M40 32.4Q39.4 36 37.4 38.2', gray, 0.7, 'opacity=".7"'),
      stache: stache(hair),
      hair: P_(HAIR_D.cap, hair) + P_(temple, gray) + MIR(P_(temple, gray)),
    });
  };
  CAST['Dante Kingsley'] = () => {
    const skin = '#8A5534', hair = '#120D0B', gold = '#F2C14E', purple = '#4B1F73';
    const crown = 'M36.6 44.6L37.4 41.6L38.6 43.2L39.6 41.2L40.6 43.2L41.8 41.6L42.6 44.6Z';
    return portrait({ bg: '#3A1B58', skin, jaw: 0.7,
      body: jersey({ c: purple, trim: gold, collar: gold, skin, num: '1', numC: gold, outline: '#2A0F42', bw: 27 }),
      under: P_(crown, 'none', `stroke="${dk(skin, 0.5)}" stroke-width=".7"`),
      front: L_('M25.6 47.4Q32 58 38.4 47.4', gold, 1.3) + L_('M25.6 47.4Q32 58 38.4 47.4', '#FFF3C4', 0.5, 'stroke-dasharray=".6 1.2"') + P_('M30 54.6L30.8 52.6L32 53.8L33.2 52.6L34 54.6Z', gold),
      brows: ['flat', hair, 1.5], eyes: 'dot', mouth: 'smirk',
      hair: P_(HAIR_D.cap, hair, 'opacity=".55"') + P_('M23 20C22.6 14 25.2 9.6 32 9.6C38.8 9.6 41.4 14 41 20C39.6 17.8 37 17 32 17C27 17 24.4 17.8 23 20Z', hair) + L_('M24.2 19.2L28 13.6', '#6B4A3A', 0.7),
      acc: C_(42.4, 30.8, 0.9, gold),
      stache: L_('M29.4 32.8Q32 32.2 34.6 32.8', hair, 0.8, 'opacity=".6"'),
    });
  };
  CAST['Jules Park'] = () => {
    const skin = '#ECC4A2', hair = '#16161C';
    return portrait({ bg: '#5A1F2C', skin, jaw: 0.6,
      backHead: P_(HAIR_D.bobBack, hair),
      body: torso('#24405E', 25) + lapels('#24405E', '#F2F2EE', null),
      front: mic(47, 47, 'HCL', '#C2272D', skin),
      brows: ['arch', hair, 1.3], eyes: 'dot', mouth: 'soft',
      hair: P_(HAIR_D.bangs, hair) + P_('M21.4 22.4L23.6 21.2L23.6 33.6C22.6 34.6 21.4 34.2 21 33.2Z', hair) + MIR(P_('M21.4 22.4L23.6 21.2L23.6 33.6C22.6 34.6 21.4 34.2 21 33.2Z', hair)),
      acc: roundGlasses('#2B2B2B'), earsOff: true,
    });
  };
  CAST['Sly Pemberton'] = () => {
    const skin = '#EFC3A3', hair = '#2A1C14';
    let check = '';
    for (const x of [10, 18, 46, 54]) check += L_(`M${x} 50L${x - 2} 66`, '#F2C14E', 0.7, 'opacity=".6"');
    return portrait({ bg: '#22243E', skin, jaw: 0.72,
      body: torso('#B5297A', 26) + check + lapels('#B5297A', '#FFFFFF', '#F2C14E') + P_('M40 52.6L44.6 51.6L44 54.4Z', '#F2C14E'),
      brows: ['arch', hair, 1.3], mouth: 'big',
      hair: P_(HAIR_D.slick, hair) + L_('M25 14.2Q31.4 10.2 39.4 12.6', '#FFFFFF', 0.9, 'opacity=".4"') + L_('M24.6 16.8Q30 13.6 37.6 14.8', '#FFFFFF', 0.6, 'opacity=".25"'),
      acc: shades(),
      front: P_('M60 6l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z', '#F2C14E') + P_('M7 11l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z', '#F2C14E', 'opacity=".8"'),
    });
  };
  CAST['Margaret'] = () => {
    const skin = '#D9A27E', hair = '#C9C4BE';
    let pearls = '';
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = 26.4 + t * 11.2, y = 47.6 + Math.sin(t * Math.PI) * 5; pearls += C_(x, y, 0.8, '#FBF6EC'); }
    return portrait({ bg: '#2F4A3B', skin, jaw: 0.6, lash: true,
      backHead: P_(HAIR_D.bobBack, hair),
      body: torso('#7E9A6C', 25) + P_('M26.4 47L32 58L37.6 47Z', '#F3EEE2') + L_('M26 47.2L31.2 66', dk('#7E9A6C', 0.18), 2.4) + L_('M38 47.2L32.8 66', dk('#7E9A6C', 0.18), 2.4) + C_(34.4, 60, 0.7, '#E8E2D0') + C_(35.2, 63.4, 0.7, '#E8E2D0') + pearls,
      brows: ['arch', '#A8A29A', 1.2], eyes: 'dot', mouth: 'soft',
      hair: P_(HAIR_D.bangs, hair) + P_('M21.4 22.4L23.6 21.2L23.6 32.6C22.6 33.6 21.4 33.2 21 32.2Z', hair) + MIR(P_('M21.4 22.4L23.6 21.2L23.6 32.6C22.6 33.6 21.4 33.2 21 32.2Z', hair)) + L_('M26 13.6Q31 11.6 37 13', '#FFFFFF', 0.7, 'opacity=".45"'),
      acc: readers('#7A4B2A') + L_('M21.6 28L19.6 40', '#C9A35A', 0.5) + L_('M42.4 28L44.4 40', '#C9A35A', 0.5), earsOff: true,
    });
  };
  CAST['Leo'] = () => {
    const skin = '#D7A27B';
    const beanie = P_('M20.6 22.6C20 12.2 25 7.6 32 7.6C39 7.6 44 12.2 43.4 22.6Z', TEAM.navy) + R_(20, 19.2, 24, 4.6, dk(TEAM.navy, 0.2), 'rx="2"') + L_('M20.6 21.4L43.4 21.4', TEAM.main, 1.1) + C_(32, 6.6, 2.8, TEAM.main)
      + L_('M25 18Q32 15.6 39 18', TEAM.main, 0.9) + L_('M28 9.8L28.2 18M32 8.4L32 18M36 9.8L35.8 18', dk(TEAM.navy, 0.35), 0.5);
    return portrait({ bg: '#2D5B88', skin, jaw: 0.56, head: { sx: 0.9, dy: 3.2 }, neck: [4.2, 52],
      body: jersey({ c: TEAM.main, trim: TEAM.navy, collar: TEAM.navy, skin, num: pnum(), numC: '#FFFFFF', outline: TEAM.navy, bw: 31, sy: 50 }) + L_('M8 66L12 56M56 66L52 56', dk(TEAM.main, 0.25), 0.8),
      brows: ['arch', '#6A4630', 1.2], eyes: 'wide', mouth: 'gap', freckles: true, blush: true,
      hair: P_('M21.2 24.6L22.4 19.6L24.6 23.4Z', '#6A4630') + P_('M42.8 24.6L41.6 19.6L39.4 23.4Z', '#6A4630'),
      acc: beanie,
    });
  };
  CAST['Grandma Bea'] = () => {
    const skin = '#F1CBB0', hair = '#ECE9E4';
    let curls = '';
    for (const [x, y] of [[22.4, 19.6], [24.4, 15.6], [28, 12.6], [32, 11.8], [36, 12.6], [39.6, 15.6], [41.6, 19.6]]) curls += C_(x, y, 3, hair);
    return portrait({ bg: '#2F6E7A', skin, jaw: 0.6, lash: true,
      body: torso('#86B6D9', 25) + crew('#FFFFFF') + P_('M26 53Q32 51.6 38 53L38.8 66L25.2 66Z', '#FBF7EE') + L_('M26.4 53.4L24.6 47.6M37.6 53.4L39.4 47.6', '#FBF7EE', 1.6)
        + P_('M30 58.4Q31.6 56.4 33.8 57.4L35.2 56.8L34.4 58.4Q32.4 60.4 30 58.4Z', '#3E7FC4') + C_(33.4, 57.6, 0.4, '#111'),
      under: '',
      brows: ['arch', '#BDB7AF', 1.2], eyes: 'happy', mouth: 'grin', blush: true,
      hair: P_(HAIR_D.cap, hair) + curls + C_(32, 7.6, 4.4, hair) + L_('M29 6.6Q32 5 35 6.6', '#FFFFFF', 0.7, 'opacity=".6"'),
      acc: roundGlasses('#B24A6A') + L_('M44 19.6L39.6 26.6', '#F2C14E', 1.3) + P_('M44 19.6L44.8 18.4L45 19.9Z', '#333'),
    });
  };
  CAST['Mom'] = () => {
    const skin = '#8B593A', hair = '#1A1210';
    const scrub = '#3C8E9B';
    return portrait({ bg: '#22445C', skin, jaw: 0.6, lash: true,
      body: torso(scrub, 25) + P_('M26.2 47L32 55L37.8 47Z', dk(skin, 0.2)) + L_('M26.2 47L32 55L37.8 47', dk(scrub, 0.25), 1.4)
        + R_(37.6, 56.4, 6.4, 5.6, dk(scrub, 0.12), 'rx=".6"') + L_('M39.2 56.6L39.2 54.2', '#F2F2F2', 0.9) + L_('M41 56.6L41 54.6', '#E5621C', 0.9)
        + L_('M27 47.4L24.6 58', '#2F5B8A', 0.9) + R_(21.6, 57.6, 5.4, 6.4, '#F6F8FA', 'rx=".7"') + R_(22.4, 58.4, 2, 2.2, '#9DB3C8'),
      brows: ['arch', hair, 1.3], eyes: 'dot', mouth: 'soft',
      hair: P_(HAIR_D.cap, hair) + C_(32, 6.4, 5.4, hair) + R_(28.2, 9.4, 7.6, 1.8, '#C94A6E', 'rx=".9"') + L_('M29 3.6Q32 2.4 35 3.6', lt(hair, 0.3), 0.7, 'opacity=".6"'),
      acc: C_(21.6, 31.2, 0.8, '#F2C14E') + C_(42.4, 31.2, 0.8, '#F2C14E'),
    });
  };
  CAST['Dad'] = () => {
    const skin = '#C08A5E', olive = '#56633A';
    return portrait({ bg: '#3A4630', skin, jaw: 0.78,
      body: torso('#4E5A36', 26) + crew(dk('#4E5A36', 0.2)) + L_('M27 47.4Q30.6 54.6 32.6 55.6M37 47.4Q34.4 53.6 33 55.4', '#C9CED2', 0.6) + R_(31, 55, 3, 4.4, '#C9CED2', 'rx=".8" transform="rotate(-8 32.5 57)"') + R_(32.6, 55.6, 3, 4.4, '#AEB4BA', 'rx=".8" transform="rotate(10 34 58)"'),
      brows: ['flat', '#2A1C14', 1.7], eyes: 'dot', mouth: 'smile',
      stache: stache('#2A1C14'),
      hair: P_('M21 27C20.8 23.6 21.2 21.6 22.2 20.6L23.6 21L23.4 27Z', '#2A1C14') + MIR(P_('M21 27C20.8 23.6 21.2 21.6 22.2 20.6L23.6 21L23.4 27Z', '#2A1C14')),
      acc: P_('M20.6 21.2L21.6 9.4Q32 7.2 42.4 9.4L43.4 21.2Z', olive) + P_('M18.8 21Q32 18.4 45.2 21L44.2 24Q32 21.8 19.8 24Z', dk(olive, 0.25))
        + L_('M21.4 12.6L42.6 12.6', dk(olive, 0.18), 0.6) + R_(29.6, 14, 4.8, 3.4, '#2A2E22', 'rx=".4"') + P_('M31 15.6L32 14.6L33 15.6L32 16.6Z', '#C9A35A'),
    });
  };
  CAST['The Turk'] = () => {
    const sil = '#0F1317', rim = '#F3D58A';
    const headRim = L_('M41.4 15.6Q43.6 20 43.2 27.6M43.6 25.6Q45 27.6 43.4 30.6', rim, 0.9, 'opacity=".75"');
    return portrait({ bg: '#262C35', skin: sil, jaw: 0.72, faceless: true,
      back: R_(44, 0, 20, 64, '#F7E3A6', 'opacity=".2"') + R_(47, 0, 4, 64, '#FFF4CC', 'opacity=".22"') + R_(0, 0, 9, 64, '#000000', 'opacity=".18"'),
      body: P_(torsoD(32, 27, 48), sil) + L_('M40 47.4Q50 49.4 55.6 58', rim, 1, 'opacity=".6"'),
      hair: headRim,
      acc: P_('M20.8 21.4C20.4 12 25.6 7.4 32 7.4C38.4 7.4 43.6 12 43.2 21.4Z', '#171C22') + P_('M20.4 20.6Q32 16.8 46.8 21.2Q47.6 22.8 45.8 23.4Q33 20 21 23Z', '#0B0E11') + L_('M38 8.6Q42.6 11.4 43 18.6', rim, 0.8, 'opacity=".6"'),
      front: R_(21, 48.6, 22, 17, '#8A6A44', 'rx="1.4"') + R_(23, 51.4, 18, 13, '#F4F1EA') + R_(28.4, 47.4, 7.2, 3.6, '#B8C0C8', 'rx="1"')
        + L_('M25.4 55H38.6M25.4 58H36.4M25.4 61H37.6', '#9AA3AD', 0.7) + hand(22.4, 58, sil, -20) + hand(41.6, 58, sil, 20),
    });
  };
  CAST['Shark Man'] = () => {
    const skin = '#E7B892', sharkC = '#6F8499';
    let teeth = '';
    for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * 0.1125), x = 32 + Math.cos(a) * 14.4, y = 26 + Math.sin(a) * 15.6; teeth += P_(`M${r2(x - 1.3)} ${r2(y)}L${r2(x + 1.3)} ${r2(y)}L${r2(32 + Math.cos(a) * 11.6)} ${r2(26 + Math.sin(a) * 12.6)}Z`, '#FFFFFF'); }
    return portrait({ bg: '#1D4E73', skin, jaw: 0.66, earsOff: true,
      backHead: P_('M14 34C12 14 21 3 32 3C43 3 52 14 50 34C49 44 42 48 32 48C22 48 15 44 14 34Z', sharkC) + P_('M15.4 36C18 44 24 47.6 32 47.6C40 47.6 46 44 48.6 36C44 42 38 44 32 44C26 44 20 42 15.4 36Z', '#E9EEF2') + P_('M29 3.6L37 -5L38.6 4.6Z', dk(sharkC, 0.2)),
      body: torso('#3B4C5E', 27) + lapels('#3B4C5E', '#FFFFFF', '#E5621C'),
      brows: ['arch', '#6B4A30', 1.4], eyes: 'wide', mouth: 'shout',
      hair: `<path d="M18 29C17 15 24 8 32 8C40 8 47 15 46 29" fill="none" stroke="${sharkC}" stroke-width="4.6"/>` + teeth + C_(17.6, 14, 1.8, '#111') + C_(46.4, 14, 1.8, '#111') + C_(18, 13.4, 0.5, '#FFF') + C_(46.8, 13.4, 0.5, '#FFF')
        + L_('M14.6 34Q13.4 38 16.6 41M49.4 34Q50.6 38 47.4 41', dk(sharkC, 0.3), 0.8),
      front: mic(50, 44, 'TV', '#1D4E73', skin),
    });
  };
  CAST['Superfan'] = () => {
    const skin = '#6E4128', hat = TEAM.main;
    return portrait({ bg: '#123A5A', skin, jaw: 0.68,
      body: jersey({ c: TEAM.main, trim: TEAM.navy, collar: TEAM.navy, skin, num: '00', numC: '#FFFFFF', outline: TEAM.navy, bw: 27 }),
      paint: P_(halfFaceD(0.68, -1), TEAM.main, 'opacity=".85"') + P_(halfFaceD(0.68, 1), TEAM.navy, 'opacity=".8"'),
      brows: ['arch', '#120C0A', 1.6], eyes: 'wide', mouth: 'shout',
      hair: hairCap('#120C0A'),
      acc: P_('M26 14.6Q32 4 38 14.6Z', hat) + P_('M6 9.4Q32 1.6 58 9.4Q59.6 13.4 56.6 15Q32 9.6 7.4 15Q4.4 13.4 6 9.4Z', hat) + L_('M9 13.4Q32 8.4 55 13.4', dk(hat, 0.25), 0.8)
        + C_(8.6, 11.6, 2.6, '#FFFFFF') + C_(55.4, 11.6, 2.6, '#FFFFFF') + C_(8.2, 11.8, 1.3, '#111') + C_(55.8, 11.8, 1.3, '#111')
        + P_('M29.6 6.6L32 -1L35 6.4Z', dk(hat, 0.12)) + L_('M24 11.4Q32 13.6 40 11.4', '#16233F', 0.9),
    });
  };
  CAST['Hands Greer'] = () => {
    const skin = '#5B3420', gray = '#D8D4CC';
    const ringHand = G_(P_('M-4.4 4L-4.6 -4.6Q-4.4 -6.4 -3 -6.4Q-1.6 -6.4 -1.6 -4.6L-1.4 -8Q-1.2 -9.6 0 -9.6Q1.4 -9.6 1.4 -8L1.6 -7.2Q1.8 -8.6 3 -8.6Q4.4 -8.6 4.4 -7L4.4 -5Q4.8 -6 5.8 -5.8Q7 -5.6 6.8 -4L6.4 2Q6 7 1.4 7.4L-1.2 7.4Q-4.2 7 -4.4 4Z', skin)
      + R_(-2.2, -3.6, 4.2, 2.6, '#F2C14E', 'rx=".8"') + C_(0, -2.3, 1, '#FFF3B0') + L_('M3.6 -10.6l1 -2M6.4 -9.4l1.8 -1.2M0 -11.4V-13.6', '#F2C14E', 0.7), 'transform="translate(50 54) rotate(10)"');
    return portrait({ bg: '#4A3A27', skin, jaw: 0.74,
      body: torso('#2E4A7A', 26) + crew('#E9E2D0') + L_('M9 58L15 51.4M11 61.6L17.4 54.6', '#E9E2D0', 1.4) + `<text x="23" y="62" font-size="7.6" fill="#E9E2D0" text-anchor="middle" ${FONT_NUM}>88</text>`,
      front: ringHand,
      brows: ['flat', gray, 1.7], eyes: 'shut', mouth: 'smile',
      beard: P_('M21.4 24.6C21 35 25 43.6 32 43.6C39 43.6 43 35 42.6 24.6L40.6 25C40.6 30.4 38.6 33.4 36.2 33.6C34.4 32.6 29.6 32.6 27.8 33.6C25.4 33.4 23.4 30.4 23.4 25Z', gray),
      stache: stache(gray),
      hair: P_('M21 26.6C20.8 23.4 21.4 21 22.4 19.8L23.8 20.4L23.4 26.6Z', gray) + MIR(P_('M21 26.6C20.8 23.4 21.4 21 22.4 19.8L23.8 20.4L23.4 26.6Z', gray)) + E_(30, 15.4, 4.6, 2, '#FFFFFF', 'opacity=".16"'),
    });
  };
  CAST['Bryce Calloway'] = () => {
    const skin = '#E0AE86', hair = '#3A2416', tips = '#F4D27A';
    let spikes = '';
    for (let i = 0; i < 7; i++) { const x = 23 + i * 3; spikes += P_(`M${x - 2} 16.6L${x + 0.6} ${7.6 + (i % 2) * 1.6}L${x + 2.6} 16.6Z`, i % 2 ? tips : lt(tips, 0.15)); }
    return portrait({ bg: '#1E3E8C', skin, jaw: 0.66,
      body: jersey({ c: TEAM.main, trim: TEAM.navy, collar: TEAM.navy, skin, num: '1', numC: '#FFFFFF', outline: TEAM.navy, bw: 27 })
        + L_('M26 47.6Q32 55.4 38 47.6', '#E8EEF2', 0.9),
      brows: ['raise', hair, 1.4], eyes: 'dot', mouth: 'smirk',
      hair: P_(HAIR_D.cap, hair) + spikes,
      acc: P_('M21 19.6Q32 15.8 43 19.6L42.9 23Q32 19.4 21.1 23Z', '#FFFFFF') + L_('M21.4 21.4Q32 17.8 42.6 21.4', TEAM.main, 1.1)
        + P_('M42.4 30.4l.9 1.2-.9 1.2-.9-1.2z', '#BFF3FF') + C_(42.4, 31.6, 0.35, '#FFFFFF'),
    });
  };
  CAST['Coach Delgado'] = () => {
    const skin = '#C68B5E', hair = '#2B211C', maroon = '#7A2433';
    return portrait({ bg: '#4A1E26', skin, jaw: 0.72,
      body: torso(maroon, 26) + standCollar(dk(maroon, 0.15), '#E8C66A') + L_('M9.6 60L19 50.6M12.4 63.6L21.6 53.4', '#E8C66A', 1.2) + L_('M54.4 60L45 50.6M51.6 63.6L42.4 53.4', '#E8C66A', 1.2),
      front: stopwatch(),
      brows: ['arch', hair, 1.8], eyes: 'dot', mouth: 'smile',
      stache: stache(hair),
      hair: P_('M21.2 25C20.8 15 25.2 11 32 11C38.8 11 43.2 15 42.8 25C42 21 40.8 18.6 38.8 17.6C37.4 18.4 35.6 17 32 17C28.4 17 26.6 18.4 25.2 17.6C23.2 18.6 22 21 21.2 25Z', hair)
        + L_('M22.4 21.6Q22.2 24 22.6 26M41.6 21.6Q41.8 24 41.4 26', '#9C978F', 1.2),
      acc: L_('M43.6 20.4L37.4 28.8', '#F2C14E', 1.4) + P_('M43.6 20.4L44.4 19.2L44.6 20.8Z', '#E89AA0'),
    });
  };
  CAST['Nana Fonoti'] = () => {
    const skin = '#9C6845', hair = '#5C5652';
    let flowers = '';
    const fl = (x, y, c) => { let f = ''; for (let i = 0; i < 5; i++) { const a = i * 1.2566; f += C_(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, 1.2, c); } return f + C_(x, y, 0.7, '#F2C14E'); };
    for (const [x, y, c] of [[14, 56, '#F6F0E4'], [24, 61, '#F6F0E4'], [42, 59, '#F6F0E4'], [52, 54, '#F6F0E4'], [34, 64, '#F6F0E4']]) flowers += fl(x, y, c);
    const hib = (() => { let f = ''; for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.2; f += E_(44 + Math.cos(a) * 2.6, 21 + Math.sin(a) * 2.6, 2.4, 1.7, i % 2 ? '#E8456A' : '#F0587A', `transform="rotate(${r2(a * 57.3)} ${r2(44 + Math.cos(a) * 2.6)} ${r2(21 + Math.sin(a) * 2.6)})"`); } return f + C_(44, 21, 1.1, '#F2C14E') + L_('M44 21L47.4 17.6', '#F2C14E', 0.6); })();
    return portrait({ bg: '#1E5A4A', skin, jaw: 0.62, lash: true,
      backHead: P_('M20.6 30C19.4 18 22.6 10 32 10C41.4 10 44.6 18 43.4 30Z', hair),
      body: torso('#2F6FA8', 26) + flowers + P_('M26.4 47.2Q32 51.6 37.6 47.2L36.4 46.8Q32 49.4 27.6 46.8Z', '#F6F0E4'),
      brows: ['arch', '#3A3430', 1.3], eyes: 'happy', mouth: 'grin', blush: true,
      hair: P_('M21.4 25C20.8 14.4 25.4 10.4 32 10.4C38.6 10.4 43.2 14.4 42.6 25C41.6 19.6 37.6 16.4 32.4 16.6C32 15.4 31.6 15.4 31.6 16.6C26.4 16.4 22.4 19.6 21.4 25Z', hair) + L_('M27 12.6Q32 10.6 37 12.6', '#9A9490', 0.7),
      acc: hib,
    });
  };
  CAST['Dr. Imani Shaw'] = () => {
    const skin = '#6A3E25', hair = '#16100D';
    return portrait({ bg: '#2A4A6B', skin, jaw: 0.6, lash: true,
      backHead: C_(32, 15.4, 13.4, hair) + C_(21, 20, 5, hair) + C_(43, 20, 5, hair),
      body: P_(torsoD(32, 26, 48), '#C9D1D8') + P_(torsoD(31, 24.4, 48.5), '#F3F6F8') + P_('M26 47L32 58L38 47Z', '#C04E6E')
        + P_('M25.6 46.2L22.6 52L26.2 53.4L24.8 55.4L30.4 64.6L31 60L27 48.4Z', '#E3E9EE') + MIR(P_('M25.6 46.2L22.6 52L26.2 53.4L24.8 55.4L30.4 64.6L31 60L27 48.4Z', '#D5DCE2'))
        + R_(38.8, 56.6, 5, 6, '#DDE7F0', 'rx=".6"') + R_(39.6, 57.4, 3.4, 1.4, '#2A4A6B'),
      front: L_('M24.4 46.6Q20.6 55 26 60.4M39.6 46.6Q43.6 54 38.8 58', '#4A5560', 1.4) + C_(26.4, 61, 2, '#AEB8C2') + C_(26.4, 61, 1.1, '#E1E7EC') + L_('M38.8 58L38.4 60.4', '#4A5560', 1.2),
      brows: ['arch', hair, 1.3], eyes: 'dot', mouth: 'soft',
      hair: P_(HAIR_D.cap, hair) + L_('M25 13.6Q32 10.6 39 13.6', lt(hair, 0.25), 0.7, 'opacity=".6"'),
      acc: C_(21.4, 31, 0.9, '#E9E2D0') + C_(42.6, 31, 0.9, '#E9E2D0'),
    });
  };
  CAST['Rocco'] = () => {
    const skin = '#E2AF89', hair = '#3A3330';
    const tape = G_(C_(0, 0, 4.4, '#F6F6F2') + C_(0, 0, 2.4, '#C9C3B6') + C_(0, 0, 1.6, dk('#4B5560', 0.1)) + L_('M3.6 2.6L8 5.6', '#F6F6F2', 2.2), 'transform="translate(49 54)"');
    return portrait({ bg: '#454A40', skin, jaw: 0.8,
      body: torso('#4B5560', 26) + crew(dk('#4B5560', 0.2)) + `<text x="21.4" y="58.6" font-size="4" fill="#C9CED2" text-anchor="middle" ${FONT_LBL}>STAFF</text>`,
      front: hand(46.4, 58, skin, 15) + tape,
      brows: ['flat', '#2A2420', 1.8], eyes: 'dot', mouth: 'smirk',
      beard: stubble('#3A3330'),
      hair: P_('M21 27C20.8 23 21.4 20.4 22.6 19.2L24.2 19.6L23.6 27Z', hair) + MIR(P_('M21 27C20.8 23 21.4 20.4 22.6 19.2L24.2 19.6L23.6 27Z', hair)) + E_(30, 15.4, 4.6, 2, '#FFFFFF', 'opacity=".14"'),
      acc: L_('M43.6 21L38 28', '#F2C14E', 1.3),
    });
  };

  // Name → cast key. Matches full names, first or last names, titles, and family words.
  const ALIASES = {
    'coach bramble': 'Coach Bramble', 'bramble': 'Coach Bramble', 'ray bramble': 'Coach Bramble', 'coach ray bramble': 'Coach Bramble', 'head coach': 'Coach Bramble',
    'coach okafor': 'Coach Okafor', 'okafor': 'Coach Okafor', 'nina okafor': 'Coach Okafor', 'coach nina okafor': 'Coach Okafor',
    'tiny': 'Tiny', 'tavita': 'Tiny', 'tavita fonoti': 'Tiny', 'tiny fonoti': 'Tiny',
    'marcus vane': 'Marcus Vane', 'vane': 'Marcus Vane', 'marcus': 'Marcus Vane',
    'dante kingsley': 'Dante Kingsley', 'dante': 'Dante Kingsley', 'kingsley': 'Dante Kingsley',
    'jules park': 'Jules Park', 'jules': 'Jules Park',
    'sly pemberton': 'Sly Pemberton', 'sly': 'Sly Pemberton', 'pemberton': 'Sly Pemberton',
    'margaret': 'Margaret',
    'leo': 'Leo',
    'grandma bea': 'Grandma Bea', 'grandma': 'Grandma Bea', 'bea': 'Grandma Bea',
    'mom': 'Mom', 'dad': 'Dad',
    'the turk': 'The Turk', 'turk': 'The Turk',
    'shark man': 'Shark Man', 'sharkman': 'Shark Man',
    'superfan': 'Superfan', 'super fan': 'Superfan',
    'hands greer': 'Hands Greer', 'hands': 'Hands Greer', 'greer': 'Hands Greer',
    'bryce calloway': 'Bryce Calloway', 'bryce': 'Bryce Calloway', 'calloway': 'Bryce Calloway',
    'coach delgado': 'Coach Delgado', 'delgado': 'Coach Delgado',
    'nana fonoti': 'Nana Fonoti', 'nana': 'Nana Fonoti',
    'dr. imani shaw': 'Dr. Imani Shaw', 'dr imani shaw': 'Dr. Imani Shaw', 'imani shaw': 'Dr. Imani Shaw', 'dr. shaw': 'Dr. Imani Shaw', 'dr shaw': 'Dr. Imani Shaw', 'imani': 'Dr. Imani Shaw', 'doc shaw': 'Dr. Imani Shaw',
    'rocco': 'Rocco',
  };
  function castKey(name) {
    const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[“”"’']/g, '');
    if (!n) return null;
    if (ALIASES[n]) return ALIASES[n];
    for (const k in CAST) if (k.toLowerCase() === n) return k;
    // "Coach Okafor (on the phone)" or "Tiny, grinning": use the first words
    const cut = n.replace(/\s*[(,:–—-].*$/, '');
    if (ALIASES[cut]) return ALIASES[cut];
    return null;
  }

  // ---- Monogram badge for anyone not in the cast ----
  const BADGE_COLORS = ['#2A3A57', '#5A1F2C', '#1D5A5E', '#3A1B58', '#4A3A27', '#22445C', '#3A4630', '#5C2E14', '#1E3E8C', '#454A40'];
  function monogram(name) {
    const words = String(name).replace(/[^A-Za-z0-9 .'-]/g, ' ').split(/\s+/).filter(w => w && !/^(the|coach|dr\.?|mr\.?|mrs\.?|ms\.?)$/i.test(w));
    const ini = (words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')) : '?').toUpperCase();
    const bg = BADGE_COLORS[hash(name) % BADGE_COLORS.length];
    let s = tile(bg);
    s += P_('M32 8C44 8 54 18 54 32C54 46 44 56 32 56C20 56 10 46 10 32C10 18 20 8 32 8Z', 'none', `stroke="${lt(bg, 0.35)}" stroke-width="1.4" stroke-dasharray="3 2.4"`);
    s += `<text x="32" y="${ini.length > 1 ? 39.4 : 41}" font-size="${ini.length > 1 ? 20 : 24}" fill="#F4F1EA" text-anchor="middle" ${FONT_NUM}>${esc(ini)}</text>`;
    s += L_('M24 46H40', TEAM.main, 1.6);
    return svg('0 0 64 64', s, 'class="pt"');
  }

  // =========================================================
  //   THE PLAYER — look picker data, avatar, and 'You'
  // =========================================================
  const SKINS = [['#F4D3B8', 'Fair'], ['#E5B08A', 'Light'], ['#C78B5E', 'Medium'], ['#A36A42', 'Tan'], ['#7A4A2B', 'Brown'], ['#4F2F1D', 'Deep']];
  const HAIRS = [['buzz', 'Buzz cut'], ['fade', 'High-top fade'], ['curls', 'Curls'], ['locs', 'Locs'], ['flow', 'The flow']];
  const HAIR_COLORS = ['#3B2618', '#2C1D14', '#22160F', '#1A120D', '#150E0A', '#120C09'];
  // Hair color. Looks saved before this existed have no tone and keep the natural color for their skin tone.
  const TONES = [['#16100C', 'Black'], ['#3B2618', 'Dark brown'], ['#6B4426', 'Brown'], ['#8E3B1F', 'Auburn'], ['#C99A4E', 'Blond'], ['#B9B4AE', 'Silver']];
  const LOOK_KEY = 'undrafted.look.v1';
  function cleanLook(l) {
    l = l || {};
    const skin = Number.isInteger(l.skin) && l.skin >= 0 && l.skin < SKINS.length ? l.skin : 2;
    const hair = Number.isInteger(l.hair) && l.hair >= 0 && l.hair < HAIRS.length ? l.hair : 0;
    const out = { skin, hair };
    if (Number.isInteger(l.tone) && l.tone >= 0 && l.tone < TONES.length) out.tone = l.tone;
    return out;
  }
  const naturalTone = skin => (skin <= 1 ? 1 : 0);
  const hairColor = l => (l.tone != null ? TONES[l.tone][0] : HAIR_COLORS[l.skin]);
  function defaultLook(seed) { const h = hash(seed || "rookie"); return cleanLook({ skin: h % SKINS.length, hair: (h >>> 4) % HAIRS.length }); }
  function lookOf(st) {
    if (!st) return cleanLook(null);
    if (st.ext && st.ext.art && st.ext.art.look) return cleanLook(st.ext.art.look);
    return defaultLook((st.first || '') + ' ' + (st.last || ''));
  }

  // opts: { num, pos, kit: 'team'|'camp'|'practice', mood: 'happy'|'grin'|'neutral'|'worried', tired, champ, bg }
  function avatar(look, opts) {
    look = cleanLook(look);
    opts = opts || {};
    const key = 'av|' + look.skin + '|' + look.hair + '|' + look.tone + '|' + [opts.num, opts.pos, opts.kit, opts.mood, opts.tired, opts.champ, opts.bg].join('|');
    return memo(key, () => {
      const skin = SKINS[look.skin][0], hairC = hairColor(look);
      const style = HAIRS[look.hair][0];
      const hs = hairStyle(style, hairC);
      const pos = opts.pos || 'QB', kit = opts.kit || 'team';
      const jc = kit === 'camp' ? '#EEF1F4' : kit === 'practice' ? '#7F8C9C' : TEAM.main;
      const trim = kit === 'camp' ? '#9AA6B4' : TEAM.navy;
      const numC = kit === 'camp' ? TEAM.navy : '#FFFFFF';
      let body = jersey({ c: jc, trim, collar: trim, skin, num: opts.num, numC, outline: kit === 'team' ? TEAM.navy : null, bw: pos === 'LB' ? 30 : 28 });
      if (kit === 'camp') body += R_(24.6, 55.6, 14.8, 2, '#F6F2E6', 'opacity=".9"');
      let front = '', under = '';
      if (pos === 'LB') under += P_('M22.6 45.2Q32 52.2 41.4 45.2L42.6 48.6Q32 55.6 21.4 48.6Z', TEAM.navy) + L_('M23 47.2Q32 53.6 41 47.2', lt(TEAM.navy, 0.2), 0.7);
      if (pos === 'QB') {
        front += G_(E_(0, 0, 6.6, 4.2, '#7A4320') + E_(0, 0, 6.6, 4.2, 'none', 'stroke="#5A2E14" stroke-width=".6"') + L_('M-3 -1.2L3 -1.2', '#FFFFFF', 0.8) + L_('M-1.8 -2.2L-1.8 -.2M0 -2.2L0 -.2M1.8 -2.2L1.8 -.2', '#FFFFFF', 0.5) + L_('M-6 0L-4.8 0M6 0L4.8 0', '#FFFFFF', 0.7, 'opacity=".7"'), 'transform="translate(49.6 50.6) rotate(-28)"')
          + hand(48.2, 56.8, skin, 10);
      }
      if (pos === 'RB') front += G_(E_(0, 0, 6.8, 4.2, '#7A4320') + L_('M-3 -1.2L3 -1.2', '#FFFFFF', 0.8) + L_('M-1.8 -2.2L-1.8 -.2M0 -2.2L0 -.2M1.8 -2.2L1.8 -.2', '#FFFFFF', 0.5), 'transform="translate(15.6 58.4) rotate(14)"') + P_('M8 66Q10.6 56.6 20.4 57.6Q22 61.8 20 66Z', dk(jc, 0.08)) + L_('M8.6 62.6Q14 59.6 20.8 60.6', trim, 1.2);
      if (pos === 'WR') {
        const glove = G_(P_('M-4.4 4L-4.6 -4.6Q-4.4 -6.4 -3 -6.4Q-1.6 -6.4 -1.6 -4.6L-1.4 -8Q-1.2 -9.6 0 -9.6Q1.4 -9.6 1.4 -8L1.6 -7.2Q1.8 -8.6 3 -8.6Q4.4 -8.6 4.4 -7L4.4 -5Q4.8 -6 5.8 -5.8Q7 -5.6 6.8 -4L6.4 2Q6 7 1.4 7.4L-1.2 7.4Q-4.2 7 -4.4 4Z', '#F4F6F8') + P_('M-3.6 -1Q1 -3 6 -1.4L5.8 2.4Q1 5 -3.6 2.6Z', TEAM.main) + R_(-4.6, 5, 11, 2.6, TEAM.navy, 'rx="1"'), 'transform="translate(50.6 54.6) rotate(12)"');
        front += glove;
      }
      let faceExtra = '';
      if (pos === 'RB' || pos === 'LB') faceExtra += eyeBlack();
      const mood = opts.mood || 'happy';
      const mouthT = mood === 'grin' ? 'grin' : mood === 'worried' ? 'worry' : mood === 'neutral' ? 'flat' : 'smile';
      const browT = mood === 'worried' ? 'worry' : mood === 'grin' ? 'arch' : mood === 'neutral' ? 'down' : 'flat';
      let acc = '';
      let hairFront = hs.front;
      if (opts.champ) {
        hairFront = style === 'locs' || style === 'flow' ? hs.front.replace(/<circle[^>]*>/, '') : '';
        acc += ballCap(TEAM.navy, TEAM.main, '1', TEAM.gold) + `<text x="32" y="12.4" font-size="3.2" fill="${TEAM.gold}" text-anchor="middle" ${FONT_LBL}>CHAMPS</text>`;
      }
      if (opts.tired) acc += P_('M44.6 18.6Q46.2 21.6 44.6 22.8Q43 21.6 44.6 18.6Z', '#9FD6FF', 'opacity=".9"');
      return portrait({ bg: opts.bg || '#1C2A47', skin, jaw: 0.66,
        backHead: hs.back,
        body: body, under, front,
        brows: [browT, hairC, 1.6], eyes: opts.tired ? 'tired' : 'dot', mouth: mouthT,
        under_eye: faceExtra,
        hair: hairFront, acc,
      });
    });
  }
  function playerOpts(st) {
    st = st || S;
    if (!st) return {};
    const kit = st.role === 'camp' ? 'camp' : st.role === 'practice' ? 'practice' : 'team';
    const c = st.st ? st.st.conf : 50;
    const mood = c >= 72 ? 'grin' : c <= 30 ? 'worried' : c <= 42 ? 'neutral' : 'happy';
    return { num: st.num, pos: st.pos, kit, mood, tired: !!(st.st && st.st.energy < 30), champ: !!((st.flags && st.flags.champion) || (st.y1 && st.y1.champion)) };
  }
  const player = st => avatar(lookOf(st || S), playerOpts(st || S));

  function portraitFor(name, raw) {
    const n = String(name || '').trim();
    if (!n) return '';
    if (/^(you|me)$/i.test(n) || (raw && /^you$/i.test(String(raw).trim()))) return S ? player(S) : '';
    const k = castKey(n);
    if (k) {
      const variant = k === 'Marcus Vane' ? vnum() : k === 'Leo' ? pnum() : '';
      return memo('pt|' + k + '|' + variant, () => CAST[k]());
    }
    return memo('mg|' + n, () => monogram(n));
  }

  // =========================================================
  //   SCENES — wide banners, viewBox 800×160, drawn to survive xMidYMid slice
  //   from 360px to 760px wide (keep the story in x 150–650).
  // =========================================================
  const VB = '0 0 800 160';
  const grad = (id, stops, x2, y2) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2 == null ? 0 : x2}" y2="${y2 == null ? 1 : y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
  const rgrad = (id, stops) => `<radialGradient id="${id}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
  const anim = (cls, delay, dur) => `class="${cls}" style="animation-delay:${r2(delay)}s${dur ? `;animation-duration:${r2(dur)}s` : ''}"`;
  function stars(rnd, n, x0, x1, y0, y1, c) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = 0.5 + rnd() * 0.9;
      s += C_(x, y, r, c || '#FFFFFF', (rnd() < 0.5 ? anim('ua-tw', -rnd() * 3, 2 + rnd() * 2) + ' ' : '') + `fill-opacity="${r2(0.4 + rnd() * 0.6)}"`);
    }
    return s;
  }
  function crowd(rnd, x0, x1, y0, y1, colors, o) {
    o = o || {};
    const step = o.step || 6.2, r = o.r || 2.5;
    let s = '';
    for (let y = y0; y <= y1; y += step * 0.85) {
      const off = ((y - y0) / (step * 0.85)) % 2 ? step / 2 : 0;
      for (let x = x0 + off; x <= x1; x += step) {
        const c = colors[Math.floor(rnd() * colors.length)];
        s += C_(x + (rnd() - 0.5) * 1.6, y + (rnd() - 0.5) * 1.4, r * (0.85 + rnd() * 0.3), c);
      }
    }
    if (o.flash) for (let i = 0; i < o.flash; i++) s += C_(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1.4, '#FFFFFF', anim('ua-flash', -rnd() * 4, 2.5 + rnd() * 3));
    return s;
  }
  function lightTower(x, y, w, glowId, beams) {
    const h = w * 0.42;
    let s = '';
    if (glowId) s += C_(x, y + h / 2, w * 1.25, `url(#${glowId})`, 'class="ua-glow"');
    s += R_(x - 2, y + h, 4, 160, '#151C26');
    s += R_(x - w / 2 - 2, y - 2, w + 4, h + 4, '#151C26', 'rx="2"');
    const cols = 5, rows = 3;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) s += C_(x - w / 2 + (i + 0.5) * w / cols, y + (j + 0.5) * h / rows, Math.min(w / cols, h / rows) * 0.36, '#FFFBEA');
    if (beams) s += P_(`M${x - w / 2} ${y + h}L${x + beams[0]} 160L${x + beams[1]} 160L${x + w / 2} ${y + h}Z`, '#FFFBEA', 'opacity=".07"');
    return s;
  }
  function helmetSide(x, y, sc, c, stripe, flip) {
    // a football helmet in profile, facing right (or left with flip)
    const g = P_('M-14 6C-16 -8 -6 -16 4 -15C14 -14 18 -6 17 3L16 9L4 10L2 6L-8 8Z', c)
      + L_('M-12 -6C-6 -14 6 -15 13 -9', stripe, 2.6)
      + E_(1, 0, 3.6, 3, dk(c, 0.3))
      + L_('M10 2L22 2M10 7L21 7M14 -1L15 10M19 -1L20 9', '#B9C0C8', 1.4)
      + P_('M-4 -7l2 -3 2 3z', stripe);
    return G_(g, `transform="translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})"`);
  }
  const ball = (x, y, sc, rot) => G_(E_(0, 0, 9, 5.4, '#7A4320') + L_('M-4 -1.6L4 -1.6', '#FFFFFF', 1) + L_('M-2.4 -3L-2.4 -.2M0 -3L0 -.2M2.4 -3L2.4 -.2', '#FFFFFF', 0.7) + L_('M-8 0L-6.4 0M8 0L6.4 0', '#FFFFFF', 0.9, 'opacity=".7"'), `transform="translate(${x} ${y}) rotate(${rot || 0}) scale(${sc || 1})"`);
  // A tiny flat person (head and shoulders) for crowds of friends and family.
  // o: { s, skin, shirt, hair: 'short'|'bun'|'long'|'bald'|'curly'|'cap'|'locs'|'flow'|'fade'|'buzz'|'kid'|'grandma', hairC, mood, glasses, flower, cap }
  function folk(x, y, o) {
    const skin = o.skin, hc = o.hairC || '#1E1612', sh = o.shirt || '#555';
    let b = '', f = '';
    if (o.hair === 'long' || o.hair === 'locs') b += P_('M-12.6 -12C-14 4 -12 12 -9 14L9 14C12 12 14 4 12.6 -12Z', hc);
    if (o.hair === 'flow') b += P_('M-12 -10C-13.6 -2 -12.6 4 -9.6 7L9.6 7C12.6 4 13.6 -2 12 -10Z', hc);
    if (o.hair === 'grandma' || o.hair === 'bun') b += C_(0, -27, 5.6, hc);
    if (o.hair === 'curly' || o.hair === 'curls') for (const [cx, cy] of [[-10, -18], [-7, -24], [-2, -26.4], [3.6, -25.6], [8.4, -22], [10.6, -16]]) b += C_(cx, cy, 4.4, hc);
    b += P_('M-22 34C-22 13 -14 6 0 6C14 6 22 13 22 34Z', sh) + P_('M-6 6Q0 12 6 6', dk(sh, 0.25));
    b += R_(-4, -2, 8, 10, dk(skin, 0.18));
    b += E_(0, -12, 11, 12.6, dk(skin, 0.14)) + E_(-0.8, -12.4, 10.2, 12, skin);
    // hair on top
    const cap = 'M-11.2 -12C-12 -22 -6 -25.6 0 -25.6C6 -25.6 12 -22 11.2 -12C10 -18 6 -19.6 0 -19.6C-6 -19.6 -10 -18 -11.2 -12Z';
    switch (o.hair) {
      case 'bald': f += P_('M-11 -10C-11.4 -13 -10.8 -15 -10 -16L-8.6 -15L-9 -10Z', hc) + MIRX(P_('M-11 -10C-11.4 -13 -10.8 -15 -10 -16L-8.6 -15L-9 -10Z', hc)); break;
      case 'cap': f += P_('M-11.4 -14C-11.6 -23 -6 -26.6 0 -26.6C6 -26.6 11.6 -23 11.4 -14Z', o.capC || TEAM.navy) + P_('M-12 -14.6Q0 -18 16.6 -14Q16.8 -12.4 15 -12.2Q2 -15 -11.6 -12.6Z', dk(o.capC || TEAM.navy, 0.2)); break;
      case 'fade': f += P_(cap, hc, 'opacity=".6"') + P_('M-10.4 -16C-10.6 -24 -8 -28.4 -5 -29.6L5 -29.6C8 -28.4 10.6 -24 10.4 -16C8 -19 4 -19.6 0 -19.6C-4 -19.6 -8 -19 -10.4 -16Z', hc); break;
      case 'kid': f += P_(cap, hc) + P_('M-6 -24.4L-3 -29L-1 -24.8L2 -29.4L3.6 -24.6Z', hc); break;
      case 'grandma': f += P_(cap, hc); for (const [cx, cy] of [[-9.6, -15], [-6.6, -20], [-1.6, -22.4], [3.6, -22], [8, -19], [10, -14.6]]) f += C_(cx, cy, 3.2, hc); break;
      case 'locs': f += P_(cap, hc) + C_(0, -26.6, 4.4, hc); break;
      case 'none': break;
      default: f += P_(cap, hc);
    }
    if (o.hair === 'curly' || o.hair === 'curls') f += P_(cap, hc);
    const mood = o.mood || 'smile';
    f += mood === 'happy' ? L_('M-6 -12.6Q-4.4 -14.6 -2.8 -12.6M2.8 -12.6Q4.4 -14.6 6 -12.6', INK, 1.3) : C_(-4.2, -12.6, 1.35, INK) + C_(4.2, -12.6, 1.35, INK);
    f += mood === 'laugh' ? P_('M-4.4 -6.6Q0 -0.6 4.4 -6.6Z', '#4A1A1A') : L_('M-3.6 -6.8Q0 -3.6 3.6 -6.8', dk(skin, 0.5), 1.3);
    f += C_(-6.6, -8, 1.8, '#E66F62', 'opacity=".25"') + C_(6.6, -8, 1.8, '#E66F62', 'opacity=".25"');
    if (o.glasses) f += `<circle cx="-4.2" cy="-12.6" r="3.2" fill="none" stroke="${o.glasses}" stroke-width="1"/><circle cx="4.2" cy="-12.6" r="3.2" fill="none" stroke="${o.glasses}" stroke-width="1"/>`;
    if (o.flower) f += C_(10.6, -18, 2.2, '#F0587A') + C_(12.6, -16, 2.2, '#E8456A') + C_(9.4, -15.4, 2, '#F0587A') + C_(10.8, -16.6, 1, '#F2C14E');
    if (o.extra) f += o.extra;
    return G_(b + f, `transform="translate(${r2(x)} ${r2(y)}) scale(${o.s || 1})"`);
  }
  const MIRX = s => `<g transform="scale(-1 1)">${s}</g>`;
  // simplified player look for little people in scenes
  function folkYou(x, y, sc, shirt, extra) {
    const L = lookOf(S);
    const map = { buzz: 'buzz', fade: 'fade', curls: 'curly', locs: 'locs', flow: 'flow' };
    return folk(x, y, { s: sc, skin: SKINS[L.skin][0], hairC: hairColor(L), hair: map[HAIRS[L.hair][0]], shirt: shirt || TEAM.main, mood: 'happy', extra });
  }
  const famKind = () => (S && S.origin === 'city' ? 'mom' : S && S.origin === 'base' ? 'dad' : 'bea');

  const SCENES = {};

  // ---- Draft night: a living room lit by the TV ----
  SCENES.draft = () => {
    const rnd = rng(7);
    let s = `<defs>${rgrad('uadr-tv', [[0, '#7FB6FF', 0.42], [0.5, '#4C7FD1', 0.14], [1, '#1A2133', 0]])}${grad('uadr-scr', [[0, '#2F5FA8'], [1, '#14284F']])}${grad('uadr-win', [[0, '#0B1430'], [1, '#22335E']])}${grad('uadr-kit', [[0, '#FFE2A3'], [1, '#F2B866']])}<clipPath id="uadr-clip"><rect x="420" y="42" width="130" height="64"/></clipPath></defs>`;
    s += R_(0, 0, 800, 160, '#1A2133');
    for (let x = 10; x < 800; x += 26) s += R_(x, 0, 1.2, 124, '#FFFFFF', 'opacity=".025"');
    // window with the moon
    s += R_(36, 18, 118, 82, '#2B3550', 'rx="3"') + R_(42, 24, 106, 70, 'url(#uadr-win)') + stars(rnd, 14, 44, 146, 26, 70) + C_(124, 40, 9, '#F4E9C8') + C_(120, 37, 9, '#22335E', 'opacity=".9"');
    s += R_(42, 74, 106, 20, '#0E1630') + R_(50, 64, 18, 30, '#0A1028') + R_(72, 70, 14, 24, '#0A1028') + R_(112, 60, 22, 34, '#0A1028');
    for (let i = 0; i < 9; i++) s += R_(52 + (i % 3) * 5 + (i > 5 ? 62 : 0), 68 + Math.floor(i / 3) * 6, 2, 3, '#FFD27A', 'opacity=".8"');
    s += R_(94, 24, 3, 70, '#2B3550') + R_(42, 57, 106, 3, '#2B3550');
    s += P_('M30 14H62Q54 60 60 106H30Z', '#3B2E4E') + P_('M160 14H128Q136 60 130 106H160Z', '#3B2E4E');
    // TV glow on the wall
    s += E_(452, 78, 260, 120, 'url(#uadr-tv)', 'class="ua-flicker"');
    // floor and rug
    s += R_(0, 124, 800, 36, '#121826') + E_(330, 148, 220, 13, '#283252');
    s += E_(436, 140, 160, 10, '#7FB6FF', 'fill-opacity=".08" class="ua-flicker"');
    // TV and stand
    s += '<g transform="translate(-34 0)">';
    s += R_(404, 112, 162, 14, '#262B3A', 'rx="2"') + R_(412, 126, 6, 10, '#1E2230') + R_(552, 126, 6, 10, '#1E2230');
    s += R_(412, 34, 146, 80, '#0A0D13', 'rx="4"') + R_(420, 42, 130, 64, 'url(#uadr-scr)');
    s += `<g clip-path="url(#uadr-clip)">`;
    s += R_(420, 42, 130, 64, '#1C3B73') + R_(420, 42, 130, 12, '#10224A');
    s += `<text x="485" y="51" font-size="7" fill="#C9D8F2" text-anchor="middle" ${FONT_LBL} letter-spacing="1.5">THE DRAFT · DAY 3</text>`;
    s += R_(468, 62, 34, 28, '#0E1A36') + R_(472, 66, 26, 3, TEAM.gold, 'opacity=".8"') + C_(485, 60, 5, '#E7C3A0') + R_(479, 64, 12, 14, '#24324E');
    s += R_(420, 86, 130, 11, TEAM.main) + `<text x="424" y="94.4" font-size="7.4" fill="#FFFFFF" ${FONT_LBL}>ROUND 7 · PICK 257</text>` + R_(522, 86, 28, 11, '#14203A') + `<text x="536" y="94.4" font-size="6.6" fill="${TEAM.gold}" text-anchor="middle" ${FONT_LBL}>LIVE</text>`;
    s += R_(420, 97, 130, 9, '#0A0D13') + `<g class="ua-ticker"><text x="424" y="103.6" font-size="6.4" fill="#E9EEE7" ${FONT_LBL} letter-spacing=".6">MR. IRRELEVANT: K, SOUTHEAST TECH · THE DRAFT IS COMPLETE · 257 PLAYERS SELECTED · UNDRAFTED FREE AGENCY OPENS NOW ·</text></g>`;
    s += `</g>` + R_(420, 42, 130, 64, '#FFFFFF', 'opacity=".05"') + C_(553, 110, 1.2, '#FF4D4D');
    s += '</g>';
    // couch
    s += R_(176, 82, 204, 36, '#3C4A6E', 'rx="10"') + R_(166, 106, 224, 24, '#33405F', 'rx="7"') + R_(158, 92, 22, 40, '#2D3854', 'rx="9"') + R_(376, 92, 22, 40, '#2D3854', 'rx="9"');
    s += L_('M278 86L278 116', '#2D3854', 1.4) + R_(186, 88, 46, 22, '#4A5A83', 'rx="6"') + P_('M330 86Q356 84 366 96L360 112Q340 108 326 112Z', TEAM.main, 'opacity=".9"');
    s += R_(170, 128, 8, 8, '#1E2638') + R_(378, 128, 8, 8, '#1E2638');
    s += R_(292, 105, 22, 9, '#0C0F15', 'rx="2" transform="rotate(-6 303 109)"') + L_('M294 104.4L312 102.4', '#5D7AB0', 0.8, 'opacity=".7"');
    s += P_('M380 96Q384 108 380 120', '#7FB6FF', 'opacity=".18"');
    // coffee table, chips, remote
    s += R_(214, 130, 132, 7, '#5A4030', 'rx="2"') + R_(220, 137, 5, 14, '#4A3426') + R_(335, 137, 5, 14, '#4A3426');
    s += P_('M236 130Q236 122 250 122Q264 122 264 130Z', '#E9E2D0') + C_(244, 124, 2, '#F2C14E') + C_(251, 122.6, 2, '#F2C14E') + C_(257, 124.4, 2, '#E8A93A');
    s += R_(296, 127, 24, 4, '#111', 'rx="2"') + C_(316, 129, 0.9, '#E33');
    // kitchen doorway with the family member at the sink
    s += '<g transform="translate(-58 0)">';
    s += R_(596, 26, 112, 100, '#3A2E2A') + R_(602, 32, 100, 94, 'url(#uadr-kit)');
    s += P_('M602 126L702 126L760 160L560 160Z', '#FFD58A', 'opacity=".14"');
    s += R_(602, 32, 100, 18, '#E9C98E') + R_(612, 38, 18, 10, '#D9B47A') + R_(636, 38, 18, 10, '#D9B47A');
    s += R_(602, 92, 100, 34, '#B9875A') + R_(602, 90, 100, 5, '#E7DCC6');
    s += L_('M672 70Q672 62 680 62L686 62', '#9AA3AD', 2.2);
    const fk = famKind();
    const famSkin = fk === 'bea' ? '#F1CBB0' : fk === 'mom' ? '#8B593A' : '#C08A5E';
    let fam = P_('M-16 60C-16 30 -12 18 0 18C12 18 16 30 16 60Z', fk === 'mom' ? '#3C8E9B' : fk === 'dad' ? '#4E5A36' : '#86B6D9');
    fam += E_(0, 6, 9, 10, famSkin);
    if (fk === 'bea') fam += P_('M-9 4C-9 -5 -4 -6 0 -6C4 -6 9 -5 9 4C7 0 4 -1 0 -1C-4 -1 -7 0 -9 4Z', '#ECE9E4') + C_(0, -6, 4.6, '#ECE9E4') + R_(-10, 26, 20, 30, '#FBF7EE', 'rx="2"');
    if (fk === 'mom') fam += P_('M-9 4C-9 -5 -4 -6 0 -6C4 -6 9 -5 9 4C7 0 4 -1 0 -1C-4 -1 -7 0 -9 4Z', '#1A1210') + C_(0, -8, 5, '#1A1210');
    if (fk === 'dad') fam += P_('M-9.6 1L-8.6 -7Q0 -9 8.6 -7L9.6 1Z', '#56633A') + P_('M-11 1Q0 -1 11 1L10 3Q0 1.4 -10 3Z', '#3E4A2E');
    fam += G_(P_('M8 30Q20 34 22 40', 'none', `stroke="${famSkin}" stroke-width="5" stroke-linecap="round"`) + E_(24, 41, 7, 3, '#5B636C'), 'class="ua-scrub"');
    s += G_(fam, 'transform="translate(652 60)"');
    s += R_(596, 26, 6, 100, '#2E2420') + R_(702, 26, 6, 100, '#2E2420');
    s += '</g>';
    // floor lamp (off) and a shelf
    s += R_(760, 30, 4, 100, '#2A3042') + P_('M748 30L776 30L770 14L754 14Z', '#3A4258') + R_(748, 128, 28, 4, '#2A3042', 'rx="2"');
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- 11:52 PM: the phone lights up ----
  SCENES.call = () => {
    const rnd = rng(11);
    const L = lookOf(S), skin = SKINS[L.skin][0];
    let s = `<defs>${rgrad('uacl-glow', [[0, '#A9D6FF', 0.55], [0.45, '#5C9BE0', 0.16], [1, '#0F1626', 0]])}${grad('uacl-scr', [[0, '#1E3E72'], [0.6, '#152C55'], [1, '#0E1D3C']])}${grad('uacl-win', [[0, '#081028'], [1, '#1B2B55']])}</defs>`;
    s += R_(0, 0, 800, 160, '#0F1626');
    // window
    s += R_(70, 16, 170, 110, '#1E2944', 'rx="3"') + R_(76, 22, 158, 98, 'url(#uacl-win)') + stars(rnd, 22, 78, 232, 24, 80) + C_(200, 42, 10, '#F6EDCF') + C_(195, 38, 10, '#152450', 'opacity=".92"');
    let sky = '';
    for (const [x, w, h] of [[78, 22, 34], [102, 16, 50], [120, 30, 28], [152, 18, 44], [172, 26, 36], [200, 20, 54], [222, 12, 30]]) sky += R_(x, 120 - h, w, h, '#0A1126');
    s += sky;
    for (let i = 0; i < 26; i++) s += R_(80 + rnd() * 150, 76 + rnd() * 40, 2, 2.6, '#FFD27A', `opacity="${r2(0.4 + rnd() * 0.6)}"`);
    s += R_(152, 22, 4, 98, '#1E2944') + R_(76, 70, 158, 4, '#1E2944');
    // kitchen faucet with the drip
    s += R_(600, 98, 200, 62, '#1A2238') + R_(600, 96, 200, 5, '#2A3352');
    s += L_('M690 96L690 74Q690 66 698 66L712 66', '#7A8494', 3.2) + C_(712, 72, 2.2, '#9FD6FF', 'class="ua-drip"');
    s += R_(628, 84, 36, 12, '#2A3352', 'rx="2"') + R_(640, 72, 4, 14, '#3A4566');
    // wall clock at 11:52
    const cx = 560, cy = 44;
    s += C_(cx, cy, 20, '#E9E2D0') + C_(cx, cy, 20, 'none', 'stroke="#2A3352" stroke-width="3"');
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s += L_(`M${r2(cx + Math.cos(a) * 15)} ${r2(cy + Math.sin(a) * 15)}L${r2(cx + Math.cos(a) * 17.4)} ${r2(cy + Math.sin(a) * 17.4)}`, '#2A3352', 1.2); }
    const ha = ((11 + 52 / 60) / 12) * 2 * Math.PI - Math.PI / 2, ma = (52 / 60) * 2 * Math.PI - Math.PI / 2;
    s += L_(`M${cx} ${cy}L${r2(cx + Math.cos(ha) * 9)} ${r2(cy + Math.sin(ha) * 9)}`, '#14203A', 2.4) + L_(`M${cx} ${cy}L${r2(cx + Math.cos(ma) * 14)} ${r2(cy + Math.sin(ma) * 14)}`, '#14203A', 1.6) + C_(cx, cy, 1.6, TEAM.main);
    // glow
    s += C_(400, 74, 150, 'url(#uacl-glow)', 'class="ua-pulse"');
    // vibration marks
    s += G_(L_('M342 40Q336 52 342 64M332 34Q322 52 332 70M458 40Q464 52 458 64M468 34Q478 52 468 70', '#A9D6FF', 2), 'class="ua-buzzmark"');
    // phone + hand
    let ph = R_(362, 18, 76, 160, '#15181E', 'rx="11"') + R_(367, 25, 66, 150, 'url(#uacl-scr)', 'rx="7"') + R_(390, 21, 20, 3, '#000', 'rx="1.5"');
    ph += `<text x="400" y="42" font-size="5.6" fill="#9FC2F0" text-anchor="middle" ${FONT_LBL} letter-spacing="1" textLength="48" lengthAdjust="spacingAndGlyphs">INCOMING CALL</text>`;
    ph += C_(400, 62, 12, '#2B4E8A') + `<text x="400" y="67" font-size="14" fill="#DCE8FA" text-anchor="middle" ${FONT_NUM}>?</text>`;
    ph += `<text x="400" y="87" font-size="9" fill="#FFFFFF" text-anchor="middle" ${FONT_LBL} textLength="52" lengthAdjust="spacingAndGlyphs">Unknown Number</text>`;
    ph += `<text x="400" y="97" font-size="6" fill="#9FC2F0" text-anchor="middle" ${FONT_LBL} letter-spacing=".5">HARBOR CITY</text><text x="400" y="105" font-size="6" fill="#9FC2F0" text-anchor="middle" ${FONT_LBL} letter-spacing=".5">11:52 PM</text>`;
    ph += C_(384, 128, 8, '#E5484D') + C_(416, 128, 8, '#2FBF71', 'class="ua-ring"') + L_('M380 128L388 128', '#FFF', 1.6) + P_('M412.6 125.4Q414 124 415.4 125.4L416.6 127Q417 128 418.2 128.6L419.6 129.4Q420.6 130.4 419.4 131.6Q417 133 413.6 129.6Q410.6 126.6 412.6 125.4Z', '#FFF');
    let hd = P_('M352 168L350 104Q350 96 357 96L366 98L366 168Z', dk(skin, 0.12));
    for (const y of [92, 106, 120]) hd += R_(352, y, 18, 11, skin, 'rx="5.5"');
    hd += P_('M442 168L446 118Q447 110 440 109L432 112L428 140L430 168Z', skin) + R_(430, 104, 14, 22, skin, 'rx="7" transform="rotate(-14 437 115)"');
    s += G_(ph + hd, 'class="ua-shake"');
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- Training camp: the locker between two giants ----
  SCENES.camp1 = () => {
    const last = (S && S.last ? S.last : 'ROOKIE').toUpperCase();
    const vn = vnum();
    let s = `<defs>${grad('uacp-wall', [[0, '#34485C'], [1, '#22303F']])}${grad('uacp-light', [[0, '#FFFFFF', 0.28], [1, '#FFFFFF', 0]])}</defs>`;
    s += R_(0, 0, 800, 160, 'url(#uacp-wall)') + R_(0, 0, 800, 7, '#E9EEF2') + R_(0, 7, 800, 26, 'url(#uacp-light)');
    s += R_(0, 132, 800, 28, '#1B2740');
    s += E_(400, 162, 120, 18, TEAM.main, 'opacity=".55"') + E_(400, 162, 96, 12, '#1B2740');
    const stall = (cx, wood, inner) => R_(cx - 58, 16, 116, 116, dk(wood, 0.35)) + R_(cx - 54, 20, 108, 112, wood) + R_(cx - 48, 32, 96, 96, dk(wood, 0.45)) + R_(cx - 48, 54, 96, 4, dk(wood, 0.15)) + (inner || '');
    const hangJersey = (cx, y, c, num, nc, trim) => P_(`M${cx - 16} ${y}L${cx - 6} ${y - 4}Q${cx} ${y + 2} ${cx + 6} ${y - 4}L${cx + 16} ${y}L${cx + 22} ${y + 14}L${cx + 14} ${y + 17}L${cx + 13} ${y + 44}L${cx - 13} ${y + 44}L${cx - 14} ${y + 17}L${cx - 22} ${y + 14}Z`, c)
      + L_(`M${cx - 18} ${y + 9}L${cx - 15} ${y + 16}M${cx + 18} ${y + 9}L${cx + 15} ${y + 16}`, trim || '#FFFFFF', 1.8)
      + `<text x="${cx}" y="${y + 33}" font-size="17" fill="${nc}" text-anchor="middle" ${FONT_NUM}>${esc(num)}</text>`
      + L_(`M${cx} ${y - 12}L${cx} ${y - 3}M${cx - 6} ${y - 8}Q${cx} ${y - 16} ${cx + 6} ${y - 8}`, '#AEB6BF', 1.2);
    // far left and far right
    s += stall(156, '#7A5236', hangJersey(156, 70, TEAM.main, 23, '#FFFFFF', TEAM.navy) + R_(116, 40, 22, 12, '#E9EEF2', 'rx="2"'));
    s += stall(644, '#7A5236', hangJersey(644, 70, TEAM.main, 90, '#FFFFFF', TEAM.navy) + E_(676, 48, 10, 5, '#F4F6F8'));
    // Tiny's locker: huge jersey, cereal, mixing bowl
    let tiny = hangJersey(278, 66, TEAM.main, 71, '#FFFFFF', TEAM.navy).replace('font-size="17"', 'font-size="19"');
    tiny += R_(236, 30, 16, 24, '#E5484D') + R_(238, 34, 12, 8, '#F2C14E') + `<text x="244" y="50" font-size="5" fill="#FFFFFF" text-anchor="middle" ${FONT_LBL}>CRUNCH</text>` + R_(254, 34, 16, 20, '#3E7FC4') + C_(262, 42, 3, '#F2C14E');
    tiny += P_('M284 54Q284 44 298 44Q312 44 312 54Z', '#D7DCE0') + E_(298, 44, 14, 2.4, '#BFC6CC') + C_(292, 43, 1.6, '#F2C14E') + C_(298, 42.4, 1.6, '#E5621C') + C_(304, 43, 1.6, '#5BD68A');
    tiny += R_(244, 116, 26, 10, '#222', 'rx="4"') + R_(276, 116, 26, 10, '#222', 'rx="4"');
    s += stall(278, '#7A5236', tiny);
    // your locker: plywood, masking tape, a duffel bag, empty hangers
    let you = R_(342, 20, 116, 112, '#D9B784') + R_(348, 32, 104, 96, '#C9A26E');
    for (const [x, y] of [[346, 24], [454, 24], [346, 128], [454, 128], [400, 24]]) you += C_(x, y, 1, '#8A6A44');
    you += L_('M360 40L372 40M428 40L440 40', '#9AA3AD', 1.4) + L_('M366 40L366 36M434 40L434 36', '#9AA3AD', 1.2) + R_(348, 54, 104, 4, '#B48C58');
    you += hangJersey(400, 68, '#EEF1F4', S ? S.num : 7, TEAM.navy, '#9AA6B4');
    you += P_('M408 130Q406 114 420 114L444 114Q456 114 454 130Z', TEAM.navy) + L_('M418 114Q418 106 426 106L436 106Q444 106 444 114', '#0E1628', 2) + L_('M410 122L452 122', TEAM.main, 1.6);
    you += helmetSide(434, 44, 0.55, TEAM.navy, TEAM.main);
    const fit = last.length > 9 ? ` textLength="84" lengthAdjust="spacingAndGlyphs"` : '';
    you += R_(352, 8, 96, 13, '#EFE6C8', 'transform="rotate(-1.4 400 14)"') + `<text x="400" y="18.6" font-size="11" fill="#1B1B1B" text-anchor="middle" ${FONT_LBL} transform="rotate(-1.4 400 14)"${fit}>${esc(last)}</text>`;
    s += you;
    // Vane's locker: brass plate, his jersey, a photo
    let vane = hangJersey(522, 70, TEAM.main, vn, '#FFFFFF', TEAM.navy);
    vane += R_(484, 34, 16, 18, '#F4F1EA', 'transform="rotate(-6 492 43)"') + R_(486, 36, 12, 10, '#7FA3C9', 'transform="rotate(-6 492 43)"');
    vane += R_(544, 34, 18, 14, '#E8C66A', 'rx="1"') + `<text x="553" y="44" font-size="6" fill="#5A4314" text-anchor="middle" ${FONT_LBL}>PRO</text>`;
    vane += R_(488, 116, 28, 10, '#F4F6F8', 'rx="4"') + R_(522, 116, 28, 10, '#F4F6F8', 'rx="4"');
    s += stall(522, '#6A4428', vane);
    s += R_(486, 7, 72, 12, '#C9A24A', 'rx="1.5"') + R_(488, 9, 68, 8, '#E3C068', 'rx="1"') + `<text x="522" y="16" font-size="7" fill="#4A3510" text-anchor="middle" ${FONT_LBL} letter-spacing="1">VANE · #${esc(vn)}</text>`;
    // bench
    s += R_(30, 126, 740, 8, '#A0794E', 'rx="2"') + R_(30, 126, 740, 2, '#C29A6A') + R_(60, 134, 6, 18, '#6E5236') + R_(734, 134, 6, 18, '#6E5236') + R_(396, 134, 6, 18, '#6E5236');
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- The forty: sprint lanes under a hot sky ----
  SCENES.camp_drill = () => {
    const rnd = rng(23);
    let s = `<defs>${grad('uadl-sky', [[0, '#7FB8E8'], [1, '#D7EAF6']])}${grad('uadl-turf', [[0, '#3E8A4B'], [1, '#2C6D39']])}</defs>`;
    s += R_(0, 0, 800, 160, 'url(#uadl-sky)');
    for (const [x, y, w] of [[120, 18, 60], [520, 12, 80], [690, 26, 50], [300, 30, 40]]) s += E_(x, y, w / 2, 7, '#FFFFFF', 'opacity=".85"') + E_(x - w / 4, y + 2, w / 3, 6, '#FFFFFF', 'opacity=".85"') + E_(x + w / 4, y + 3, w / 3.4, 5, '#FFFFFF', 'opacity=".85"');
    // bleachers with scouts
    s += R_(0, 40, 800, 30, '#9AA6B4');
    for (let y = 44; y < 70; y += 6) s += R_(0, y, 800, 1.4, '#7F8C9C');
    for (let i = 0; i < 34; i++) {
      const x = 20 + rnd() * 760, y = 44 + Math.floor(rnd() * 4) * 6;
      const c = pick2(rnd, ['#14203A', '#2E4A7A', '#5A1F2C', '#3A4630', '#E9EEF2']);
      s += C_(x, y - 3, 2.2, pick2(rnd, ['#F1CBB0', '#C68B5E', '#7A4A2B', '#E2AF89', '#5B3420'])) + R_(x - 3, y - 1, 6, 5, c, 'rx="1.5"');
      if (rnd() < 0.3) s += R_(x + 2, y - 1, 4, 5, '#F4F1EA');
    }
    // stopwatch scout
    s += C_(470, 41, 2.6, '#E2AF89') + R_(466, 43, 8, 7, '#14203A', 'rx="2"') + L_('M473 44L478 38', '#E2AF89', 1.6) + C_(479, 36.6, 2.2, '#D7DCE0');
    // field in perspective
    s += R_(0, 66, 800, 94, 'url(#uadl-turf)');
    let yy = 66, hh = 6;
    while (yy < 160) { s += R_(0, yy, 800, hh, '#FFFFFF', 'opacity=".05"'); yy += hh * 2; hh *= 1.25; }
    const vx = 400, vy = 34;
    for (const xb of [-500, -200, 100, 400, 700, 1000, 1300]) {
      const t = (66 - vy) / (160 - vy), xt = vx + (xb - vx) * t;
      s += L_(`M${r2(xt)} 66L${xb} 160`, '#FFFFFF', 2, 'opacity=".75"');
    }
    s += R_(0, 66, 800, 2.4, '#FFFFFF') + R_(0, 146, 800, 3, '#FFFFFF', 'opacity=".9"');
    // timing gates at the finish
    for (const x of [252, 548]) s += L_(`M${x} 66L${x} 50M${x - 6} 72L${x} 66L${x + 6} 72`, '#2A2F3A', 1.6) + R_(x - 4, 46, 8, 6, '#2A2F3A', 'rx="1"') + C_(x, 49, 1.4, '#FF4D4D', 'class="ua-blink"');
    // LED timer board
    // (centered over the lanes so it survives the phone crop, which keeps only about x 157-643)
    s += R_(396, 40, 8, 8, '#2A2F3A') + R_(340, 2, 120, 40, '#0E1210', 'rx="3"') + R_(344, 6, 112, 32, '#151B18') + `<text x="400" y="16" font-size="7" fill="#93A096" text-anchor="middle" ${FONT_LBL} letter-spacing="1.5">40-YARD DASH</text>` + `<text x="400" y="35" font-size="18" fill="${'#FFB21E'}" text-anchor="middle" ${FONT_NUM} class="ua-blink2">0.00</text>`;
    // cones at the start line
    for (const x of [118, 262, 400, 538, 682]) s += P_(`M${x - 7} 148L${x} 130L${x + 7} 148Z`, TEAM.main) + R_(x - 8, 147, 16, 3, dk(TEAM.main, 0.2)) + R_(x - 4.4, 138, 8.8, 2.4, '#FFFFFF');
    // a rookie in his stance (from behind), in lane two
    const L = lookOf(S), skin = SKINS[L.skin][0];
    let r = E_(0, 30, 22, 4, '#000000', 'opacity=".2"');
    r += P_('M-12 28L-14 12Q-14 6 -8 6L-2 8L-6 28Z', '#E8ECF0') + P_('M12 28L14 12Q14 6 8 6L2 8L6 28Z', '#E8ECF0');
    r += R_(-15, 26, 9, 5, '#14181C', 'rx="2"') + R_(6, 26, 9, 5, '#14181C', 'rx="2"');
    r += P_('M-16 8Q-18 -12 0 -14Q18 -12 16 8Q0 12 -16 8Z', '#EEF1F4') + `<text x="0" y="4" font-size="12" fill="${TEAM.navy}" text-anchor="middle" ${FONT_NUM}>${esc(S ? S.num : 7)}</text>`;
    r += L_('M14 -4L22 18', skin, 5) + C_(0, -18, 7.6, skin) + P_('M-7.6 -19Q-7 -26 0 -26Q7 -26 7.6 -19Q4 -22 0 -22Q-4 -22 -7.6 -19Z', hairColor(L));
    s += G_(r, 'transform="translate(338 116) scale(.9)"');
    // Coach Bramble with a clipboard, off to the side
    let cb = P_('M-12 40L-10 8Q-10 0 0 0Q10 0 10 8L12 40Z', '#1B2740') + C_(0, -8, 7, '#E9B697') + P_('M-7.6 -9Q-7 -17 0 -17Q7 -17 7.6 -9Z', '#1B2740') + P_('M-8 -9.6Q4 -11.6 13 -8.6L12 -7Q2 -9.6 -7.6 -8Z', '#14203A') + R_(-14, 14, 10, 13, '#F4F1EA', 'transform="rotate(-10 -9 20)"') + R_(-12, 40, 9, 6, '#111', 'rx="2"') + R_(3, 40, 9, 6, '#111', 'rx="2"');
    s += G_(cb, 'transform="translate(606 92)"');
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };
  function pick2(rnd, a) { return a[Math.floor(rnd() * a.length)]; }

  // ---- Cut day, 6:40 AM: the door that says HEAD COACH ----
  SCENES.cut = () => {
    let s = `<defs>${grad('uacu-dawn', [[0, '#3B4B7A'], [0.55, '#E58A6A'], [1, '#F7C77A']])}${grad('uacu-floor', [[0, '#3C4452'], [1, '#262C36']])}${grad('uacu-glass', [[0, '#E8EEF0'], [1, '#C3D0D6']])}</defs>`;
    s += R_(0, 0, 800, 160, '#566273');
    for (let y = 0; y < 132; y += 13) { s += R_(0, y, 800, 1, '#3E4856', 'opacity=".6"'); for (let x = (y / 13) % 2 ? 0 : 24; x < 800; x += 48) s += R_(x, y, 1, 13, '#3E4856', 'opacity=".45"'); }
    s += R_(0, 128, 800, 32, 'url(#uacu-floor)') + R_(0, 126, 800, 4, '#2E3540');
    // dawn window with blinds
    s += R_(40, 24, 104, 80, '#2E3540', 'rx="2"') + R_(46, 30, 92, 68, 'url(#uacu-dawn)') + C_(110, 86, 12, '#FFE3A0', 'opacity=".9"');
    for (let y = 33; y < 98; y += 6) s += R_(46, y, 92, 2.6, '#DCE2E8', 'opacity=".55"');
    s += P_('M46 130L138 130L190 160L0 160Z', '#F7C77A', 'opacity=".1"');
    // framed team photos
    for (const [x, y] of [[180, 30], [246, 38]]) {
      s += R_(x, y, 52, 38, '#2A2420', 'rx="1"') + R_(x + 4, y + 4, 44, 30, '#C9D3DA');
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) s += C_(x + 9 + c * 7, y + 12 + r * 8, 2.4, ['#E2AF89', '#7A4A2B', '#C68B5E', '#5B3420'][(r + c) % 4]) + R_(x + 6.6 + c * 7, y + 14.6 + r * 8, 5, 3.6, TEAM.main, 'opacity=".8"');
    }
    // the door
    s += R_(322, 12, 156, 118, '#3E2B1E') + R_(330, 18, 140, 112, '#7A5236');
    s += R_(344, 28, 112, 56, 'url(#uacu-glass)', 'rx="2"') + R_(344, 28, 112, 56, 'none', 'rx="2" stroke="#5A3C28" stroke-width="2"');
    s += `<text x="400" y="55" font-size="14" fill="#14203A" text-anchor="middle" ${FONT_NUM} textLength="92" lengthAdjust="spacingAndGlyphs">HEAD COACH</text>`;
    s += `<text x="400" y="70" font-size="8" fill="#3A4656" text-anchor="middle" ${FONT_LBL} letter-spacing="2">R. BRAMBLE</text>`;
    s += R_(344, 92, 112, 30, '#6E4A30', 'rx="2"') + R_(350, 98, 100, 18, '#7E5838', 'rx="1"');
    s += C_(452, 92, 4, '#D9B44A') + R_(446, 90, 12, 4, '#C9A24A', 'rx="2"');
    s += R_(330, 128, 140, 3, '#FFD98A', 'class="ua-glow"') + P_('M330 131L470 131L500 160L300 160Z', '#FFD98A', 'fill-opacity=".14" class="ua-glow"');
    // clock reading 6:40
    const cx = 560, cy = 36;
    s += C_(cx, cy, 15, '#F4F1EA') + C_(cx, cy, 15, 'none', 'stroke="#2A2F3A" stroke-width="2.4"');
    const ha = ((6 + 40 / 60) / 12) * 2 * Math.PI - Math.PI / 2, ma = (40 / 60) * 2 * Math.PI - Math.PI / 2;
    s += L_(`M${cx} ${cy}L${r2(cx + Math.cos(ha) * 7)} ${r2(cy + Math.sin(ha) * 7)}`, '#14203A', 2) + L_(`M${cx} ${cy}L${r2(cx + Math.cos(ma) * 11)} ${r2(cy + Math.sin(ma) * 11)}`, '#14203A', 1.4) + C_(cx, cy, 1.4, '#BE3229');
    // chair with the playbook
    s += R_(530, 88, 58, 6, '#2F3742', 'rx="2"') + R_(534, 94, 4, 32, '#2F3742') + R_(580, 94, 4, 32, '#2F3742') + R_(582, 56, 6, 38, '#2F3742', 'rx="2"');
    s += R_(538, 74, 42, 14, TEAM.navy, 'rx="2"') + R_(538, 74, 6, 14, dk(TEAM.navy, 0.3)) + R_(552, 78, 20, 6, '#F4F1EA') + `<text x="562" y="82.8" font-size="4.6" fill="${TEAM.navy}" text-anchor="middle" ${FONT_LBL} textLength="17" lengthAdjust="spacingAndGlyphs">PLAYBOOK</text>`;
    // exit sign
    s += R_(688, 14, 44, 16, '#1B1F25', 'rx="2"') + `<text x="710" y="26" font-size="10" fill="#FF5A4E" text-anchor="middle" ${FONT_LBL} letter-spacing="1" class="ua-glow">EXIT</text>`;
    // the Turk's long shadow sliding in from the left
    s += P_('M120 160L210 132Q218 128 226 130L246 136Q254 128 262 132Q270 138 262 144L300 160Z', '#000000', 'opacity=".24"');
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- Thanksgiving at the Fonotis: three ovens, twenty-two cousins ----
  SCENES.w8_thanks = () => {
    const rnd = rng(88);
    let s = `<defs>${grad('uath-wall', [[0, '#8A4A2E'], [1, '#5E2E1E']])}${grad('uath-cloth', [[0, '#F7EFE0'], [1, '#E7D9C0']])}${grad('uath-dusk', [[0, '#5B4A8A'], [1, '#F2A65A']])}</defs>`;
    s += R_(0, 0, 800, 160, 'url(#uath-wall)');
    for (let x = 0; x < 800; x += 32) s += P_(`M${x + 16} 6l3 5-3 5-3-5z`, '#F2C14E', 'opacity=".08"');
    // windows at dusk
    for (const x of [40, 690]) s += R_(x, 20, 70, 60, '#3A1E14', 'rx="2"') + R_(x + 5, 25, 60, 50, 'url(#uath-dusk)') + R_(x + 33, 25, 4, 50, '#3A1E14') + R_(x + 5, 48, 60, 4, '#3A1E14');
    // string lights
    s += L_('M0 10Q100 34 200 12Q300 34 400 12Q500 34 600 12Q700 34 800 10', '#2A1A12', 1.2);
    for (let i = 0; i < 40; i++) {
      const x = i * 20 + 10, seg = (x % 200) / 200, y = 12 + Math.sin(seg * Math.PI) * 19;
      s += C_(x, y + 3, 3, ['#FFD27A', '#FF9E5E', '#FFF1C4'][i % 3], anim('ua-tw', -rnd() * 3, 2 + rnd() * 2)) + C_(x, y + 3, 6, '#FFD27A', 'opacity=".12"');
    }
    // the family behind the table
    const skins = ['#9C6845', '#A8714A', '#8A5534', '#B98058', '#6E4128', '#C68B5E', '#7A4A2B', '#A36A42'];
    const shirts = ['#2F6FA8', '#E8456A', '#3E8A4B', '#F2C14E', '#7A2433', '#5B2A86', '#1D5A5E', '#E5621C', '#F4F1EA'];
    const hairs = ['short', 'bun', 'long', 'curly', 'short', 'kid', 'long', 'fade'];
    const back = [];
    for (let i = 0; i < 14; i++) {
      const x = 52 + i * 54 + (rnd() - 0.5) * 10;
      if (Math.abs(x - 400) < 64) continue;
      back.push(folk(x, 82, { s: 0.72, skin: skins[i % skins.length], shirt: shirts[(i * 5) % shirts.length], hair: hairs[(i * 3) % hairs.length], hairC: i % 5 === 0 ? '#5C5652' : '#1A1210', mood: i % 3 ? 'smile' : 'happy' }));
    }
    s += back.join('');
    const front = [];
    front.push(folk(150, 104, { s: 0.95, skin: '#8A5534', shirt: '#3E8A4B', hair: 'curly', mood: 'laugh' }));
    front.push(folk(214, 92, { s: 0.8, skin: '#B98058', shirt: TEAM.main, hair: 'kid', mood: 'laugh', extra: R_(-16, 2, 32, 20, '#FFFFFF', 'opacity="0"') }));
    front.push(folk(270, 104, { s: 0.95, skin: '#6E4128', shirt: '#7A2433', hair: 'bun', mood: 'happy', glasses: '#2B2B2B' }));
    front.push(folkYou(338, 104, 0.95, TEAM.main));
    front.push(folk(404, 100, { s: 1.32, skin: '#A8714A', shirt: TEAM.navy, hair: 'bun', mood: 'laugh', extra: `<text x="-10" y="28" font-size="9" fill="${TEAM.main}" text-anchor="middle" ${FONT_NUM}>71</text>` }));
    front.push(folk(470, 104, { s: 0.95, skin: '#9C6845', shirt: '#2F6FA8', hair: 'grandma', hairC: '#5C5652', mood: 'happy', flower: true }));
    front.push(folk(534, 104, { s: 0.95, skin: '#C68B5E', shirt: '#F2C14E', hair: 'short', mood: 'smile', extra: R_(8, 6, 7, 10, '#FFFFFF', 'rx="1" transform="rotate(12 11 11)"') + R_(12, 7, 7, 10, '#F4F1EA', 'rx="1" transform="rotate(24 15 12)"') }));
    front.push(folk(600, 104, { s: 0.95, skin: '#7A4A2B', shirt: '#5B2A86', hair: 'long', mood: 'laugh' }));
    front.push(folk(664, 104, { s: 0.95, skin: '#A36A42', shirt: '#E8456A', hair: 'fade', mood: 'smile' }));
    s += front.join('');
    // the table
    s += P_('M-10 112L810 112L820 160L-20 160Z', 'url(#uath-cloth)') + R_(-10, 110, 820, 5, '#FFFFFF', 'opacity=".7"');
    for (let x = 30; x < 800; x += 60) s += E_(x, 132, 18, 6, '#FFFFFF') + E_(x, 132, 12, 3.6, '#F2EBDD');
    // turkey, pies, sides, candles
    s += E_(400, 128, 34, 7, '#D7DCE0') + P_('M374 126Q372 104 400 102Q428 104 426 126Z', '#B8682E') + P_('M380 120Q384 108 400 106', 'none', 'stroke="#D98B4A" stroke-width="3" stroke-linecap="round"');
    s += L_('M376 118L364 112M424 118L436 112', '#B8682E', 5) + C_(362, 111, 3, '#F4F1EA') + C_(438, 111, 3, '#F4F1EA') + C_(392, 128, 2.4, '#3E8A4B') + C_(410, 128, 2.4, '#E5484D');
    for (const x of [252, 548, 640]) s += E_(x, 128, 18, 6, '#C9A24A') + E_(x, 126, 15, 4.6, '#E58A3A') + L_(`M${x - 10} 126L${x + 10} 126M${x} 122L${x} 130`, '#F2C14E', 0.8, 'opacity=".7"');
    s += E_(170, 128, 16, 6, '#F4F1EA') + E_(170, 125, 13, 4, '#FFF8E0') + E_(320, 130, 14, 5, '#3A6B3A') + E_(320, 127.6, 11, 3.4, '#5BA05B');
    s += P_('M470 132L474 122L498 122L502 132Z', '#C9A26E') + C_(480, 121, 3.6, '#E8C08A') + C_(488, 120, 3.6, '#E8C08A') + C_(495, 121, 3.4, '#E8C08A');
    for (const x of [100, 700]) s += R_(x - 2, 112, 4, 18, '#F4F1EA') + P_(`M${x} 104Q${x + 3} 108 ${x} 112Q${x - 3} 108 ${x} 104Z`, '#FFB21E', 'class="ua-flicker"') + C_(x, 108, 7, '#FFD27A', 'fill-opacity=".2" class="ua-flicker"');
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- Room 412: a hospital window with Leo's drawing ----
  SCENES.w9_leo = () => {
    const rnd = rng(412);
    const num = S ? S.num : 7;
    let s = `<defs>${grad('ualo-sky', [[0, '#A9C9E6'], [1, '#EAF2F8']])}</defs>`;
    s += R_(0, 0, 800, 160, '#CFE3DC') + R_(0, 104, 800, 56, '#B5D1C7') + R_(0, 102, 800, 4, '#E8F1EE');
    // pennant
    s += P_('M108 30L218 46L108 62Z', TEAM.navy) + R_(104, 26, 5, 40, '#8A6A44') + `<text x="146" y="49.4" font-size="7" fill="${TEAM.main}" text-anchor="middle" ${FONT_LBL} letter-spacing=".6" transform="rotate(8 146 46)">HAMMERHEADS</text>`;
    // the window and winter city
    s += R_(244, 10, 312, 108, '#F4F6F6') + R_(252, 18, 296, 92, 'url(#ualo-sky)');
    let city = '';
    for (const [x, w, h] of [[252, 30, 34], [284, 22, 50], [308, 40, 28], [350, 26, 58], [378, 36, 40], [416, 24, 66], [442, 40, 36], [484, 28, 52], [514, 34, 30]]) {
      city += R_(x, 110 - h, w, h, '#9FB3C8');
      for (let wy = 110 - h + 5; wy < 106; wy += 8) for (let wx = x + 4; wx < x + w - 4; wx += 7) city += R_(wx, wy, 3, 4, '#C9D8E6');
      city += R_(x, 110 - h, w, 3, '#FFFFFF', 'opacity=".9"');
    }
    s += city;
    for (let i = 0; i < 40; i++) s += C_(254 + rnd() * 292, 18 + rnd() * 90, 0.9 + rnd() * 1.1, '#FFFFFF', anim('ua-snow', -rnd() * 6, 5 + rnd() * 4) + ` fill-opacity="${r2(0.6 + rnd() * 0.4)}"`);
    s += R_(396, 18, 8, 92, '#F4F6F6') + R_(252, 62, 296, 6, '#F4F6F6');
    s += R_(236, 116, 328, 8, '#E8EEEE') + R_(236, 122, 328, 3, '#C9D6D2');
    // get-well cards on the sill
    s += P_('M262 116L270 100L278 116Z', '#F2C14E') + P_('M282 116L292 98L302 116Z', '#E8456A') + P_('M520 116L530 102L540 116Z', '#69C3E6');
    // Leo's crayon drawing, taped to the glass
    let d = R_(-42, -36, 84, 72, '#FFFDF6') + R_(-42, -36, 84, 72, 'none', 'stroke="#E2DCC8" stroke-width="1"');
    d += L_('M-38 26Q-20 22 0 26Q20 30 38 24', '#3FA34D', 3.4) + L_('M-36 30Q-10 27 36 31', '#3FA34D', 2.6);
    d += C_(30, -24, 6, '#F2C14E') + L_('M30 -34L30 -31M40 -24L37 -24M37 -31L35 -29M23 -31L25 -29', '#F2C14E', 1.4);
    for (const [x, h] of [[-34, 10], [-27, 14], [-20, 8]]) d += R_(x, 24 - h, 6, h, '#8A9BB0');
    d += L_('M2 -12L-10 -26M14 -12L26 -26', '#B8682E', 2.6);
    d += R_(-2, -14, 20, 26, TEAM.main, 'rx="3"') + `<text x="8" y="5" font-size="12" fill="#FFFFFF" text-anchor="middle" ${FONT_NUM}>${esc(num)}</text>`;
    d += L_('M2 12L-2 25M14 12L18 25', '#14203A', 2.6) + C_(8, -21, 7, '#C68B5E') + C_(6, -22, 1, INK) + C_(10.6, -22, 1, INK) + L_('M5 -18.6Q8 -16 11 -18.6', INK, 1);
    d += `<text x="-24" y="-20" font-size="10" fill="#2F6FA8" text-anchor="middle" font-family="'Comic Sans MS','Chalkboard SE','Marker Felt',cursive" font-weight="700">LEO</text>` + P_('M-30 -8Q-30 -13 -26 -11Q-22 -13 -22 -8Q-22 -5 -26 -2Q-30 -5 -30 -8Z', '#E8456A');
    d += R_(-48, -40, 16, 7, '#E9DFC0', 'opacity=".85" transform="rotate(-24 -40 -36)"') + R_(32, -40, 16, 7, '#E9DFC0', 'opacity=".85" transform="rotate(24 40 -36)"');
    s += G_(d, 'transform="translate(330 62) rotate(-4)"');
    // balloons
    for (const [x, y, c] of [[612, 34, TEAM.main], [640, 24, TEAM.navy], [664, 40, '#F4F6F8']]) s += L_(`M${x} ${y + 15}Q${x + 6} ${y + 50} ${x + 2} 128`, '#8A9BB0', 0.8) + E_(x, y, 12, 15, c, 'class="ua-sway"') + E_(x - 4, y - 5, 3, 5, '#FFFFFF', 'opacity=".35"');
    // IV pole with a shark sticker
    s += R_(728, 8, 4, 152, '#AEB8C2') + L_('M716 14L744 14', '#AEB8C2', 2.4) + R_(712, 16, 14, 22, '#E6F2F8', 'rx="3" opacity=".9"') + L_('M719 38L719 70Q719 80 726 84', '#C9D6DE', 1);
    s += C_(730, 92, 6, TEAM.main) + P_('M726 92L734 92L732 89Z', '#FFFFFF');
    // bed and blanket
    s += R_(460, 124, 360, 40, '#7FA8C9', 'rx="8"') + R_(460, 120, 360, 8, '#F4F6F8', 'rx="4"') + R_(450, 116, 8, 44, '#AEB8C2', 'rx="2"');
    s += L_('M500 140L600 140M520 150L640 150', '#9DC0DA', 2);
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- Game day: the stadium under the lights ----
  const OPP_ART = {
    Gulls: { c: ['#1FA3A3', '#F4F6F8', '#0E5E6B'], fx: 'gulls' },
    Vipers: { c: ['#C8442E', '#E9C46A', '#5A2A1A'], sky: 'day', fx: 'desert' },
    Lumberjacks: { c: ['#2F6B3A', '#B23A2E', '#F2E6D0'], fx: 'pines' },
    Smelters: { c: ['#F2C14E', '#1B1B1B', '#F2C14E'], fx: 'towels' },
    Monarchs: { c: ['#5B2A86', '#F2C14E', '#3A1B58'], fx: 'crowns' },
    Hurricanes: { c: ['#D23B3B', '#F4F6F8', '#1B2A4A'], fx: 'palms' },
    Mustangs: { c: ['#2B4C9B', '#E5621C', '#F4F6F8'], fx: 'mountains' },
    Bison: { c: ['#6B4A2E', '#3A6EA5', '#E9D6B0'], sky: 'dusk' },
    Jackpots: { c: ['#E83E8C', '#39D98A', '#1B1B1B'], fx: 'neon' },
    Grizzlies: { c: ['#2E5A3A', '#7A5A3A', '#E9D6B0'], fx: 'pines' },
    Sentinels: { c: ['#9AA7B8', '#1B2A4A', '#E9EEF2'] },
  };
  function oppArt(team) {
    const k = shortName(team || '');
    // Prefer the game's own team colors (48-teams.js) so the crowd matches the helmets.
    let ts = null;
    try { if (typeof teamStyle === 'function') ts = teamStyle(team); } catch (e) { ts = null; }
    if (ts && ts.c1) return Object.assign({}, OPP_ART[k] || {}, { c: [ts.c1, ts.c2, ts.c1] });
    if (OPP_ART[k]) return OPP_ART[k];
    const h = hash(team || 'x'), pal = ['#2E8B57', '#8B2E2E', '#2E4E8B', '#8B6B2E', '#6B2E8B', '#2E7A8B'];
    return { c: [pal[h % pal.length], '#F4F6F8', pal[(h >>> 3) % pal.length]] };
  }
  // Home / away / neutral comes from the engine's shared venueOf (src/48-teams.js), so the banner always agrees with
  // the story text and the seeding (Wild Card on the road, the better seed hosts the Conference Championship).
  // The fallback below only runs if that helper is missing or throws (e.g. no career started yet).
  function gameVenue(n) {
    try {
      if (typeof venueOf === 'function' && S) {
        const v = venueOf(n);
        if (v === 'home' || v === 'away' || v === 'neutral') return v;
      }
    } catch (e) { /* fall through */ }
    if (n >= 12) return 'neutral';
    if (n === 10) return 'away';
    if (n === 11) return S && S.record && S.record.w >= 8 ? 'home' : 'away';
    return n % 2 === 0 ? 'home' : 'away';
  }
  SCENES.game_pre = o => {
    o = o || {};
    const n = o.n != null ? o.n : (S ? S.slate : 0);
    const opp = (typeof oppOf === 'function' && S) ? oppOf(n) : { team: 'Lakeshore Gulls' };
    const oa = oppArt(opp && opp.team);
    const venue = o.venue || gameVenue(n);
    const playoff = n >= 10, final = n >= 12;
    const sky = venue === 'away' && oa.sky ? oa.sky : n === 7 ? 'dusk' : 'night';
    const rnd = rng(1000 + n * 17 + (S ? S.year || 1 : 1));
    const skyStops = sky === 'day' ? [[0, '#5BA8E8'], [1, '#CDE6F5']] : sky === 'dusk' ? [[0, '#2E2558'], [0.6, '#A8506A'], [1, '#F2A65A']] : [[0, '#070B1C'], [1, '#1B2850']];
    let s = `<defs>${grad('uagp-sky', skyStops)}${rgrad('uagp-glow', [[0, '#FFFBEA', 0.85], [0.25, '#FFF3C4', 0.35], [1, '#FFF3C4', 0]])}${grad('uagp-turf', [[0, '#2E7A40'], [1, '#215C30']])}</defs>`;
    s += R_(0, 0, 800, 160, 'url(#uagp-sky)');
    if (sky === 'night') s += stars(rnd, 30, 0, 800, 2, 40);
    if (sky === 'day') s += C_(660, 20, 16, '#FFF2B0') + C_(660, 20, 26, '#FFF2B0', 'opacity=".3"');
    if (sky === 'dusk') s += C_(150, 40, 18, '#FFD98A', 'opacity=".8"');
    const fxk = venue === 'away' ? oa.fx : null;
    if (fxk === 'mountains') s += P_('M0 60L80 22L140 44L220 10L310 48L380 26L460 52L540 16L640 50L720 24L800 46L800 70L0 70Z', '#3C4E7A') + P_('M210 14L220 10L232 18L222 20Z M532 20L540 16L552 24L542 26Z', '#F4F6F8');
    if (fxk === 'pines' || (venue === 'home' && false)) for (let x = 0; x < 800; x += 22) { const h = 20 + rnd() * 18; s += P_(`M${x} 60L${x + 11} ${60 - h}L${x + 22} 60Z`, '#14321E'); }
    if (fxk === 'palms') for (const x of [40, 120, 690, 760]) s += L_(`M${x} 64Q${x + 4} 40 ${x} 22`, '#2A1E14', 3) + P_(`M${x} 22Q${x - 18} 16 ${x - 26} 26Q${x - 14} 18 ${x} 24Q${x + 14} 16 ${x + 26} 26Q${x + 18} 14 ${x} 22Z`, '#1F4A2A');
    if (fxk === 'neon') for (const [x, c] of [[60, '#E83E8C'], [150, '#39D98A'], [660, '#FFD23F'], [740, '#E83E8C']]) s += R_(x - 16, 18, 32, 40, '#141018') + R_(x - 12, 22, 24, 6, c, 'class="ua-blink"') + R_(x - 12, 32, 24, 3, c, 'opacity=".7"');
    if (fxk === 'gulls') for (const [x, y] of [[120, 22], [140, 30], [630, 18], [652, 26]]) s += L_(`M${x - 6} ${y}Q${x - 3} ${y - 4} ${x} ${y}Q${x + 3} ${y - 4} ${x + 6} ${y}`, sky === 'night' ? '#C9D3DA' : '#2A2F3A', 1.4);
    if (fxk === 'desert') for (const x of [60, 730]) s += R_(x - 3, 30, 6, 34, '#3E6B3A', 'rx="3"') + R_(x - 12, 40, 6, 14, '#3E6B3A', 'rx="3"') + R_(x + 6, 36, 6, 12, '#3E6B3A', 'rx="3"');
    // stadium shell
    s += P_('M-10 46Q400 28 810 46L810 92L-10 92Z', '#1A2130');
    for (let x = 10; x < 800; x += 24) s += C_(x, 46 - Math.sin(x / 800 * Math.PI) * 17 + 2, 1, '#FFE9A8', 'opacity=".8"');
    const home = venue === 'home';
    const cols = home ? [TEAM.main, TEAM.main, TEAM.navy, '#F4F6F8', '#22345A'] : venue === 'neutral' ? [TEAM.main, TEAM.navy, oa.c[0], oa.c[1], '#F4F6F8'] : [oa.c[0], oa.c[0], oa.c[1], oa.c[2], TEAM.main];
    s += crowd(rnd, 0, 800, 54, 84, cols, { step: 6, r: 2.4, flash: 14 });
    // ribbon board
    s += R_(0, 86, 800, 9, '#0B0F17');
    const rib = home ? 'HAMMERHEADS · HARBOR CITY · ' : venue === 'neutral' ? 'THE CHAMPIONSHIP · ' : `${shortName(opp.team).toUpperCase()} · WELCOME TO ${String(opp.team).toUpperCase()} COUNTRY · `;
    s += `<text x="0" y="93.2" font-size="6.6" fill="${home ? TEAM.main : venue === 'neutral' ? TEAM.gold : oa.c[1] === '#1B1B1B' ? oa.c[0] : oa.c[1]}" ${FONT_LBL} letter-spacing="2">${esc(rib.repeat(8))}</text>`;
    s += crowd(rnd, 0, 800, 100, 112, cols, { step: 5.4, r: 2.2 });
    if (fxk === 'towels') for (let i = 0; i < 40; i++) s += R_(rnd() * 800, 54 + rnd() * 54, 5, 4, '#F2C14E', anim('ua-wave', -rnd() * 1.2));
    if (fxk === 'crowns') for (const x of [140, 300, 500, 660]) s += P_(`M${x - 8} 80L${x - 8} 70L${x - 4} 74L${x} 68L${x + 4} 74L${x + 8} 70L${x + 8} 80Z`, '#F2C14E');
    s += R_(0, 112, 800, 6, '#0E1626');
    // field
    s += P_('M-40 118L840 118L900 160L-100 160Z', 'url(#uagp-turf)');
    for (let i = -10; i <= 10; i++) { const xt = 400 + i * 48, xb = 400 + i * 66; s += L_(`M${xt} 118L${xb} 160`, '#FFFFFF', 1.4, 'opacity=".55"'); }
    s += E_(400, 140, 54, 12, home ? TEAM.main : venue === 'neutral' ? TEAM.gold : oa.c[0], 'opacity=".75"');
    s += home ? `<text x="400" y="144" font-size="11" fill="#FFFFFF" text-anchor="middle" ${FONT_NUM}>H</text>` : venue === 'neutral' ? P_('M392 146L394 134L400 140L406 134L408 146Z', '#14203A') : `<text x="400" y="144" font-size="11" fill="#FFFFFF" text-anchor="middle" ${FONT_NUM}>${esc(shortName(opp.team).charAt(0))}</text>`;
    // light towers and beams
    s += lightTower(92, 8, 64, 'uagp-glow', [80, 220]) + lightTower(708, 8, 64, 'uagp-glow', [-220, -80]);
    // scoreboard
    s += R_(318, 4, 164, 40, '#0B0F17', 'rx="3"') + R_(322, 8, 156, 32, '#141B16');
    s += `<text x="400" y="20" font-size="9" fill="#FFB21E" text-anchor="middle" ${FONT_LBL} letter-spacing="1.4">HAMMERHEADS</text>`;
    s += `<text x="400" y="34" font-size="8" fill="#E9EEE7" text-anchor="middle" ${FONT_LBL} letter-spacing="1.2">${esc((home || venue === 'neutral' ? 'VS ' : 'AT ') + shortName(opp.team).toUpperCase())}</text>`;
    s += R_(396, 44, 8, 8, '#0B0F17');
    if (playoff && !final) {
      s += P_('M0 0L800 0L800 6Q700 16 600 6Q500 16 400 6Q300 16 200 6Q100 16 0 6Z', TEAM.main, 'opacity=".9"');
      for (let i = 0; i < 70; i++) s += C_(rnd() * 800, rnd() * 160, 0.8 + rnd() * 1.4, '#FFFFFF', anim('ua-snow', -rnd() * 6, 4 + rnd() * 4) + ` fill-opacity="${r2(0.5 + rnd() * 0.5)}"`);
    }
    if (final) {
      for (const [x, y, c] of [[200, 24, TEAM.gold], [560, 18, TEAM.main], [640, 34, '#FFFFFF'], [150, 36, '#69C3E6']]) {
        let f = '';
        for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; f += L_(`M${r2(x + Math.cos(a) * 4)} ${r2(y + Math.sin(a) * 4)}L${r2(x + Math.cos(a) * 14)} ${r2(y + Math.sin(a) * 14)}`, c, 1.4); }
        s += G_(f + C_(x, y, 2, c), anim('ua-burst', -rnd() * 2.4, 2.4));
      }
    }
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- The night before the Championship: hotel window over the city ----
  SCENES.po3_night = () => {
    const rnd = rng(311);
    const vane = S ? S.rel.vane >= 40 : false;
    let s = `<defs>${grad('uapn-sky', [[0, '#060A1C'], [1, '#1C2A55']])}${rgrad('uapn-stad', [[0, '#FFF3C4', 0.8], [1, '#FFF3C4', 0]])}</defs>`;
    s += R_(0, 0, 800, 160, '#0D1220');
    s += R_(176, 8, 448, 124, '#1B2236') + R_(184, 14, 432, 112, 'url(#uapn-sky)') + stars(rnd, 30, 186, 614, 16, 60);
    s += C_(560, 34, 9, '#F4E9C8') + C_(556, 31, 9, '#141F44', 'opacity=".9"');
    const skyline = (col, base, hmin, hvar, x0, x1) => {
      let out = '', x = x0;
      while (x < x1) {
        const w = 16 + rnd() * 24, h = hmin + rnd() * hvar;
        out += R_(x, base - h, w, h + 30, col);
        for (let wy = base - h + 5; wy < base + 20; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (rnd() < 0.4) out += R_(wx, wy, 2.4, 3, rnd() < 0.5 ? '#FFD27A' : '#BFD8FF', rnd() < 0.15 ? anim('ua-tw', -rnd() * 4, 3 + rnd() * 3) + ' fill-opacity=".9"' : 'opacity=".75"');
        x += w + 2;
      }
      return out;
    };
    s += skyline('#18213D', 96, 16, 30, 184, 400);
    // distant stadium glowing, and the bridge
    s += C_(492, 72, 64, 'url(#uapn-stad)', 'class="ua-glow"') + P_('M436 92Q492 62 548 92Z', '#2A3350') + E_(492, 76, 38, 6, '#FFF3C4', 'opacity=".55"') + R_(454, 52, 2, 26, '#2A3350') + R_(528, 52, 2, 26, '#2A3350') + R_(448, 48, 14, 6, '#FFFBEA') + R_(522, 48, 14, 6, '#FFFBEA');
    s += L_('M548 98Q582 74 616 98', '#3A4566', 1.6) + R_(548, 98, 70, 3, '#2A3350');
    for (let x = 552; x < 616; x += 8) s += C_(x, 98 - Math.sin((x - 548) / 68 * Math.PI) * 22 + 1, 1, '#FFD27A');
    s += skyline('#0E1530', 126, 24, 34, 184, 430) + skyline('#0E1530', 126, 10, 16, 560, 616);
    s += R_(396, 14, 8, 112, '#1B2236') + R_(176, 126, 448, 8, '#2A3350');
    // curtains
    s += P_('M110 0L210 0Q190 70 206 160L110 160Z', '#3A2F4E') + P_('M690 0L590 0Q610 70 594 160L690 160Z', '#3A2F4E');
    s += L_('M140 0Q130 80 140 160M170 0Q160 80 172 160M660 0Q670 80 660 160M630 0Q640 80 628 160', '#2A2140', 2);
    // nightstand with the clock (and maybe Vane's wristband)
    s += R_(40, 112, 120, 48, '#2A2030') + R_(36, 108, 128, 6, '#3A2E40');
    s += R_(58, 90, 44, 18, '#111318', 'rx="3"') + `<text x="80" y="104" font-size="12" fill="#FF4D4D" text-anchor="middle" ${FONT_LBL} letter-spacing="1" class="ua-glow">11:40</text>`;
    s += R_(124, 70, 4, 38, '#3A2E40') + P_('M110 70L142 70L136 52L116 52Z', '#4A3E52');
    if (vane) {
      s += E_(132, 106, 10, 3.4, 'none', `stroke="${TEAM.main}" stroke-width="3"`) + E_(132, 105, 10, 3.4, 'none', 'stroke="#FFFFFF" stroke-width=".7" opacity=".5"');
      s += R_(720, 20, 90, 140, '#1E1828') + R_(722, 150, 80, 3, '#FFD98A', 'class="ua-glow"') + P_('M722 153L800 153L800 160L700 160Z', '#FFD98A', 'opacity=".2"');
      s += L_('M708 60Q702 70 708 80M700 54Q690 70 700 86', '#FFD98A', 1.6, 'class="ua-knock" stroke-opacity=".7"');
    } else {
      for (const x of [640, 680]) s += P_(`M${x - 16} 140Q${x - 16} 156 ${x} 156Q${x + 16} 156 ${x + 16} 140Z`, '#F4F1EA') + E_(x, 140, 16, 3.4, '#E7DCC6') + C_(x - 5, 139, 1.6, '#F2C14E') + C_(x + 3, 138.6, 1.6, '#E5621C') + L_(`M${x + 4} 140L${x + 14} 124`, '#C9D0D6', 2);
    }
    s += R_(230, 138, 360, 30, '#2E3756', 'rx="6"') + R_(230, 136, 360, 6, '#46507A', 'rx="3"') + R_(256, 128, 70, 14, '#C9CFE0', 'rx="6"') + L_('M340 148Q420 140 520 150', '#3E4870', 2);
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // ---- Endings: confetti for champions, an empty field at dusk for everyone else ----
  SCENES.ending = o => {
    o = o || {};
    const id = o.id || (S && S.flags && S.flags.ending) || 'next';
    const champ = o.champ != null ? o.champ : !!(S && S.flags && S.flags.champion);
    const rnd = rng(hash(id) + 5);
    if (champ) {
      let s = `<defs>${grad('uaen-sky', [[0, '#05081A'], [1, '#1A2350']])}${rgrad('uaen-spot', [[0, '#FFF3C4', 0.7], [1, '#FFF3C4', 0]])}${grad('uaen-gold', [[0, '#FFE38A'], [0.5, '#F2B53A'], [1, '#B07A14']], 1, 0)}</defs>`;
      s += R_(0, 0, 800, 160, 'url(#uaen-sky)');
      s += crowd(rnd, 0, 800, 70, 110, [TEAM.main, TEAM.main, TEAM.navy, '#F4F6F8'], { step: 6.4, r: 2.4, flash: 20 });
      s += R_(0, 110, 800, 50, '#1E5A30') + R_(0, 108, 800, 4, '#0E1626');
      s += P_('M300 0L360 0L410 160L330 160Z', '#FFF3C4', 'opacity=".08"') + P_('M500 0L440 0L390 160L470 160Z', '#FFF3C4', 'opacity=".08"');
      s += E_(400, 150, 140, 16, 'url(#uaen-spot)');
      // podium + trophy
      s += R_(340, 124, 120, 30, '#14203A', 'rx="3"') + R_(346, 130, 108, 4, TEAM.main) + `<text x="400" y="148" font-size="10" fill="${TEAM.gold}" text-anchor="middle" ${FONT_NUM} letter-spacing="1.5">CHAMPIONS</text>`;
      s += R_(374, 108, 52, 16, '#2A2420', 'rx="2"') + R_(382, 102, 36, 8, '#3A3028', 'rx="2"');
      s += P_('M394 102L396 86L404 86L406 102Z', 'url(#uaen-gold)') + E_(400, 86, 7, 2.4, '#C99A2E');
      s += P_('M370 30Q370 76 400 84Q430 76 430 30Z', 'url(#uaen-gold)') + E_(400, 30, 30, 6, '#FFE9A8') + E_(400, 30, 26, 4.4, '#C99A2E');
      s += L_('M370 38Q352 40 354 54Q356 66 376 64M430 38Q448 40 446 54Q444 66 424 64', '#E8B544', 4);
      s += G_(E_(0, 0, 13, 8, '#7A4320') + L_('M-6 -2L6 -2', '#FFFFFF', 1.2) + L_('M-3.6 -4L-3.6 0M0 -4L0 0M3.6 -4L3.6 0', '#FFFFFF', 0.8), 'transform="translate(400 18) rotate(-20)"');
      s += P_('M380 36Q384 60 396 72', 'none', 'stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".5"');
      for (const [x, y] of [[352, 24], [452, 46], [440, 16]]) s += P_(`M${x} ${y - 6}l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z`, '#FFF3C4', anim('ua-tw', -rnd() * 2, 1.6));
      // confetti
      for (let i = 0; i < 90; i++) {
        const x = rnd() * 800, y = rnd() * 150, c = rnd() < 0.55 ? TEAM.main : rnd() < 0.8 ? '#FFFFFF' : TEAM.gold;
        s += R_(x, y, 3 + rnd() * 3, 2 + rnd() * 2, c, `transform="rotate(${Math.round(rnd() * 180)} ${r2(x)} ${r2(y)})" ` + anim('ua-conf', -rnd() * 6, 4 + rnd() * 4));
      }
      return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
    }
    let s = `<defs>${grad('uaen-dusk', [[0, '#231E48'], [0.45, '#7A3E6A'], [0.8, '#E07A5A'], [1, '#F6B66A']])}${grad('uaen-turf', [[0, '#3A4A2C'], [1, '#1E2A1A']])}</defs>`;
    s += R_(0, 0, 800, 160, 'url(#uaen-dusk)');
    s += C_(560, 50, 90, '#FFD98A', 'opacity=".08"') + C_(560, 50, 44, '#FFD98A', 'opacity=".2"') + C_(560, 50, 19, '#FFD98A');
    for (const [x, y] of [[180, 34], [196, 40], [212, 30], [620, 26], [636, 32]]) s += L_(`M${x - 5} ${y}Q${x - 2.5} ${y - 3.4} ${x} ${y}Q${x + 2.5} ${y - 3.4} ${x + 5} ${y}`, '#2A1E2E', 1.3);
    // empty stands and dark light towers
    s += P_('M-10 74Q400 58 810 74L810 104L-10 104Z', '#2A2236');
    for (let y = 78; y < 104; y += 5) s += R_(0, y, 800, 1, '#3A3048', 'opacity=".7"');
    for (const x of [90, 710]) s += R_(x - 2, 20, 4, 84, '#1E1828') + R_(x - 26, 12, 52, 18, '#1E1828', 'rx="2"');
    // field with long shadows
    s += R_(0, 104, 800, 56, 'url(#uaen-turf)');
    for (let i = -8; i <= 8; i++) s += L_(`M${400 + i * 52} 104L${400 + i * 74} 160`, '#F4F1EA', 1.2, 'opacity=".28"');
    // goalpost in front of the sun
    s += L_('M560 160L560 112M534 112L586 112M534 112L534 26M586 112L586 26', '#F2C14E', 3.6) + L_('M560 160L560 112', '#C9A23A', 2);
    s += P_('M560 112L640 160L600 160Z', '#000000', 'opacity=".18"');
    // the bench and what's left on it
    s += R_(140, 128, 200, 8, '#5A4A3A', 'rx="2"') + R_(150, 136, 6, 18, '#3A2E24') + R_(324, 136, 6, 18, '#3A2E24') + P_('M150 154L360 160L150 160Z', '#000000', 'opacity=".2"');
    if (id === 'hype') {
      // the phone that will not stop: face up on the bench, notifications stacking above it
      s += E_(244, 126, 26, 7, '#9FD6FF', 'fill-opacity=".22" class="ua-pulse"');
      s += P_('M228 128L234 121L262 121L258 128Z', '#0C0F15') + P_('M231 127L235.6 122.2L259.6 122.2L256.4 127Z', '#BFE6FF');
      for (let i = 0; i < 3; i++) s += G_(R_(226 + i * 6, 104 - i * 9, 38, 7, '#F4F6F8', 'rx="3.5"') + C_(231 + i * 6, 107.5 - i * 9, 2, i === 1 ? '#E83E8C' : TEAM.main) + R_(236 + i * 6, 106.3 - i * 9, 22 - i * 3, 2.4, '#9AA7B8', 'rx="1.2"'), anim('ua-tw', -i * 0.7, 2.8) + ' fill-opacity=".95"');
    }
    else if (id === 'heart') s += G_(R_(-16, -22, 32, 24, '#8A5A2E', 'rx="2"') + R_(-12, -18, 24, 16, '#C9A24A', 'rx="1"') + `<text x="0" y="-7" font-size="5" fill="#4A3510" text-anchor="middle" ${FONT_LBL}>ROOKIE</text>`, 'transform="translate(250 128) rotate(-8)"');
    else s += helmetSide(244, 116, 0.75, TEAM.navy, TEAM.main);
    if (id === 'climb' || id === 'next') {
      s += L_('M288 112Q302 92 316 112', '#0E1626', 2.4) + L_('M292 112Q302 98 312 112', '#0E1626', 1.6);
      s += R_(276, 110, 50, 19, TEAM.navy, 'rx="9"') + R_(276, 110, 50, 19, 'none', 'rx="9" stroke="#0E1626" stroke-width="1.2"');
      s += R_(279, 117, 44, 3.4, TEAM.main) + L_('M283 112.6L319 112.6', '#B9C0C8', 0.8, 'stroke-dasharray="2 1.4"');
      s += C_(301, 123.6, 3.4, '#F4F6F8') + `<text x="301" y="125.4" font-size="5" fill="${TEAM.navy}" text-anchor="middle" ${FONT_NUM}>H</text>`;
    }
    if (id === 'tree') s += G_(R_(-11, -15, 22, 28, '#8A6A44', 'rx="2"') + R_(-8, -10, 16, 21, '#F4F1EA') + R_(-4, -17, 8, 5, '#B9C0C8', 'rx="1"') + L_('M-5 -5L5 -5M-5 -1L3 -1M-5 3L5 3', '#8A93A0', 0.8) + C_(-3, 7, 1.6, 'none', 'stroke="#C0392B" stroke-width=".8"') + L_('M1 5L5 9M5 5L1 9', TEAM.navy, 0.8), 'transform="translate(296 116) rotate(-12)"');
    if (id === 'favorite') s += G_(R_(-20, -12, 40, 22, '#F4F1EA', 'rx="1.5"') + R_(-20, -12, 40, 5, TEAM.main) + `<text x="0" y="6" font-size="10" fill="${TEAM.navy}" text-anchor="middle" ${FONT_NUM}>#${esc(S && S.num != null ? S.num : '')}</text>` + L_('M-6 -1L-2 -4L2 -1L6 -4', TEAM.main, 1), 'transform="translate(298 116) rotate(8)"');
    const winC = (() => { try { const o = typeof oppOf === 'function' && S ? oppOf(12) : null; const c = o ? oppArt(o.team).c : null; return c ? [c[0], c[1]] : null; } catch (e) { return null; } })() || ['#9AA7B8', '#1B2A4A'];
    if (id === 'close') for (let i = 0; i < 60; i++) { const x = rnd() * 800, y = 110 + rnd() * 48; s += R_(x, y, 3, 2, rnd() < 0.5 ? winC[0] : winC[1], `transform="rotate(${Math.round(rnd() * 180)} ${r2(x)} ${r2(y)})"`); }
    return svg(VB, s, 'preserveAspectRatio="xMidYMid slice"');
  };

  // Which pages get a banner. Modules can add their own: ART.BANNERS.my_page = 'game_pre' or (args) => ({ id, opts }).
  const BANNERS = {
    draft: 'draft', call: 'call', camp1: 'camp1', camp_drill: 'camp_drill', cut: 'cut', w8_thanks: 'w8_thanks',
    w9_leo: 'w9_leo', game_pre: 'game_pre', po3_night: 'po3_night', ending: 'ending',
    y2_po3_night: 'po3_night',
  };
  function scene(id, opts) {
    const f = SCENES[id];
    if (!f) return '';
    const st = S || {};
    const ven = id === 'game_pre' ? gameVenue(opts && opts.n != null ? opts.n : st.slate) : '';
    const key = 'sc|' + id + '|' + JSON.stringify(opts || {}) + '|' + ven + '|' + [st.slate, st.year, st.num, st.last, st.origin, st.pos, st.flags && st.flags.ending, st.flags && st.flags.champion, st.rel && st.rel.vane >= 40, JSON.stringify(lookOf(S))].join('|');
    return memo(key, () => f(opts));
  }
  function banner(id, opts) {
    const svgS = scene(id, opts);
    return svgS ? `<div class="art-banner art-${esc(id)}" aria-hidden="true">${svgS}</div>` : '';
  }

  // =========================================================
  //   COVER ART — the title screen: you, from behind, walking into the lights
  // =========================================================
  function coverFigure(st) {
    const look = st ? lookOf(st) : { skin: 3, hair: 1 };
    const skin = SKINS[look.skin][0], sh = dk(skin, 0.18), hairC = hairColor(look), style = HAIRS[look.hair][0];
    const num = st && st.num != null ? String(st.num) : '';
    const last = st && st.last ? String(st.last).toUpperCase() : '';
    const rim = '#FFF3C4';
    let s = E_(180, 470, 86, 9, '#000000', 'opacity=".28"');
    // legs
    s += P_('M134 286L130 404L170 406L180 298Z', '#E6EAEF') + P_('M226 286L230 404L190 406L180 298Z', '#CDD4DC');
    s += L_('M137 292L134 398', TEAM.navy, 5) + L_('M137 292L134 398', TEAM.main, 2) + L_('M223 292L226 398', TEAM.navy, 5) + L_('M223 292L226 398', TEAM.main, 2);
    s += R_(134, 402, 34, 52, TEAM.navy, 'rx="6"') + R_(192, 402, 34, 52, dk(TEAM.navy, 0.15), 'rx="6"') + R_(134, 418, 34, 6, TEAM.main) + R_(192, 418, 34, 6, TEAM.main);
    s += R_(128, 448, 42, 18, '#111418', 'rx="8"') + R_(190, 448, 42, 18, '#0B0D10', 'rx="8"') + R_(132, 462, 34, 4, '#2A2F3A');
    // towel
    s += P_('M150 282L168 282L170 334Q160 340 150 334Z', '#F4F6F8') + L_('M152 326L168 326', TEAM.main, 2);
    // back hair that falls past the neck (locs, flow)
    if (style === 'locs') for (let i = 0; i < 9; i++) s += R_(155 + i * 5.6, 104, 5, 64 - Math.abs(i - 4) * 4, hairC, 'rx="2.5"');
    if (style === 'flow') s += P_('M156 112Q152 140 160 156Q170 150 180 158Q190 150 200 156Q208 140 204 112Z', hairC);
    // torso (jersey over pads)
    s += P_('M98 178Q104 154 150 150L210 150Q256 154 262 178L250 296L110 296Z', TEAM.main);
    s += P_('M206 150Q256 154 262 178L250 296L214 296Z', TEAM.dark, 'opacity=".55"');
    s += P_('M150 150Q180 160 210 150L206 158Q180 166 154 158Z', TEAM.navy);
    // sleeves with stripes, arms
    s += P_('M98 178Q92 196 94 214L124 214L126 176Z', TEAM.main) + P_('M262 178Q268 196 266 214L236 214L234 176Z', TEAM.dark);
    s += L_('M95 204L125 204', TEAM.navy, 4) + L_('M95 210L125 210', '#FFFFFF', 2) + L_('M265 204L235 204', TEAM.navy, 4) + L_('M265 210L235 210', '#FFFFFF', 2);
    s += L_('M108 214L102 300', skin, 22) + L_('M252 214L262 296', sh, 22);
    s += C_(101, 306, 12, skin) + C_(263, 302, 12, sh);
    // helmet dangling from the right hand
    s += G_(P_('M-14 6C-16 -8 -6 -16 4 -15C14 -14 18 -6 17 3L16 9L4 10L2 6L-8 8Z', TEAM.navy) + L_('M-12 -6C-6 -14 6 -15 13 -9', TEAM.main, 2.6) + L_('M10 2L22 2M10 7L21 7M14 -1L15 10M19 -1L20 9', '#B9C0C8', 1.4) + P_('M-4 -7l2 -3 2 3z', TEAM.main), 'transform="translate(270 338) rotate(78) scale(2.5)"');
    s += C_(263, 302, 12, sh);
    // nameplate + number
    if (last) {
      const fit = last.length > 8 ? ` textLength="${Math.min(96, last.length * 9)}" lengthAdjust="spacingAndGlyphs"` : '';
      s += R_(128, 176, 104, 18, '#EFE6C8', 'transform="rotate(-1.2 180 185)"') + `<text x="180" y="190" font-size="14" fill="#1B1B1B" text-anchor="middle" ${FONT_LBL} transform="rotate(-1.2 180 185)"${fit}>${esc(last)}</text>`;
    } else s += R_(128, 176, 104, 18, '#EFE6C8', 'transform="rotate(-1.2 180 185)" opacity=".85"');
    s += `<text x="180" y="270" font-size="${num.length > 1 ? 70 : 80}" fill="#FFFFFF" text-anchor="middle" ${FONT_NUM} stroke="${TEAM.navy}" stroke-width="5" paint-order="stroke">${esc(num || '?')}</text>`;
    // rim light on the right edge
    s += L_('M262 180Q266 200 264 214M210 150Q250 154 260 172', rim, 2.4, 'opacity=".55"');
    // neck and head from behind
    s += R_(164, 122, 32, 34, sh, 'rx="8"');
    s += E_(154, 112, 5, 8, skin) + E_(206, 112, 5, 8, sh);
    s += E_(180, 108, 26, 30, skin) + P_('M180 78C196 78 206 92 206 108C206 126 196 138 182 138C194 128 198 118 198 106C198 92 192 82 180 78Z', sh, 'opacity=".6"');
    const backHair = 'M154 110C153 86 166 76 180 76C194 76 207 86 206 110C206 120 202 128 196 132C190 130 186 129 180 129C174 129 170 130 164 132C158 128 154 120 154 110Z';
    if (style === 'buzz') s += P_(backHair, hairC, 'opacity=".9"');
    if (style === 'fade') s += P_(backHair, hairC, 'opacity=".55"') + P_('M158 96C157 80 166 70 172 68L188 68C194 70 203 80 202 96C196 90 188 88 180 88C172 88 164 90 158 96Z', hairC);
    if (style === 'curls') { s += P_(backHair, hairC); for (const [x, y] of [[158, 92], [164, 80], [174, 74], [186, 74], [196, 80], [202, 92], [204, 106], [156, 106], [170, 86], [190, 86], [180, 98], [166, 100], [194, 100]]) s += C_(x, y, 7.6, hairC); }
    if (style === 'locs') { s += P_(backHair, hairC) + C_(180, 72, 10, hairC) + R_(172, 76, 16, 4, TEAM.main, 'rx="2"'); }
    if (style === 'flow') s += P_(backHair, hairC) + L_('M164 90Q180 82 196 90', lt(hairC, 0.25), 1.6, 'opacity=".6"');
    s += L_('M204 92Q208 104 205 118', rim, 2, 'opacity=".5"');
    return s;
  }
  function towerBank(x, y, w, glowId) {
    const h = w * 0.46;
    let s = C_(x, y + h / 2, w * 1.5, `url(#${glowId})`, 'class="ua-glow"');
    s += R_(x - w / 2 - 3, y - 3, w + 6, h + 6, '#0E141C', 'rx="3"');
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) s += C_(x - w / 2 + (i + 0.5) * w / 5, y + (j + 0.5) * h / 3, Math.min(w / 5, h / 3) * 0.36, '#FFFCEB');
    return s;
  }
  function titleArt(st) {
    const key = 'title|' + (st ? [JSON.stringify(lookOf(st)), st.num, st.last].join('|') : 'none');
    return memo(key, () => {
      const rnd = rng(42);
      const defs = `<defs>${rgrad('uati-glow', [[0, '#FFFBEA', 0.9], [0.2, '#FFF3C4', 0.45], [1, '#FFF3C4', 0]])}</defs>`;
      const fig = coverFigure(st);
      let dust = '';
      for (let i = 0; i < 14; i++) dust += C_(140 + rnd() * 200, 60 + rnd() * 260, 0.8 + rnd() * 1.2, '#FFF3C4', anim('ua-tw', -rnd() * 3, 2 + rnd() * 3) + ' fill-opacity=".7"');
      // Tall version (desktop, right side of the hero)
      let tall = defs;
      tall += R_(300, 60, 6, 420, '#0E141C') + R_(214, 34, 4, 446, '#0E141C', 'opacity=".7"');
      tall += P_('M262 84L40 480L250 480L338 84Z', '#FFF8DC', 'opacity=".08"') + P_('M200 52L90 480L180 480L236 52Z', '#FFF8DC', 'opacity=".05"');
      tall += towerBank(216, 30, 52, 'uati-glow') + towerBank(303, 52, 86, 'uati-glow');
      tall += dust + G_(fig, 'transform="translate(-6 4)"');
      // Wide version (phones, a band across the top of the hero)
      let wide = defs;
      wide += R_(48, 40, 4, 160, '#0E141C') + R_(348, 40, 4, 160, '#0E141C');
      wide += P_('M30 46L150 200L230 200L74 46Z', '#FFF8DC', 'opacity=".07"') + P_('M370 46L250 200L170 200L326 46Z', '#FFF8DC', 'opacity=".07"');
      wide += towerBank(50, 18, 52, 'uati-glow') + towerBank(350, 18, 52, 'uati-glow');
      wide += G_(dust, 'transform="translate(20 -40)"') + G_(fig, 'transform="translate(101 -12) scale(.55)"');
      return svg('0 0 360 480', tall, 'class="ha-tall" preserveAspectRatio="xMidYMax meet"') + svg('0 0 400 200', wide, 'class="ha-wide" preserveAspectRatio="xMidYMid slice"');
    });
  }
  const playerKey = st => (st ? JSON.stringify([lookOf(st), playerOpts(st)]) : '');

  return { portrait: portraitFor, avatar, player, playerKey, lookOf, cleanLook, defaultLook, naturalTone, scene, banner, titleArt, BANNERS, SCENES, CAST, SKINS, HAIRS, TONES, LOOK_KEY };
})();

// ---------- Hooks: plug the art into the game ----------
UI.portrait = (name, raw) => ART.portrait(name, raw);

on('page', (pg, el, id) => {
  if (!el || !ART.BANNERS[id]) return;
  const b = ART.BANNERS[id];
  let spec = typeof b === 'function' ? b((S && S.at && S.at.args) || {}) : b;
  if (!spec) return;
  if (typeof spec === 'string') spec = { id: spec };
  const html = ART.banner(spec.id, spec.opts);
  if (html) el.insertAdjacentHTML('afterbegin', html);
});

let artLastAva = null;
on('card', el => {
  if (!S || !el) return;
  const head = el.querySelector('.pc-head');
  if (!head || head.querySelector('.pc-ava')) return;
  const key = ART.playerKey(S);
  const span = document.createElement('span');
  span.className = 'pc-ava' + (artLastAva && artLastAva !== key ? ' pop' : '');
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ART.player(S);
  head.classList.add('has-ava');
  head.prepend(span);
  artLastAva = key;
});

on('title', el => {
  const hero = el && el.querySelector('.hero');
  if (!hero || hero.querySelector('.hero-art')) return;
  const saved = (S && S.at) ? S : loadSave();
  const div = document.createElement('div');
  div.className = 'hero-art';
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = ART.titleArt(saved);
  hero.classList.add('has-art');
  hero.insertBefore(div, hero.querySelector('.hero-inner'));
});

on('setup', form => {
  if (!form || form.querySelector('.look-fs')) return;
  let look = store.get(ART.LOOK_KEY, null);
  look = look ? ART.cleanLook(look) : { skin: ri(0, ART.SKINS.length - 1), hair: ri(0, ART.HAIRS.length - 1) };
  if (look.tone == null) look.tone = ART.naturalTone(look.skin);
  // Until the player picks a hair color, it follows the skin tone's natural color.
  let toneAuto = look.tone === ART.naturalTone(look.skin);
  const fs = document.createElement('fieldset');
  fs.className = 'look-fs';
  const opt = (name, i, label, checked) => `<label class="opt look-opt" title="${esc(label)}"><input type="radio" name="${name}" value="${i}" aria-label="${esc(label)}"${checked ? ' checked' : ''} /><span class="opt-body" aria-hidden="true"></span></label>`;
  fs.innerHTML = `<legend class="lbl">Your look</legend>
    <div class="look-wrap">
      <div class="look-card"><span class="look-preview" aria-hidden="true"></span><span class="look-cap"><b class="look-num"></b><span>Camp invites wear white. Make the team, and this is you.</span><button class="btn btn-plain look-shuffle" type="button">Surprise me</button></span></div>
      <div class="look-rows">
        <div class="look-h" id="lookSkinH">Skin tone</div>
        <div class="look-row" role="radiogroup" aria-labelledby="lookSkinH">${ART.SKINS.map((s, i) => opt('lookSkin', i, 'Skin tone: ' + s[1], i === look.skin)).join('')}</div>
        <div class="look-h" id="lookHairH">Hair</div>
        <div class="look-row" role="radiogroup" aria-labelledby="lookHairH">${ART.HAIRS.map((h, i) => opt('lookHair', i, 'Hair: ' + h[1], i === look.hair)).join('')}</div>
        <div class="look-h" id="lookToneH">Hair color</div>
        <div class="look-row look-tones" role="radiogroup" aria-labelledby="lookToneH">${ART.TONES.map((t, i) => `<label class="opt look-opt look-tone" title="${esc(t[1])}"><input type="radio" name="lookTone" value="${i}" aria-label="${esc('Hair color: ' + t[1])}"${i === look.tone ? ' checked' : ''} /><span class="opt-body" aria-hidden="true"><i style="background:${t[0]}"></i></span></label>`).join('')}</div>
      </div>
    </div>`;
  const err = form.querySelector('#fErr');
  if (err) form.insertBefore(fs, err); else form.appendChild(fs);
  const val = n => { const r = form.querySelector(`input[name=${n}]:checked`); return r ? r.value : ''; };
  const paint = () => {
    const pos = val('pos') || 'QB', num = val('num');
    const thumb = l => ART.avatar(l, { pos: 'none', kit: 'team', mood: 'happy' }).replace('viewBox="0 0 64 64"', 'viewBox="10 2 44 44"');
    $$('input[name=lookSkin]', fs).forEach((r, i) => { r.nextElementSibling.innerHTML = thumb({ skin: i, hair: look.hair, tone: look.tone }); });
    $$('input[name=lookHair]', fs).forEach((r, i) => { r.nextElementSibling.innerHTML = thumb({ skin: look.skin, hair: i, tone: look.tone }); });
    $('.look-preview', fs).innerHTML = ART.avatar(look, { num, pos, kit: 'team', mood: 'grin' });
    $('.look-num', fs).textContent = `#${num} · ${pos} · ${ART.HAIRS[look.hair][1]}${look.tone != null && look.tone !== ART.naturalTone(look.skin) ? ', ' + ART.TONES[look.tone][1].toLowerCase() : ''}`;
  };
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'lookSkin') {
      look.skin = +t.value;
      if (toneAuto) { look.tone = ART.naturalTone(look.skin); const r = fs.querySelector(`input[name=lookTone][value="${look.tone}"]`); if (r) r.checked = true; }
    } else if (t.name === 'lookHair') look.hair = +t.value;
    else if (t.name === 'lookTone') { look.tone = +t.value; toneAuto = false; }
    else if (t.name !== 'pos' && t.name !== 'num') return;
    paint();
  });
  $('.look-shuffle', fs).addEventListener('click', () => {
    Sound.play('click');
    let n;
    do {
      n = { skin: ri(0, ART.SKINS.length - 1), hair: ri(0, ART.HAIRS.length - 1) };
      // mostly natural colors, sometimes a surprise
      n.tone = Math.random() < 0.7 ? ART.naturalTone(n.skin) : ri(0, ART.TONES.length - 2);
    } while (n.skin === look.skin && n.hair === look.hair && n.tone === look.tone);
    look = n;
    toneAuto = look.tone === ART.naturalTone(look.skin);
    for (const [nm, v] of [['lookSkin', look.skin], ['lookHair', look.hair], ['lookTone', look.tone]]) { const r = fs.querySelector(`input[name=${nm}][value="${v}"]`); if (r) r.checked = true; }
    paint();
  });
  paint();
});

on('newCareer', (st, form) => {
  let look = null;
  if (form) {
    const s = form.querySelector('input[name=lookSkin]:checked'), h = form.querySelector('input[name=lookHair]:checked'), t = form.querySelector('input[name=lookTone]:checked');
    if (s && h) { look = ART.cleanLook({ skin: +s.value, hair: +h.value, tone: t ? +t.value : undefined }); store.set(ART.LOOK_KEY, look); }
  }
  if (!look) { const saved = store.get(ART.LOOK_KEY, null); look = saved ? ART.cleanLook(saved) : ART.defaultLook((st.first || '') + ' ' + (st.last || '')); }
  ext('art', () => ({})).look = look;
});
