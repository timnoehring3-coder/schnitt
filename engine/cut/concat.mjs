// cut/concat.mjs — Schritt 6: ein ffmpeg-Lauf mit filter_complex: trim/atrim je Segment, 4-ms-Mikrofades,
// concat, fps=30, 9:16-Crop, CFR + dichte Keyframes (Remotion-Seek). Danach cut-map, Wortframes und Nahtmessung.
import { readJson, writeJson } from '../lib/project.mjs';
import { run } from '../lib/spawn.mjs';
import { loadCutProfile } from './profile.mjs';
import { measureSeams } from './metrics.mjs';
import { progress, log } from '../lib/progress.mjs';

export default async function concat(project) {
  const prof = loadCutProfile(project);
  const fps = project.json.fps;
  const sj = readJson(project.path('selects.json'));
  const th = readJson(project.path('audio/floor.json'));
  const ws = readJson(project.path('words-src.json'));
  const enabled = sj.selects.filter((s) => s.enabled && s.segments?.length).sort((a, b) => a.order - b.order);
  if (!enabled.length) throw new Error('keine gewählten Takes mit Nähten — erst takes und seams ausführen.');
  const segs = enabled.flatMap((s) => s.segments.map((g) => ({ ...g, select: s.id })));
  const src = project.path(project.json.source.file);
  const out = project.path('media/camera.mp4');
  const fade = prof.fade.ms / 1000;
  const V = prof.video;
  // filter_complex
  // Video erst auf CFR zwingen und dann nach FRAME-Nummern trimmen: so hat jedes Segment exakt out−in Frames und
  // concat muss nichts auffüllen (bei Zeitstempel-Jitter der Quelle schob er sonst Stille ein → Drift).
  const parts = [];
  parts.push(`[0:v]fps=${fps},setpts=N/FRAME_RATE/TB,split=${segs.length}` + segs.map((_, i) => `[s${i}]`).join(''));
  parts.push(`[0:a]asplit=${segs.length}` + segs.map((_, i) => `[t${i}]`).join(''));
  for (let i = 0; i < segs.length; i++) {
    const A = (segs[i].in / fps).toFixed(5), B = (segs[i].out / fps).toFixed(5), L = ((segs[i].out - segs[i].in) / fps).toFixed(5);
    parts.push(`[s${i}]trim=start_frame=${segs[i].in}:end_frame=${segs[i].out},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[t${i}]atrim=start=${A}:end=${B},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, L - fade).toFixed(5)}:d=${fade}[a${i}]`);
  }
  parts.push(segs.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${segs.length}:v=1:a=1[vc][ac]`);
  const vf = [];
  if (V.portrait) vf.push('scale=1080:1920:force_original_aspect_ratio=increase', 'crop=1080:1920', 'setsar=1');
  parts.push(`[vc]${vf.length ? vf.join(',') : 'null'}[vo]`);
  parts.push(`[ac]aresample=${V.audioRate}[ao]`);
  progress(5, 'ffmpeg');
  const args = ['-nostdin', '-y', '-v', 'error', '-i', src, '-filter_complex', parts.join(';'), '-map', '[vo]', '-map', '[ao]',
    '-c:v', 'libx264', '-preset', V.preset, '-crf', String(V.crf), '-g', String(V.gop), '-pix_fmt', 'yuv420p',
    '-c:a', V.audioCodec, '-b:a', V.audioBitrate, '-ar', String(V.audioRate), '-movflags', '+faststart', out];
  await run('ffmpeg', args);
  progress(70, 'Karte');
  // cut-map: Quell- → Zielframes
  let dst = 0;
  const cutMap = segs.map((g) => { const len = g.out - g.in; const m = { select: g.select, block: g.block, words: g.words || null, srcIn: g.in, srcOut: g.out, dstIn: dst, dstOut: dst + len, hardIn: Boolean(g.hardIn), hardOut: Boolean(g.hardOut) }; dst += len; return m; });
  writeJson(project.path('cut-map.json'), { fps, frames: dst, segments: cutMap });
  // Wörter in Zielframes
  const words = [];
  for (const m of cutMap) {
    const inRange = m.words ? (x, k) => k >= m.words[0] && k <= m.words[1] : (x) => x.block === m.block;
    for (const w of ws.words.filter(inRange)) {
      const f0 = Math.max(m.dstIn, Math.min(m.dstOut - 1, m.dstIn + Math.round((w.t0 * fps) - m.srcIn)));
      const f1 = Math.max(f0 + 1, Math.min(m.dstOut, m.dstIn + Math.round((w.t1 * fps) - m.srcIn)));
      words.push({ w: w.w, f0, f1, block: m.block, select: m.select });
    }
  }
  writeJson(project.path('words-frames.json'), { fps, frames: dst, words });
  progress(80, 'Nähte messen');
  const H = prof.seam[prof.seam.haerte] || prof.seam.hart;
  const met = await measureSeams(out, cutMap, { fps, floor: th.floor, hopMs: prof.hopMs, sampleRate: prof.sampleRate, corridorMs: H.corridorMs, hart: prof.seam.haerte === 'hart' });
  const wpm = met.durationSec ? Math.round(words.length / met.durationSec * 60) : 0;
  writeJson(project.path('check/seams.json'), { haerte: prof.seam.haerte, corridorMs: H.corridorMs, ...met, wpm, words: words.length });
  const summary = { seconds: met.durationSec, frames: dst, segments: segs.length, seams: met.nSeams, hardSeams: met.hardSeams, inCorridor: met.inCorridor, medianSeamMs: met.medianMs, startsHot: met.startsHot.length, endsHot: met.endsHot.length, silenceSec: met.silenceSec, wpm };
  log(`cut (${prof.seam.haerte}): ${summary.seconds}s · ${summary.segments} Segmente · Nähte ${met.inCorridor}/${met.nSeams} im Korridor ${H.corridorMs[0]}–${H.corridorMs[1]} ms (Median ${met.medianMs} ms)${prof.seam.haerte === 'hart' ? '' : ` · Anlaut heiß ${met.startsHot.length} · Auslaut heiß ${met.endsHot.length}`} · Stille ${met.silenceSec}s · ${wpm} WPM`);
  return { summary };
}
