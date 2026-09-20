const app = document.getElementById('app');
const subtitle = document.getElementById('subtitle');
const searchBox = document.getElementById('search');
const conferenceFilter = document.getElementById('conferenceFilter');
const tabs = document.querySelectorAll('#mainTabs button');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const generatedAtEl = document.getElementById('generatedAt');
const swatchesEl = document.getElementById('swatches');
const liveSection = document.getElementById('liveSection');
const liveStrip = document.getElementById('liveStrip');
const liveHeadingDot = document.getElementById('liveHeadingDot');
const liveHeadingText = document.getElementById('liveHeadingText');

const statsView = document.getElementById('statsView');
const fantasyView = document.getElementById('fantasyView');
const fantasySubtitle = document.getElementById('fantasySubtitle');
const fantasyLeagueTabs = document.querySelectorAll('#fantasyLeagueTabs button');
const fantasyModeTabs = document.querySelectorAll('#fantasyModeTabs button');
const fantasyBoardsEl = document.getElementById('fantasyBoards');
const fantasyLiveEl = document.getElementById('fantasyLive');
const fantasyTradeEl = document.getElementById('fantasyTrade');
const tradeVerdictEl = document.getElementById('tradeVerdict');
const fantasyWeekEl = document.getElementById('fantasyWeek');
const fantasyWeekBoardsEl = document.getElementById('fantasyWeekBoards');
const weekSelectorEl = document.getElementById('weekSelector');
const fantasyPredictionsEl = document.getElementById('fantasyPredictions');
const fantasyPredictionsBodyEl = document.getElementById('fantasyPredictionsBody');
const fantasyMyTeamEl = document.getElementById('fantasyMyTeam');
const myTeamNoteEl = document.getElementById('myTeamNote');
const myTeamSuggestionsEl = document.getElementById('myTeamSuggestions');
const tradeSettingsBtn = document.getElementById('tradeSettingsBtn');
const tradeSettingsPanel = document.getElementById('tradeSettingsPanel');
const tradeSettingsSummaryEl = document.getElementById('tradeSettingsSummary');

const THEMES = [
  { id: 'green', name: 'Matrix Green', accent: '#39ff8a', accentDim: '#1f8f56', accent2: '#4fd8ff' },
  { id: 'cyan', name: 'Cyber Cyan', accent: '#4fe1ff', accentDim: '#1f7f96', accent2: '#39ff8a' },
  { id: 'magenta', name: 'Hot Magenta', accent: '#ff4fd8', accentDim: '#96286f', accent2: '#4fd8ff' },
  { id: 'amber', name: 'Amber', accent: '#ffb84f', accentDim: '#96702f', accent2: '#4fd8ff' },
  { id: 'violet', name: 'Ultraviolet', accent: '#b84fff', accentDim: '#6b2f96', accent2: '#4fd8ff' },
  { id: 'red', name: 'Blood Red', accent: '#ff4f5f', accentDim: '#962f38', accent2: '#4fd8ff' },
];
const THEME_KEY = 'statLeadersAccentTheme';

function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-dim', theme.accentDim);
  root.setProperty('--accent-2', theme.accent2);
  document.querySelectorAll('.swatch').forEach((el) => {
    el.classList.toggle('active', el.dataset.themeId === theme.id);
  });
}

function loadSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function saveTheme(id) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* private browsing / storage blocked - theme just won't persist */
  }
}

function initThemePicker() {
  const savedId = loadSavedTheme();
  const initial = THEMES.find((t) => t.id === savedId) || THEMES[0];
  applyTheme(initial);

  for (const theme of THEMES) {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.type = 'button';
    btn.dataset.themeId = theme.id;
    btn.title = theme.name;
    btn.style.background = theme.accent;
    btn.addEventListener('click', () => {
      applyTheme(theme);
      saveTheme(theme.id);
    });
    swatchesEl.appendChild(btn);
  }
  applyTheme(initial);
}

let manifest = null;
let currentLeague = 'nfl';
let liveData = null;
const cache = {}; // league -> { boardId -> data }

const STATE_ORDER = { in: 0, pre: 1, post: 2 };

function renderLiveCard(game) {
  const away = game.competitors.find((c) => c.homeAway === 'away') || game.competitors[0];
  const home = game.competitors.find((c) => c.homeAway === 'home') || game.competitors[1];

  const card = document.createElement('div');
  card.className = `live-card state-${game.state}`;

  const status = document.createElement('div');
  status.className = 'live-status';
  status.innerHTML = game.state === 'in' ? `<span class="live-dot"></span>${game.statusDetail}` : game.statusDetail;
  card.appendChild(status);

  const matchup = document.createElement('div');
  matchup.className = 'live-matchup';
  for (const team of [away, home]) {
    const row = document.createElement('div');
    row.className = `live-team${team.winner ? ' win' : ''}`;
    row.innerHTML = `<span>${team.team}</span><span class="live-score">${game.state === 'pre' ? '' : team.score}</span>`;
    matchup.appendChild(row);
  }
  card.appendChild(matchup);

  if (game.leaders && game.leaders.length) {
    const leaders = document.createElement('div');
    leaders.className = 'live-leaders';
    for (const l of game.leaders) {
      const row = document.createElement('div');
      row.className = 'live-leader';
      const abbr = { Passing: 'PASS', Rushing: 'RUSH', Receiving: 'REC' }[l.category] || l.category.toUpperCase();
      row.innerHTML = `<span class="ll-cat">${abbr}</span> ${l.name} <span class="ll-team">${l.team}</span><br><span class="ll-val">${l.displayValue}</span>`;
      leaders.appendChild(row);
    }
    card.appendChild(leaders);
  }

  return card;
}

function renderLive() {
  if (!liveData) return;
  const games = (liveData[currentLeague] || []).slice().sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  liveStrip.innerHTML = '';
  if (games.length === 0) {
    liveSection.hidden = true;
    return;
  }
  liveSection.hidden = false;
  const anyLive = games.some((g) => g.state === 'in');
  liveHeadingDot.style.display = anyLive ? '' : 'none';
  liveHeadingText.textContent = anyLive ? 'Live Now' : "Today's Games";
  for (const game of games) liveStrip.appendChild(renderLiveCard(game));
}

