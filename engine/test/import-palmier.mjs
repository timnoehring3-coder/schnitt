// test/import-palmier.mjs — zieht Referenzen aus Tims Palmier-Projekten (Typ B): Klebestellen aus blockplan.md,
// handgeprüfte Wortzeiten aus words-frames.json. Rohmaterial bleibt draußen (CORPUS_DIR), nur Zahlen ins Repo.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = process.env.CORPUS_DIR || resolve(homedir(), 'Tim OS', 'work', 'palmier');
const SKIP = new Set(['_assets', '_calib', '_test', 'klon', 'arcads']); // arcads ist der Roh-Fall, klon Fremdstimme
let n = 0;
for (const name of readdirSync(CORPUS)) {
  if (SKIP.has(name) || !existsSync(resolve(CORPUS, name, 'blockplan.md')) || !existsSync(resolve(CORPUS, name, 'camera.mp4'))) continue;
  const lines = readFileSync(resolve(CORPUS, name, 'blockplan.md'), 'utf8').split('\n');
  const at = lines.findIndex((l) => /Klebestellen/i.test(l));
  let frames = null;
  for (let i = at; i >= 0 && i < Math.min(lines.length, at + 12); i++) {
    const m = /(\d{2,4}(?:\s*·\s*\d{2,4}){2,})/.exec(lines[i]);
    if (m) { frames = m[1].split('·').map((s) => Number(s.trim())); break; }
  }
  if (!frames) { console.log(`${name}: keine Klebestellen-Liste gefunden`); continue; }
  const dir = resolve(here, 'corpus', name); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'source.json'), JSON.stringify({ file: `${name}/camera.mp4`, typ: 'fertig' }) + '\n');
  writeFileSync(resolve(dir, 'reference-splices.json'), JSON.stringify({ fps: 30, frames, from: 'blockplan.md' }) + '\n');
  const wf = resolve(CORPUS, name, 'words-frames.json');
  let words = 0;
  if (existsSync(wf)) {
    const raw = JSON.parse(readFileSync(wf, 'utf8'));
    const norm = raw.map((w) => Array.isArray(w) ? w : [w.f0, w.f1, w.w ?? w.t]).filter((w) => Number.isFinite(w[0]) && w[2]);
    if (norm.length) { writeFileSync(resolve(dir, 'reference-words.json'), JSON.stringify(norm) + '\n'); words = norm.length; }
  }
  console.log(`${name}: ${frames.length} Klebestellen${words ? `, ${words} Wörter` : ''}`); n++;
}
console.log(`${n} Projekte importiert`);
