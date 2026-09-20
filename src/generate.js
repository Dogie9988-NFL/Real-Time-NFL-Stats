const fs = require('fs');
const path = require('path');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { fetchLeaders } = require('./fetch-espn');
const { fetchAllCfbPools } = require('./fetch-espn-cfb');
const { FETCH_SPECS, LEADERBOARDS } = require('./categories');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
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

async function generateNfl(season) {
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

  for (const board of LEADERBOARDS) {
    if (board.staticUnavailable) {
      categoriesMeta.push(writeUnavailable(outDir, board, 'nfl', season, board.staticUnavailable));
      continue;
    }
    const pool = pools[board.fetch];
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

async function generateCfb(season) {
  console.log(`\n=== CFB === (season ${season.year}, ${season.label}, Power 4 + Notre Dame only)`);
  console.log('  ESPN\'s fast stats API does not sort correctly for CFB; scraping the stats site directly (slower, ~70 requests).');
  const pools = await fetchAllCfbPools(season.year);
  for (const [name, rows] of Object.entries(pools)) {
    console.log(`  pool ${name}: ${rows.length} players`);
  }

  const outDir = path.join(DATA_DIR, 'cfb');
  fs.mkdirSync(outDir, { recursive: true });
  const categoriesMeta = [];

  for (const board of LEADERBOARDS) {
    if (board.staticUnavailable) {
      categoriesMeta.push(writeUnavailable(outDir, board, 'cfb', season, board.staticUnavailable));
      continue;
    }
    const spec = FETCH_SPECS[board.fetch];
    if (!spec.cfb) {
      categoriesMeta.push(writeUnavailable(outDir, board, 'cfb', season, 'Not exposed by ESPN\'s public CFB stats for any source we could find.'));
      continue;
    }
    const pool = pools[spec.cfb.pool] || [];
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

async function main() {
  const manifest = { generatedAt: new Date().toISOString(), leagues: {} };

  const nflSeason = await detectSeason('nfl');
  manifest.leagues.nfl = { season: nflSeason.year, seasonLabel: nflSeason.label, categories: await generateNfl(nflSeason) };

  const cfbSeason = await detectSeason('college-football');
  manifest.leagues.cfb = { season: cfbSeason.year, seasonLabel: cfbSeason.label, categories: await generateCfb(cfbSeason) };

  fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest written to data/manifest.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