async function loadLive() {
  try {
    const res = await fetch(`data/live.json?t=${Date.now()}`);
    liveData = await res.json();
    renderLive();
  } catch (e) {
    console.error('live data failed to load', e);
  }
}

function fmt(n) {
  return Number(n).toLocaleString('en-US');
}

async function loadLeague(league) {
  if (cache[league]) return cache[league];
  const meta = manifest.leagues[league];
  const results = await Promise.all(
    meta.categories.map((c) =>
      fetch(`data/${league}/${c.id}.json`)
        .then((r) => r.json())
        .catch(() => ({ id: c.id, label: c.label, section: c.section, available: false, players: [] }))
    )
  );
  const byId = {};
  for (const board of results) byId[board.id] = board;
  cache[league] = byId;
  return byId;
}

function playersForBoard(board, conference) {
  let players = board.players || [];
  if (conference && board.league === 'cfb') {
    players = players.filter((p) => p.conference === conference);
    players = players.map((p, i) => ({ ...p, rank: i + 1 }));
  }
  return players;
}

// Returns null when this board should be hidden entirely for the given query.
function renderBoard(board, conference, query) {
  const labelMatch = !query || board.label.toLowerCase().includes(query);

  if (!board.available) {
    if (query && !labelMatch) return null;
    const div = document.createElement('div');
    div.className = 'board';
    const h3 = document.createElement('h3');
    h3.textContent = board.label;
    div.appendChild(h3);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = 'Not available';
    div.appendChild(meta);
    const p = document.createElement('div');
    p.className = 'unavailable';
    p.textContent = board.reason || 'Data not available from any free public source.';
    div.appendChild(p);
    return div;
  }

  const players = playersForBoard(board, conference);
  const matchIndex = query ? players.findIndex((p) => p.name.toLowerCase().includes(query)) : -1;

  if (query && !labelMatch && matchIndex === -1) return null;

  const div = document.createElement('div');
  div.className = 'board';
  const h3 = document.createElement('h3');
  h3.textContent = board.label;
  div.appendChild(h3);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${board.seasonLabel || 'Season'} ${board.season || ''}`;
  div.appendChild(meta);

  if (players.length === 0) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'No qualifying players yet this season.';
    div.appendChild(p);
    return div;
  }

  // A player match outside the top 5 forces this board open to top 50 so it's visible.
  let expanded = matchIndex >= 5;
  const list = document.createElement('ol');
  div.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    const shown = expanded ? players.slice(0, 50) : players.slice(0, 5);
    for (const p of shown) {
      const li = document.createElement('li');
      const isMatch = query && p.name.toLowerCase().includes(query);
      li.className = [p.rank === 1 ? 'rank-first' : '', isMatch ? 'match' : ''].filter(Boolean).join(' ');
      li.innerHTML = `
        <span class="rank">${p.rank}</span>
        <span class="player-name">${p.name}<span class="player-team">${p.team ? ' ' + p.team : ''}${p.position ? ' · ' + p.position : ''}</span></span>
        <span class="value">${fmt(p.value)}</span>
      `;
      list.appendChild(li);
    }
  }
  renderList();

  if (players.length > 5) {
    const btn = document.createElement('button');
    btn.className = 'show-all';
    btn.textContent = expanded ? 'Show top 5' : 'Show all (top 50)';
    btn.addEventListener('click', () => {
      expanded = !expanded;
      btn.textContent = expanded ? 'Show top 5' : 'Show all (top 50)';
      renderList();
    });
    div.appendChild(btn);
  }

  return div;
}

function render() {
  const league = currentLeague;
  const boards = cache[league];
  if (!boards) return;

  const meta = manifest.leagues[league];
  subtitle.textContent = `${league === 'nfl' ? 'NFL' : 'College Football (Power 4 + Notre Dame)'} — ${meta.seasonLabel} ${meta.season}`;

  app.innerHTML = '';

  const sections = [
    { key: 'overall', label: 'Whole League' },
    { key: 'position', label: 'By Position' },
  ];

  const conference = league === 'cfb' ? conferenceFilter.value : '';
  const query = searchBox.value.trim().toLowerCase();

  for (const section of sections) {
    const ids = meta.categories.filter((c) => c.section === section.key).map((c) => c.id);
    if (ids.length === 0) continue;

    const grid = document.createElement('div');
    grid.className = 'board-grid';
    for (const id of ids) {
      const board = boards[id];
      if (!board) continue;
      const el = renderBoard(board, conference, query);
      if (el) grid.appendChild(el);
    }
    if (grid.children.length === 0) continue;

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = section.label;
    app.appendChild(heading);
    app.appendChild(grid);
  }

  if (!app.children.length) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = `No categories or players match "${searchBox.value.trim()}".`;
    app.appendChild(p);
  }
}

async function switchStatsLeague(league) {
  currentLeague = league;
  conferenceFilter.style.display = league === 'cfb' ? '' : 'none';
  subtitle.textContent = 'Loading data…';
  await loadLeague(league);
  render();
  renderLive();
}

function switchMainView(view) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.league === view));
  if (view === 'fantasy') {
    statsView.hidden = true;
    fantasyView.hidden = false;
    subtitle.textContent = 'Fantasy leaderboards, live scoring, and a trade calculator';
    initFantasyIfNeeded();
  } else {
    fantasyView.hidden = true;
    statsView.hidden = false;
    switchStatsLeague(view);
  }
}

tabs.forEach((t) => t.addEventListener('click', () => switchMainView(t.dataset.league)));
searchBox.addEventListener('input', render);
conferenceFilter.addEventListener('change', render);
settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});
initThemePicker();

// ---------------------------------------------------------------------
// Fantasy: season leaderboards, week leaders, live in-game scoring, and a
// trade calculator. Reuses the same .board/.board-grid presentation as the
// real stat leaderboards - it's the same shape of data (ranked players + a
// value), just fantasy points instead of a raw stat.
// ---------------------------------------------------------------------

let fantasyManifest = null;
let currentFantasyLeague = 'nfl';
let currentFantasyMode = 'leaderboards';
let liveFantasyData = null;
let fantasyLiveIntervalStarted = false;
const fantasyCache = {}; // league -> { boardId -> board }
const tradeIndex = { nfl: [], cfb: [] }; // league -> flat searchable player list
const tradeSides = { a: [], b: [] }; // side -> array of player entries from tradeIndex

async function initFantasyIfNeeded() {
  if (!fantasyManifest) {
    fantasySubtitle.textContent = 'Loading fantasy data…';
    try {
      const res = await fetch(`data/fantasy/manifest.json?t=${Date.now()}`);
      fantasyManifest = await res.json();
    } catch (e) {
      fantasySubtitle.textContent = 'Failed to load fantasy data.';
      console.error(e);
      return;
    }
  }
  await switchFantasyLeague(currentFantasyLeague);
  if (!fantasyLiveIntervalStarted) {
    fantasyLiveIntervalStarted = true;
    loadLiveFantasy();
    setInterval(loadLiveFantasy, 30000);
  }
}

async function loadFantasyBoards(league) {
  if (fantasyCache[league]) return fantasyCache[league];
  const meta = fantasyManifest.leagues[league];
  const results = await Promise.all(
    meta.categories.map((c) =>
      fetch(`data/fantasy/${league}/${c.id}.json`)
        .then((r) => r.json())
        .catch(() => ({ id: c.id, label: c.label, players: [] }))
    )
  );
  const byId = {};
  for (const board of results) byId[board.id] = board;
  fantasyCache[league] = byId;
  return byId;
}

function buildTradeIndex(league) {
  const boards = fantasyCache[league];
  if (!boards) return;
  const primaryId = league === 'nfl' ? 'all' : 'off';
  const extraIds = league === 'nfl' ? ['def', 'k'] : ['def'];
  const seen = new Set();
  const list = [];
  for (const id of [primaryId, ...extraIds]) {
    const board = boards[id];
    if (!board) continue;
    for (const p of board.players || []) {
      const key = `${p.name}|${p.team}|${p.position}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(p);
    }
  }
  tradeIndex[league] = list;
}

