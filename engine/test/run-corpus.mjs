// test/run-corpus.mjs — alle Korpus-Projekte rechnen und gegen die Referenzen messen.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = process.env.CORPUS_DIR || resolve(homedir(), 'Tim OS', 'work', 'palmier');
const OUT = process.env.SCHNITT_PROJEKTE || '/tmp/schnitt-corpus';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const SOURCES = { arcads: { file: 'arcads/raw.mp4', typ: 'roh' }, dreiskills: { file: 'dreiskills/camera.mp4', typ: 'fertig' } };
const env = { ...process.env, SCHNITT_PROJEKTE: OUT, SCHNITT_DEV: '1' };
const cli = (...args) => spawnSync(process.execPath, [resolve(here, '..', 'cli.mjs'), ...args], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
let fails = 0;
for (const name of readdirSync(resolve(here, 'corpus')).filter((n) => !n.endsWith('.md'))) {
  if (only && name !== only) continue;
  const src = SOURCES[name]; if (!src) continue;
  const file = resolve(CORPUS, src.file);
  if (!existsSync(file)) { console.log(`${name}: Quelle fehlt (${file})`); continue; }
  console.log(`\n== ${name}`);
  if (!existsSync(resolve(OUT, name, 'project.json'))) cli('neu', file, '--name', name, '--typ', src.typ);
  const names = resolve(here, 'corpus', name, 'names.json'); if (existsSync(names)) spawnSync('cp', [names, resolve(OUT, name, 'names.json')]);
  const r = cli('run', name, '--bis', 'cut', ...(process.argv.includes('--force') ? ['--force'] : []));
  process.stdout.write(r.stderr.split('\n').filter((l) => /^(analyse|blocks|asr|takes|seams|cut|splices):/.test(l)).map((l) => '  ' + l).join('\n') + '\n');
  const refDir = resolve(here, 'corpus', name);
  if (existsSync(resolve(refDir, 'reference-selects.json'))) {
    const c = spawnSync(process.execPath, [resolve(here, 'corpus.mjs'), resolve(OUT, name), resolve(refDir, 'reference-selects.json')], { encoding: 'utf8' });
    process.stdout.write(c.stdout.split('\n').slice(0, 3).map((l) => '  ' + l).join('\n') + '\n');
    const m = /Take-Treffer: (\d+)\/(\d+)/.exec(c.stdout); if (m && Number(m[1]) / Number(m[2]) < 0.85) { fails++; console.log('  ✗ Take-Treffer unter 85 %'); }
  }
  if (existsSync(resolve(refDir, 'reference-splices.json'))) {
    const ref = JSON.parse(readFileSync(resolve(refDir, 'reference-splices.json'))).frames;
    const got = JSON.parse(readFileSync(resolve(OUT, name, 'splices.json'))).frames.map((f) => f.frame);
    const exact = ref.length === got.length && ref.every((f, i) => f === got[i]);
    console.log(`  Klebestellen: ${got.join(' · ')} ${exact ? '✓ exakt' : '✗ Referenz ' + ref.join(' · ')}`); if (!exact) fails++;
  }
  if (existsSync(resolve(refDir, 'reference-words.json'))) {
    const R = JSON.parse(readFileSync(resolve(refDir, 'reference-words.json')));
    const ours = JSON.parse(readFileSync(resolve(OUT, name, 'words-frames.json'))).words;
    const norm = (w) => String(w).toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
    let j = 0, d = []; for (const [f0, , w] of R) { const rw = norm(w); let k = -1; for (let x = j; x < Math.min(ours.length, j + 8); x++) { const ow = norm(ours[x].w); if (ow === rw || (rw.length > 3 && (ow.startsWith(rw) || rw.startsWith(ow)))) { k = x; break; } } if (k < 0) continue; d.push(Math.abs(ours[k].f0 - f0)); j = k + 1; }
    d.sort((a, b) => a - b); const med = d[Math.floor(d.length / 2)];
    console.log(`  Wortzeiten: ${d.length}/${R.length} getroffen · |Δ| Median ${med} F · p90 ${d[Math.floor(d.length * 0.9)]} F · max ${d[d.length - 1]} F ${med <= 3 ? '✓' : '✗'}`); if (med > 3) fails++;
  }
}
console.log(fails ? `\n${fails} Prüfung(en) verfehlt` : '\nalle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
