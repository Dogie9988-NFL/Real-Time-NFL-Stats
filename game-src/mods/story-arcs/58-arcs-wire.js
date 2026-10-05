
// =========================================================
//   CHARACTER ARCS: wiring (runs after 50-engine.js, so BEATS, CODAS,
//   ENDING_RULES and the engine's game pages exist here).
// =========================================================

// ---------- Weekly beats (year 1) ----------
// Week (slate) map, story pages besides hub and game:
//   0 w1_family + tiny_knee        1 [w2_callup] + fam_a + event (practice squad: event waits)
//   2 ok_suit + event              3 w4_rehab + ok_ref        4 w5_trash (+ dante_mid after the game)
//   5 w6_agent + event
//   6 w7_return + tiny_truck       7 w8_thanks                8 w9_leo + event
//   9 fam_b + w10_stakes          10 po1 + event             11 po2      12 po3_media, po3_night
// Postgame pages chain off the final score: dante_mid (4), tiny_deal (7), ok_offer (9), dante_last (11).
BEATS.push(
  { slate: 0, id: 'tiny_knee' },
  { slate: 2, id: 'ok_suit' },
  { slate: 1, id: 'fam_a' },
  { slate: 3, id: 'ok_ref' },
  { slate: 6, id: 'tiny_truck' },
  { slate: 9, id: 'fam_b' },
);
// These happen early in the week, so they go before that week's fixed beat.
const ARC_EARLY = ['fam_b'];
const ARC_FRAME = new Set(['week_intro', 'week_hub', 'game_pre', 'scout_team']);
const qid = x => (typeof x === 'string' ? x : x && x.id);
// Beats that may slide one week later when a week is already full (e.g. the slump beat landed on it).
const ARC_DEFER = ['ok_ref', 'tiny_truck', 'fam_a', 'ok_suit'];
on('weekStart', () => {
  if (!isY1() || !Array.isArray(S.queue)) return;
  const q = S.queue, a = arcs();
  if (a.carry && a.carry.length) {
    const at = q.findIndex(x => !ARC_FRAME.has(qid(x)) || qid(x) === 'game_pre' || qid(x) === 'scout_team');
    q.splice(at < 0 ? q.length : at, 0, ...a.carry);
    a.carry = [];
  }
  for (const id of ARC_EARLY) {
    const i = q.findIndex(x => qid(x) === id);
    const first = q.findIndex(x => !ARC_FRAME.has(qid(x)));
    if (i > first && first >= 0) { const [it] = q.splice(i, 1); q.splice(first, 0, it); }
  }
  // Keep weeks from feeling overstuffed: at most two story pages. A random event yields to arc beats
  // and goes back in the pool for a later week.
  const count = () => q.filter(x => !ARC_FRAME.has(qid(x))).length;
  while (count() > 2) {
    const j = q.map(qid).lastIndexOf('event');
    if (j < 0) break;
    const [ev] = q.splice(j, 1);
    const k = ev && ev.args && ev.args.e, u = k ? S.used.lastIndexOf(k) : -1;
    if (u >= 0) S.used.splice(u, 1);
    // drawEvent() marked it as seen for the trophy case; undo that if it was marked just now.
    try { const d = trophyData(); if (k && d.events[k] && Date.now() - d.events[k] < 5000) { delete d.events[k]; store.set(TROPHY_KEY, d); } } catch (e) { /* storage blocked */ }
  }
  // Still too full: push one of our own beats to next week (never past the regular season).
  while (count() > 2 && S.slate < 9) {
    const j = q.findIndex(x => ARC_DEFER.includes(qid(x)));
    if (j < 0) break;
    (a.carry = a.carry || []).push(q.splice(j, 1)[0]);
  }
});

// ---------- Results that move the Kingsley rivalry ----------
on('gameEnd', g => {
  if (!isY1() || !g) return;
  if (g.n === 4 || g.n === 9 || g.n === 11) {
    const d = arcs().dante;
    if (d['g' + g.n] != null) return;
    d['g' + g.n] = !!g.won;
    if (g.won) danteAdd(1, 0); else if (d.heat >= 2) danteAdd(0, 1);
  }
});

// ---------- Engine pages, extended ----------
const _arcGamePre = P.game_pre;
P.game_pre = a => {
  const pg = _arcGamePre(a);
  if (!isY1()) return pg;
  const n = S.slate, add = [];
  if (n === 4) add.push(`Across the field, Dante Kingsley is warming up in a crown. An actual crown.${S.flags.trash === 'cake' ? ' Somewhere in the stands, somebody is holding up a poster of your cake.' : ''}`);
  if (n === 7 && arcs().tiny.knee) add.push(kneeTreated() ? `Tiny's knee brace is black, ugly, and roughly the size of a traffic cone. He has named it Nana.` : `Tiny's left knee is taped so thick it looks like a second, smaller Tiny. He catches you looking and shakes his head: *not now.*`);
  if (n === 9) { const l = famFinalePre(); if (l) add.push(l); }
  if (n === 11) add.push({ friend: `During warmups, Kingsley jogs past your sideline and slaps your helmet without breaking stride.`, respect: `During warmups, Kingsley catches your eye from across the field and nods once.`, grudge: `During warmups, Kingsley stands on your logo at midfield and stares at your sideline until a referee moves him.` }[danteState()]);
  if (add.length) { const b = (pg.body || []).slice(); b.splice(Math.max(0, b.length - 1), 0, ...add); pg.body = b; }
  return pg;
};

