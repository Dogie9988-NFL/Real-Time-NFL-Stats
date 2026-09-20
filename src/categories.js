// Defines every underlying ESPN stat we pull, and every leaderboard we
// derive from those pulls (many leaderboards share one underlying fetch,
// just sliced by position).

// One entry per distinct ESPN "category.field" we need to sort by.
// `cfb` says which CFB pool (from fetch-cfbd.js) and field to read the
// same stat from; `cfb: null` means no free CFB data source exposes that
// stat at all (see README "Known data gaps").
const FETCH_SPECS = {
  passingYards: { category: 'passing', field: 'passingYards', cfb: { pool: 'passing', field: 'passingYards' } },
  passingTouchdowns: { category: 'passing', field: 'passingTouchdowns', cfb: { pool: 'passing', field: 'passingTouchdowns' } },
  passingInterceptions: { category: 'passing', field: 'interceptions', cfb: { pool: 'passing', field: 'interceptions' } }, // INTs thrown
  rushingYards: { category: 'rushing', field: 'rushingYards', cfb: { pool: 'rushing', field: 'rushingYards' } },
  rushingTouchdowns: { category: 'rushing', field: 'rushingTouchdowns', cfb: { pool: 'scoring', field: 'rushingTouchdowns' } },
  receivingYards: { category: 'receiving', field: 'receivingYards', cfb: { pool: 'receiving', field: 'receivingYards' } },
  receivingTouchdowns: { category: 'receiving', field: 'receivingTouchdowns', cfb: { pool: 'scoring', field: 'receivingTouchdowns' } },
  sacks: { category: 'defensive', field: 'sacks', cfb: { pool: 'defensive', field: 'sacks' } },
  totalTackles: { category: 'defensive', field: 'totalTackles', cfb: { pool: 'defensive', field: 'totalTackles' } },
  passesDefended: { category: 'defensive', field: 'passesDefended', cfb: { pool: 'defensive', field: 'passesDefended' } },
  fumblesForced: { category: 'general', field: 'fumblesForced', cfb: null }, // CFBD doesn't track forced fumbles at all
  fumblesRecovered: { category: 'general', field: 'fumblesRecovered', cfb: { pool: 'defensive', field: 'fumblesRecovered' } },
  // ESPN's sort param needs the camelCase category name even though the
  // response itself labels this category "defensiveinterceptions".
  defInterceptions: { category: 'defensiveinterceptions', sortCategory: 'defensiveInterceptions', field: 'interceptions', cfb: { pool: 'defensive', field: 'interceptions' } },
  kickReturnYards: { category: 'returning', field: 'kickReturnYards', cfb: { pool: 'returning', field: 'kickReturnYards' } },
  puntReturnYards: { category: 'returning', field: 'puntReturnYards', cfb: { pool: 'returning', field: 'puntReturnYards' } },
  kickReturnTouchdowns: { category: 'returning', field: 'kickReturnTouchdowns', cfb: { pool: 'returning', field: 'kickReturnTouchdowns' } },
  puntReturnTouchdowns: { category: 'returning', field: 'puntReturnTouchdowns', cfb: { pool: 'returning', field: 'puntReturnTouchdowns' } },
};

const QB = (p) => p === 'QB';
const NOT_QB = (p) => p !== 'QB';
const DB = (p) => p === 'CB' || p === 'S' || p === 'DB'; // CFB sometimes just tags "DB" generically
const LB = (p) => p === 'LB';
// Note: CFB sometimes tags a lineman just "DL" (generic) instead of DT/DE.
// We can't tell interior from edge for those, so they're excluded from
// both buckets rather than guessed into one.
const DT = (p) => p === 'DT';
const EDGE = (p) => p === 'DE';
const NOT_LB_DB = (p) => !DB(p) && !LB(p);
const WR = (p) => p === 'WR';
const RB = (p) => p === 'RB';
const TE = (p) => p === 'TE';
const NOT_WRRBTE = (p) => !WR(p) && !RB(p) && !TE(p);
const ANY = () => true;