async function switchFantasyLeague(league) {
  currentFantasyLeague = league;
  fantasyLeagueTabs.forEach((t) => t.classList.toggle('active', t.dataset.flg === league));
  fantasySubtitle.textContent = 'Loading fantasy data…';
  await Promise.all([loadFantasyBoards(league), loadTeamInfo(league), loadNews()]);
  buildTradeIndex(league);
  const meta = fantasyManifest.leagues[league];
  fantasySubtitle.textContent =
    league === 'nfl'
      ? `NFL Fantasy — ${meta.format} — ${meta.seasonLabel} ${meta.season}`
      : `College Football Fantasy (Power 4 + Notre Dame) — ${meta.format}`;
  renderFantasyMode();
}

function renderFantasyMode() {
  fantasyBoardsEl.hidden = currentFantasyMode !== 'leaderboards';
  fantasyWeekEl.hidden = currentFantasyMode !== 'week';
  fantasyLiveEl.hidden = currentFantasyMode !== 'live';
  fantasyPredictionsEl.hidden = currentFantasyMode !== 'predictions';
  fantasyMyTeamEl.hidden = currentFantasyMode !== 'myteam';
  fantasyTradeEl.hidden = currentFantasyMode !== 'trade';
  if (currentFantasyMode === 'leaderboards') renderFantasyBoards();
  if (currentFantasyMode === 'week') renderFantasyWeek();
  if (currentFantasyMode === 'live') renderFantasyLive();
  if (currentFantasyMode === 'predictions') renderFantasyPredictions();
  if (currentFantasyMode === 'myteam') {
    renderMyTeamSide('mine');
    renderMyTeamSide('fa');
    ensureMyTeamDataLoaded(currentFantasyLeague);
  }
  if (currentFantasyMode === 'trade') {
    refreshTradeUI();
  }
}

fantasyLeagueTabs.forEach((t) => t.addEventListener('click', () => switchFantasyLeague(t.dataset.flg)));
fantasyModeTabs.forEach((t) =>
  t.addEventListener('click', () => {
    currentFantasyMode = t.dataset.fmode;
    fantasyModeTabs.forEach((b) => b.classList.toggle('active', b === t));
    renderFantasyMode();
  })
);

function fantasyPlayerTag(p) {
  // Conference is deliberately left out here (team + position is what the
  // real stat leaderboards already show, and it keeps long names from
  // truncating in the fixed-width board cards).
  const parts = [];
  if (p.team && p.team !== p.name) parts.push(p.team);
  if (p.position) parts.push(p.position);
  if (p.opponent) parts.push(`${p.isHome ? 'vs' : '@'} ${p.opponent}`);
  return parts.join(' · ');
}

function renderFantasyBoard(board) {
  const div = document.createElement('div');
  div.className = 'board';
  const h3 = document.createElement('h3');
  h3.textContent = board.label;
  div.appendChild(h3);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = board.format || '';
  div.appendChild(meta);

  const players = board.players || [];
  if (players.length === 0) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'No qualifying players yet this season.';
    div.appendChild(p);
    return div;
  }

  let expanded = false;
  const list = document.createElement('ol');
  div.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    const shown = expanded ? players.slice(0, 50) : players.slice(0, 5);
    for (const p of shown) {
      const li = document.createElement('li');
      li.className = p.rank === 1 ? 'rank-first' : '';
      const tag = fantasyPlayerTag(p);
      li.innerHTML = `
        <span class="rank">${p.rank}</span>
        <span class="player-name">${p.name}<span class="player-team">${tag ? ' ' + tag : ''}</span></span>
        <span class="value">${p.points.toFixed(2)}</span>
      `;
      list.appendChild(li);
    }
  }
  renderList();

  if (players.length > 5) {
    const btn = document.createElement('button');
    btn.className = 'show-all';
    btn.textContent = 'Show all (top 50)';
    btn.addEventListener('click', () => {
      expanded = !expanded;
      btn.textContent = expanded ? 'Show top 5' : 'Show all (top 50)';
      renderList();
    });
    div.appendChild(btn);
  }

  return div;
}

