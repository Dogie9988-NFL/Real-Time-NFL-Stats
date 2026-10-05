// =========================================================
//   SCREENS
// =========================================================
function contLabel(s) {
  if (s.at && s.at.id === 'ending') return 'Season over';
  if (s.role === 'camp') return s.at && (s.at.id === 'draft' || s.at.id === 'call') ? 'Draft night' : 'Training camp';
  if (s.slate >= 10 && s.flags && s.flags.inPO === false) return 'Season over';
  if (s.slate < 10) return `${(s.year || 1) > 1 ? `Year ${s.year}, ` : ''}Week ${s.slate + 1}, ${s.record.w}-${s.record.l}`;
  return playoffsFor(s.year || 1)[Math.min(s.slate, 12) - 10].round;
}
function renderTitle() {
  const saved = (S && S.at) ? S : loadSave();
  const got = Object.keys(trophyData().got).length;
  const cont = saved ? `<button class="btn btn-primary" id="tContinue" type="button">Continue <small>${esc(saved.first)} ${esc(saved.last)} · ${saved.pos} · ${esc(contLabel(saved))}</small></button>` : '';
  $('#screen').innerHTML = `<div class="wrap">
    <section class="hero">
      <div class="hero-field" aria-hidden="true"></div>
      <div class="yardnums" aria-hidden="true"><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span></div>
      <div class="pylon-mark" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="eyebrow">A football story game</div>
        <h1 class="logo">Undrafted</h1>
        <p class="tagline">257 names got called on draft night. Yours wasn't. Now you have one tryout, one season, and a veteran who wants you gone.</p>
        <div class="hero-actions">
          ${cont}
          <button class="btn ${saved ? 'btn-ghost' : 'btn-primary'}" id="tNew" type="button">Start a new career</button>
          <button class="btn btn-ghost" id="tTrophy" type="button">Trophy case <small>${got}/${TROPHIES.length}</small></button>
        </div>
      </div>
    </section>
    <section class="how">
      <div><h3>Make the calls</h3><p>Every choice moves your stats and your relationships: the coaches, the veteran whose job you want, and the family watching from home.</p></div>
      <div><h3>Play the big moments</h3><p>Game days come down to a few key snaps. Each one is a quick skill game, and better stats make it easier.</p><div class="how-games"><span class="chip">Pass plays</span><span class="chip">Open-field runs</span><span class="chip">Route &amp; catch</span><span class="chip">Pursuit</span><span class="chip">Timing</span><span class="chip">Reaction</span><span class="chip">Moves</span><span class="chip">Reads</span></div></div>
      <div><h3>Write your ending</h3><p>Ten games a season, up to three more in the playoffs, a second season if you earn it, and ${Object.keys(ENDINGS).length} endings. Four positions to try and ${TROPHIES.length} trophies to collect.</p></div>
    </section>
    <p class="foot-note"><span class="kb-only">Number keys pick choices. Space or Enter for timing plays. Arrow keys for moves. </span><span class="touch-only">Tap to choose. Tap and drag in the field games. </span>Your career saves automatically in this browser.</p>
  </div>`;
  if (saved) $('#tContinue').addEventListener('click', () => { Sound.play('click'); S = saved; screen = 'play'; renderPlay(true); updateTopbar(); });
  let armed = false;
  $('#tNew').addEventListener('click', e => {
    Sound.play('click');
    if (saved && !armed) { armed = true; e.currentTarget.innerHTML = 'Replace your saved career? <small>Tap again</small>'; return; }
    newCareer();
  });
  $('#tTrophy').addEventListener('click', () => { Sound.play('click'); showTrophies('title'); });
  emit('title', $('#screen'));
}
function renderSetup() {
  const posKeys = Object.keys(POS), oKeys = Object.keys(ORIGINS);
  $('#screen').innerHTML = `<div class="wrap narrow"><div class="sheet">
    <div class="kicker">Hammerheads rookie intake form</div>
    <h2 class="title">Who Are You?</h2>
    <form id="setupForm" class="form-grid" novalidate>
      <div class="name-row">
        <label><span class="lbl">First name</span><input class="txt" id="fFirst" name="first" maxlength="14" autocomplete="off" spellcheck="false" /></label>
        <label><span class="lbl">Last name</span><input class="txt" id="fLast" name="last" maxlength="16" autocomplete="off" spellcheck="false" /></label>
        <button class="btn btn-plain" id="fRandom" type="button">Random</button>
      </div>
      <fieldset><legend class="lbl">Position</legend><div class="opt-grid">
        ${posKeys.map((k, i) => `<label class="opt"><input type="radio" name="pos" value="${k}"${i === 0 ? ' checked' : ''} /><span class="opt-body"><span class="opt-big">${k}</span><span class="opt-name">${POS[k].name}</span><span class="opt-desc">${POS[k].blurb}</span><span class="opt-tag">${POS[k].games.join(' · ')}</span></span></label>`).join('')}
      </div></fieldset>
      <fieldset><legend class="lbl">Where you're from</legend><div class="opt-grid three">
        ${oKeys.map((k, i) => `<label class="opt"><input type="radio" name="origin" value="${k}"${i === 0 ? ' checked' : ''} /><span class="opt-body"><span class="opt-name">${ORIGINS[k].name}</span><span class="opt-desc">${ORIGINS[k].blurb}</span><span class="opt-tag">${ORIGINS[k].tag}</span></span></label>`).join('')}
      </div></fieldset>
      <fieldset><legend class="lbl">Jersey number</legend><div class="num-row" id="fNum"></div></fieldset>
      <p class="confirm-text" id="fErr" hidden>Give your player a first and last name.</p>
      <div><button class="btn btn-primary" type="submit">Report to camp</button></div>
    </form></div></div>`;
  const form = $('#setupForm');
  const rnd = () => { $('#fFirst').value = pick(FIRST_NAMES); $('#fLast').value = pick(LAST_NAMES); };
  rnd();
  const nums = () => {
    const p = form.querySelector('input[name=pos]:checked').value;
    $('#fNum').innerHTML = POS[p].nums.map((n, i) => `<label class="opt"><input type="radio" name="num" value="${n}"${i === 0 ? ' checked' : ''} /><span class="opt-body">${n}</span></label>`).join('');
  };
  nums();
  $('#fRandom').addEventListener('click', () => { Sound.play('click'); rnd(); });
  emit('setup', form);
  $$('input[name=pos]', form).forEach(r => r.addEventListener('change', nums));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const clean = v => v.replace(/\s+/g, ' ').trim();
    const first = clean($('#fFirst').value), last = clean($('#fLast').value);
    if (!first || !last) { $('#fErr').hidden = false; return; }
    Sound.play('whistle');
    S = newState({
      first, last,
      pos: form.querySelector('input[name=pos]:checked').value,
      origin: form.querySelector('input[name=origin]:checked').value,
      num: +form.querySelector('input[name=num]:checked').value,
    });
    emit('newCareer', S, form);
    go('draft');
  });
}
function renderTrophies() {
  const d = trophyData(), got = d.got;
  $('#screen').innerHTML = `<div class="wrap"><div class="sheet">
    <div class="kicker">Trophy case</div>
    <div class="tr-top"><h2 class="title">${Object.keys(got).length} of ${TROPHIES.length} Unlocked</h2><button class="btn btn-plain" id="trBackTop" type="button">Back</button></div>
    <p style="margin:0 0 16px">Positions that made it through camp: ${['QB', 'RB', 'WR', 'LB'].map(p => `<span class="chip" style="opacity:${d.pos.includes(p) ? 1 : 0.45}">${p}${d.pos.includes(p) ? ' ✓' : ''}</span>`).join(' ')}</p>
    ${endingsHTML(d)}
    <div class="ending-mark">Trophies</div>
    <div class="trophies">${TROPHIES.map(([id, n, desc]) => `<div class="trophy${got[id] ? ' on' : ''}"><span class="ti" aria-hidden="true">${got[id] ? '★' : '?'}</span><div style="min-width:0"><b>${esc(n)}</b><span>${esc(desc)}</span></div></div>`).join('')}</div>
    <div class="choices"><button class="choice primary" id="trBack" type="button" data-k="1"><span class="k">1</span><span class="t">Back</span></button></div>
  </div></div>`;
  const back = () => { Sound.play('click'); if (trophyBack === 'play' && S && S.at) { screen = 'play'; render(); window.scrollTo(0, trophyScroll); } else showTitle(); };
  $('#trBack').addEventListener('click', back);
  $('#trBackTop').addEventListener('click', back);
}
// Hints for endings you haven't found yet. Modules may add ENDING_HINTS[id].
const ENDING_HINTS = {
  legend: 'Win it all and be the best player on the field.', ring: 'Win the Championship as part of the team.',
  close: 'Reach the Championship game.', climb: 'Make the playoffs.', hype: 'Get famous without the locker room behind you.',
  heart: 'Miss the playoffs with a locker room that loves you.', next: 'Every career has to start somewhere.',
};
function endingsHTML(d) {
  const ids = Object.keys(ENDINGS);
  const found = ids.filter(id => d.endings[id]).length;
  return `<div class="ending-mark">Endings found · ${found} of ${ids.length}</div>
    <div class="endings-grid">${ids.map(id => d.endings[id]
      ? `<div class="end-card on"><b>${esc(ENDINGS[id].title)}</b></div>`
      : `<div class="end-card"><b>???</b><span>${esc(ENDING_HINTS[id] || 'Keep playing to find this one.')}</span></div>`).join('')}</div>`;
}
function showTitle() { stopMini(); screen = 'title'; render(); }
let trophyScroll = 0;
function showTrophies(from) { stopMini(); trophyBack = from || 'title'; trophyScroll = window.scrollY; screen = 'trophies'; render(); window.scrollTo(0, 0); }
// The old save is only replaced when the new player is actually created (setup form submit).
function newCareer() { stopMini(); screen = 'setup'; render(); window.scrollTo(0, 0); }

