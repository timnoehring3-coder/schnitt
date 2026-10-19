// audio/breath.mjs — Atem-Bursts vor einer Naht erkennen: 80–400 ms, Pegel floor+4…+14 dB, spektraler
// Schwerpunkt > 2 kHz (Atem rauscht, Stimme nicht). Kleine FFT in Node, kein Paket.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar; im[i + k] += ai;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Spektraler Schwerpunkt (Hz) eines 512-Samples-Fensters ab Sample s. */
export function centroid(pcm, s, sampleRate, N = 512) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) { const v = pcm[s + i] ?? 0; re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); }
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]); num += m * k * sampleRate / N; den += m; }
  return den > 0 ? num / den : 0;
}

/**
 * Sucht in [fromHop, toHop] den ersten Atem-Lauf. Liefert {h0, h1} in Hops oder null.
 */
export function findBreath(pcm, rms, fromHop, toHop, { sampleRate = 16000, hopMs = 10, floor, minMs = 80, maxMs = 400, aboveFloorDb = [4, 14], centroidHz = 2000 } = {}) {
  const hop = Math.round(sampleRate * hopMs / 1000);
  const lo = floor + aboveFloorDb[0], hi = floor + aboveFloorDb[1];
  const minH = Math.round(minMs / hopMs), maxH = Math.round(maxMs / hopMs);
  let run = null;
  for (let h = Math.max(0, fromHop); h <= Math.min(rms.length - 1, toHop); h++) {
    const level = rms[h] >= lo && rms[h] <= hi;
    const ok = level && centroid(pcm, h * hop, sampleRate) > centroidHz;
    if (ok) { if (!run) run = { h0: h, h1: h + 1 }; else run.h1 = h + 1; }
    else if (run) { if (run.h1 - run.h0 >= minH && run.h1 - run.h0 <= maxH) return run; run = null; }
  }
  if (run && run.h1 - run.h0 >= minH && run.h1 - run.h0 <= maxH) return run;
  return null;
}
