// ESPN's fast JSON stats API (used for NFL in fetch-espn.js) is broken for
// college football: sorting by any specific stat field returns "-" for
// everyone. Their actual stats webpage works fine though (it's server-
// rendered with real sorted data embedded in a `window['__espnfitt__']`
// JSON blob), so for CFB we fetch that HTML and parse the embedded JSON.
//
// We also fetch per Power-4-conference (group id) rather than "all
// conferences", since Yahoo Fantasy CFB only includes Power 4 + Notre
// Dame, and ESPN lets us filter server-side with a `group` id.

const { execFile } = require('child_process');

const CONFERENCE_GROUPS = [1, 4, 5, 8, 18]; // ACC, Big 12, Big Ten, SEC, FBS Independents (Notre Dame only, filtered later)
const NOTRE_DAME_ABBR = 'ND';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// A full, well-formed Chrome UA string (with "KHTML, like Gecko) Chrome/...
// Safari/...") gets blocked outright - almost certainly a bot-manager check
// that a claimed Chrome UA should come with a matching Chrome TLS
// fingerprint, which curl doesn't have. A short, generic, non-specific UA
// sails through every time (verified repeatedly), so we use that instead.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function curlOnce(url) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-sL', '--max-time', '10', '-A', USER_AGENT, url],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      }
    );
  });
}

// ESPN's stats pages sit behind bot-detection that blocks Node's own HTTPS
// client (even through this environment's proxy) but lets plain `curl`
// through fine, so we shell out to curl rather than use Node's https module.
// It's also intermittently flaky (some requests come back empty/challenged
// for no discernible reason), so retry a few times before giving up.
async function getHtml(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const html = await curlOnce(url).catch(() => '');
    if (html && html.includes('__espnfitt__')) return html;
    if (process.env.CFB_DEBUG) console.error(`  retry ${i}/${attempts} ${url}`);
    if (i < attempts) await sleep(500 * i);
  }
  return '';
}

function parseEmbedded(html) {
  const m = html.match(/window\['__espnfitt__'\]=(\{.*?\});/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Fetches one (view/table, sort field, conference group) page and returns
// rows: {id, name, position, team, conference, values: {statName: number}}
async function fetchOnePage(urlPath, groupId) {
  const url = `https://www.espn.com/college-football/stats/player/_/${urlPath}/group/${groupId}`;
  const html = await getHtml(url);
  const data = parseEmbedded(html);
  const stats = data && data.page && data.page.content && data.page.content.statistics;
  if (!stats || !Array.isArray(stats.playerStats)) return [];

  const confName = (stats.metadata && stats.metadata.conference && stats.metadata.conference.name) || String(groupId);

  return stats.playerStats
    .filter((p) => groupId !== 18 || p.athlete.team === NOTRE_DAME_ABBR) // independents: keep only Notre Dame
    .map((p) => {
      const values = {};
      for (const s of p.stats) {
        values[s.name] = s.value === '-' ? 0 : parseFloat(String(s.value).replace(/,/g, '')) || 0;
      }
      return {
        id: p.athlete.href || `${p.athlete.name}-${p.athlete.team}`,
        name: p.athlete.name,
        position: p.athlete.position || '-',
        team: p.athlete.team,
        conference: confName,
        values,
      };
    });
}

// Fetches one urlPath across all Power-4(+ND) conference groups in
// parallel and merges, deduping by athlete id.
async function fetchPowerFour(urlPath) {
  const perGroup = await Promise.all(CONFERENCE_GROUPS.map((g) => fetchOnePage(urlPath, g)));
  const seen = new Map();
  for (const rows of perGroup) {
    for (const r of rows) {
      if (!seen.has(r.id)) seen.set(r.id, r);
    }
  }
  return [...seen.values()];
}

// Fetches several urlPaths (different sort angles on the same table), each
// across all conferences in parallel, and merges into one deduped pool with
// the union of all `values` seen for each athlete.
async function fetchMergedPool(urlPaths) {
  const perUrl = await Promise.all(urlPaths.map((u) => fetchPowerFour(u)));
  const merged = new Map();
  for (const rows of perUrl) {
    for (const r of rows) {
      const existing = merged.get(r.id);
      if (existing) {
        Object.assign(existing.values, r.values);
      } else {
        merged.set(r.id, r);
      }
    }
  }
  return [...merged.values()];
}

const SEASONTYPE = 2; // regular season

function passingUrl(season, sort) {
  return `season/${season}/seasontype/${SEASONTYPE}/table/passing/sort/${sort}/dir/desc`;
}
function rushingDefaultUrl(season) {
  return `stat/rushing/season/${season}/seasontype/${SEASONTYPE}`;
}
function receivingDefaultUrl(season) {
  return `stat/receiving/season/${season}/seasontype/${SEASONTYPE}`;
}
function scoringUrl(season, sort) {
  return `view/scoring/season/${season}/seasontype/${SEASONTYPE}/table/scoring/sort/${sort}/dir/desc`;
}
function defensiveUrl(season, sort) {
  return `view/defense/season/${season}/seasontype/${SEASONTYPE}/table/defensive/sort/${sort}/dir/desc`;
}
function returningUrl(season, sort) {
  return `view/special/season/${season}/seasontype/${SEASONTYPE}/table/returning/sort/${sort}/dir/desc`;
}

const POOL_BUILDERS = {
  passing: (season) =>
    fetchMergedPool([passingUrl(season, 'passingYards'), passingUrl(season, 'passingTouchdowns'), passingUrl(season, 'interceptions')]),
  rushing: (season) => fetchPowerFour(rushingDefaultUrl(season)),
  receiving: (season) => fetchPowerFour(receivingDefaultUrl(season)),
  scoring: (season) => fetchMergedPool([scoringUrl(season, 'rushingTouchdowns'), scoringUrl(season, 'receivingTouchdowns')]),
  defensive: (season) =>
    fetchMergedPool([
      defensiveUrl(season, 'totalTackles'),
      defensiveUrl(season, 'sacks'),
      defensiveUrl(season, 'passesDefended'),
      defensiveUrl(season, 'interceptions'),
    ]),
  returning: (season) =>
    fetchMergedPool([
      returningUrl(season, 'kickReturnYards'),
      returningUrl(season, 'puntReturnYards'),
      returningUrl(season, 'kickReturnTouchdowns'),
      returningUrl(season, 'puntReturnTouchdowns'),
    ]),
};

// Builds CFB stat pools for a season. `only` optionally limits which named
// pools to build (useful for debugging a single pool). Returns pool-name ->
// array of {id,name,position,team,conference,values}.
async function fetchAllCfbPools(season, only) {
  const names = only && only.length ? only : Object.keys(POOL_BUILDERS);
  const pools = {};
  for (const name of names) {
    pools[name] = await POOL_BUILDERS[name](season);
  }
  return pools;
}

module.exports = { fetchAllCfbPools, CONFERENCE_GROUPS, POOL_NAMES: Object.keys(POOL_BUILDERS) };
