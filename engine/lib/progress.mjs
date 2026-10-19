// lib/progress.mjs — das Protokoll zwischen Engine-Schritt und Aufrufer (Dashboard, Claude, Tests).
//   stdout: "@@PROGRESS <pct> <Stufe>"   und am Ende   "@@RESULT <json>"
//   stderr: alles andere (Logs, ffmpeg-Ausgaben)
let last = -1;
export function progress(pct, stage = '') {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if (p === last && stage === '') return;
  last = p;
  process.stdout.write(`@@PROGRESS ${p} ${stage}\n`);
}
export function result(obj) {
  process.stdout.write(`@@RESULT ${JSON.stringify(obj)}\n`);
}
export function log(...args) {
  process.stderr.write(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n');
}
/** Parst eine Zeile aus einem Kindprozess. Gibt {type, pct, stage} | {type, data} | null. */
export function parseLine(line) {
  const m = /^@@PROGRESS\s+(\d+)\s*(.*)$/.exec(line);
  if (m) return { type: 'progress', pct: Number(m[1]), stage: m[2].trim() };
  const r = /^@@RESULT\s+(.*)$/.exec(line);
  if (r) { try { return { type: 'result', data: JSON.parse(r[1]) }; } catch { return null; } }
  return null;
}
