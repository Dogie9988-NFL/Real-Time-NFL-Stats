// Pulls CFB stat leaders from the CollegeFootballData.com API instead of
// scraping ESPN's stats webpage. The scrape (see git history of
// fetch-espn-cfb.js) works fine from a normal network but is blocked
// outright when run from GitHub Actions' own cloud IPs - CFBD is a real
// public API (no bot-protection to route around), so it's reliable from
// anywhere, but its free tier is capped at 1,000 calls/month. We fetch
// every stat category in one unfiltered call (omitting `category` returns
// all of them) to spend exactly 1 call per run - see refresh-stats-cfb.yml
// for why this fetch runs on its own, hourly schedule rather than the
// NFL fetch's 5-minute one.
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.collegefootballdata.com';

// Power 4 + Notre Dame only, matching what Yahoo Fantasy CFB covers. Static
// rather than fetched live each run, since conference membership only
// changes in the off-season and every call here counts against the quota -
// regenerate by re-running the snippet in README.md if realignment happens.
const TEAM_META = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'reference', 'cfb-power4-teams-cfbd.json'), 'utf8')
);

function getJson(urlPath) {
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) throw new Error('CFBD_API_KEY environment variable is not set');
  return new Promise((resolve, reject) => {
    https
      .get(`${API_BASE}${urlPath}`, { headers: { Authorization: `Bearer ${apiKey}` } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`CFBD ${urlPath} -> HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          try {
            const data = JSON.parse(body);
            if (!Array.isArray(data)) return reject(new Error(`CFBD ${urlPath} did not return an array`));
            resolve(data);
          } catch (e) {
            reject(new Error(`Bad JSON from ${urlPath}: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

// CFBD (category, statType) -> our field name, grouped by which "pool" it
// belongs to. A pool matches one entry in FETCH_SPECS[x].cfb.pool.
const POOL_STAT_MAP = {
  passing: { passing: { YDS: 'passingYards', TD: 'passingTouchdowns', INT: 'interceptions' } },
  rushing: { rushing: { YDS: 'rushingYards' } },
  receiving: { receiving: { YDS: 'receivingYards' } },
  scoring: { rushing: { TD: 'rushingTouchdowns' }, receiving: { TD: 'receivingTouchdowns' } },
  defensive: {
    defensive: { SACKS: 'sacks', TOT: 'totalTackles', PD: 'passesDefended' },
    interceptions: { INT: 'interceptions' },
    fumbles: { REC: 'fumblesRecovered' },
  },
  returning: {
    kickReturns: { YDS: 'kickReturnYards', TD: 'kickReturnTouchdowns' },
    puntReturns: { YDS: 'puntReturnYards', TD: 'puntReturnTouchdowns' },
  },
};

// Builds CFB stat pools for a season from one unfiltered CFBD call. Returns
// pool-name -> array of {id,name,position,team,conference,values}, the same
// shape the old ESPN-scraping module produced.
async function fetchAllCfbPools(season) {
  const rows = await getJson(`/stats/player/season?year=${season}&seasonType=regular`);

  const pools = {};
  for (const poolName of Object.keys(POOL_STAT_MAP)) {
    const byCategory = POOL_STAT_MAP[poolName];
    const players = new Map();
    for (const row of rows) {
      const fieldMap = byCategory[row.category];
      const fieldName = fieldMap && fieldMap[row.statType];
      if (!fieldName) continue;
      const meta = TEAM_META[row.team];
      if (!meta) continue; // not Power 4 + Notre Dame

      let p = players.get(row.playerId);
      if (!p) {
        p = { id: row.playerId, name: row.player, position: row.position || '-', team: meta.abbreviation, conference: meta.conference, values: {} };
        players.set(row.playerId, p);
      }
      const value = parseFloat(row.stat);
      p.values[fieldName] = Number.isFinite(value) ? value : 0;
    }
    pools[poolName] = [...players.values()];
  }
  return pools;
}

module.exports = { fetchAllCfbPools };