function renderFantasyBoards() {
  const league = currentFantasyLeague;
  const boards = fantasyCache[league];
  fantasyBoardsEl.innerHTML = '';
  if (!boards || !fantasyManifest) return;
  const meta = fantasyManifest.leagues[league];
  const grid = document.createElement('div');
  grid.className = 'board-grid';
  for (const c of meta.categories) {
    const board = boards[c.id];
    if (!board) continue;
    grid.appendChild(renderFantasyBoard(board));
  }
  fantasyBoardsEl.appendChild(grid);
}

// --- Week Leaders ---
// Same board shape/rendering as the season leaderboards, just scored from
// one week's games instead of the whole season - reuses renderFantasyBoard
// by wrapping each week's raw ranked array with the label that board would
// have on the season view.

const NFL_WEEK_LABELS = { all: 'All Players', qb: 'All QB', rb: 'All RB', wr: 'All WR', te: 'All TE', def: 'All DEF', k: 'All Kicker' };
const CFB_WEEK_LABELS = { off: 'All Offense', qb: 'All QB', rb: 'All RB', wr: 'All WR', te: 'All TE', def: 'All Defense (IDP)' };

const weekManifestCache = { nfl: null, cfb: null };
const weekBoardCache = { nfl: {}, cfb: {} };
const selectedWeek = { nfl: null, cfb: null };

async function loadWeekManifest(league) {
  if (weekManifestCache[league]) return weekManifestCache[league];
  try {
    const res = await fetch(`data/fantasy/${league}/weeks/manifest.json?t=${Date.now()}`);
    weekManifestCache[league] = await res.json();
  } catch (e) {
    console.error('week manifest failed to load', e);
    weekManifestCache[league] = { currentWeek: null, weeks: [] };
  }
  return weekManifestCache[league];
}

async function loadWeekBoard(league, week) {
  if (weekBoardCache[league][week]) return weekBoardCache[league][week];
  const res = await fetch(`data/fantasy/${league}/weeks/week-${week}.json?t=${Date.now()}`);
  const data = await res.json();
  weekBoardCache[league][week] = data;
  return data;
}

async function renderFantasyWeek() {
  const league = currentFantasyLeague;
  const manifest = await loadWeekManifest(league);
  if (!manifest.weeks || manifest.weeks.length === 0) {
    fantasyWeekBoardsEl.innerHTML = '';
    weekSelectorEl.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'No week data yet this season.';
    fantasyWeekBoardsEl.appendChild(p);
    return;
  }
  if (!selectedWeek[league]) selectedWeek[league] = manifest.weeks[manifest.weeks.length - 1];

  weekSelectorEl.innerHTML = '';
  for (const w of manifest.weeks) {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = `Week ${w}`;
    if (w === selectedWeek[league]) opt.selected = true;
    weekSelectorEl.appendChild(opt);
  }

  fantasyWeekBoardsEl.innerHTML = '<div class="empty">Loading week…</div>';
  const weekData = await loadWeekBoard(league, selectedWeek[league]);
  fantasyWeekBoardsEl.innerHTML = '';

  const labels = league === 'nfl' ? NFL_WEEK_LABELS : CFB_WEEK_LABELS;
  const grid = document.createElement('div');
  grid.className = 'board-grid';
  for (const [id, label] of Object.entries(labels)) {
    const players = (weekData.boards && weekData.boards[id]) || [];
    grid.appendChild(renderFantasyBoard({ label, format: `Week ${weekData.week}${weekData.allFinal ? '' : ' (in progress)'}`, players }));
  }
  fantasyWeekBoardsEl.appendChild(grid);
}

weekSelectorEl.addEventListener('change', () => {
  selectedWeek[currentFantasyLeague] = Number(weekSelectorEl.value);
  renderFantasyWeek();
});

// --- Predictions: upcoming game picks + predicted stat leaders ---

const predictionsCache = { nfl: null, cfb: null };

async function loadPredictions(league) {
  if (predictionsCache[league]) return predictionsCache[league];
  try {
    const [statsRes, gamesRes] = await Promise.all([
      fetch(`data/predictions/${league}/stat-leaders.json?t=${Date.now()}`),
      fetch(`data/predictions/${league}/games.json?t=${Date.now()}`),
    ]);
    predictionsCache[league] = { stats: await statsRes.json(), games: await gamesRes.json() };
  } catch (e) {
    console.error('predictions failed to load', e);
    predictionsCache[league] = null;
  }
  return predictionsCache[league];
}

function renderGamePredictionCard(g) {
  const card = document.createElement('div');
  card.className = 'board game-pick-card';
  const h3 = document.createElement('h3');
  h3.textContent = g.name;
  card.appendChild(h3);
  if (g.predictedWinner) {
    card.innerHTML += `
      <div class="game-pick-winner">Pick: ${g.predictedWinner}<span class="game-pick-margin"> (by ~${g.margin} net pts)</span></div>
      <div class="game-pick-ratings">
        <span>${g.away}: ${g.awayNetRating > 0 ? '+' : ''}${g.awayNetRating}</span>
        <span>${g.home}: ${g.homeNetRating > 0 ? '+' : ''}${g.homeNetRating}</span>
      </div>
    `;
  } else {
    card.innerHTML += `<div class="empty">Not enough season data yet to pick this one.</div>`;
  }
  return card;
}

