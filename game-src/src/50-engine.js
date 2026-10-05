
// =========================================================
//   ENGINE
// =========================================================
/* HOOK LIST — emit(name, ...) is called at these points:
     'newCareer' (S, form|null)   right after a career is created (form = setup <form> element)
     'title' (el)                 title screen rendered      'setup' (form)   setup form rendered
     'page' (pg, el, id)          any story/game page rendered into #sheet
     'card' (el)                  player card rendered       'hub' (el)       week-hub activity grid rendered
     'weekStart' (slate)          a new week began (after pay)
     'gameStart' (game)           kickoff                    'gameEnd' (game) final whistle (record updated)
     'play' ({r, td, note, moment, clutch, success, saved, pending})        a moment or clutch play resolved
     'miniEnd' (r, label)         a mini-game finished       'fx' (changes)   stats changed: [[key, delta], ...]
     'award' (id)                 trophy newly unlocked      'ending' (id)    ending chosen
   MOD KEYS — mod(key, value, ctx):
     'diff' (mini-game difficulty), 'timing.window', 'timing.speed', 'reaction.great', 'combo.time', 'combo.len',
     'read.time', 'picks' (weekly activity picks), 'pay', 'energyCost', 'teamRating', 'fx.<stat>' (each stat change)
   Module state lives under S.ext[name] — use ext(name, init). */
let S = null;          // the whole career (saved to the browser)
let screen = 'title';  // title | setup | trophies | play
let curPage = null;
let busy = false;
let mini = null;       // the running mini-game, if any
let menuKilledMini = false;
let trophyBack = 'title';

function newState(cfg) {
  const s = {
    v: 1, first: cfg.first, last: cfg.last, pos: cfg.pos, origin: cfg.origin, num: cfg.num,
    st: { skill: 40, conf: 50, energy: 80, fame: 5, chem: 30, money: 4000 },
    rel: { coach: 40, vane: -10, family: 70 },
    items: {}, flags: {}, camp: 0,
    slate: 0, role: 'camp', record: { w: 0, l: 0 },
    line: {}, grades: [], hist: [], used: [], queue: [], at: null, game: null, wk: null,
    runTrophies: [], recentMoments: [],
    year: 1, inject: [], ext: {},
  };
  const b = ORIGINS[cfg.origin].bonus;
  for (const k in b) if (k in s.st) s.st[k] += b[k];
  const idx = shuffle(MOMENTS[cfg.pos].map((_, i) => i));
  s.flags.scrim = [idx[0], idx[1]];
  return s;
}
function save() { if (S) store.set(SAVE_KEY, S); }
function ext(name, init) {
  if (!S.ext) S.ext = {};
  if (!S.ext[name]) S.ext[name] = init ? init() : {};
  return S.ext[name];
}
// Text with tokens filled in but no HTML (for names, labels, aria text).
function plain(text) { text = rosterText(text); const t = tokens(); return String(text).replace(/\{(\w+)\}/g, (m, k) => (t[k] != null ? String(t[k]) : m)); }
function loadSave() { const s = store.get(SAVE_KEY, null); return s && s.v === 1 && s.at && P[s.at.id] ? migrate(s) : null; }
// Older saves (or saves from before a module existed) get any missing fields filled in.
function migrate(s) {
  const d = newState({ first: s.first || 'Rookie', last: s.last || 'Player', pos: POS[s.pos] ? s.pos : 'QB', origin: ORIGINS[s.origin] ? s.origin : 'town', num: s.num || 7 });
  for (const k in d) if (s[k] == null) s[k] = d[k];
  for (const k of ['st', 'rel', 'record']) for (const kk in d[k]) if (typeof s[k][kk] !== 'number' || !isFinite(s[k][kk])) s[k][kk] = d[k][kk];
  if (!Array.isArray(s.runTrophies)) s.runTrophies = [];
  if (!Array.isArray(s.used)) s.used = [];
  return s;
}

// ---------- Text ----------
// Your position coach. Coach Okafor, unless she took the Ridgeline State job at the end of Year One;
// then Year Two brings in Coach Lou Pettis. Use coach() in code and {coach} / {coachLast} in story text.
const NEW_COACH = { name: 'Coach Pettis', last: 'Pettis', full: 'Lou Pettis', pron: 'he', pos: 'his', obj: 'him' };
function okaforLeft() { return !!(S && (S.year || 1) > 1 && S.ext && S.ext.arcs && S.ext.arcs.ok && S.ext.arcs.ok.leaves === true); }
function coach() { return okaforLeft() ? NEW_COACH : { name: 'Coach Okafor', last: 'Okafor', full: 'Nina Okafor', pron: 'she', pos: 'her', obj: 'her' }; }
// What happens to Marcus Vane after Year One, from your relationship. Every module should use this.
//   'retired' (60+) retires and passes you the nameplate · 'signed' (20–59) signs elsewhere, leaves on good terms
//   'quiet' (0–19) moves on quietly · 'released' (below 0) released, no goodbye
function vaneFate(v) { v = v == null ? (S && S.rel ? S.rel.vane : 0) : v; return v >= 60 ? 'retired' : v >= 20 ? 'signed' : v >= 0 ? 'quiet' : 'released'; }
function tokens() {
  if (!S) return {};
  const pc = coach();
  const o = ORIGINS[S.origin];
  return {
    first: S.first, last: S.last, LAST: S.last.toUpperCase(), fam: o.fam, fp: o.fp, fpos: o.fpos, fobj: o.fobj, where: o.where,
    home: o.home || { town: "Cutter's Ford", city: 'the east side of Harbor City', base: 'Fort Redmond, Texas' }[S.origin] || o.where,
    pos: POS[S.pos].name.toLowerCase(), POS: S.pos, num: S.num, vnum: VANE_NUM[S.pos], poscoach: POSCOACH[S.pos],
    verb: POS[S.pos].verb, inj: INJ[S.pos], big: S.pos === 'LB' ? 'takeaway' : 'touchdown', king: S.pos === 'LB' ? 'quarterback' : 'linebacker',
    coach: pc.name, coachLast: pc.last, cp: pc.pron, Cp: pc.pron[0].toUpperCase() + pc.pron.slice(1), cpos: pc.pos, cobj: pc.obj,
  };
}
// Year Two: if Okafor or Tiny left after Year One, game-day text written for Year One names their replacements.
const NEW_CENTER = 'Rudy';
function tinyLeft() { return !!(S && (S.year || 1) > 1 && S.ext && S.ext.arcs && S.ext.arcs.tiny && ['market', 'sly'].includes(S.ext.arcs.tiny.fate)); }
let rosterFilter = false; // true while a game-day page renders
function rosterText(text) {
  if (!rosterFilter || !S) return text;
  let t = String(text);
  if (okaforLeft()) t = t.replace(/Coach Okafor/g, NEW_COACH.name).replace(/\bOkafor\b/g, NEW_COACH.last);
  if (tinyLeft()) t = t.replace(/\bTiny\b/g, NEW_CENTER);
  return t;
}
function fmt(text) {
  text = rosterText(text);
  const t = tokens();
  let h = esc(text).replace(/\{(\w+)\}/g, (m, k) => (t[k] != null ? esc(t[k]) : m));
  return h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}
function paraHTML(p) {
  if (p == null || p === '') return '';
  if (typeof p === 'string') return `<p>${fmt(p)}</p>`;
  if (p.s) {
    const art = UI.portrait ? UI.portrait(plain(p.s), p.s) : '';
    if (art) return `<div class="say has-art"><span class="say-art" aria-hidden="true">${art}</span><p class="say-text"><span class="who">${fmt(p.s)}</span>“${fmt(p.t)}”</p></div>`;
    return `<p class="say"><span class="who">${fmt(p.s)}</span>“${fmt(p.t)}”</p>`;
  }
  if (p.note) return `<p class="note">${fmt(p.note)}</p>`;
  if (p.warn) return `<p class="warn">${fmt(p.warn)}</p>`;
  return '';
}
function textFor(m, r) {
  if (m[r]) return m[r];
  if (m.read) { const o = m.read.opts.find(x => x[1] === r); if (o) return o[2]; }
  return '';
}
const fmtMoment = textFor;

// ---------- Stats, toasts, trophies ----------
let fxCapture = null; // while a choice runs, stat changes are collected here and shown inline instead of as a toast
const LABELS = { skill: 'Skill', conf: 'Confidence', energy: 'Energy', fame: 'Fame', chem: 'Chemistry', coach: 'Coaches', vane: 'Vane', family: 'Family' };
// raw: apply gains exactly as written (used for things the game promises a fixed amount for, like Pro Shop items).
function fx(d, quiet, raw) {
  if (!d || !S) return;
  const parts = [], changes = [];
  for (const k in d) {
    const v = Math.round(mod('fx.' + k, d[k], { quiet: !!quiet }));
    if (!v) continue;
    if (k === 'money') {
      const before = S.st.money;
      S.st.money = Math.max(0, S.st.money + v);
      const real = S.st.money - before;
      if (real) changes.push([k, real]);
      if (!quiet && real) { parts.push([(real > 0 ? '+' : '−') + money(Math.abs(real)), real > 0 ? 'cash' : 'down']); if (real > 0) Sound.play('cash'); }
      continue;
    }
    let before, after;
    if (k in S.st) {
      before = S.st[k];
      // Gains shrink as a stat nears 100, so maxing one out means something. Energy recovers at full rate.
      const gain = v > 0 && k !== 'energy' && !raw ? Math.max(before < 90 ? 1 : 0, Math.round(v * clamp((105 - before) / 80, 0.1, 1.2))) : v;
      S.st[k] = clamp(before + gain, 0, 100); after = S.st[k];
    }
    else if (k === 'vane') { before = S.rel.vane; S.rel.vane = clamp(before + v, -100, 100); after = S.rel.vane; }
    else if (k in S.rel) {
      before = S.rel[k];
      const gain = v > 0 && !raw ? Math.max(before < 90 ? 1 : 0, Math.round(v * clamp((105 - before) / 80, 0.1, 1.2))) : v;
      S.rel[k] = clamp(before + gain, 0, 100); after = S.rel[k];
    }
    else continue;
    const real = after - before;
    if (real) changes.push([k, real]);
    if (!quiet && real) parts.push([`${real > 0 ? '+' : '−'}${Math.abs(real)} ${LABELS[k]}`, real > 0 ? 'up' : 'down']);
  }
  if (parts.length) { if (fxCapture) fxCapture.push(...parts); else toast(parts); }
  if (changes.length) emit('fx', changes);
  checkTrophies();
  renderCard();
}
// toast('text', cls) for one message, or toast([[text, cls], ...]) for a row of stat changes.
function toast(text, cls) {
  const box = $('#toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  if (Array.isArray(text)) t.innerHTML = text.map(([s, c]) => `<span class="tp ${c}">${esc(s)}</span>`).join('');
  else t.textContent = text;
  box.appendChild(t);
  while (box.children.length > (window.innerWidth <= 880 ? 1 : 3)) box.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, cls === 'trophy' ? 3800 : 2300);
}
// Kept in memory as well, so trophies still work (for this visit) when the browser blocks storage.
let TROPHY_CACHE = null;
function trophyData() {
  if (!TROPHY_CACHE) TROPHY_CACHE = store.get(TROPHY_KEY, null) || {};
  const d = TROPHY_CACHE;
  d.got = d.got || {}; d.pos = d.pos || []; d.endings = d.endings || {}; d.events = d.events || {};
  return d;
}
// Remember endings and events across careers (for the trophy case and to favor unseen events).
function remember(kind, id) { const d = trophyData(); if (!d[kind][id]) { d[kind][id] = Date.now(); store.set(TROPHY_KEY, d); } }
function award(id) {
  if (S && !S.runTrophies.includes(id)) S.runTrophies.push(id);
  const d = trophyData();
  if (d.got[id]) return;
  d.got[id] = Date.now();
  store.set(TROPHY_KEY, d);
  const t = TROPHIES.find(x => x[0] === id);
  if (t) trophyPop(t);
  emit('award', id);
}
// Trophy unlocks get their own card, shown one at a time.
const trophyQueue = [];
function trophyPop(t) { trophyQueue.push(t); if (trophyQueue.length === 1) showNextTrophy(); }
function showNextTrophy() {
  const t = trophyQueue[0];
  if (!t) return;
  const el = document.createElement('div');
  el.className = 'trophy-pop';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="tp-star" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.5l2.8 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.2l-6.1 3.6 1.6-6.8-5.2-4.6 6.9-.6z"/></svg></span><span class="tp-text"><span class="tp-eyebrow">Trophy unlocked</span><b>${esc(t[1])}</b><span>${esc(t[2])}</span></span>`;
  document.body.appendChild(el);
  Sound.play('trophy');
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); trophyQueue.shift(); showNextTrophy(); }, 350); }, reduceMotion ? 3000 : 3400);
}
function checkTrophies() {
  if (!S) return;
  if (S.st.fame >= 80) award('fame');
  if (S.st.chem >= 85) award('chem');
  if (S.rel.vane >= 60) award('torch');
  if (S.rel.family >= 95) award('family');
}

