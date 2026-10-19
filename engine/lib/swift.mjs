// lib/swift.mjs — Apple-Vision-Werkzeuge: einmal mit swiftc kompilieren (Setup), sonst beim ersten Aufruf nachholen.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { run } from './spawn.mjs';
import { BIN_DIR, PLUGIN_ROOT } from './paths.mjs';
import { log } from './progress.mjs';

export async function swiftBin(name) {
  const bin = resolve(BIN_DIR, name);
  if (existsSync(bin)) return bin;
  const src = resolve(PLUGIN_ROOT, 'tools', 'swift', `${name}.swift`);
  if (!existsSync(src)) throw new Error(`Swift-Quelle fehlt: ${src}`);
  mkdirSync(BIN_DIR, { recursive: true });
  log(`swiftc: kompiliere ${name} …`);
  await run('swiftc', ['-O', '-o', bin, src]);
  return bin;
}

/** Kinnhöhe (0…1, 0 = oben) und Gesichtsbreite in einem Bild. */
export async function detectChin(imagePath) {
  const bin = await swiftBin('detect-chin');
  const out = await run(bin, [imagePath]).catch((e) => e.message);
  const m = /\{.*\}/.exec(out);
  if (!m) return { ok: false, error: 'keine Ausgabe' };
  try { return JSON.parse(m[0]); } catch { return { ok: false, error: 'JSON' }; }
}