async function renderFantasyPredictions() {
  const league = currentFantasyLeague;
  fantasyPredictionsBodyEl.innerHTML = '<div class="empty">Loading predictions…</div>';
  const data = await loadPredictions(league);
  fantasyPredictionsBodyEl.innerHTML = '';
  if (!data) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Prediction data not available yet.';
    fantasyPredictionsBodyEl.appendChild(p);
    return;
  }

  const gamesHeading = document.createElement('div');
  gamesHeading.className = 'section-heading';
  gamesHeading.textContent = `Predicted Game Winners — Week ${data.games.week}`;
  fantasyPredictionsBodyEl.appendChild(gamesHeading);

  const games = data.games.games || [];
  if (games.length === 0) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = "All of this week's games are already underway or finished — check Live or Week Leaders.";
    fantasyPredictionsBodyEl.appendChild(p);
  } else {
    const gameGrid = document.createElement('div');
    gameGrid.className = 'board-grid';
    for (const g of games) gameGrid.appendChild(renderGamePredictionCard(g));
    fantasyPredictionsBodyEl.appendChild(gameGrid);
  }

  const statsHeading = document.createElement('div');
  statsHeading.className = 'section-heading';
  statsHeading.textContent = `Predicted Stat Leaders — Week ${data.stats.week}`;
  fantasyPredictionsBodyEl.appendChild(statsHeading);

  const labels = league === 'nfl' ? NFL_WEEK_LABELS : CFB_WEEK_LABELS;
  const anyBoardHasPlayers = Object.values(data.stats.boards || {}).some((arr) => arr.length > 0);
  if (!anyBoardHasPlayers) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'No players with an upcoming game to predict right now.';
    fantasyPredictionsBodyEl.appendChild(p);
    return;
  }
  const statGrid = document.createElement('div');
  statGrid.className = 'board-grid';
  for (const [id, label] of Object.entries(labels)) {
    const players = (data.stats.boards && data.stats.boards[id]) || [];
    statGrid.appendChild(renderFantasyBoard({ label, format: 'Predicted, not actual', players }));
  }
  fantasyPredictionsBodyEl.appendChild(statGrid);
}

// --- Trade calculator data: team schedules/SOS and player news ---

const teamInfoCache = { nfl: null, cfb: null };
let newsCache = null;

async function loadTeamInfo(league) {
  if (teamInfoCache[league]) return teamInfoCache[league];
  try {
    const res = await fetch(`data/fantasy/${league}/team-info.json?t=${Date.now()}`);
    teamInfoCache[league] = await res.json();
  } catch {
    teamInfoCache[league] = {};
  }
  return teamInfoCache[league];
}

async function loadNews() {
  if (newsCache) return newsCache;
  try {
    const res = await fetch(`data/fantasy/news.json?t=${Date.now()}`);
    newsCache = await res.json();
  } catch {
    newsCache = {};
  }
  return newsCache;
}

async function loadLiveFantasy() {
  try {
    const res = await fetch(`data/live-fantasy.json?t=${Date.now()}`);
    liveFantasyData = await res.json();
    if (currentFantasyMode === 'live' && !fantasyView.hidden) renderFantasyLive();
  } catch (e) {
    console.error('live fantasy data failed to load', e);
  }
}

function renderLiveFantasyList(players, opts = {}) {
  const board = document.createElement('div');
  board.className = 'board fantasy-live-board';
  const list = document.createElement('ol');
  players.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = i === 0 ? 'rank-first' : '';
    const tag = opts.showTeam === false ? p.gameStatus : `${p.team} · ${p.gameStatus}`;
    li.innerHTML = `
      <span class="rank">${i + 1}</span>
      <span class="player-name">${p.name}<span class="player-team"> ${tag}</span></span>
      <span class="value">${p.points.toFixed(2)}</span>
    `;
    list.appendChild(li);
  });
  board.appendChild(list);
  return board;
}

function renderFantasyLive() {
  fantasyLiveEl.innerHTML = '';
  if (!liveFantasyData) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Loading live fantasy data…';
    fantasyLiveEl.appendChild(p);
    return;
  }
  const league = currentFantasyLeague;
  const data = liveFantasyData[league] || {};
  const gameCount = (liveFantasyData.liveGameCount && liveFantasyData.liveGameCount[league]) || 0;

  const heading = document.createElement('div');
  heading.className = 'section-heading live-heading';
  const dot = document.createElement('span');
  dot.className = 'live-dot';
  dot.style.display = gameCount > 0 ? '' : 'none';
  heading.appendChild(dot);
  const text = document.createElement('span');
  text.textContent =
    gameCount > 0 ? `Live Fantasy — ${gameCount} game${gameCount === 1 ? '' : 's'} in progress` : 'No games in progress right now';
  heading.appendChild(text);
  fantasyLiveEl.appendChild(heading);

  const performers = data.topPerformers || [];
  if (performers.length === 0) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'No live fantasy performances yet. Check back once games kick off.';
    fantasyLiveEl.appendChild(p);
    return;
  }
  fantasyLiveEl.appendChild(renderLiveFantasyList(performers));

  if (league === 'nfl' && data.teamDefLive && data.teamDefLive.length) {
    const dstHeading = document.createElement('div');
    dstHeading.className = 'section-heading';
    dstHeading.textContent = 'Team Defense (Live)';
    fantasyLiveEl.appendChild(dstHeading);
    fantasyLiveEl.appendChild(renderLiveFantasyList(data.teamDefLive, { showTeam: false }));
  }
}

// --- Trade calculator ---

function tradeSideTag(p) {
  return fantasyPlayerTag(p);
}

// League Settings: lets a player's trade value be recomputed live from
// their real raw stat line (p.stats, from generate-fantasy.js) under a
// different scoring format, instead of being stuck with whatever one
// fixed format the season boards were generated with.
const TRADE_SETTINGS_KEY = 'tradeCalcSettings';
let tradeSettings = { type: 'redraft', scoring: 'full', qbFormat: '1qb' };

function loadTradeSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRADE_SETTINGS_KEY));
    if (saved) tradeSettings = { ...tradeSettings, ...saved };
  } catch {
    /* private browsing / storage blocked - falls back to the defaults above */
  }
}

function saveTradeSettings() {
  try {
    localStorage.setItem(TRADE_SETTINGS_KEY, JSON.stringify(tradeSettings));
  } catch {
    /* private browsing / storage blocked - setting just won't persist */
  }
}

const PPR_VALUES = { non: 0, half: 0.5, full: 1, tep: 1 };
const QB_FORMAT_MULTIPLIERS = { '1qb': 1, '2qb': 1.35, sf: 1.5 };
const QB_FORMAT_LABELS = { '1qb': '1QB', '2qb': '2QB', sf: 'Superflex' };
const SCORING_LABELS = { non: 'Non-PPR', half: 'Half PPR', full: 'Full PPR', tep: 'TEP' };

