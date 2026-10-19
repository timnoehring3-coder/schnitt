// lib/text.mjs — Textähnlichkeit ohne Pakete: Levenshtein-Ratio (0…1) und Token-Helfer.
export function normTok(s) {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
export function simRatio(a, b) {
  a = String(a); b = String(b);
  if (!a.length && !b.length) return 1;
  const n = a.length, m = b.length;
  let prev = new Array(m + 1), cur = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[m] / Math.max(n, m);
}
export function toks(text, minLen = 2) {
  return String(text).split(/\s+/).map(normTok).filter((t) => t.length >= minLen);
}
export function jaccard(A, B) {
  const a = new Set(A), b = new Set(B);
  if (!a.size && !b.size) return 1;
  let n = 0; for (const t of a) if (b.has(t)) n++;
  return n / (a.size + b.size - n);
}
export function containment(A, B) {
  const a = new Set(A), b = new Set(B);
  if (!a.size || !b.size) return 0;
  let n = 0; for (const t of a) if (b.has(t)) n++;
  return n / Math.min(a.size, b.size);
}