// ---------- Navigation ----------
const ACTIONS = {
  resume: () => { const n = S.injectNext; S.injectNext = null; goNext(n); },
  queue: () => nextInQueue(),
  advance: () => advanceGame(),
  finish: () => finishGame(),
  weekEnd: () => weekEnd(),
  beginWeek: () => beginWeek(),
};
function go(id, args, keepScroll) {
  if (id === '_result' && args && !args.title && curPage) args.title = curPage.title;
  S.at = { id, args: args || {} };
  save();
  screen = 'play';
  renderPlay(!keepScroll);
}
// interject(id, args): show this page before wherever the player goes next (level-ups, surprise beats...).
// The injected page should continue with next: 'resume'.
function interject(id, args) { if (!S.inject) S.inject = []; S.inject.push({ id, args: args || {} }); }
function goNext(n) {
  if (n == null) return;
  if (n !== 'resume' && S.inject && S.inject.length) {
    const p = S.inject.shift();
    S.injectNext = n;
    return go(p.id, p.args);
  }
  if (typeof n === 'string') return ACTIONS[n] ? ACTIONS[n]() : go(n);
  if (n.id) return go(n.id, n.args);
}
// A choice's outcome. Normally shown inline under the page you chose on (see showInlineResult);
// this standalone version is what a reload shows.
P._result = a => ({ kicker: a.kicker, title: a.title, html: a.picked ? pickedHTML(a.picked) : '', body: a.body, after: chipsHTML(a.chips), next: a.next == null ? 'queue' : a.next });
function pickedHTML(label) { return `<p class="picked"><span class="who">You chose</span>${fmt(label)}</p>`; }
function chipsHTML(chips) { return chips && chips.length ? `<div class="fx-chips">${chips.map(([t, c]) => `<span class="fxc ${c === 'cash' ? 'up' : c}">${esc(t)}</span>`).join('')}</div>` : ''; }
function showInlineResult(a) {
  const box = $('#choices');
  if (!box) return renderPlay(true);
  const el = document.createElement('div');
  el.className = 'inline-result story reveal';
  el.innerHTML = pickedHTML(a.picked) + a.body.map(paraHTML).join('') + chipsHTML(a.chips);
  box.before(el);
  renderChoices({ next: a.next });
  busy = false;
  updateTopbar();
  requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); });
  emit('result', a, el);
}

function choose(c) {
  if (busy) return;
  busy = true;
  Sound.play('click');
  const from = S.at && S.at.id, before = S.at;
  fxCapture = [];
  let out, chips;
  try { out = c.do ? c.do() : null; }
  catch (e) { console.error(e); out = null; }
  finally { chips = fxCapture; fxCapture = null; }
  const next = typeof c.then === 'function' ? c.then() : c.then;
  if (Array.isArray(out) && out.length) {
    const args = { body: out, next: next == null ? 'queue' : next, kicker: curPage && curPage.kicker, title: c.rt || (curPage && curPage.title), picked: plain(c.label), chips, from };
    // Show the outcome right here unless do() already moved to another page.
    if (S.at === before && $('#choices')) { S.at = { id: '_result', args }; save(); return showInlineResult(args); }
    return go('_result', args);
  }
  if (chips && chips.length) toast(chips);
  try { if (next != null) return goNext(next); }
  catch (e) { console.error(e); }
  busy = false;
}
// Ignore the second click of a double-click (and taps that land just as a page appears).
let pageShownAt = 0;
function tooSoon(e) { return !!e && (e.detail > 1 || (e.detail === 1 && performance.now() - pageShownAt < 300)); }

function renderPlay(scroll) {
  const main = $('#screen');
  if (!$('#sheet')) {
    main.innerHTML = `<div class="wrap"><div class="play"><section class="sheet" id="sheet"></section><aside class="card" id="card" aria-label="Player card"></aside></div></div>`;
  }
  renderCard();
  let page;
  try { page = P[S.at.id](S.at.args || {}); }
  catch (e) {
    console.error(e);
    page = { kicker: 'Timeout', title: 'Something Went Sideways', body: ['This page failed to load. Your career is still saved.'],
      choices: [{ label: 'Back to the title screen', do() { showTitle(); return null; } }] };
  }
  showPage(page);
  updateTopbar();
  if (scroll) {
    const behavior = reduceMotion ? 'auto' : 'smooth';
    const top = $('#sheet').getBoundingClientRect().top + window.scrollY - 76;
    const mg = page && page.mini && window.innerWidth <= 880 && $('#mini .mg');
    if (mg) {
      // On phones, bring the mini-game's controls on screen (the story text stays just above it).
      const r = mg.getBoundingClientRect();
      const want = Math.min(r.bottom + window.scrollY - window.innerHeight + 12, r.top + window.scrollY - 70);
      window.scrollTo({ top: Math.max(0, want), behavior });
    } else if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior });
  }
}
function showPage(pg) {
  stopMini();
  const pid = (S && S.at && S.at.id) || '';
  rosterFilter = /^g_|^game_pre$/.test(pid) || (pid === '_result' && /^g_/.test((S.at.args && S.at.args.from) || ''));
  curPage = pg;
  busy = false;
  pageShownAt = performance.now();
  const el = $('#sheet');
  let h = '';
  if (pg.kicker) h += `<div class="kicker">${fmt(pg.kicker)}</div>`;
  if (pg.title) h += `<h2 class="title">${fmt(pg.title)}</h2>`;
  if (pg.board) h += boardHTML(pg.final);
  if (pg.html) h += pg.html;
  h += `<div class="story reveal">${(pg.body || []).map(paraHTML).join('')}</div>`;
  if (pg.after) h += pg.after;
  h += `<div id="mini"></div><div class="choices" id="choices"></div>`;
  el.innerHTML = h;
  if (pg.mini) startMini(pg.mini, $('#mini'));
  else renderChoices(pg);
  if (pg.custom) pg.custom(el);
  emit('page', pg, el, S.at && S.at.id);
}
function renderChoices(pg) {
  const box = $('#choices');
  if (!box) return;
  let list = (pg.choices || []).filter(c => !c.if || c.if());
  if (!list.length && pg.next != null) list = [{ label: pg.nextLabel || 'Continue', then: pg.next, primary: true }];
  box.innerHTML = '';
  list.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice' + (c.primary ? ' primary' : '');
    b.dataset.k = String(i + 1);
    b.innerHTML = `<span class="k">${i + 1}</span><span class="t">${fmt(c.label)}${c.sub ? `<small>${fmt(c.sub)}</small>` : ''}</span>`;
    b.addEventListener('click', e => { if (!tooSoon(e)) choose(c); });
    box.appendChild(b);
  });
}