function openMenu() {
  if ($('#menu') || screen !== 'play') return;
  if (mini) { stopMini(); menuKilledMini = true; }
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.id = 'menu';
  ov.innerHTML = `<div class="sheet menu" role="dialog" aria-modal="true" aria-labelledby="menuTitle">
    <div class="kicker">Timeout</div><h2 class="title" id="menuTitle">Menu</h2>
    <button class="btn btn-primary" type="button" data-m="resume">Resume</button>
    <button class="btn btn-plain" type="button" data-m="trophies">Trophy case</button>
    <button class="btn btn-plain" type="button" data-m="title">Title screen</button>
    <button class="btn btn-plain" type="button" data-m="restart">Start a new career</button>
    <p class="confirm-text" hidden>This erases your current career. Tap again to confirm.</p></div>`;
  document.body.appendChild(ov);
  let armed = false;
  ov.addEventListener('click', e => {
    if (e.target === ov) return closeMenu();
    const b = e.target.closest('[data-m]');
    if (!b) return;
    Sound.play('click');
    const m = b.dataset.m;
    if (m === 'resume') closeMenu();
    if (m === 'trophies') { closeMenu(true); showTrophies('play'); }
    if (m === 'title') { closeMenu(true); showTitle(); }
    if (m === 'restart') {
      if (!armed) { armed = true; ov.querySelector('.confirm-text').hidden = false; return; }
      closeMenu(true); newCareer();
    }
  });
  ov.querySelector('[data-m=resume]').focus();
}
function closeMenu(silent) {
  const ov = $('#menu');
  if (ov) ov.remove();
  if (menuKilledMini) { menuKilledMini = false; if (!silent && screen === 'play' && S && S.at) renderPlay(false); }
}