// section: 'position' (grouped under a position header) or 'overall' (whole-league, shown first)
const LEADERBOARDS = [
  // ---- Whole-league (shown first on each league's page) ----
  { id: 'passing-yards', label: 'Passing Yards', section: 'overall', fetch: 'passingYards', filter: ANY },
  { id: 'rushing-yards', label: 'Rushing Yards', section: 'overall', fetch: 'rushingYards', filter: ANY },
  { id: 'passing-td', label: 'Passing Touchdowns', section: 'overall', fetch: 'passingTouchdowns', filter: ANY },
  { id: 'rushing-td', label: 'Rushing Touchdowns', section: 'overall', fetch: 'rushingTouchdowns', filter: ANY },
  { id: 'receiving-yards', label: 'Receiving Yards', section: 'overall', fetch: 'receivingYards', filter: ANY },
  { id: 'receiving-td', label: 'Receiving Touchdowns', section: 'overall', fetch: 'receivingTouchdowns', filter: ANY },
  { id: 'sacks', label: 'Sacks', section: 'overall', fetch: 'sacks', filter: ANY },
  { id: 'interceptions', label: 'Interceptions', section: 'overall', fetch: 'defInterceptions', filter: ANY },
  { id: 'tackles', label: 'Tackles', section: 'overall', fetch: 'totalTackles', filter: ANY },
  { id: 'pass-deflections', label: 'Pass Deflections', section: 'overall', fetch: 'passesDefended', filter: ANY },
  { id: 'forced-fumbles', label: 'Forced Fumbles', section: 'overall', fetch: 'fumblesForced', filter: ANY },
  { id: 'fumbles-recovered', label: 'Fumbles Recovered', section: 'overall', fetch: 'fumblesRecovered', filter: ANY },
  { id: 'interceptions-thrown', label: 'Interceptions Thrown', section: 'overall', fetch: 'passingInterceptions', filter: ANY },
  { id: 'kick-return-yards', label: 'Kick Return Yards', section: 'overall', fetch: 'kickReturnYards', filter: ANY },
  { id: 'punt-return-yards', label: 'Punt Return Yards', section: 'overall', fetch: 'puntReturnYards', filter: ANY },
  { id: 'kick-return-td', label: 'Kick Return Touchdowns', section: 'overall', fetch: 'kickReturnTouchdowns', filter: ANY },
  { id: 'punt-return-td', label: 'Punt Return Touchdowns', section: 'overall', fetch: 'puntReturnTouchdowns', filter: ANY },

  // ---- Positional splits ----
  { id: 'passing-yards-qb', label: 'Passing Yards (QB)', section: 'position', fetch: 'passingYards', filter: QB },
  { id: 'passing-yards-non-qb', label: 'Passing Yards (Non-QB)', section: 'position', fetch: 'passingYards', filter: NOT_QB },
  { id: 'passing-td-qb', label: 'Passing TD (QB)', section: 'position', fetch: 'passingTouchdowns', filter: QB },
  { id: 'passing-td-non-qb', label: 'Passing TD (Non-QB)', section: 'position', fetch: 'passingTouchdowns', filter: NOT_QB },

  { id: 'rushing-yards-qb', label: 'Rushing Yards (QB)', section: 'position', fetch: 'rushingYards', filter: QB },
  { id: 'rushing-yards-wr', label: 'Rushing Yards (WR)', section: 'position', fetch: 'rushingYards', filter: WR },
  { id: 'rushing-yards-te', label: 'Rushing Yards (TE)', section: 'position', fetch: 'rushingYards', filter: TE },
  { id: 'rushing-yards-rb', label: 'Rushing Yards (RB)', section: 'position', fetch: 'rushingYards', filter: RB },
  { id: 'rushing-td-qb', label: 'Rushing TD (QB)', section: 'position', fetch: 'rushingTouchdowns', filter: QB },
  { id: 'rushing-td-wr', label: 'Rushing TD (WR)', section: 'position', fetch: 'rushingTouchdowns', filter: WR },
  { id: 'rushing-td-te', label: 'Rushing TD (TE)', section: 'position', fetch: 'rushingTouchdowns', filter: TE },
  { id: 'rushing-td-rb', label: 'Rushing TD (RB)', section: 'position', fetch: 'rushingTouchdowns', filter: RB },

  { id: 'receiving-yards-wr', label: 'Receiving Yards (WR)', section: 'position', fetch: 'receivingYards', filter: WR },
  { id: 'receiving-yards-rb', label: 'Receiving Yards (RB)', section: 'position', fetch: 'receivingYards', filter: RB },
  { id: 'receiving-yards-te', label: 'Receiving Yards (TE)', section: 'position', fetch: 'receivingYards', filter: TE },
  { id: 'receiving-yards-other', label: 'Receiving Yards (Non WR/RB/TE)', section: 'position', fetch: 'receivingYards', filter: NOT_WRRBTE },
  { id: 'receiving-td-wr', label: 'Receiving TD (WR)', section: 'position', fetch: 'receivingTouchdowns', filter: WR },
  { id: 'receiving-td-rb', label: 'Receiving TD (RB)', section: 'position', fetch: 'receivingTouchdowns', filter: RB },
  { id: 'receiving-td-te', label: 'Receiving TD (TE)', section: 'position', fetch: 'receivingTouchdowns', filter: TE },
  { id: 'receiving-td-other', label: 'Receiving TD (Non WR/RB/TE)', section: 'position', fetch: 'receivingTouchdowns', filter: NOT_WRRBTE },

  { id: 'sacks-dt', label: 'Sacks (DT)', section: 'position', fetch: 'sacks', filter: DT },
  { id: 'sacks-edge', label: 'Sacks (Edge)', section: 'position', fetch: 'sacks', filter: EDGE },
  { id: 'sacks-lb', label: 'Sacks (LB)', section: 'position', fetch: 'sacks', filter: LB },
  { id: 'sacks-db', label: 'Sacks (DB)', section: 'position', fetch: 'sacks', filter: DB },

  { id: 'interceptions-db', label: 'Interceptions (DB)', section: 'position', fetch: 'defInterceptions', filter: DB },
  { id: 'interceptions-lb', label: 'Interceptions (LB)', section: 'position', fetch: 'defInterceptions', filter: LB },
  { id: 'interceptions-other', label: 'Interceptions (Non LB/DB)', section: 'position', fetch: 'defInterceptions', filter: NOT_LB_DB },

  { id: 'tackles-dt', label: 'Tackles (DT)', section: 'position', fetch: 'totalTackles', filter: DT },
  { id: 'tackles-edge', label: 'Tackles (Edge)', section: 'position', fetch: 'totalTackles', filter: EDGE },
  { id: 'tackles-lb', label: 'Tackles (LB)', section: 'position', fetch: 'totalTackles', filter: LB },
  { id: 'tackles-db', label: 'Tackles (DB)', section: 'position', fetch: 'totalTackles', filter: DB },

  { id: 'pass-deflections-db', label: 'Pass Deflections (DB)', section: 'position', fetch: 'passesDefended', filter: DB },
  { id: 'pass-deflections-lb', label: 'Pass Deflections (LB)', section: 'position', fetch: 'passesDefended', filter: LB },
  { id: 'pass-deflections-other', label: 'Pass Deflections (Non DB/LB)', section: 'position', fetch: 'passesDefended', filter: NOT_LB_DB },

  { id: 'forced-fumbles-dt', label: 'Forced Fumbles (DT)', section: 'position', fetch: 'fumblesForced', filter: DT },
  { id: 'forced-fumbles-edge', label: 'Forced Fumbles (Edge)', section: 'position', fetch: 'fumblesForced', filter: EDGE },
  { id: 'forced-fumbles-lb', label: 'Forced Fumbles (LB)', section: 'position', fetch: 'fumblesForced', filter: LB },
  { id: 'forced-fumbles-db', label: 'Forced Fumbles (DB)', section: 'position', fetch: 'fumblesForced', filter: DB },

  { id: 'fumbles-recovered-dt', label: 'Fumbles Recovered (DT)', section: 'position', fetch: 'fumblesRecovered', filter: DT },
  { id: 'fumbles-recovered-edge', label: 'Fumbles Recovered (Edge)', section: 'position', fetch: 'fumblesRecovered', filter: EDGE },
  { id: 'fumbles-recovered-lb', label: 'Fumbles Recovered (LB)', section: 'position', fetch: 'fumblesRecovered', filter: LB },
  { id: 'fumbles-recovered-db', label: 'Fumbles Recovered (DB)', section: 'position', fetch: 'fumblesRecovered', filter: DB },

  // Not fetchable from any free public source (see README) - included so it
  // still shows up in the UI with an explanation instead of just missing.
  {
    id: 'sacks-allowed-ol',
    label: 'Sacks Allowed (OL, min. 50 snaps, least to most)',
    section: 'position',
    staticUnavailable:
      'ESPN (and every other free source) does not publish a per-player "sacks allowed" stat or snap counts - that only exists in paid PFF-style products.',
  },
];

module.exports = { FETCH_SPECS, LEADERBOARDS };