// ---------- Player card ----------
const lastBars = {};
function renderCard() {
  const el = $('#card');
  if (!el || !S) return;
  const open = el.classList.contains('open');
  const p = POS[S.pos], st = S.st, rel = S.rel;
  const roleName = { camp: 'Camp invite', practice: 'Practice squad', backup: 'Backup', rotation: 'Split snaps', starter: 'Starter' }[S.role] || '';
  // Bars start at their previous width and slide to the new one.
  const meter = (label, v, color, key) => {
    const from = key in lastBars ? lastBars[key] : v;
    lastBars[key] = v;
    const cls = from === v ? '' : v > from ? ' rose' : ' fell';
    return `<div class="meter-row${cls}" data-stat="${key}"><span class="ml">${label}</span><span class="bar"><i style="width:${from}%;background:${color}" data-to="${v}"></i></span><span class="mv">${v}</span></div>`;
  };
  const vane = rel.vane, vw = Math.abs(vane) / 2, vl = vane >= 0 ? 50 : 50 - vw;
  const vaneRow = `<div class="meter-row" title="Marcus Vane: -100 to +100"><span class="ml">Vane</span><span class="bar center"><i style="left:${vl}%;width:${vw}%;background:${vane >= 0 ? 'var(--m-energy)' : 'var(--m-neg)'}"></i></span><span class="mv">${vane > 0 ? '+' : ''}${vane}</span></div>`;
  const items = Object.keys(S.items).filter(k => S.items[k] && ITEMS[k]).map(k => `<span class="pc-item" title="${esc(ITEMS[k][1])}">${esc(ITEMS[k][0])}</span>`);
  if (S.flags.agent) items.push(`<span class="pc-item" title="Your agent">Agent: ${S.flags.agent === 'sly' ? 'Sly' : 'Margaret'}</span>`);
  const stats = p.stats.map(([k, l]) => `<div><b>${S.line[k] || 0}</b><span>${l}</span></div>`).join('');
  el.innerHTML = `
    <div class="pc-head"><div class="pc-num">${esc(S.num)}</div><div style="min-width:0"><div class="pc-name">${esc(S.first)} ${esc(S.last)}</div><div class="pc-role">${S.pos} · ${roleName}</div></div></div>
    <button class="pc-toggle" type="button" aria-expanded="${open}"><span class="pc-mini"><span>Skill <b>${st.skill}</b></span><span>Conf <b>${st.conf}</b></span><span>Energy <b>${st.energy}</b></span><span><b>${money(st.money)}</b></span></span><span>${open ? 'Hide' : 'Show card'}</span></button>
    <div class="pc-body">
      <div class="pc-sec"><div class="pc-h">Attributes</div>
        ${meter('Skill', st.skill, 'var(--m-skill)', 'skill')}${meter('Confidence', st.conf, 'var(--m-conf)', 'conf')}${meter('Energy', st.energy, st.energy < 30 ? 'var(--m-neg)' : 'var(--m-energy)', 'energy')}${meter('Fame', st.fame, 'var(--m-fame)', 'fame')}${meter('Chemistry', st.chem, 'var(--m-chem)', 'chem')}
      </div>
      <div class="pc-sec"><div class="pc-h">Relationships</div>
        ${meter('Coaches', rel.coach, 'var(--m-conf)', 'coach')}${vaneRow}${meter(esc(ORIGINS[S.origin].fam), rel.family, 'var(--m-skill)', 'family')}
      </div>
      <div class="pc-sec"><div class="pc-h">Bonuses</div><div class="pc-bonus">
        <span class="${st.chem >= edgeChem() ? 'on' : ''}" title="Chemistry ${edgeChem()}+">Teammates bail out one bad play per game <i>Chem ${edgeChem()}</i></span>
        ${edgeCoach() <= 100 ? `<span class="${rel.coach >= edgeCoach() ? 'on' : ''}" title="Coaches ${edgeCoach()}+">Coach's call: film notes every week <i>Coaches ${edgeCoach()}</i></span>` : ''}
        <span class="${rel.family >= 85 ? 'on' : ''}" title="Family 85+">${esc(ORIGINS[S.origin].fam)}'s calls: +5 Energy a week <i>${esc(ORIGINS[S.origin].fam)} 85</i></span>
      </div></div>
      <div class="pc-money"><span>Bank</span><b>${money(st.money)}</b></div>
      ${items.length ? `<div class="pc-sec"><div class="pc-h">Items</div><div class="pc-items">${items.join('')}</div></div>` : ''}
      <div class="pc-sec"><div class="pc-h">Season stats · ${S.record.w}-${S.record.l}</div><div class="pc-stats">${stats}</div></div>
    </div>`;
  el.querySelector('.pc-toggle').addEventListener('click', () => { el.classList.toggle('open'); renderCard(); });
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.bar > i[data-to]', el).forEach(i => { i.style.width = i.dataset.to + '%'; })));
  emit('card', el);
}
function updateTopbar() {
  const st = $('#status'), mb = $('#menuBtn');
  if (screen === 'play' && S) {
    let s;
    const id = S.at && (S.at.id === '_result' && S.at.args && S.at.args.from ? S.at.args.from : S.at.id);
    if (id === 'ending') s = 'Season over';
    else if (id === 'draft' || id === 'call') s = 'Draft night';
    else if (S.role === 'camp') s = 'Training camp';
    else if (S.slate >= 10 && S.flags.inPO === false) s = 'Season over';
    else if (S.slate < 10) s = `${S.year > 1 ? `Year ${S.year} · ` : ''}Week ${S.slate + 1} of 10 · ${S.record.w}-${S.record.l}`;
    else s = `Playoffs · ${playoffsFor(S.year || 1)[Math.min(S.slate, 12) - 10].round}`;
    st.textContent = s;
    mb.hidden = false;
    document.body.classList.add('in-play');
  } else { st.textContent = ''; mb.hidden = true; document.body.classList.remove('in-play'); }
}

// ---------- Camp → season ----------
function campScore() { return S.camp + (S.st.skill - 40) / 4 + (S.rel.coach - 40) / 8; }
function campDone() {
  S.role = S.flags.made ? 'backup' : 'practice';
  if (!S.flags.made) S.flags.wasSquad = true;
  award('camp');
  const d = trophyData();
  if (!d.pos.includes(S.pos)) { d.pos.push(S.pos); store.set(TROPHY_KEY, d); }
  if (d.pos.length >= 4) award('all4');
  S.slate = 0;
  beginWeek();
}
function keepJob() {
  const gs = S.grades.filter(g => g.n >= 2 && g.n <= 5).map(g => g.v);
  const avg = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 1.5;
  return avg >= 2.0 || (avg >= 1.6 && S.rel.coach >= 60);
}

// ---------- The week ----------
const FIXED = { 0: 'w1_family', 1: () => (S.role === 'practice' ? 'w2_callup' : null), 3: 'w4_rehab', 4: 'w5_trash', 5: 'w6_agent', 6: 'w7_return', 7: 'w8_thanks', 8: 'w9_leo', 9: 'w10_stakes', 10: 'po1', 11: 'po2', 12: 'po3_media' };
function beginWeek() {
  const n = S.slate;
  S.wk = { picks: Math.max(1, Math.round(mod('picks', 2))), done: [], log: [], film: false };
  S.flags.focus = false;
  S.game = null;
  const pay = Math.round(mod('pay', S.role === 'practice' ? 13000 : n >= 10 ? 60000 : 48000));
  // Things drift if you don't tend to them: confidence settles, chemistry and fame fade, home feels farther away.
  fx({ energy: 12 + (S.rel.family >= 85 ? 5 : 0), conf: Math.round((55 - S.st.conf) * 0.2) + (S.items.blitz ? 2 : 0), chem: -3, fame: S.st.fame > 20 ? -2 : 0, family: -2 }, true);
  fx({ money: pay }, true);
  toast(`${n >= 10 ? 'Playoff' : 'Game'} check +${money(pay)}`, 'cash');
  const q = ['week_hub'];
  const year = S.year || 1;
  let f = (year > 1 ? (FIXED_Y[year] || {}) : FIXED)[n];
  if (typeof f === 'function') f = f();
  if (f) q.push(f);
  for (const b of BEATS) {
    if ((b.year || 1) !== year) continue;
    const at = Array.isArray(b.slate) ? b.slate.includes(n) : b.slate === n;
    if (at && (!b.if || b.if())) q.push(b.args ? { id: b.id, args: b.args } : b.id);
  }
  if (RANDOM_SLATES.includes(n)) { const e = drawEvent(); if (e) q.push({ id: 'event', args: { e } }); }
  if (S.role === 'practice') q.push({ id: 'scout_team', args: { m: ri(0, MOMENTS[S.pos].length - 1) } });
  q.push('game_pre');
  S.queue = q;
  emit('weekStart', n);
  nextInQueue();
}
function nextInQueue() {
  let n = S.queue.shift();
  // The scout-team page is only for practice-squad weeks (a midweek call-up skips it).
  while (n && (n === 'scout_team' || n.id === 'scout_team') && S.role !== 'practice') n = S.queue.shift();
  if (!n) return go('game_pre');
  if (typeof n === 'string') go(n); else go(n.id, n.args);
}
function drawEvent() {
  const pool = Object.keys(EVENTS).filter(k => !S.used.includes(k) && (!EVENTS[k].if || EVENTS[k].if()));
  if (!pool.length) return null;
  const seen = trophyData().events, fresh = pool.filter(k => !seen[k]);
  const k = pick(fresh.length && chance(0.75) ? fresh : pool);
  remember('events', k);
  S.used.push(k);
  return k;
}
function weekKicker() { const n = S.slate; return n < 10 ? `${S.year > 1 ? `Year ${S.year} · ` : ''}Week ${n + 1} of 10` : `Playoffs · ${oppOf(n).round}`; }
function roleLine() {
  if (UI.roleLine) { const t = UI.roleLine(S.role); if (t) return t; }
  return {
    practice: `You're on the practice squad. You'll practice all week, but you won't dress on Sunday.`,
    backup: `You're the backup {pos} behind Marcus Vane. Stay ready. Coach may call your number for a few plays.`,
    rotation: `You and Vane are splitting snaps. Make the most of yours.`,
    starter: `You're the starting {pos}. The ${S.pos === 'LB' ? 'defense' : 'offense'} runs through you.`,
  }[S.role] || '';
}
function matchupHTML(opp) {
  const threat = clamp(Math.round((opp.r - 40) / 8), 1, 5);
  const ti = Array.from({ length: 5 }, (_, i) => `<i class="${i < threat ? 'on' : ''}"></i>`).join('');
  const us = teamStyle(HOME_TEAM), them = teamStyle(opp.team);
  return `<div class="matchup" style="--c-us:${us.c1};--c-them:${them.c1}">
    <div class="mu-side">${helmetSVG(HOME_TEAM)}<div class="mu-txt"><div class="mu-team">Hammerheads</div><div class="mu-sub">${S.slate < 10 ? `Record ${S.record.w}-${S.record.l}` : 'Harbor City'}</div></div></div>
    <div class="mu-vs">vs</div>
    <div class="mu-side right"><div class="mu-txt"><div class="mu-team">${esc(opp.team)}</div><div class="mu-sub">Threat <span class="threat" role="img" aria-label="Threat ${threat} of 5">${ti}</span></div></div>${helmetSVG(opp.team, true)}</div></div>`;
}

P.week_intro = () => {
  const n = S.slate, opp = oppOf(n);
  const body = [opp.blurb];
  const last = S.hist[S.hist.length - 1];
  if (last) body.push(`Last week: ${last.won ? 'beat' : 'lost to'} the ${last.opp}, ${Math.max(last.us, last.them)}-${Math.min(last.us, last.them)}.`);
  body.push(roleLine());
  if (S.st.energy < 30) body.push({ warn: `You're running on fumes (Energy ${S.st.energy}). Your timing will be off on Sunday. A recovery day would help.` });
  return { kicker: weekKicker(), title: opp.team, html: matchupHTML(opp), body, next: 'queue', nextLabel: 'Plan your week' };
};

