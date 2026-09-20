const app = document.getElementById('app');
const subtitle = document.getElementById('subtitle');
const searchBox = document.getElementById('search');
const conferenceFilter = document.getElementById('conferenceFilter');
const tabs = document.querySelectorAll('.league-tabs button');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const generatedAtEl = document.getElementById('generatedAt');
const swatchesEl = document.getElementById('swatches');

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
const cache = {}; // league -> { boardId -> data }

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

async function switchLeague(league) {
  currentLeague = league;
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.league === league));
  conferenceFilter.style.display = league === 'cfb' ? '' : 'none';
  subtitle.textContent = 'Loading data…';
  await loadLeague(league);
  render();
}

tabs.forEach((t) => t.addEventListener('click', () => switchLeague(t.dataset.league)));
searchBox.addEventListener('input', render);
conferenceFilter.addEventListener('change', render);
settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});
initThemePicker();

fetch('data/manifest.json')
  .then((r) => r.json())
  .then((m) => {
    manifest = m;
    if (m.generatedAt) {
      const d = new Date(m.generatedAt);
      generatedAtEl.textContent = `Feed last refreshed: ${d.toLocaleString('en-US')}`;
    }
    switchLeague('nfl');
  })
  .catch((e) => {
    subtitle.textContent = 'Failed to load data.';
    console.error(e);
  });
