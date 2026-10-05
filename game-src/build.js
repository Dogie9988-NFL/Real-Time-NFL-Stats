// Builds the Undrafted game into one HTML file: docs/game/index.html
//   node game-src/build.js
// It reads every .html/.css/.js file in src/ and in the module folders listed in MODS.txt,
// sorts them by file name, and glues them together. (A module file with the same name as a
// src/ file replaces it. Files starting with "_" are skipped.)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const OUT = path.resolve(HERE, process.argv[2] || '../docs/game/index.html');
const mods = fs.readFileSync(path.join(HERE, 'MODS.txt'), 'utf8').trim().split(',').filter(Boolean);

const files = new Map();
for (const dir of ['src', ...mods].map(d => path.join(HERE, d))) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(html|css|js)$/.test(f) || f.startsWith('_')) continue;
    files.set(f, path.join(dir, f));
  }
}
const names = [...files.keys()].sort();
let html = '';
for (const n of names) {
  let s = fs.readFileSync(files.get(n), 'utf8');
  if (!s.endsWith('\n')) s += '\n';
  if (/\.(css|js)$/.test(n)) html += `/* ---- ${n} ---- */\n`;
  html += s;
}

// Check the JavaScript for syntax errors before writing anything.
const m = html.match(/<script>([\s\S]*)<\/script>/);
try { new vm.Script(m[1], { filename: 'undrafted.js' }); }
catch (e) {
  console.error('SYNTAX ERROR:', e.message);
  const line = +((e.stack.match(/undrafted\.js:(\d+)/) || [])[1] || 0);
  if (line) {
    const lines = m[1].split('\n');
    let file = '?';
    for (let i = line - 1; i >= 0; i--) { const mm = lines[i].match(/^\/\* ---- (.+) ---- \*\/$/); if (mm) { file = mm[1]; break; } }
    console.error(`  in ${file}, near:\n` + lines.slice(Math.max(0, line - 3), line + 2).join('\n'));
  }
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`built ${path.relative(process.cwd(), OUT)} (${(html.length / 1024).toFixed(0)} KB) from ${names.length} files`);
