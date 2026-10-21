// cut/splices.mjs — Typ B (fertig geschnitten): Klebestellen des gelieferten Schnitts finden. Bild: YAVG der
// Frame-Differenz (tblend difference) > faktor × Mittel. Rein informativ für den Schnitt (Blockgrenzen liegen ohnehin
// in Pausen), verbindlich für den Blockplan: jede Grafik-Naht gehört auf eine Klebestelle (CUT-STYLE).
import { run } from '../lib/spawn.mjs';
import { readJson, writeJson } from '../lib/project.mjs';
import { progress, log } from '../lib/progress.mjs';

/** Frame-Differenz je Frame (YAVG von tblend difference). Index i = Differenz Frame i zu i−1, 0-basiert. */
export async function frameDiffs(file, fps = 30) {
  const out = await run('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
  const rows = []; let t = null;
  for (const line of out.split('\n')) {
    const m1 = /pts_time:([\d.]+)/.exec(line); if (m1) { t = Number(m1[1]); continue; }
    const m2 = /YAVG=([\d.]+)/.exec(line); if (m2 && t != null) rows.push({ t, v: Number(m2[1]) });
  }
  return rows.map((r) => ({ frame: Math.round(r.t * fps), t: r.t, v: r.v }));
}

/**
 * Klebestelle = Frame, der eine neue Einstellung beginnt (am Korpus mit rohen Frames nachgemessen: Index = round(t·fps)).
 * Zwei Wege: stark (≥ factor × Mittel) oder markant (≥ minFactor × Mittel UND ≥ prominence × beide Nachbarn) —
 * ein Schnitt ist eine Einzelspitze, Bewegung/Zoom liefert Läufe erhöhter Werte.
 */
export async function detectSplices(file, { fps = 30, factor = 3.5, minFactor = 2.5, prominence = 1.8, minGapFrames = 3 } = {}) {
  const rows = await frameDiffs(file, fps);
  const mean = rows.reduce((s, r) => s + r.v, 0) / Math.max(1, rows.length);
  const thr = factor * mean;
  const frames = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i], ratio = r.v / mean;
    const nb = Math.max(rows[i - 1].v, rows[i + 1]?.v ?? 0);
    const hit = ratio >= factor || (ratio >= minFactor && r.v >= prominence * nb);
    if (hit && (!frames.length || r.frame - frames[frames.length - 1].frame >= minGapFrames)) frames.push({ frame: r.frame, t: +r.t.toFixed(3), ratio: +ratio.toFixed(2), prominence: +(r.v / Math.max(nb, 1e-6)).toFixed(1) });
  }
  return { mean: +mean.toFixed(3), threshold: +thr.toFixed(3), frames };
}

export default async function splices(project) {
  const fps = project.json.fps;
  progress(10, 'Frame-Differenz');
  const r = await detectSplices(project.path(project.json.source.file), { fps });
  // Lage zu den Sprechblöcken: Klebestelle in einer Pause (Blockgrenze ±3 F) oder mitten im Block
  const bj = readJson(project.path('blocks.json'));
  for (const s of r.frames) {
    const atEdge = bj.blocks.some((b) => Math.abs(b.f0 - s.frame) <= 3 || Math.abs(b.f1 - s.frame) <= 3);
    const inside = bj.blocks.find((b) => s.frame > b.f0 + 3 && s.frame < b.f1 - 3);
    s.where = atEdge ? 'pause' : inside ? `in Block ${inside.id}` : 'pause';
  }
  writeJson(project.path('splices.json'), { fps, ...r });
  const summary = { count: r.frames.length, mean: r.mean, inBlock: r.frames.filter((s) => s.where.startsWith('in')).length };
  log(`splices: ${summary.count} Klebestellen (Mittel ${r.mean}, Schwelle ${r.threshold}) · ${summary.inBlock} mitten im Sprechblock`);
  return { summary };
}