function render() {
  closeMenu(true);
  if (screen === 'play' && S && S.at) renderPlay(false);
  else if (screen === 'setup') renderSetup();
  else if (screen === 'trophies') renderTrophies();
  else { screen = 'title'; renderTitle(); }
  updateTopbar();
}

// ---------- Global controls ----------
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ($('#menu')) { if (e.key === 'Escape') closeMenu(); return; }
  if (e.key === 'Escape' && screen === 'play') { openMenu(); return; }
  if (mini && mini.key) { if (mini.key(e)) e.preventDefault(); return; }
  if (e.repeat) return; // holding a key must not race through pages
  if (screen !== 'play' && screen !== 'trophies') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) {
    const b = $$('[data-k]:not([disabled])', $('#screen')).find(x => x.dataset.k === String(n));
    if (b) { e.preventDefault(); b.click(); }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && (!document.activeElement || document.activeElement === document.body)) {
    const ch = $$('#choices .choice');
    if (ch.length === 1) { e.preventDefault(); ch[0].click(); }
  }
});
$('#soundBtn').addEventListener('click', e => {
  const on = Sound.toggle();
  e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  Sound.play('click');
});
$('#soundBtn').textContent = Sound.on ? 'Sound on' : 'Sound off';
$('#soundBtn').setAttribute('aria-pressed', String(Sound.on));
$('#menuBtn').addEventListener('click', () => { Sound.play('click'); openMenu(); });
$('#brandBtn').addEventListener('click', () => { Sound.play('click'); showTitle(); });