// Same shape as nflOffensePoints/cfbOffensePoints in fantasy-scoring.js,
// parameterized by the chosen PPR value instead of a fixed one - every
// field defaults to 0 via `|| 0`, so it works whether `stats` came from
// the NFL pool (has fumbles-lost/return-TD fields) or the CFB pool
// (doesn't - see the site's documented CFB data gaps).
function recomputeOffenseSeasonPoints(stats, position, scoring) {
  const ppr = PPR_VALUES[scoring] ?? PPR_VALUES.full;
  const teBonus = scoring === 'tep' && position === 'TE' ? 0.5 : 0;
  return (
    (stats.passingYards || 0) * 0.04 +
    (stats.passingTouchdowns || 0) * 4 +
    (stats.interceptions || 0) * -2 +
    (stats.rushingYards || 0) * 0.1 +
    (stats.rushingTouchdowns || 0) * 6 +
    (stats.rushingFumblesLost || 0) * -2 +
    (stats.receivingYards || 0) * 0.1 +
    (stats.receivingTouchdowns || 0) * 6 +
    (stats.receptions || 0) * (ppr + teBonus) +
    (stats.receivingFumblesLost || 0) * -2 +
    (stats.kickReturnTouchdowns || 0) * 6 +
    (stats.puntReturnTouchdowns || 0) * 6
  );
}

// The season-total value under the current League Settings - QB format's
// scarcity multiplier included, PPR/TEP recompute included, but NOT the
// Redraft PPG divide (see effectivePoints) so callers needing a stable
// season-scale number (e.g. the PPG/rest-of-season detail line) aren't
// affected by the Redraft/Dynasty toggle.
function seasonPointsFor(p, settings) {
  if (!p.stats) return p.points; // K / team DEF / CFB IDP - not PPR-sensitive, settings don't apply
  let pts = recomputeOffenseSeasonPoints(p.stats, p.position, settings.scoring);
  if (p.position === 'QB') pts *= QB_FORMAT_MULTIPLIERS[settings.qbFormat] ?? 1;
  return pts;
}

// The number actually shown/summed for trading: Dynasty is the season
// total above; Redraft is points-per-game wherever we have games-played
// data (see the trade calculator's own callout note for who doesn't).
function effectivePoints(p, settings) {
  const season = seasonPointsFor(p, settings);
  if (settings.type === 'redraft' && p.gamesPlayed) return season / p.gamesPlayed;
  return season;
}

function pointsUnitLabel(p, settings) {
  return settings.type === 'redraft' && p.gamesPlayed ? 'pts/gm' : 'pts';
}

// Points-per-game, a rest-of-season estimate, a schedule-strength badge,
// and any ESPN news matched to this player - everything beyond the headline
// trade value that the trade calculator shows for a player once added to a
// side. Always at season pace under the current scoring format, regardless
// of the Redraft/Dynasty toggle (see the League Settings note in the UI).
function renderPlayerDetail(p, league, opts = {}) {
  const statParts = [];
  const gp = p.gamesPlayed;
  const seasonPts = seasonPointsFor(p, tradeSettings);
  const ppg = gp && gp > 0 ? seasonPts / gp : null;
  if (ppg != null) statParts.push(`<span class="detail-stat">${gp} GP &middot; ${ppg.toFixed(1)} PPG</span>`);
  if (opts.recentPpg != null) statParts.push(`<span class="detail-stat">${opts.recentPpg.toFixed(1)} PPG (last ${opts.recentWeeks || 'few'} wks)</span>`);

  const info = (teamInfoCache[league] || {})[p.team];
  if (info) {
    if (ppg != null && info.gamesRemaining) {
      const proj = ppg * info.gamesRemaining;
      statParts.push(`<span class="detail-stat">Rest of season (est.): +${proj.toFixed(1)} pts / ${info.gamesRemaining} gm</span>`);
    } else if (info.gamesRemaining != null) {
      statParts.push(`<span class="detail-stat">${info.gamesRemaining} games remaining</span>`);
    }
    if (info.sosTier && info.sosTier !== 'Unknown') {
      statParts.push(`<span class="sos-badge sos-${info.sosTier.toLowerCase()}">${info.sosTier} schedule</span>`);
    }
  }

  let newsHtml = '';
  if (p.id) {
    const articles = (newsCache || {})[`${league}-${p.id}`];
    if (articles && articles.length) {
      newsHtml =
        '<div class="player-news">' +
        articles
          .slice(0, 2)
          .map((a) => `<a href="${a.link}" target="_blank" rel="noopener noreferrer">${a.headline}</a>`)
          .join('') +
        '</div>';
    }
  }

  if (!statParts.length && !newsHtml) return '';
  return `<div class="player-detail">${statParts.join('')}</div>${newsHtml}`;
}

function renderTradeSide(side) {
  const el = document.querySelector(`.trade-side[data-side="${side}"]`);
  if (!el) return;
  const list = el.querySelector('.trade-list');
  const totalEl = el.querySelector('.trade-total-value');
  const unitEl = el.querySelector('.trade-total-unit');
  list.innerHTML = '';
  let total = 0;
  let unit = 'pts';
  tradeSides[side].forEach((p, i) => {
    const pts = effectivePoints(p, tradeSettings);
    total += pts;
    unit = pointsUnitLabel(p, tradeSettings);
    const li = document.createElement('li');
    const tag = tradeSideTag(p);
    li.innerHTML = `
      <div class="trade-item-row">
        <span class="player-name">${p.name}<span class="player-team">${tag ? ' ' + tag : ''}</span></span>
        <span class="value">${pts.toFixed(2)}</span>
        <button type="button" class="trade-remove" aria-label="Remove ${p.name}">&times;</button>
      </div>
      ${renderPlayerDetail(p, currentFantasyLeague)}
    `;
    li.querySelector('.trade-remove').addEventListener('click', () => {
      tradeSides[side].splice(i, 1);
      renderTradeSide(side);
    });
    list.appendChild(li);
  });
  totalEl.textContent = total.toFixed(2);
  unitEl.textContent = unit;
  updateTradeVerdict();
}

