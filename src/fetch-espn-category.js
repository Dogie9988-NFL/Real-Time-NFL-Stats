// Like fetch-espn.js's fetchLeaders, but captures every field in the
// category instead of just the one being sorted on - needed for fantasy
// scoring, which combines several fields per category (e.g. receptions +
// receivingYards + receivingTouchdowns all at once).
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = PROXY ? new HttpsProxyAgent(PROXY) : undefined;

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(getJson(res.headers.location));
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Bad JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 3;

// sportSlug: 'nfl'. category: e.g. 'passing'. sortField: a field name within
// that category (e.g. 'passingYards'). sortCategory: override for the sort
// param when it differs from the response's category name (see
// categories.js's defInterceptions quirk).
async function fetchCategoryPool(sportSlug, category, sortField, season, seasontype = 2, sortCategory) {
  const out = [];
  const seen = new Set();
  const sortCat = sortCategory || category;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `https://site.web.api.espn.com/apis/common/v3/sports/football/${sportSlug}` +
      `/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false` +
      `&limit=${PAGE_SIZE}&page=${page}&sort=${sortCat}.${sortField}&season=${season}&seasontype=${seasontype}`;

    const data = await getJson(url);
    if (!data.athletes || data.athletes.length === 0) break;

    const catIndex = data.categories.findIndex((c) => c.name === category);
    if (catIndex === -1) break;
    const names = data.categories[catIndex].names;
    const sortIdx = names.indexOf(sortField);

    let lastSortValue = null;
    for (const a of data.athletes) {
      const ath = a.athlete;
      const totals = a.categories[catIndex].totals;
      const values = {};
      names.forEach((n, i) => {
        const raw = totals[i];
        values[n] = raw === '-' ? 0 : parseFloat(String(raw).replace(/,/g, '')) || 0;
      });
      lastSortValue = values[names[sortIdx]];
      if (seen.has(ath.id)) continue;
      seen.add(ath.id);
      out.push({
        id: ath.id,
        name: ath.displayName,
        position: (ath.position && ath.position.abbreviation) || '-',
        team: ath.teamShortName || '',
        values,
      });
    }

    if (lastSortValue === 0) break;
    if (data.athletes.length < PAGE_SIZE) break;
  }

  return out;
}

module.exports = { fetchCategoryPool };
