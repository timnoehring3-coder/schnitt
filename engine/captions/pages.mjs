// captions/pages.mjs — Schritt 8: Untertitel-Seiten. Verbindlich (CAPTIONS.md, Tims Reset vom 15.08.): IMMER genau
// EIN Wort sichtbar. Ein Wort steht bis zum nächsten Wortanfang (Pausen bleiben beim letzten Wort), aber höchstens
// maxHoldFrames über sein Ende hinaus; Mindestdauer minFrames (sonst flackert es — Wörter < minFrames werden mit
// dem Nachbarn zusammengelegt, wie in Tims align-words.py).
import { readJson, writeJson } from '../lib/project.mjs';
import { existsSync } from 'node:fs';
import { progress, log } from '../lib/progress.mjs';

export function buildPages(words, { minFrames = 6, maxHoldFrames = 12, segmentBreaks = [] } = {}) {
  // 1) zu kurze Wörter mit dem Nachbarn zusammenlegen (nur innerhalb desselben Segments)
  const merged = [];
  for (let i = 0; i < words.length; i++) {
    const w = { ...words[i] };
    const next = words[i + 1];
    if (w.f1 - w.f0 < minFrames && next && next.select === w.select && !w.w.includes(' ')) { merged.push({ ...w, w: w.w + ' ' + next.w, f1: next.f1 }); i++; continue; }
    const last = merged[merged.length - 1];
    if (w.f1 - w.f0 < minFrames && last && last.select === w.select && !last.w.includes(' ')) { last.w += ' ' + w.w; last.f1 = w.f1; continue; }
    merged.push(w);
  }
  // 2) Anzeige bis zum nächsten Wortanfang, gedeckelt
  const pages = merged.map((w, i) => {
    const next = merged[i + 1];
    const until = next && next.select === w.select ? next.f0 : w.f1 + maxHoldFrames;
    return { f0: w.f0, f1: Math.max(w.f0 + 1, Math.min(until, w.f1 + maxHoldFrames)), t: w.w, select: w.select, block: w.block };
  });
  // Nachlauf: ist eine Seite trotzdem kürzer als minFrames (Nachbarwort beginnt sofort), mit dem Nachbarn verschmelzen
  for (let guard = 0; guard < 50; guard++) {
    const i = pages.findIndex((p) => p.f1 - p.f0 < minFrames);
    if (i < 0) break;
    const p = pages[i], prev = pages[i - 1], next = pages[i + 1];
    const withPrev = prev && prev.select === p.select, withNext = next && next.select === p.select;
    if (withPrev && (!withNext || prev.f1 - prev.f0 <= next.f1 - next.f0)) { prev.t += ' ' + p.t; prev.f1 = p.f1; pages.splice(i, 1); }
    else if (withNext) { next.t = p.t + ' ' + next.t; next.f0 = p.f0; pages.splice(i, 1); }
    else { p.f1 = p.f0 + minFrames; }
  }
  return pages;
}

export default async function untertitel(project) {
  const wf = readJson(project.path('words-frames.json'));
  const cm = readJson(project.path('cut-map.json'));
  progress(20, 'Seiten');
  const pages = buildPages(wf.words);
  // Segment-Index je Seite (für die Kinnhöhe)
  const chin = existsSync(project.path('chin.json')) ? readJson(project.path('chin.json')) : null;
  for (const p of pages) { p.segment = cm.segments.findIndex((s) => p.f0 >= s.dstIn && p.f0 < s.dstOut); p.piece = chin ? chin.segments.findIndex((s) => p.f0 >= s.dstIn && p.f0 < s.dstOut) : p.segment; }
  const existing = project.path('texte.json');
  let texte = {};
  try { texte = readJson(existing); } catch { /* neu */ }
  texte.fps = wf.fps; texte.frames = wf.frames; texte.subtitles = pages;
  writeJson(existing, texte);
  const summary = { pages: pages.length, minFrames: Math.min(...pages.map((p) => p.f1 - p.f0)), avgFrames: +(pages.reduce((s, p) => s + (p.f1 - p.f0), 0) / pages.length).toFixed(1) };
  log(`untertitel: ${pages.length} Ein-Wort-Seiten · kürzeste ${summary.minFrames} F · Ø ${summary.avgFrames} F`);
  return { summary };
}