function updateTradeVerdict() {
  const totalA = tradeSides.a.reduce((s, p) => s + effectivePoints(p, tradeSettings), 0);
  const totalB = tradeSides.b.reduce((s, p) => s + effectivePoints(p, tradeSettings), 0);
  if (tradeSides.a.length === 0 && tradeSides.b.length === 0) {
    tradeVerdictEl.textContent = 'Add players to both sides to evaluate the trade.';
    return;
  }
  const diff = Math.abs(totalA - totalB);
  if (diff < 0.01) {
    tradeVerdictEl.textContent = `Even trade (${totalA.toFixed(2)} each side)`;
  } else if (totalB > totalA) {
    tradeVerdictEl.textContent = `Team A wins the trade by ${diff.toFixed(2)}`;
  } else {
    tradeVerdictEl.textContent = `Team B wins the trade by ${diff.toFixed(2)}`;
  }
}

// Renders a browsable, clickable list of candidate players for this side -
// the current search text narrows it, but (unlike a plain autocomplete) an
// empty search still shows the top players by current trade value, so you
// can add someone without already knowing their exact name.
function renderTradeCandidates(el, side) {
  const input = el.querySelector('.trade-search');
  const results = el.querySelector('.trade-search-results');
  const q = input.value.trim().toLowerCase();
  const pool = tradeIndex[currentFantasyLeague] || [];
  const already = new Set(tradeSides[side].map((p) => `${p.name}|${p.team}|${p.position}`));
  const scored = pool
    .filter((p) => !already.has(`${p.name}|${p.team}|${p.position}`))
    .map((p) => ({ p, pts: effectivePoints(p, tradeSettings) }))
    .filter(({ p }) => !q || p.name.toLowerCase().includes(q));
  scored.sort((a, b) => b.pts - a.pts);
  const shown = scored.slice(0, 15);

  results.innerHTML = '';
  results.hidden = shown.length === 0;
  for (const { p, pts } of shown) {
    const item = document.createElement('div');
    item.className = 'trade-result';
    const tag = tradeSideTag(p);
    const unit = pointsUnitLabel(p, tradeSettings);
    item.textContent = `${p.name}${tag ? ' (' + tag + ')' : ''} — ${pts.toFixed(2)} ${unit}`;
    item.addEventListener('click', () => {
      tradeSides[side].push(p);
      input.value = '';
      renderTradeCandidates(el, side);
      renderTradeSide(side);
    });
    results.appendChild(item);
  }
}

function refreshTradeUI() {
  document.querySelectorAll('.trade-side').forEach((el) => renderTradeCandidates(el, el.dataset.side));
  renderTradeSide('a');
  renderTradeSide('b');
}

function setupTradeSide(el) {
  const input = el.querySelector('.trade-search');
  input.addEventListener('input', () => renderTradeCandidates(el, el.dataset.side));
}

document.querySelectorAll('#fantasyTrade .trade-side').forEach(setupTradeSide);

// --- My Team: roster + free agency advisor ---
// Reuses the same .trade-side/.trade-list search-and-add UI as the trade
// calculator, but instead of comparing two sides' point totals, it looks
// for same-position swaps where a free agent's recent form clearly beats
// a roster player's - a simple heuristic, not real league-specific advice.

const myTeamLists = { mine: [], fa: [] };
const recentFormCache = { nfl: null, cfb: null };
const POSITION_BOARD_IDS = { nfl: ['qb', 'rb', 'wr', 'te', 'k', 'def'], cfb: ['qb', 'rb', 'wr', 'te', 'def'] };

// Average fantasy points per player over the last few completed weeks,
// keyed by "name|team" - built from the same week-board files Week
// Leaders already uses, reading only the position-specific boards (not
// "all"/"off", which would double-count each player alongside their
// position board).
async function loadRecentForm(league) {
  if (recentFormCache[league]) return recentFormCache[league];
  const manifest = await loadWeekManifest(league);
  const weeks = (manifest.weeks || []).slice(-3);
  const boards = await Promise.all(weeks.map((w) => loadWeekBoard(league, w).catch(() => null)));
  const byPlayer = {};
  for (const wb of boards) {
    if (!wb || !wb.boards) continue;
    for (const boardId of POSITION_BOARD_IDS[league]) {
      for (const p of wb.boards[boardId] || []) {
        const key = `${p.name}|${p.team}`;
        (byPlayer[key] = byPlayer[key] || []).push(p.points);
      }
    }
  }
  const avg = {};
  for (const [key, arr] of Object.entries(byPlayer)) avg[key] = { ppg: arr.reduce((a, b) => a + b, 0) / arr.length, weeks: arr.length };
  recentFormCache[league] = avg;
  return avg;
}

function outlookScore(p, league) {
  const gp = p.gamesPlayed;
  const seasonPpg = gp && gp > 0 ? p.points / gp : 0;
  const recent = (recentFormCache[league] || {})[`${p.name}|${p.team}`];
  let score = recent ? recent.ppg * 0.6 + seasonPpg * 0.4 : seasonPpg;
  const info = (teamInfoCache[currentFantasyLeague] || {})[p.team];
  if (info && info.sosTier === 'Easy') score *= 1.08;
  if (info && info.sosTier === 'Tough') score *= 0.92;
  return score;
}

function renderMyTeamSide(side) {
  const el = document.querySelector(`#fantasyMyTeam .trade-side[data-roster="${side}"]`);
  if (!el) return;
  const list = el.querySelector('.trade-list');
  list.innerHTML = '';
  const league = currentFantasyLeague;
  myTeamLists[side].forEach((p, i) => {
    const li = document.createElement('li');
    const tag = fantasyPlayerTag(p);
    const recent = (recentFormCache[league] || {})[`${p.name}|${p.team}`];
    li.innerHTML = `
      <div class="trade-item-row">
        <span class="player-name">${p.name}<span class="player-team">${tag ? ' ' + tag : ''}</span></span>
        <span class="value">${p.points.toFixed(2)}</span>
        <button type="button" class="trade-remove" aria-label="Remove ${p.name}">&times;</button>
      </div>
      ${renderPlayerDetail(p, league, recent ? { recentPpg: recent.ppg, recentWeeks: recent.weeks } : {})}
    `;
    li.querySelector('.trade-remove').addEventListener('click', () => {
      myTeamLists[side].splice(i, 1);
      renderMyTeamSide(side);
      renderMyTeamSuggestions();
    });
    list.appendChild(li);
  });
  renderMyTeamSuggestions();
}

