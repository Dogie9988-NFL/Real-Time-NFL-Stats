const fs = require('fs');
const path = require('path');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { fetchLeaders } = require('./fetch-espn');
const { fetchAllCfbPools } = require('./fetch-cfbd');
const { FETCH_SPECS, LEADERBOARDS } = require('./categories');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = PROXY ? new HttpsProxyAgent(PROXY) : undefined;

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { agent, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function detectSeason(slug) {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/${slug}/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=1&sort=general.gamesPlayed`;
  const data = await getJson(url);
  return {
    year: data.currentSeason.year,
    seasontype: data.currentSeason.type.type,
    label: data.currentSeason.type.name,
  };
}

function writeBoard(outDir, board, league, season, players) {
  const payload = {
    id: board.id,
    label: board.label,
    league,
    section: board.section,
    season: season.year,
    seasonLabel: season.label,
    available: true,
    players,
  };
  fs.writeFileSync(path.join(outDir, `${board.id}.json`), JSON.stringify(payload));
  return { id: board.id, label: board.label, section: board.section, count: players.length, available: true };
}

function writeUnavailable(outDir, board, league, season, reason) {
  const payload = { id: board.id, label: board.label, league, section: board.section, season: season.year, available: false, reason, players: [] };
  fs.writeFileSync(path.join(outDir, `${board.id}.json`), JSON.stringify(payload));
  return { id: board.id, label: board.label, section: board.section, count: 0, available: false };
}

function loadPreviousManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

function previousCategoryMap(previousManifest, league) {
  const cats = previousManifest && previousManifest.leagues && previousManifest.leagues[league] && previousManifest.leagues[league].categories;
  return new Map(Array.isArray(cats) ? cats.map((c) => [c.id, c]) : []);
}

// A raw stat pool coming back empty means the fetch was blocked/failed, not
// that zero players exist - ESPN always has data once a season has games.
// Writing that through would silently wipe out a good, previously-fetched
// board with an empty one, so instead we leave that board's on-disk file
// untouched (keeping last-known-good data) and carry its previous manifest
// entry forward.
function keepPrevious(previous, board, outDir) {
  const prev = previous.get(board.id);
  if (prev) return prev;
  return writeUnavailable(outDir, board, board.league || '', { year: null, label: null }, 'No data available yet.');
}

async function generateNfl(season, previousManifest) {
  console.log(`\n=== NFL === (season ${season.year}, ${season.label})`);
  const pools = {};
  for (const [fetchKey, spec] of Object.entries(FETCH_SPECS)) {
    process.stdout.write(`  fetching ${fetchKey}... `);
    const leaders = await fetchLeaders('nfl', spec.category, spec.field, season.year, season.seasontype, spec.sortCategory);
    pools[fetchKey] = leaders;
    console.log(`${leaders.length} rows`);
  }

  const outDir = path.join(DATA_DIR, 'nfl');
  fs.mkdirSync(outDir, { recursive: true });
  const categoriesMeta = [];
  const previous = previousCategoryMap(previousManifest, 'nfl');

  for (const board of LEADERBOARDS) {
    if (board.staticUnavailable) {
      categoriesMeta.push(writeUnavailable(outDir, board, 'nfl', season, board.staticUnavailable));
      continue;
    }
    const pool = pools[board.fetch];
    if (!pool || pool.length === 0) {
      console.warn(`  [WARN] pool "${board.fetch}" came back empty - keeping previous data for "${board.id}"`);
      categoriesMeta.push(keepPrevious(previous, { ...board, league: 'nfl' }, outDir));
      continue;
    }
    const filtered = pool.filter((p) => board.filter(p.position) && p.value > 0);
    const players = filtered.slice(0, 50).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      team: p.team,
      position: p.position,
      value: p.value,
    }));
    categoriesMeta.push(writeBoard(outDir, board, 'nfl', season, players));
  }

  console.log(`Wrote ${categoriesMeta.length} leaderboards to ${outDir}`);
  return categoriesMeta;
}

async function generateCfb(season, previousManifest) {
  console.log(`\n=== CFB === (season ${season.year}, ${season.label}, Power 4 + Notre Dame only)`);
  let pools = {};
  try {
    pools = await fetchAllCfbPools(season.year);
    for (const [name, rows] of Object.entries(pools)) {
      console.log(`  pool ${name}: ${rows.length} players`);
    }
  } catch (err) {
    // A CFBD outage/rate-limit/bad-key shouldn't crash the whole script (that
    // would also block an NFL update sharing this run) - treat it the same
    // as "every pool empty" so every board below falls back to its last
    // known-good data instead.
    console.error(`  [ERROR] CFBD fetch failed: ${err.message}`);
  }

  const outDir = path.join(DATA_DIR, 'cfb');
  fs.mkdirSync(outDir, { recursive: true });
  const categoriesMeta = [];
  const previous = previousCategoryMap(previousManifest, 'cfb');

  for (const board of LEADERBOARDS) {
    if (board.staticUnavailable) {
      categoriesMeta.push(writeUnavailable(outDir, board, 'cfb', season, board.staticUnavailable));
      continue;
    }
    const spec = FETCH_SPECS[board.fetch];
    if (!spec.cfb) {
      categoriesMeta.push(writeUnavailable(outDir, board, 'cfb', season, 'Not exposed by any free public CFB stats source we could find.'));
      continue;
    }
    const pool = pools[spec.cfb.pool] || [];
    if (pool.length === 0) {
      console.warn(`  [WARN] pool "${spec.cfb.pool}" came back empty (likely blocked) - keeping previous data for "${board.id}"`);
      categoriesMeta.push(keepPrevious(previous, { ...board, league: 'cfb' }, outDir));
      continue;
    }
    const field = spec.cfb.field;

    const withValue = pool
      .map((p) => ({ ...p, value: p.values[field] || 0 }))
      .filter((p) => board.filter(p.position) && p.value > 0);
    withValue.sort((a, b) => b.value - a.value);

    const players = withValue.slice(0, 50).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      team: p.team,
      conference: p.conference,
      position: p.position,
      value: p.value,
    }));
    categoriesMeta.push(writeBoard(outDir, board, 'cfb', season, players));
  }

  console.log(`Wrote ${categoriesMeta.length} leaderboards to ${outDir}`);
  return categoriesMeta;
}

// Optional CLI arg restricts this run to one league ("nfl" or "cfb"), so
// each league can run on its own schedule (NFL's ESPN JSON API is free and
// fast; CFB's CFBD API is capped at 1,000 calls/month - see the two
// refresh-stats-*.yml workflows). Omit it to do both, as a manual run does.
const which = process.argv[2];

async function main() {
  const previousManifest = loadPreviousManifest();
  // Start from whatever was already there so a single-league run doesn't
  // blank out the other league's manifest section.
  const manifest = previousManifest ? { ...previousManifest } : { leagues: {} };
  manifest.generatedAt = new Date().toISOString();

  if (!which || which === 'nfl') {
    const nflSeason = await detectSeason('nfl');
    manifest.leagues.nfl = { season: nflSeason.year, seasonLabel: nflSeason.label, categories: await generateNfl(nflSeason, previousManifest) };
  }

  if (!which || which === 'cfb') {
    const cfbSeason = await detectSeason('college-football');
    manifest.leagues.cfb = { season: cfbSeason.year, seasonLabel: cfbSeason.label, categories: await generateCfb(cfbSeason, previousManifest) };
  }

  fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest written to data/manifest.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
