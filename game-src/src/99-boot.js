// Small hook so automated tests can drive the game.
window.__undrafted = {
  get state() { return S; },
  get screen() { return screen; },
  get miniActive() { return !!(mini && mini.finish && document.querySelector('#mini .mg') && !document.querySelector('#mini .flash')); },
  finishMini(r) { if (mini && mini.finish) mini.finish(r); },
  // Shortcuts for testing a feature without playing up to it.
  debug: {
    start(cfg) {
      S = newState(Object.assign({ first: 'Test', last: 'Player', pos: 'QB', origin: 'town', num: 7 }, cfg || {}));
      emit('newCareer', S, null);
      go('draft');
    },
    week(slate, role) { S.role = role || (S.role === 'camp' ? 'starter' : S.role); S.slate = slate; beginWeek(); },
    go: (id, args) => go(id, args),
    fx: d => fx(d),
    game() { startGame(); },
    miniTest(cfg) {
      // Render one mini-game on a blank page, e.g. miniTest({ type: 'run', diff: 2 }); resolves with the result.
      return new Promise(res => { screen = 'play'; renderPlay(false); showPage({ kicker: 'Test', title: 'Mini-game test', body: [], mini: Object.assign({ diff: 2, onDone: (r, x) => res({ r, x }) }, cfg) }); });
    },
    get MINIGAMES() { return MINIGAMES; },
    get Field() { return Field; },
    setMini, endMini, mgHead,
    get MOMENTS() { return MOMENTS; },
  },
};

// ---------- Boot ----------
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S, screen, trophyBack })); } catch (e) { /* ignore */ } }
function boot(data) {
  if (data && (data.S || data.screen)) {
    S = data.S ? migrate(data.S) : null;
    screen = data.screen || 'title';
    trophyBack = data.trophyBack || 'title';
    if (screen === 'play' && !(S && S.at)) screen = 'title';
  } else { S = loadSave(); screen = 'title'; }
  render();
}
if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot(hot && hot.data);
})();
</script>
</body>
</html>