function renderMyTeamSuggestions() {
  myTeamSuggestionsEl.innerHTML = '';
  const { mine, fa } = myTeamLists;
  if (mine.length === 0 || fa.length === 0) {
    myTeamNoteEl.textContent = 'Add players to both lists to see suggestions.';
    return;
  }
  const league = currentFantasyLeague;
  const suggestions = [];
  const positions = new Set(mine.map((p) => p.position));
  for (const pos of positions) {
    const mineAtPos = mine.filter((p) => p.position === pos);
    const faAtPos = fa.filter((p) => p.position === pos);
    if (!mineAtPos.length || !faAtPos.length) continue;
    const worstMine = mineAtPos.map((p) => ({ p, score: outlookScore(p, league) })).sort((a, b) => a.score - b.score)[0];
    const bestFa = faAtPos.map((p) => ({ p, score: outlookScore(p, league) })).sort((a, b) => b.score - a.score)[0];
    if (bestFa.score > worstMine.score * 1.15) {
      suggestions.push({ pos, drop: worstMine, add: bestFa });
    }
  }
  suggestions.sort((a, b) => b.add.score - b.drop.score - (a.add.score - a.drop.score));

  if (suggestions.length === 0) {
    myTeamNoteEl.textContent = 'No clear upgrades found at shared positions right now.';
    return;
  }
  myTeamNoteEl.textContent = `${suggestions.length} suggested move${suggestions.length === 1 ? '' : 's'}`;

  const heading = document.createElement('div');
  heading.className = 'section-heading';
  heading.textContent = 'Suggested Moves';
  myTeamSuggestionsEl.appendChild(heading);

  for (const s of suggestions) {
    const card = document.createElement('div');
    card.className = 'board suggestion-card';
    card.innerHTML = `
      <h3>${s.pos}</h3>
      <div class="suggestion-row"><span class="suggestion-add">+ Add ${s.add.p.name}</span><span class="detail-stat">${s.add.score.toFixed(1)} outlook pts/gm</span></div>
      <div class="suggestion-row"><span class="suggestion-drop">&minus; Drop ${s.drop.p.name}</span><span class="detail-stat">${s.drop.score.toFixed(1)} outlook pts/gm</span></div>
    `;
    myTeamSuggestionsEl.appendChild(card);
  }
}

function setupMyTeamSide(el) {
  const side = el.dataset.roster;
  const input = el.querySelector('.trade-search');
  const results = el.querySelector('.trade-search-results');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) {
      results.hidden = true;
      return;
    }
    const pool = tradeIndex[currentFantasyLeague] || [];
    const matches = pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
    results.hidden = matches.length === 0;
    for (const p of matches) {
      const item = document.createElement('div');
      item.className = 'trade-result';
      const tag = fantasyPlayerTag(p);
      item.textContent = `${p.name}${tag ? ' (' + tag + ')' : ''} — ${p.points.toFixed(2)} pts`;
      item.addEventListener('click', () => {
        myTeamLists[side].push(p);
        input.value = '';
        results.innerHTML = '';
        results.hidden = true;
        renderMyTeamSide(side);
      });
      results.appendChild(item);
    }
  });
}

document.querySelectorAll('#fantasyMyTeam .trade-side').forEach(setupMyTeamSide);

const myTeamLeagueLoaded = { nfl: false, cfb: false };
async function ensureMyTeamDataLoaded(league) {
  if (myTeamLeagueLoaded[league]) return;
  myTeamLeagueLoaded[league] = true;
  await loadRecentForm(league);
  renderMyTeamSide('mine');
  renderMyTeamSide('fa');
}

function syncTradeSettingsUI() {
  document.querySelectorAll('#tradeTypeTabs button').forEach((b) => b.classList.toggle('active', b.dataset.value === tradeSettings.type));
  document.querySelectorAll('#tradeScoringTabs button').forEach((b) => b.classList.toggle('active', b.dataset.value === tradeSettings.scoring));
  document.querySelectorAll('#tradeQbTabs button').forEach((b) => b.classList.toggle('active', b.dataset.value === tradeSettings.qbFormat));
  tradeSettingsSummaryEl.textContent = `${tradeSettings.type === 'dynasty' ? 'Dynasty' : 'Redraft'} · ${SCORING_LABELS[tradeSettings.scoring]} · ${QB_FORMAT_LABELS[tradeSettings.qbFormat]}`;
}

function setupTradeSettingsTabs(containerId, key) {
  document.querySelectorAll(`#${containerId} button`).forEach((btn) => {
    btn.addEventListener('click', () => {
      tradeSettings[key] = btn.dataset.value;
      saveTradeSettings();
      syncTradeSettingsUI();
      refreshTradeUI();
    });
  });
}

loadTradeSettings();
syncTradeSettingsUI();
setupTradeSettingsTabs('tradeTypeTabs', 'type');
setupTradeSettingsTabs('tradeScoringTabs', 'scoring');
setupTradeSettingsTabs('tradeQbTabs', 'qbFormat');
tradeSettingsBtn.addEventListener('click', () => {
  tradeSettingsPanel.hidden = !tradeSettingsPanel.hidden;
});

fetch('data/manifest.json')
  .then((r) => r.json())
  .then((m) => {
    manifest = m;
    if (m.generatedAt) {
      const d = new Date(m.generatedAt);
      generatedAtEl.textContent = `Feed last refreshed: ${d.toLocaleString('en-US')}`;
    }
    switchMainView('nfl');
    loadLive();
    setInterval(loadLive, 30000);
  })
  .catch((e) => {
    subtitle.textContent = 'Failed to load data.';
    console.error(e);
  });
