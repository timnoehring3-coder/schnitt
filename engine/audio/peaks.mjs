// audio/peaks.mjs — Wellenform-Daten fürs Dashboard: min/max je 5 ms als Int8 (−127…127), base64.
export function computePeaks(pcm, sampleRate, { binMs = 5 } = {}) {
  const bin = Math.round(sampleRate * binMs / 1000);
  const n = Math.ceil(pcm.length / bin);
  const out = new Int8Array(n * 2);
  for (let k = 0; k < n; k++) {
    let lo = 1, hi = -1;
    const a = k * bin, b = Math.min(pcm.length, a + bin);
    for (let i = a; i < b; i++) { const v = pcm[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (b <= a) { lo = 0; hi = 0; }
    out[k * 2] = Math.round(Math.max(-1, Math.min(1, lo)) * 127);
    out[k * 2 + 1] = Math.round(Math.max(-1, Math.min(1, hi)) * 127);
  }
  return { binMs, bins: n, data: Buffer.from(out.buffer).toString('base64') };
}
