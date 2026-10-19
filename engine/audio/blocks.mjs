// audio/blocks.mjs — Schritt 2: Sprechblöcke per Hysterese (an über `on`, aus unter `off`),
// Lücken < closeGapMs schließen, Blöcke < minBlockMs verwerfen, Takes = Gruppen mit Lücke ≥ takeGapMs.
import { readJson, writeJson } from '../lib/project.mjs';
import { loadRms } from './analyse.mjs';
import { loadCutProfile } from '../cut/profile.mjs';
import { progress, log } from '../lib/progress.mjs';

export function detectBlocks(db, hopMs, { on, off }, { closeGapMs = 200, minBlockMs = 250 } = {}) {
  const raw = [];
  let inside = false, start = 0;
  for (let i = 0; i < db.length; i++) {
    if (!inside && db[i] > on) { inside = true; start = i; }
    else if (inside && db[i] < off) { inside = false; raw.push([start, i]); }
  }
  if (inside) raw.push([start, db.length]);
  // Lücken schließen
  const closeGap = Math.round(closeGapMs / hopMs);
  const merged = [];
  for (const [a, b] of raw) {
    const last = merged[merged.length - 1];
    if (last && a - last[1] < closeGap) last[1] = b; else merged.push([a, b]);
  }
  const minLen = Math.round(minBlockMs / hopMs);
  return merged.filter(([a, b]) => b - a >= minLen);
}

export default async function blocks(project) {
  const prof = loadCutProfile(project);
  const { db, hopMs } = loadRms(project);
  const th = readJson(project.path('audio/floor.json'));
  const fps = project.json.fps;
  progress(20, 'Blöcke');
  const bl = detectBlocks(db, hopMs, th, prof.blocks);
  const takeGap = prof.takes.takeGapMs / 1000;
  let take = -1, prevEnd = -Infinity;
  const out = bl.map(([a, b], i) => {
    const t0 = a * hopMs / 1000, t1 = b * hopMs / 1000;
    if (t0 - prevEnd >= takeGap) take++;
    prevEnd = t1;
    return { id: i, t0: +t0.toFixed(3), t1: +t1.toFixed(3), f0: Math.round(t0 * fps), f1: Math.round(t1 * fps), take };
  });
  writeJson(project.path('blocks.json'), { fps, hopMs, floor: th.floor, on: th.on, off: th.off, blocks: out, takes: take + 1 });
  const summary = { blocks: out.length, takes: take + 1, spokenSeconds: +out.reduce((s, b) => s + (b.t1 - b.t0), 0).toFixed(1) };
  log(`blocks: ${summary.blocks} Sprechblöcke in ${summary.takes} Takes · ${summary.spokenSeconds}s Sprache`);
  return { summary };
}
