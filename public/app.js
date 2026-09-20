const app = document.getElementById('app');
const subtitle = document.getElementById('subtitle');
const searchBox = document.getElementById('search');
const conferenceFilter = document.getElementById('conferenceFilter');
const tabs = document.querySelectorAll('.league-tabs button');

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

function renderBoard(board, conference) {
  const div = document.createElement('div');
  div.className = 'board';
  div.dataset.label = board.label.toLowerCase();

  const h3 = document.createElement('h3');
  h3.textContent = board.label;
  div.appendChild(h3);

  if (!board.available) {
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

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${board.seasonLabel || 'Season'} ${board.season || ''}`;
  div.appendChild(meta);

  const players = playersForBoard(board, conference);

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
      li.innerHTML = `
        <span class="rank">${p.rank}.</span>
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

function render() {
  const league = currentLeague;
  const boards = cache[league];
  if (!boards) return;

  const meta = manifest.leagues[league];
  subtitle.textContent = `${league === 'nfl' ? 'NFL' : 'College Football (Power 4 + Notre Dame)'} — ${meta.seasonLabel} ${meta.season}`;

  app.innerHTML = '';

  const sections = [
    { key: 'overall', label: 'Whole-League Leaders' },
    { key: 'position', label: 'Leaders by Position' },
  ];

  const conference = league === 'cfb' ? conferenceFilter.value : '';

  for (const section of sections) {
    const ids = meta.categories.filter((c) => c.section === section.key).map((c) => c.id);
    if (ids.length === 0) continue;

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = section.label;
    app.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'board-grid';
    for (const id of ids) {
      const board = boards[id];
      if (!board) continue;
      grid.appendChild(renderBoard(board, conference));
    }
    app.appendChild(grid);
  }

  applySearch();
}

function applySearch() {
  const q = searchBox.value.trim().toLowerCase();
  document.querySelectorAll('.board').forEach((el) => {
    el.style.display = !q || el.dataset.label.includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.section-heading').forEach((heading) => {
    const grid = heading.nextElementSibling;
    const anyVisible = [...grid.children].some((c) => c.style.display !== 'none');
    heading.style.display = anyVisible ? '' : 'none';
    grid.style.display = anyVisible ? '' : 'none';
  });
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
searchBox.addEventListener('input', applySearch);
conferenceFilter.addEventListener('change', render);

fetch('data/manifest.json')
  .then((r) => r.json())
  .then((m) => {
    manifest = m;
    switchLeague('nfl');
  })
  .catch((e) => {
    subtitle.textContent = 'Failed to load data.';
    console.error(e);
  });
