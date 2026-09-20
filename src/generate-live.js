const fs = require('fs');
const path = require('path');
const { fetchNflGames, fetchCfbGames } = require('./fetch-live');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');

async function main() {
  const [nfl, cfb] = await Promise.all([fetchNflGames(), fetchCfbGames()]);
  const payload = { generatedAt: new Date().toISOString(), nfl, cfb };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'live.json'), JSON.stringify(payload));
  console.log(`Live: ${nfl.length} NFL games, ${cfb.length} CFB (Power 4 + Notre Dame) games.`);
  console.log(`  NFL in-progress: ${nfl.filter((g) => g.state === 'in').length}`);
  console.log(`  CFB in-progress: ${cfb.filter((g) => g.state === 'in').length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
