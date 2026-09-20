const fs = require('fs');
const path = require('path');
const { buildLiveFantasy } = require('./fetch-live-fantasy');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');

async function main() {
  const result = await buildLiveFantasy();
  const payload = { generatedAt: new Date().toISOString(), ...result };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'live-fantasy.json'), JSON.stringify(payload));
  console.log(`Live fantasy: ${result.liveGameCount.nfl} live NFL games, ${result.liveGameCount.cfb} live CFB games.`);
  console.log(`  NFL top performers: ${result.nfl.topPerformers.length}, DST rows: ${result.nfl.teamDefLive.length}`);
  console.log(`  CFB top performers: ${result.cfb.topPerformers.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
