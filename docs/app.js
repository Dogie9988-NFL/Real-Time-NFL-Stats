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
// Fantasy: season leaderboards, live in-game scoring, trade calculator.
// Reuses the same .board/.board-grid presentation as the real stat
// leaderboards - it's the same shape of data (ranked players + a value),
// just fantasy points instead of a raw stat.
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
    setInterval(loadLiveFantasy, 60000);
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
  await loadFantasyBoards(league);
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
  fantasyLiveEl.hidden = currentFantasyMode !== 'live';
  fantasyTradeEl.hidden = currentFantasyMode !== 'trade';
  if (currentFantasyMode === 'leaderboards') renderFantasyBoards();
  if (currentFantasyMode === 'live') renderFantasyLive();
  if (currentFantasyMode === 'trade') {
    renderTradeSide('a');
    renderTradeSide('b');
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

function renderTradeSide(side) {
  const el = document.querySelector(`.trade-side[data-side="${side}"]`);
  if (!el) return;
  const list = el.querySelector('.trade-list');
  const totalEl = el.querySelector('.trade-total-value');
  list.innerHTML = '';
  let total = 0;
  tradeSides[side].forEach((p, i) => {
    total += p.points;
    const li = document.createElement('li');
    const tag = tradeSideTag(p);
    li.innerHTML = `
      <span class="player-name">${p.name}<span class="player-team">${tag ? ' ' + tag : ''}</span></span>
      <span class="value">${p.points.toFixed(2)}</span>
      <button type="button" class="trade-remove" aria-label="Remove ${p.name}">&times;</button>
    `;
    li.querySelector('.trade-remove').addEventListener('click', () => {
      tradeSides[side].splice(i, 1);
      renderTradeSide(side);
    });
    list.appendChild(li);
  });
  totalEl.textContent = total.toFixed(2);
  updateTradeVerdict();
}

function updateTradeVerdict() {
  const totalA = tradeSides.a.reduce((s, p) => s + p.points, 0);
  const totalB = tradeSides.b.reduce((s, p) => s + p.points, 0);
  if (tradeSides.a.length === 0 && tradeSides.b.length === 0) {
    tradeVerdictEl.textContent = 'Add players to both sides to evaluate the trade.';
    return;
  }
  const diff = Math.abs(totalA - totalB);
  if (diff < 0.01) {
    tradeVerdictEl.textContent = `Even trade (${totalA.toFixed(2)} pts each side)`;
  } else if (totalB > totalA) {
    tradeVerdictEl.textContent = `Team A wins the trade by ${diff.toFixed(2)} pts`;
  } else {
    tradeVerdictEl.textContent = `Team B wins the trade by ${diff.toFixed(2)} pts`;
  }
}

function setupTradeSide(el) {
  const side = el.dataset.side;
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
      const tag = tradeSideTag(p);
      item.textContent = `${p.name}${tag ? ' (' + tag + ')' : ''} — ${p.points.toFixed(2)} pts`;
      item.addEventListener('click', () => {
        tradeSides[side].push(p);
        input.value = '';
        results.innerHTML = '';
        results.hidden = true;
        renderTradeSide(side);
      });
      results.appendChild(item);
    }
  });
}

document.querySelectorAll('.trade-side').forEach(setupTradeSide);

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
    setInterval(loadLive, 60000);
  })
  .catch((e) => {
    subtitle.textContent = 'Failed to load data.';
    console.error(e);
  });