P.week_hub = () => {
  const n = S.slate, opp = oppOf(n);
  const body = [opp.blurb];
  const last = S.hist[S.hist.length - 1];
  if (last) body.push(`Last week: ${last.won ? 'beat' : 'lost to'} the ${last.opp}, ${Math.max(last.us, last.them)}-${Math.min(last.us, last.them)}.`);
  body.push(roleLine());
  const trait = oppTrait(n);
  if (trait.note) body.push({ note: `${trait.name ? trait.name + ': ' : ''}${trait.note}` });
  if (S.st.energy < 30) body.push({ warn: `You're running on fumes (Energy ${S.st.energy}). Your timing will be off on Sunday. A recovery day would help.` });
  const picks = (S.wk && S.wk.picks) || 2;
  body.push(`**Plan your week.** You have time for ${picks === 1 ? 'one thing' : picks === 2 ? '**two** things' : `**${picks}** things`} before game day. Energy carries into Sunday.`);
  return { kicker: weekKicker(), title: (opp.rival ? 'Rivalry Week: ' : '') + opp.team, html: matchupHTML(opp), body, custom: renderHub };
};
function renderHub(el) {
  const wk = S.wk, left = wk.picks - wk.done.length;
  const wrap = document.createElement('div');
  let h = `<div class="picks-left">${left > 0 ? `${left} pick${left > 1 ? 's' : ''} left` : 'Week planned'}</div><div class="acts">`;
  ACTS.forEach((a, i) => {
    const ok = !a.req || a.req();
    const picked = wk.done.includes(a.id);
    const dis = picked || !ok || left <= 0;
    const key = dis || i >= 9 ? 0 : i + 1; // stable number keys: an activity keeps its key all week
    h += `<button type="button" class="act${picked ? ' picked' : ''}" data-act="${a.id}"${key ? ` data-k="${key}"` : ''}${dis ? ' disabled' : ''}>
      <span class="act-top"><span class="act-name">${fmt(a.name)}</span>${key ? `<kbd>${key}</kbd>` : picked ? '<span class="fxc up">Done</span>' : ''}</span>
      <span class="act-desc">${fmt(a.desc())}</span>
      <span class="act-fx">${ok ? a.chips.map(c => `<span class="fxc ${c[1]}">${c[0]}</span>`).join('') : `<span class="fxc lock">${esc(a.lock)}</span>`}</span>
    </button>`;
  });
  h += '</div>';
  if (wk.log.length) h += `<div class="hub-log">${wk.log.map(l => `<p><b>${fmt(l[0])}.</b> ${fmt(l[1])}</p>`).join('')}</div>`;
  wrap.innerHTML = h;
  el.querySelector('.story').after(wrap);
  $$('.act', wrap).forEach(b => b.addEventListener('click', e => {
    if (busy || tooSoon(e)) return;
    const a = ACTS.find(x => x.id === b.dataset.act);
    if (!a || S.wk.done.length >= S.wk.picks || S.wk.done.includes(a.id) || (a.req && !a.req())) return;
    busy = true;
    Sound.play('click');
    S.wk.done.push(a.id);
    S.wk.log.push([a.name, a.run()]);
    hubJustPicked = true;
    go('week_hub', {}, true);
  }));
  if (left <= 0) renderChoices({ next: 'queue', nextLabel: 'On to the week' });
  emit('hub', wrap);
  // After a pick, show what happened (and the next button once the week is planned).
  if (hubJustPicked) {
    hubJustPicked = false;
    requestAnimationFrame(() => {
      const target = left <= 0 ? $('#choices') : wrap.querySelector('.hub-log p:last-child');
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 60) target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
}
let hubJustPicked = false;

// Practice-squad weeks: you play the opponent's star on the scout team in Thursday practice.
P.scout_team = a => {
  const m = MOMENTS[S.pos][a.m] || MOMENTS[S.pos][0], opp = oppOf(S.slate);
  return {
    kicker: `${weekKicker()} · Thursday practice`,
    title: 'Scout Team',
    body: [
      `Practice-squad players run the other team's plays so the starters can prepare. This week you're playing the ${shortName(opp.team)}' best player, and the starting defense knows it.`,
      { s: 'Coach Okafor', t: `Make them work, {last}. Bramble's watching the scout team today.` },
      m.setup,
    ],
    mini: Object.assign(miniCfg(m, 1.6), {
      onDone(r, x) {
        fx({ great: { coach: 6, skill: 2, conf: 3 }, good: { coach: 3, skill: 1 }, bad: { coach: -2, conf: -2 } }[r]);
        const react = { great: `Bramble stops practice to ask who that was. Okafor tells him. He nods slowly.`, good: `Solid work. The starting defense has to earn it.`, bad: `The starters eat you alive. Somebody laughs. You remember who.` }[r];
        go('_result', { body: [x && x.text ? x.text : textFor(m, r), react], next: 'queue', kicker: `${weekKicker()} · Thursday practice`, title: 'Scout Team' });
      },
    }),
  };
};

P.event = a => {
  const e = EVENTS[a.e];
  return { kicker: weekKicker(), title: e.title, body: e.body, choices: e.choices };
};

// ---------- Game day ----------
const TEAM_TD = [
  'A twelve-play drive ends with a Hammerheads touchdown.',
  'Tiny flattens a defensive end, and the Hammerheads punch it in from the 2.',
  'Trick play! The Hammerheads score on a flea-flicker.',
  'A 71-yard punt return sets up a quick Hammerheads touchdown.',
  'Tight end Walt Okonjo rumbles 28 yards with two defenders on his back. Touchdown, Hammerheads.',
  'Receiver Shay Mercado gets behind the defense and the Hammerheads go 80 yards in four plays.',
  'A blocked punt! The Hammerheads fall on it in the end zone.',
  'Safety Ronnie Batiste jumps a route and takes it 40 yards the other way. Touchdown!',
  'Fourth and goal from the 1. Bramble goes for it. Tiny leads the way. Touchdown.',
  'The Hammerheads drain eight minutes off the clock and finish it with a short touchdown run.',
];
const TEAM_FG = [
  'Kicker Augie Szczepanski drills a 43-yard field goal.',
  'A drive stalls at the 20. Field goal, Hammerheads.',
  'Augie Szczepanski hits from 51 and points at the sky like he meant to.',
  'Third down falls incomplete in the red zone. The Hammerheads take the three points.',
  'A sack ends the drive, but Augie Szczepanski bails them out from 47.',
];
const OPP_TD = [
  'The {opp} hit a deep pass for a touchdown.',
  'The {opp} grind out a long drive and score.',
  'A fumble gives the {opp} a short field, and they cash in.',
  'The {opp} run a reverse that fools everybody, including the cameraman. Touchdown.',
  'A pass interference flag sets up the {opp} at the 1. They punch it in.',
  'The {opp} return the kickoff 98 yards. The stadium goes very quiet.',
  'A screen pass goes 60 yards because three Hammerheads miss the same tackle. Touchdown, {opp}.',
];
const OPP_FG = [
  'The {opp} kick a field goal.',
  'The Hammerheads defense holds in the red zone. The {opp} settle for three.',
  'The {opp} kicker banks one in off the upright. It counts.',
  'A holding call kills the {opp} drive. They kick a field goal.',
];
// Picks from a list without repeating until the whole list has been used (per career).
function pickFresh(key, arr) {
  const used = ext('fresh', () => ({}));
  let u = used[key] || [];
  if (u.length >= arr.length) u = [];
  const i = pick(arr.map((_, k) => k).filter(k => !u.includes(k)));
  used[key] = u.concat(i);
  return arr[i];
}
const WIN_LINES = [
  'The locker room is loud enough to rattle the lockers. Tiny is standing on a bench, shirtless, for reasons nobody can explain.',
  'Bramble hands out game balls. He says nine words in total. It\'s the longest speech he\'s given all year.',
  'Somebody turns the music up so loud Rocco has to unplug it.',
  'Augie Szczepanski leads the team in a fight song nobody knows the words to. Everybody sings anyway.',
  'Walt Okonjo gives the game ball to the long snapper, who cries a little and denies it.',
  'The team bus smells like wings and victory. Shay Mercado DJs the whole ride home.',
  'Bramble shakes every hand in the locker room on his way out. He doesn\'t say anything. He doesn\'t have to.',
  'Ronnie Batiste does a dramatic reading of the box score. It gets a standing ovation.',
  'Rocco quietly hands you a fresh towel and says, "Good one." From Rocco, that\'s a parade.',
];
const LOSS_LINES = [
  'The locker room is silent except for the sound of tape being cut off ankles.',
  'Bramble says, "Film at eight," and walks out. That\'s the whole speech.',
  'Nobody talks on the bus. Tiny shares his headphones with you without asking.',
  'Walt Okonjo sits in front of his locker in full pads for twenty minutes. Nobody bothers him.',
  'Augie Szczepanski kicks a trash can, hurts his foot, and apologizes to the trash can.',
  'Shay Mercado tapes a printout of the final score inside his locker. "So I see it every morning," he says.',
  'Rocco collects the jerseys without a word and hands you yours back clean on Monday, like nothing happened.',
];

P.game_pre = () => {
  const n = S.slate;
  const flavor = [
    'The tunnel smells like popcorn and cut grass. Sixty-eight thousand people make a noise you can feel in your teeth.',
    'Fireworks go off at the end of the tunnel. The smoke hasn\'t cleared when the team starts running.',
    'Tiny bangs his helmet against yours three times, the way he does every week. Your ears ring. It\'s tradition.',
    'A kid in the front row holds up a sign with your number on it. You point at it. The kid nearly faints.',
    'Rocco the equipment manager hands you a fresh pair of gloves and says the same thing he says every week: "Don\'t lose these."',
    'The national anthem singer holds the last note for eleven seconds. Tiny times it on his fingers.',
    'Bramble walks out for warmups in a short-sleeved shirt, the way he does every week, whatever the weather is doing.',
    'The PA announcer says your name during introductions, and somebody up in the cheap seats screams it back.',
  ];
  const body = [flavor[(n + (S.year || 1) * 3) % flavor.length]];
  if (n === 0 && S.flags.famAtGame) body.push(`You spot {fam} in the stands, waving the sign with both arms.`);
  if (n >= 10) body.push(`Playoff football. Every snap feels twice as loud.`);
  body.push({ practice: `You're on the practice squad, so you watch from the sideline in a team hoodie. Next week, maybe.`, backup: `You're the backup. Helmet on, stay loose. Your number might get called.`, rotation: `You and Vane will trade series today.`, starter: `You're starting. Here we go.` }[S.role]);
  return {
    kicker: `${weekKicker()} · Game day`,
    title: `Kickoff vs ${oppOf(n).team}`,
    html: matchupHTML(oppOf(n)),
    body,
    choices: [{ label: S.role === 'practice' ? 'Watch the game' : 'Run out of the tunnel', primary: true, do() { startGame(); return null; } }],
  };
};

function clockStr(late) { const m = late ? ri(1, 2) : ri(1, 14); return `${m}:${String(ri(0, 59)).padStart(2, '0')}`; }
function teamRating() {
  let r = 50 + (S.st.chem - 30) * 0.15;
  if (S.role === 'starter') r += (S.st.skill - 50) * 0.15;
  else if (S.role === 'rotation') r += (S.st.skill - 50) * 0.08;
  return mod('teamRating', r);
}
function drive(off, def, mult) {
  const edge = (off - def) / 100;
  const pTD = clamp(0.26 + edge * 1.1, 0.06, 0.55) * mult;
  const pFG = 0.2 * mult;
  const x = Math.random();
  return x < pTD ? 7 : x < pTD + pFG ? 3 : 0;
}
// Opponents may carry a trait: { name, note, diff, energy, fakes } (see SCHEDULE in 30-data.js).
function oppTrait(n) { const o = oppOf(n); return (o && o.trait) || {}; }
function gameDiff() { const g = S.game, opp = oppOf(g.n), t = oppTrait(g.n); return clamp(mod('diff', 1 + (opp.r - 45) / 9 + (g.n >= 10 ? 0.3 : 0) + (t.diff || 0), { game: g }), 0.6, 5.5); }
// Bonus thresholds (mod keys 'edge.coach' / 'edge.chem' let difficulty modules move or switch them off).
const edgeCoach = () => mod('edge.coach', 85);
const edgeChem = () => mod('edge.chem', 80);
function hasEdge() { return !!((S.wk && S.wk.film) || S.items.notes || S.flags.focus || S.rel.coach >= edgeCoach()); }
function miniCfg(m, diff) {
  const t = S.game ? oppTrait(S.game.n) : {};
  const fakes = m.fakes != null || t.fakes ? (m.fakes != null ? m.fakes : 1) + (t.fakes || 0) : undefined;
  return { type: m.type, diff, prompt: m.prompt, btn: m.btn, read: m.read, fakes, label: m.label, edge: hasEdge(), moment: m };
}
// Moments can be limited with m.vs (team name or list), m.year (number) and m.when (() => bool).
function momentAllowed(m, opp) {
  if (m.year && m.year !== (S.year || 1)) return false;
  if (m.when) { try { if (!m.when()) return false; } catch (e) { return false; } }
  if (m.vs) return [].concat(m.vs).includes(opp.team);
  return true;
}

function startGame() {
  const n = S.slate;
  let qs = { starter: [1, 2, 3], rotation: [2, 3], backup: [3], practice: [] }[S.role] || [];
  let special = null;
  if (n === 2 && (S.year || 1) === 1 && !S.flags.vaneHurt) { special = 'injury'; qs = [2, 3]; }
  const lib = MOMENTS[S.pos], recent = S.recentMoments || [], opp = oppOf(n);
  const ok = lib.map((_, i) => i).filter(i => momentAllowed(lib[i], opp));
  const sig = shuffle(ok.filter(i => lib[i].vs));               // this opponent's signature moments come first
  const rest = shuffle(ok.filter(i => !lib[i].vs)).sort((a, b) => (recent.includes(a) ? 1 : 0) - (recent.includes(b) ? 1 : 0));
  const order = sig.slice(0, 1).concat(rest);
  if (order.length < qs.length) order.push(...shuffle(lib.map((_, i) => i)));
  const plan = qs.map((q, i) => ({ q, m: order[i], clock: clockStr() }));
  S.recentMoments = plan.map(p => p.m);
  S.game = { n, us: 0, them: 0, q: 0, plan, mi: 0, res: [], recap: [], seen: 0, special, line: {}, bgTD: 0, done: false, clock: clockStr(true) };
  if (S.role !== 'practice' && S.st.energy < 15) award('empty');
  Sound.play('whistle');
  emit('gameStart', S.game);
  advanceGame();
}
function simQuarter(q) {
  const g = S.game, opp = oppOf(g.n);
  const us = teamRating(), them = opp.r + (g.n === 4 && S.flags.trash === 'fire' ? 3 : 0);
  const mult = q === 4 ? 0.85 : 1;
  const a = drive(us, them, mult), b = drive(them, us, mult);
  const nick = shortName(opp.team);
  if (a) { g.us += a; if (a === 7) g.bgTD++; g.recap.push(`Q${q}: ${pick(a === 7 ? TEAM_TD : TEAM_FG)}`); }
  if (b) { g.them += b; g.recap.push(`Q${q}: ${pick(b === 7 ? OPP_TD : OPP_FG).replace('{opp}', nick)}`); }
}
function advanceGame() {
  const g = S.game;
  while (g.q < 4) {
    g.q++;
    simQuarter(g.q);
    if (g.special === 'injury' && g.q === 2 && !g.injured) { g.injured = true; return go('g_injury'); }
    if (g.plan[g.mi] && g.plan[g.mi].q === g.q) return go('g_moment');
  }
  return endRegulation();
}
function endRegulation() {
  const g = S.game, d = g.us - g.them;
  if (S.role !== 'practice' && Math.abs(d) <= 8) return go('g_clutch');
  if (d === 0) {
    if (chance(0.5 + (teamRating() - oppOf(g.n).r) / 100)) g.us += 3; else g.them += 3;
    g.recap.push('OT: A field goal decides it in overtime.');
  }
  return finishGame();
}
function recapLines() { const g = S.game; return g.recap.slice(g.seen).map(t => ({ note: t })); }
function boardHTML(final) {
  const g = S.game;
  if (!g) return '';
  const opp = oppOf(g.n);
  const us = teamStyle(HOME_TEAM), them = teamStyle(opp.team);
  return `<div class="board" role="group" aria-label="Scoreboard: Hammerheads ${g.us}, ${esc(opp.team)} ${g.them}" style="--c-us:${us.c1};--c-them:${them.c1}"><div class="bteam"><span class="bname"><span class="bfull">Hammerheads</span><span class="babbr">${us.abbr}</span></span><span class="bscore">${g.us}</span></div><div class="bmid">${final ? 'Final' : 'Q' + Math.max(1, g.q)}</div><div class="bteam right"><span class="bscore">${g.them}</span><span class="bname"><span class="bfull">${esc(shortName(opp.team))}</span><span class="babbr">${esc(them.abbr)}</span></span></div></div>`;
}

P.g_injury = () => {
  const opp = oppOf(S.game.n);
  const setStarter = () => { S.role = 'starter'; S.flags.vaneHurt = true; };
  return {
    kicker: `Q2 · 9:14 · vs ${opp.team}`,
    title: 'Vane Is Down',
    board: true,
    body: [
      `Second quarter. Marcus Vane {inj}, and a 300-pound lineman lands on his ankle. You hear it from the sideline. Sixty-eight thousand people go quiet at the same time.`,
      `The cart comes out. Vane waves it off, tries to stand, can't, and gets on the cart.`,
      { s: 'Coach Okafor', t: `{last}. Helmet. You're in.` },
    ],
    choices: [
      { label: 'Jog to the cart and tap helmets with Vane first.', do() { setStarter(); fx({ vane: 12, coach: 2 }); return [`Vane grabs your facemask and pulls you close.`, { s: 'Marcus Vane', t: `Eyes up. Don't look at your feet.` }, `It's the nicest thing he's ever said to you.`]; }, then: 'g_moment' },
      { label: 'Grab your helmet and sprint onto the field.', do() { setStarter(); fx({ conf: 5, coach: 3 }); return [`No hesitation. The crowd sees you running out and gets loud again.`]; }, then: 'g_moment' },
      { label: 'Take three deep breaths, the way {fam} taught you.', do() { setStarter(); fx({ conf: 4, family: 2 }); return [`In for four, hold for four, out for four. Your hands stop shaking by the time you reach the huddle.`]; }, then: 'g_moment' },
    ],
  };
};

P.g_moment = () => {
  const g = S.game, p = g.plan[g.mi], m = MOMENTS[S.pos][p.m], opp = oppOf(g.n);
  const body = recapLines();
  if (S.role === 'backup' && g.mi === 0) body.push({ s: coach().name, t: pick([`{last}! You're in for this series. Go.`, `Package play. {last}, you're up.`]) });
  body.push(m.setup);
  return {
    kicker: `Q${g.q} · ${p.clock} · vs ${opp.team}`,
    title: m.title,
    board: true,
    body,
    mini: Object.assign(miniCfg(m, gameDiff()), { onDone: momentDone }),
  };
};
function momentDone(r, x) {
  const g = S.game, m = MOMENTS[S.pos][g.plan[g.mi].m];
  const body = [];
  let text = x && x.text ? x.text : textFor(m, r);
  const saved = saveBadPlay(r);
  S.game.lastSaved = !!saved;
  if (saved) r = 'good'; // the flag wipes the play out; its own (bad) text stays true
  body.push(text);
  if (saved) body.push({ note: saved });
  const res = playResult(r, m);
  body.push({ note: res.note });
  g.res.push(r);
  emit('play', { r, td: res.td, note: res.note, moment: m, clutch: false, success: r !== 'bad' , saved: !!S.game.lastSaved });
  g.mi++;
  g.seen = g.recap.length;
  go('g_mres', { body, r, saved: !!saved });
}
P.g_mres = a => ({
  kicker: `Q${S.game.q} · vs ${oppOf(S.game.n).team}`,
  title: a.saved ? 'Flag on the Play' : { great: 'Big Play!', good: 'Nice Work', bad: 'Rough One' }[a.r],
  board: true,
  body: a.body,
  next: 'advance',
});
function playResult(r, m) {
  const g = S.game;
  let note = '', td = false;
  if (S.pos !== 'LB') {
    if (r === 'great') {
      if (chance(0.65)) { g.us += 7; td = true; note = '**Touchdown, Hammerheads!**'; }
      else { g.us += 3; note = 'The drive stalls in the red zone. Field goal is good.'; }
    } else if (r === 'good') {
      if (chance(0.45)) { g.us += 3; note = 'The drive ends with a field goal.'; }
      else note = 'Good field position, but the drive ends in a punt.';
    } else {
      const x = Math.random();
      if (x < 0.3) { g.them += 7; note = 'They turn it into a touchdown the other way.'; }
      else if (x < 0.6) { g.them += 3; note = 'They turn it into a field goal.'; }
      else note = 'Your defense bails you out with a stop.';
    }
  } else {
    if (r === 'great') {
      const x = Math.random();
      if (m.tag === 'take' && x < 0.25) { g.us += 7; td = true; note = '**Defensive touchdown!** You take it all the way back.'; }
      else if (x < 0.72) { g.us += 3; note = 'The offense turns the short field into a field goal.'; }
      else note = 'Three and out. The crowd is on its feet.';
    } else if (r === 'good') { if (chance(0.25)) { g.us += 3; note = 'Drive stalled, and the offense turns the field position into a field goal.'; } else note = 'Drive stalled. They have to punt.'; }
    else if (chance(0.45)) { g.them += 7; note = 'They punch it in for a touchdown.'; }
    else { g.them += 3; note = 'They settle for a field goal.'; }
  }
  if (!(S.game && S.game.lastSaved)) statsFor(r, td, m); // a play wiped out by a flag adds no stats
  const f = { great: { conf: 2, fame: 1, coach: 2 }, good: { conf: 1 }, bad: { conf: -3, coach: -2 } }[r];
  if (td) f.fame += 2;
  fx(f);
  if (r === 'great') award('bigplay');
  if (td) award('six');
  return { note, td };
}
function addLine(L) {
  const g = S.game;
  for (const k in L) {
    if (k === 'long') { S.line.long = Math.max(S.line.long || 0, L.long); g.line.long = Math.max(g.line.long || 0, L.long); continue; }
    S.line[k] = (S.line[k] || 0) + L[k];
    g.line[k] = (g.line[k] || 0) + L[k];
  }
}
function statsFor(r, td, m, clutch) {
  const L = {};
  switch (S.pos) {
    case 'QB':
      L.passYds = r === 'great' ? ri(28, 58) : r === 'good' ? ri(7, 19) : 0;
      if (r === 'bad' && m.type === 'read' && !clutch && chance(0.5)) L.int = 1;
      break;
    case 'RB': { const y = r === 'great' ? ri(18, 64) : r === 'good' ? ri(4, 12) : ri(-3, 1); L.rushYds = y; L.long = y; break; }
    case 'WR':
      if (r !== 'bad') { L.rec = 1; L.recYds = r === 'great' ? ri(24, 61) : ri(7, 18); }
      break;
    case 'LB':
      if (r !== 'bad') L.tkl = ri(1, 2);
      if (r === 'great' && m.tag === 'take') L.take = 1;
      if (r === 'great' && m.tag === 'sack') L.sacks = 1;
      break;
  }
  if (td) L.td = 1;
  addLine(L);
}

// ---------- The final minutes: a short drive of 1–3 snaps ----------
// Behind or tied: down 0–2, one good snap wins it (field goal). Down 3–6, a great snap scores the touchdown and a
// good one keeps the drive alive for one more snap. Down 7–8, score the touchdown, then make the two-point try.
// Ahead: a great snap ends it, a good one forces one more snap, and any bad snap lets them score.
function clutchMoment(g) {
  const cl = g.cl || {};
  if (cl.snap >= 1 && cl.m2 != null && MOMENTS[S.pos][cl.m2]) return MOMENTS[S.pos][cl.m2];
  const v = CLUTCH[S.pos][(cl.d0 != null ? cl.d0 : g.us - g.them) <= 0 ? 'chase' : 'hold'];
  if (!Array.isArray(v)) return v;
  const opts = v.filter(m => momentAllowed(m, oppOf(g.n)));
  const list = opts.length ? opts : v;
  return list[(cl.v || 0) % list.length];
}
function pickFollowup(twoPt) {
  const lib = MOMENTS[S.pos], used = (S.game.plan || []).map(p => p.m), cur = clutchMoment(S.game);
  let idx = lib.map((m, i) => i).filter(i => !used.includes(i) && lib[i].type !== cur.type);
  if (twoPt) { const quick = idx.filter(i => ['read', 'timing', 'reaction', 'throw', 'catch'].includes(lib[i].type)); if (quick.length) idx = quick; }
  if (!idx.length) idx = lib.map((m, i) => i);
  return pick(idx);
}
function clutchClock(g) { const cl = g.cl || {}; return cl.snap ? `0:${String(Math.max(3, 41 - cl.snap * 17)).padStart(2, '0')}` : g.clock; }
P.g_clutch = () => {
  const g = S.game, opp = oppOf(g.n);
  if (!g.cl) g.cl = { snap: 0, d0: g.us - g.them, v: ri(0, 99) };
  const cl = g.cl, d = g.us - g.them, chase = cl.d0 <= 0, def = S.pos === 'LB';
  const c = clutchMoment(g);
  const body = recapLines();
  let title = c.title;
  if (cl.twoPt) {
    title = 'Two-Point Try';
    body.push(`**Two-point try.** Down ${-d}. One snap from the 2-yard line ${d === -1 ? 'to win it' : 'to tie it and force overtime'}.`);
  } else if (cl.snap === 0) {
    const sit = d < 0 ? `Down ${-d}` : d > 0 ? `Up ${d}` : `Tied ${g.us}-${g.them}`;
    body.push(`**${sit}, ${g.clock} left in the fourth quarter.** ${chase ? needLine(-d) : (def ? 'Hold them, and it\'s over.' : 'Close it out.')}`);
    if (S.role === 'backup' || S.role === 'rotation') body.push({ s: S.role === 'backup' ? coach().name : 'Coach Bramble', t: `{last}. You're in. Win us the game.` });
  } else {
    title = chase ? 'Still Alive' : def ? 'One More Stop' : 'One More Snap';
    body.push(chase
      ? (def ? `**Still alive.** That play didn't end it, but they only need one more first down. Make another play.` : `**Still alive.** The clock is running and the timeouts are gone. One more big play.`)
      : (def ? `**One more stop.** They're still coming, and there's time for one more snap.` : `**Not over yet.** That one didn't end it. One more snap to ice it.`));
  }
  body.push(c.setup);
  return {
    kicker: `Q4 · ${clutchClock(g)} · vs ${opp.team}`,
    title,
    board: true,
    body,
    mini: Object.assign(miniCfg(c, gameDiff() + 1 + (cl.snap ? 0.3 : 0)), { clutch: true, onDone: clutchDone }),
  };
};
function needLine(def) {
  if (S.pos === 'LB') return def === 0 ? 'Get the ball back and the offense can win it.' : `They're trying to run out the clock. Get the ball back.`;
  return def === 0 ? 'Any score wins it.' : def <= 2 ? 'A field goal wins it.' : def <= 6 ? 'You need a touchdown.' : def === 7 ? 'You need a touchdown and a two-point conversion.' : 'You need a touchdown and a two-point conversion just to force overtime.';
}
const CLUTCH_NOTES = {
  hold: '**Ballgame.** The offense lines up in victory formation.',
  fg: 'Augie Szczepanski, the kicker the commissioner mispronounced on draft night, drills a 41-yarder as time expires. **Hammerheads win!**',
  td: '**Touchdown!** The defense holds on the final snap. **Hammerheads win!**',
  td2: '**Touchdown,** and the two-point try is good! **Hammerheads win by one!**',
  two: 'The two-point try is good! **Hammerheads win by one!**',
  twofail: 'The two-point try comes up a foot short. **Final.**',
  ot: 'Tied at the end of regulation. **Overtime.** The Hammerheads win the coin toss, march down the field, and kick the winner.',
  short: 'That was the last chance. They kneel it out. **Final.**',
  lost: 'They score in the final seconds. The stadium goes silent. **Final.**',
  otl: 'They tie it with seconds left, then win it in overtime. **Final.**',
};
function clutchResolve(success) {
  const g = S.game, d = g.us - g.them;
  if (success) {
    if (d > 0) return 'hold';
    const need = -d, add = need <= 2 ? 3 : need <= 6 ? 7 : 8;
    g.us += add;
    if (g.us === g.them) { g.us += 3; return 'ot'; }
    return add === 3 ? 'fg' : add === 7 ? 'td' : 'td2';
  }
  if (d < 0) return 'short';
  const add = d <= 2 ? 3 : d <= 6 ? 7 : 8;
  g.them += add;
  if (g.us === g.them) { g.them += 3; return 'otl'; }
  return 'lost';
}
function clutchDone(r, x) {
  const g = S.game;
  if (!g.cl) g.cl = { snap: 0, d0: g.us - g.them, v: ri(0, 99) };
  const cl = g.cl, c = clutchMoment(g), chase = cl.d0 <= 0, need = -cl.d0, def = S.pos === 'LB';
  const body = [];
  let text = x && x.text ? x.text : textFor(c, r);
  const saved = saveBadPlay(r);
  S.game.lastSaved = !!saved;
  body.push(text);
  if (saved) {
    // In the final minutes a flag means a do-over: run another snap (the two-point try stays a two-point try).
    body.push({ note: saved });
    g.res.push('good');
    g.clutchPlayed = true;
    g.seen = g.recap.length;
    if (!cl.twoPt) { cl.snap = Math.max(cl.snap, 1); cl.m2 = pickFollowup(false); }
    emit('play', { r: 'good', td: false, note: '', moment: c, clutch: true, success: null, pending: true, saved: true });
    return go('g_cmid', { body, title: 'Flag on the Play' });
  }
  cl.snap++;
  g.res.push(r);
  g.clutchPlayed = true;
  g.seen = g.recap.length;
  if (!S.game.lastSaved) statsFor(r, false, c, true);
  if (cl.twoPt) {
    cl.twoPt = false;
    const ok = r !== 'bad';
    if (ok) g.us += 2;
    let note = g.us > g.them ? 'two' : 'twofail';
    if (g.us === g.them) { g.us += 3; note = 'ot'; }
    return clutchEnd(r, g.us > g.them, note, body, false, c);
  }
  const success = r === 'great' || (r === 'good' && (cl.snap >= 2 || (chase && need <= 2)));
  if (r === 'good' && !success) {
    cl.m2 = pickFollowup(false);
    emit('play', { r, td: false, note: '', moment: c, clutch: true, success: null, pending: true , saved: !!S.game.lastSaved });
    return go('g_cmid', { body, title: chase ? 'Still Alive' : 'Not Over Yet' });
  }
  if (success && chase && need >= 7) {
    g.us += 6;
    cl.twoPt = true;
    cl.m2 = pickFollowup(true);
    if (!def) { addLine({ td: 1 }); award('six'); }
    body.push({ note: def ? 'The offense takes over and scores! **Touchdown.** Now the two-point try decides it.' : '**Touchdown!** Now the two-point try decides it.' });
    emit('play', { r, td: !def, note: 'td', moment: c, clutch: true, success: null, pending: true , saved: !!S.game.lastSaved });
    return go('g_cmid', { body, title: 'Touchdown!' });
  }
  const note = clutchResolve(success);
  return clutchEnd(r, success, note, body, success && !def && (note === 'td' || note === 'td2' || note === 'ot'), c);
}
function clutchEnd(r, success, note, body, td, c) {
  const g = S.game, def = S.pos === 'LB', chase = g.cl && g.cl.d0 <= 0;
  if (td) addLine({ td: 1 });
  emit('play', { r, td, note, moment: c, clutch: true, success , saved: !!S.game.lastSaved });
  if (def && chase && success && note !== 'two' && note !== 'twofail') body.push({ note: 'The offense takes over on a short field.' });
  body.push({ note: CLUTCH_NOTES[note] });
  if (success) {
    fx({ conf: 4, fame: r === 'great' ? 4 : 3, coach: 3 });
    award('clutch');
    if (r === 'great') award('bigplay');
    if (td) award('six');
  } else fx({ conf: -5 });
  go('g_cres', { body, success });
}
P.g_cmid = a => ({
  kicker: `Q4 · ${clutchClock(S.game)} · vs ${oppOf(S.game.n).team}`,
  title: a.title,
  board: true,
  body: a.body,
  next: 'g_clutch',
  nextLabel: 'Next snap',
});
P.g_cres = a => ({
  kicker: `Q4 · 0:00 · vs ${oppOf(S.game.n).team}`,
  title: a.success ? 'Clutch!' : 'So Close',
  board: true,
  final: true,
  body: a.body,
  next: 'finish',
  nextLabel: 'Final whistle',
});
// A bad play can be rescued once in a while: the rabbit's foot (once), or a teammate when chemistry is high (once per game).
function saveBadPlay(r) {
  if (r !== 'bad') return null;
  const g = S.game;
  // A rescue wipes the bad play out with a flag on the other team, so the failure text above it still makes sense.
  if (S.items.luck) { delete S.items.luck; return `Then you see it: a yellow flag on the grass. Holding, on them, away from the play. The whole thing comes back, and the rabbit's foot in your sock feels warm.`; }
  if (g && !g.chemSaved && S.st.chem >= edgeChem() && chance(0.6)) {
    g.chemSaved = true;
    return S.pos === 'LB'
      ? pick([`But there's a flag. Ronnie Batiste baited their receiver into a push-off, the way you two drew it up at lunch. The play comes back. Chemistry pays off.`, `But there's a flag: illegal formation. Your defensive line spotted it and pointed it out before the snap. The play comes back.`])
      : pick([`But there's a flag. Tiny spent all game baiting their nose tackle, and he finally jumps offside. The play comes back. Chemistry pays off.`, `But there's a flag: their linebacker hit you late, and three teammates made sure the referee saw it. Do over, with yards.`]);
  }
  return null;
}

function binom(n, p) { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < p) k++; return k; }
function letter(v) { return v >= 2.75 ? 'A+' : v >= 2.5 ? 'A' : v >= 2.25 ? 'A−' : v >= 2 ? 'B+' : v >= 1.75 ? 'B' : v >= 1.5 ? 'B−' : v >= 1.25 ? 'C' : v >= 1 ? 'D' : 'F'; }
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
function lineText(L) {
  switch (S.pos) {
    case 'QB': return `${plural(L.passYds || 0, 'passing yard')}, ${L.td || 0} TD, ${L.int || 0} INT`;
    case 'RB': return `${plural(L.rushYds || 0, 'rushing yard')}, ${L.td || 0} TD, long of ${L.long || 0}`;
    case 'WR': return `${plural(L.rec || 0, 'catch', 'catches')}, ${plural(L.recYds || 0, 'yard')}, ${L.td || 0} TD`;
    default: return `${plural(L.tkl || 0, 'tackle')}, ${plural(L.sacks || 0, 'sack')}, ${plural(L.take || 0, 'takeaway')}`;
  }
}
function finishGame() {
  const g = S.game;
  if (g.done) return go('g_final');
  g.done = true;
  // The plays you weren't the star of still add to your stat line.
  const mult = { starter: 1, rotation: 0.5, backup: 0.12, practice: 0 }[S.role] || 0;
  if (mult) {
    const L = {};
    if (S.pos === 'QB') { L.passYds = Math.round(ri(120, 200) * mult); L.td = binom(g.bgTD, 0.6 * mult); }
    if (S.pos === 'RB') { L.rushYds = Math.round(ri(30, 65) * mult); L.long = Math.min(L.rushYds, ri(5, 14)); L.td = binom(g.bgTD, 0.35 * mult); }
    if (S.pos === 'WR') { const rec = Math.round(ri(2, 4) * mult); L.rec = rec; L.recYds = rec ? rec * ri(7, 13) : 0; L.td = rec ? binom(g.bgTD, 0.3 * mult) : 0; }
    if (S.pos === 'LB') { L.tkl = Math.round(ri(3, 6) * mult); }
    addLine(L);
  }
  const won = g.us > g.them;
  g.won = won;
  if (g.n < 10) { if (won) S.record.w++; else S.record.l++; }
  else if (!won) S.flags.lostRound = g.n;
  else if (g.n === 12) S.flags.champion = true;
  if (g.res.length) {
    const v = g.res.reduce((a, r) => a + { great: 3, good: 2, bad: 0.5 }[r], 0) / g.res.length;
    g.grade = v;
    S.grades.push({ n: g.n, v });
    if (v >= 2.75) award('perfect');
  }
  if (g.n === 8 && S.flags.leoPromise) {
    const kept = S.pos === 'LB' ? !!(g.line.take || g.line.sacks || g.line.td) : !!g.line.td;
    S.flags.leoKept = kept;
    if (kept) award('leo');
  }
  if (g.n === 9 && S.record.w === 10) award('undefeated');
  if (g.n >= 10 && won && S.flags.wasSquad) award('squad');
  if (g.n === 12 && won) award('champ');
  S.hist.push({ n: g.n, opp: shortName(oppOf(g.n).team), us: g.us, them: g.them, won });
  const cost = Math.round(mod('energyCost', ({ starter: 16, rotation: 11, backup: 7, practice: 2 }[S.role] || 5) + (S.role !== 'practice' ? oppTrait(g.n).energy || 0 : 0)));
  const notable = g.n >= 10 || Math.abs(g.us - g.them) >= 14 || !!g.clutchPlayed || oppOf(g.n).rival || (g.grade != null && (g.grade >= 2.75 || g.grade < 1));
  g.press = g.n !== 12 && S.role !== 'practice' && (notable ? chance(0.8) : chance(0.12));
  emit('gameEnd', g);
  fx({ energy: -cost, conf: won ? 2 : -3, chem: won ? 2 : -1, coach: g.grade != null ? Math.round((g.grade - 1.75) * 4) : 0, fame: S.flags.leoKept && g.n === 8 ? 5 : 0 });
  go('g_final');
}
P.g_final = () => {
  const g = S.game, opp = oppOf(g.n), won = g.won, m = Math.abs(g.us - g.them);
  const title = won
    ? (g.n === 12 ? 'Champions!' : m >= 14 ? 'Statement Win' : m <= 3 ? 'Survive and Advance' : 'Hammerheads Win')
    : (m >= 14 ? 'Blown Out' : m <= 3 ? 'Heartbreaker' : 'A Tough Loss');
  const body = recapLines();
  if (g.n === 12 && won) body.push(`The clock hits zero. The Hammerheads are champions. You don't remember the next ten minutes at all.`);
  else if (g.n >= 10 && !won) body.push(`The clock hits zero, and just like that, the season is over.`);
  else body.push(g.finalLine || (g.finalLine = won ? pickFresh('win', WIN_LINES) : pickFresh('loss', LOSS_LINES))); // picked once, so a re-render keeps it
  if (g.n === 8 && S.flags.leoPromise) body.push(S.flags.leoKept
    ? `After the game, a nurse sends you a video from room 412. Leo is standing on his bed in your jersey, screaming. You kept your promise.`
    : `You call Leo after the game. "It's okay," he says. "You'll get the next one."`);
  if (g.n === 0 && S.flags.famAtGame) body.push(`{fam} waits outside the locker room with that sign. It's a little crumpled now.`);
  const after = g.res.length
    ? `<div class="grade-row"><span class="grade">${letter(g.grade)}</span><div><div class="kicker">Your game grade</div><div>${esc(lineText(g.line))}</div></div></div>`
    : `<div class="story"><p class="note">You watched this one from the sideline.</p></div>`;
  return {
    kicker: `Final · vs ${opp.team}`,
    title,
    board: true,
    final: true,
    body,
    after,
    next: g.n === 12 ? 'ending' : g.press ? 'g_press' : 'weekEnd',
    nextLabel: g.n === 12 || (g.n >= 10 && !won && !g.press) ? 'Epilogue' : g.press ? 'Postgame press conference' : 'Next week',
  };
};
P.g_press = () => {
  const g = S.game, won = g.won, opp = oppOf(g.n), m = Math.abs(g.us - g.them);
  const nick = shortName(opp.team);
  // The first question depends on what just happened.
  const firstStart = g.n === 2 && (S.year || 1) === 1;
  const q = firstStart ? (won ? `Marcus Vane goes down and you come in cold. How's Marcus, and how did you stay so calm?` : `You came in cold after Marcus went down. How's he doing, and what did you learn today?`)
    : g.n === 7 && (S.year || 1) === 1 ? `Happy Thanksgiving. What are you most thankful for after a game like that?`
    : g.n === 8 && S.flags.leoPromise ? (S.flags.leoKept ? `Word is that touchdown was for somebody. Want to tell us about it?` : `People say you made a promise to a kid this week. What do you tell him now?`)
    : !won && g.grade != null && g.grade < 1.25 ? `You had a rough day. What happened out there?`
    : won
    ? (g.clutchPlayed ? `That last drive. Walk us through what was going through your head.`
      : m >= 14 ? `Statement win today. Is this team better than people think?`
      : opp.rival ? `You beat the ${nick}. What does that one mean to you?`
      : g.grade != null && g.grade >= 2.75 ? `You were everywhere today. What clicked?`
      : pick([`Walk us through today. What was working?`, `Big win. What's the mood in there?`, `You looked comfortable out there. Where does that come from?`]))
    : (g.clutchPlayed ? `It came down to the last snap. What happened on that play?`
      : m >= 14 ? `That got away from you early. What went wrong?`
      : opp.rival ? `The ${nick} got the better of you today. How much does that sting?`
      : pick([`Tough one. What went wrong today?`, `What do you say to the fans after a loss like that?`]));
  const choices = won ? [
    { label: '"Credit the guys up front. None of that happens without them."', do() { fx({ chem: 4 }); return [S.pos === 'LB' ? pick([`The defensive line watches the clip in the film room and demands you say it again, slower.`, `The nose tackle prints your quote and tapes it to the weight-room mirror. Then he adds "(me)" next to "the guys up front."`]) : pick([`Tiny watches the clip eleven times on the bus home.`, `The offensive line buys you a cake shaped like a football. It says THANKS in frosting. It's for them, they explain. You can have a piece.`])]; }, then: 'weekEnd' },
    { label: '"I expect to make those plays. That\'s my job."', do() { fx({ conf: 3, fame: 4 }); return [pick([`It plays on every sports show that night. Some people call it confident. Some call it cocky. Everybody calls it something.`, `A sports radio host plays it eleven times in an hour. Half the callers love it.`])]; }, then: 'weekEnd' },
    { label: 'Make a joke about Tiny\'s cereal habit.', do() { fx({ fame: 3, chem: 3 }); return [pick([`The room laughs. A cereal company sends Tiny forty boxes by Wednesday. He finishes them by Friday.`, `Tiny bursts into the press room holding a bowl. It is the most-watched clip of the week.`])]; }, then: 'weekEnd' },
  ] : [
    { label: '"That one\'s on me."', do() { fx({ coach: 4, chem: 2, conf: -1 }); return [pick([`Bramble watches the press conference from his office. He nods at the TV.`, `{coachLast} finds you in the parking lot. "Owning it is the first step. Film is the second. Eight a.m."`])]; }, then: 'weekEnd' },
    { label: '"They made more plays than we did. Credit to them."', do() { fx({ coach: 2, conf: 1 }); return [`Classy, boring, safe. {coachLast} gives you a thumbs-up on the way out.`]; }, then: 'weekEnd' },
    { label: 'Blame the referees.', do() { fx({ fame: 3, coach: -5, money: -11817 }); return [`The league fines you $11,817 for criticizing officials. Bramble makes you pay it in person, and then makes you run.`]; }, then: 'weekEnd' },
  ];
  // Special questions get answers that fit them.
  if (firstStart) choices.splice(0, 2,
    { label: '"Marcus is the reason I was ready. I\'ve been watching him for years."', do() { fx({ vane: 6, chem: 3 }); return [`Vane watches the clip from a training-room table with his foot in ice. He doesn't say anything about it. He forwards it to his mom.`]; }, then: 'weekEnd' },
    { label: '"I\'ve been ready since draft night."', do() { fx({ conf: 4, fame: 4 }); return [`It's the line every sports show runs that night, right over the clip of the phone that didn't ring.`]; }, then: 'weekEnd' });
  else if (g.n === 8 && S.flags.leoPromise && S.flags.leoKept) choices.splice(0, 2,
    { label: 'Tell them about Leo and room 412.', do() { fx({ fame: 5, family: 3 }); return [`The room goes quiet while you talk. That night, a local news crew sets up outside Harbor City Children's. Leo does the interview in your jersey and refuses to take any questions about kickball.`]; }, then: 'weekEnd' },
    { label: '"That one\'s between me and a nine-year-old."', do() { fx({ conf: 3, coach: 2 }); return [`Jules Park smiles and lets it go. The next morning the Ledger runs a photo of you pointing at the stands, with no caption at all.`]; }, then: 'weekEnd' });
  else if (g.n === 7 && (S.year || 1) === 1) choices.splice(0, 2,
    { label: '"Tiny\'s grandmother\'s turkey tails. And this team."', do() { fx({ chem: 4, fame: 2 }); return [`Nana Fonoti calls Tiny during the bus ride to say she saw it. Tiny puts her on speaker for the whole bus.`]; }, then: 'weekEnd' },
    { label: '"{fam}. Always."', do() { fx({ family: 5, conf: 2 }); return [`{fam} watches the clip so many times that night that the TV remote stops working.`]; }, then: 'weekEnd' });
  if (opp.rival && S.flags.trash) choices.push(won
    ? { label: 'Send a message to Dante Kingsley.', do() { fx({ fame: 6, conf: 2, coach: -2 }); S.flags.kingsleyMsg = true; return [`"Tell Dante I said hi. And that the crown looked heavy today." The clip has four million views by midnight. Somewhere, Kingsley is typing.`]; }, then: 'weekEnd' }
    : { label: 'Give Kingsley his credit.', do() { fx({ conf: 1, coach: 2, fame: 2 }); S.flags.kingsleyCredit = true; return [`"He's the best player I've lined up against. That's not going to stay true forever." Kingsley reposts it with a single crown emoji.`]; }, then: 'weekEnd' });
  return {
    kicker: `Postgame · vs ${opp.team}`,
    title: 'The Podium',
    body: [
      pick([`Jules Park from the Harbor City Ledger gets the first question, like always.`, `The podium lights are hot. Jules Park from the Harbor City Ledger has a notebook already open.`, `Twelve microphones, one folding table, and Jules Park from the Harbor City Ledger in the front row.`]),
      { s: 'Jules Park', t: q },
    ],
    choices,
  };
};
function weekEnd() {
  const g = S.game;
  if (g && g.n >= 10 && !g.won) return go('ending');
  if (g && g.n === 12) return go('ending');
  S.slate++;
  if (S.slate === 10) return go('po_gate');
  beginWeek();
}

// ---------- Endings ----------
function avgGrade() { return S.grades.length ? S.grades.reduce((a, g) => a + g.v, 0) / S.grades.length : 0; }
function pickEnding() {
  for (const r of ENDING_RULES) { try { if (r.when()) return r.id; } catch (e) { console.error(e); } }
  if (S.flags.champion) return (avgGrade() >= 2.5 && S.st.fame >= 75) ? 'legend' : 'ring';
  if (S.flags.lostRound === 12) return 'close';
  if (S.flags.inPO) return 'climb';
  if (S.st.fame >= 60 && S.st.chem < 40) return 'hype';
  if (S.st.chem >= 60) return 'heart';
  return 'next';
}
function codas() {
  const out = [];
  const y1 = (S.year || 1) === 1; // later seasons write their own epilogue lines (CODAS)
  if (!y1) { /* skip the Year One lines below */ }
  else if (vaneFate() === 'retired') out.push(`In March, Marcus Vane retires after twelve seasons. He leaves something in your locker: the brass nameplate from his. On the back, scratched in with a key: *Your turn. Eyes up.*`);
  else if (vaneFate() === 'signed') out.push(`Marcus Vane signs with another team in the spring. The day he leaves, you get a text: *Stop looking at your feet. Proud of you, rook.*`);
  else if (vaneFate() === 'quiet') out.push(`Marcus Vane is released in the offseason. On his way out of the building he stops at your locker, taps the nameplate, and says, "Eyes up, rook." That's the whole goodbye.`);
  else out.push(`Marcus Vane is released in the offseason. You don't hear from him for a long time. Some bridges take longer to build than others.`);
  if (y1) out.push(S.st.money >= 500000 ? FAMILY_RICH[S.origin] : FAMILY_MODEST[S.origin]);
  if (y1 && S.items.blitz) out.push(`Blitz, the practice-field dog, now has his own fan account. It has more followers than Coach Bramble.`);
  if (!y1) { /* Leo and Tiny lines are Year One only */ }
  else if (S.flags.leoKept) out.push(`Leo goes home from the hospital in April. He mails you a photo from recess: somebody picked him first for kickball.`);
  else if (S.flags.leoPromise) out.push(`You didn't keep your promise to Leo. He writes to you anyway: *It's ok. You'll get the next one.* You tape the letter inside your locker.`);
  else if (S.flags.leoVisit) out.push(`Leo sends you a crayon drawing of you in your number {num}, about forty feet tall.`);
  if (y1 && S.st.chem >= 70) out.push(`Tiny gets your jersey number tattooed on his calf. He tells everyone it's his lucky lottery number.`);
  const extra = [];
  for (const c of CODAS) { try { const p = c(); if (p) extra.push(p); } catch (e) { console.error(e); } }
  // Keep the epilogue readable: at most nine short paragraphs in all.
  out.push(...extra.slice(0, Math.max(3, 9 - out.length - 1)));
  if (y1 && S.flags.ending !== 'climb') out.push(`The report date for next season is March 30th. You're already counting the days.`);
  return out;
}
// The beat reporter's column about your season, assembled from what actually happened.
function ledgerHTML() {
  if (UI.ledger) { const h = UI.ledger(); if (h) return h; }
  const best = S.grades.length ? S.grades.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const bestGame = best && S.hist.find(h => h.n === best.n);
  const champ = S.flags.champion, lost = S.flags.lostRound;
  const lines = [];
  lines.push(`Nobody drafted ${esc(S.first)} ${esc(S.last)}. Two hundred and fifty-seven names were called, and then the phone rang at 11:52.`);
  lines.push(S.flags.wasSquad ? `${esc(S.last)} started this season on the practice squad, running the other team's plays in a team hoodie.` : `${esc(S.last)} made the roster as a backup and waited for a chance.`);
  if (S.flags.vaneHurt) lines.push(`The chance came in Week 3, when Marcus Vane went down and Coach Okafor said four words: "Helmet. You're in."`);
  if (bestGame) lines.push(`The best of it came against the ${esc(bestGame.opp)}: ${/^[AF]/.test(letter(best.v)) ? 'an' : 'a'} ${letter(best.v)} game in a ${bestGame.won ? 'win' : 'loss'}, ${bestGame.us}-${bestGame.them}.`);
  lines.push(`The Hammerheads finished ${S.record.w}-${S.record.l}${champ ? ' and won the Championship' : lost === 12 ? ' and came one game short of a title' : lost != null ? ' and made the playoffs' : S.flags.inPO ? '' : ' and missed the playoffs'}.`);
  lines.push(`${esc(S.last)}'s season line: ${esc(lineText(S.line))}.`);
  if (S.flags.leoKept) lines.push(`In room 412 at Harbor City Children's, there's a nine-year-old who says he called it.`);
  return `<div class="ledger"><div class="ledger-mast">The Harbor City Ledger</div><div class="ledger-head">The 258th Pick</div><div class="ledger-by">By Jules Park</div><p>${lines.join(' ')}</p></div>`;
}
function summaryHTML() {
  const po = S.flags.champion ? 'Champions' : S.flags.lostRound != null ? { 10: 'Lost wild card', 11: 'Lost conf. final', 12: 'Lost the final' }[S.flags.lostRound] : S.flags.inPO ? 'Playoffs' : 'Missed';
  const tiles = [[`${S.record.w}-${S.record.l}`, 'Record'], [po, 'Playoffs'], [S.grades.length ? letter(avgGrade()) : '–', 'Avg grade'], [money(S.st.money), 'Bank']]
    .concat(POS[S.pos].stats.map(([k, l]) => [S.line[k] || 0, l]));
  const res = S.hist.map(h => `<span class="res ${h.won ? 'w' : 'l'}">${h.won ? 'W' : 'L'} ${esc(h.opp)} ${h.us}-${h.them}</span>`).join('');
  const tr = S.runTrophies.map(id => TROPHIES.find(t => t[0] === id)).filter(Boolean);
  return `<div class="ending-mark">Season summary</div>
    <div class="sumgrid">${tiles.map(t => `<div><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('')}</div>
    <div class="results">${res}</div>
    ${tr.length ? `<div class="ending-mark">Trophies this career</div><div class="how-games" style="margin-bottom:8px">${tr.map(t => `<span class="chip">${esc(t[1])}</span>`).join('')}</div>` : ''}`;
}
P.ending = () => {
  if (!S.flags.ending) {
    S.flags.ending = pickEnding();
    if (S.flags.ending === 'legend') award('mvp');
    if (S.flags.champion) award('champ');
    if (S.st.money >= 750000 * (S.year || 1)) award('rich');
    remember('endings', S.flags.ending);
    emit('ending', S.flags.ending);
    save();
  }
  const E = ENDINGS[S.flags.ending];
  return {
    kicker: 'Epilogue',
    title: E.title,
    body: E.body().concat(codas()),
    after: ledgerHTML() + summaryHTML(),
    choices: [
      { if: () => typeof UI.startNextYear === 'function' && (!UI.canStartNextYear || UI.canStartNextYear()), label: UI.nextYearLabel || 'Play next season', sub: UI.nextYearSub || 'Same player, new season.', primary: true, do() { UI.startNextYear(); return null; } },
      { label: 'Start a new career', sub: 'Try another position or hometown. Every career can end differently.', primary: true, do() { newCareer(); return null; } },
      { label: 'Open the trophy case', do() { showTrophies('play'); return null; } },
    ],
  };
};