const ARC_POSTGAME = { 4: ['dante_mid', 'Meet Kingsley at midfield'], 7: ['tiny_deal', 'Find Tiny in the players\' lot'], 9: ['ok_offer', 'Okafor wants to see you'], 11: ['dante_last', 'The handshake line'] };
const _arcFinal = P.g_final;
P.g_final = a => {
  const pg = _arcFinal(a);
  const g = S && S.game;
  if (!isY1() || !g) return pg;
  const add = [];
  if (g.n === 0 && S.flags.dadLot) add.push(`Dad is waiting at the players' exit. He found it from the parking lot. He shakes your hand like you just got promoted.`);
  if (g.n === 9) {
    const ds = danteState(), d = arcs().dante;
    add.push(g.won
      ? (ds === 'grudge' ? `Kingsley skips the handshake line. His podcast goes dark for a week. Tiny calls it "the sound of respect."` : `At midfield, Kingsley finds you again. This time he isn't talking trash. "Okay," he says. "Okay. I see you."`)
      : (ds === 'friend' ? `At midfield, Kingsley pulls you into a hug and talks into your facemask: "Don't you dare get sad. I'll see you again. I can feel it."`
        : ds === 'grudge' ? `Kingsley jogs past you with his helmet off, grinning, two fingers up. ${d.g4 === false ? 'Two games, two wins.' : 'One apiece.'} He doesn't need to say a word.`
        : `Kingsley taps his crown tattoo and points at you on his way off the field. You'll think about that all winter.`));
    const fl = famFinalePost(g.won);
    if (fl) add.push(fl);
  }
  if (add.length) pg.body = (pg.body || []).concat(add);
  const pc = ARC_POSTGAME[g.n];
  if (pc && pg.next != null && P[pc[0]]) {
    pg.next = { id: pc[0], args: { next: pg.next } };
    pg.nextLabel = pc[1];
  }
  return pg;
};

// ---------- Endings and epilogue ----------
const arcNoTitle = () => !S.flags.champion && S.flags.lostRound !== 12;
ENDING_RULES.push(
  { id: 'tree', when: () => isY1() && arcs().ok.leaves === true && arcs().ok.offer === 'take' && S.rel.coach >= 65 && arcNoTitle() },
  { id: 'favorite', when: () => isY1() && arcNoTitle() && S.st.fame >= 70 && S.st.chem >= 65 },
);
CODAS.push(
  () => (isY1() ? okafCoda() : null),
  () => (isY1() ? tinyCoda() : null),
  () => (isY1() ? danteCoda() : null),
  () => (isY1() ? smallCoda() : null),
);
on('ending', () => { if (isY1() && danteState() === 'friend' && (arcs().dante.g4 != null || S.flags.trash)) award('crown'); });

// ---------- Page decoration ----------
// "Tiny will remember that." gets its own quiet callout, on full pages and on inline choice results.
const arcMarkNotes = el => $$('p.note', el).forEach(p => { if (/ will remember that\.$/.test(p.textContent.trim())) p.classList.add('mem'); });
on('result', (args, el) => { if (el) arcMarkNotes(el); });
// Hints for the two new endings in the trophy case (ENDING_HINTS lives in 70-screens.js, so fill it in lazily).
const arcHints = () => {
  if (typeof ENDING_HINTS !== 'object') return;
  if (!ENDING_HINTS.tree) ENDING_HINTS.tree = 'Tell a coach to chase her dream, earn her trust, and finish without a title.';
  if (!ENDING_HINTS.favorite) ENDING_HINTS.favorite = 'Win over the fans and the locker room, but not the trophy.';
};
on('title', arcHints);
on('page', (pg, el, id) => {
  arcHints();
  if (!el) return;
  arcMarkNotes(el);
  if (id === 'ending' && S && isY1() && !el.querySelector('.arc-land')) {
    const html = arcSummaryHTML();
    if (!html) return;
    const mark = el.querySelector('.ending-mark');
    const box = document.createElement('div');
    box.innerHTML = html;
    if (mark) mark.before(box.firstElementChild); else el.querySelector('.story').after(box.firstElementChild);
  }
});

// Test handle (like window.__undrafted): read and tweak arc state from automated tests.
window.__undraftedArcs = { get state() { return S ? arcs() : null; }, danteState: () => (S ? danteState() : null), summary: () => (S ? arcSummary() : []) };
