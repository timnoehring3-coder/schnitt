// audio/analyse.mjs — Schritt 1: Ton lesen, RMS-Kurve, Rauschboden, Wellenform.
import { pcmFloat, wav16k } from '../lib/ffmpeg.mjs';
import { computeRms, thresholds } from './rms.mjs';
import { computePeaks } from './peaks.mjs';
import { writeJson, readJson } from '../lib/project.mjs';
import { progress, log } from '../lib/progress.mjs';
import { loadCutProfile } from '../cut/profile.mjs';

export default async function analyse(project) {
  const prof = loadCutProfile(project);
  const src = project.path(project.json.source.file);
  progress(5, 'Ton lesen');
  const pcm = await pcmFloat(src, prof.sampleRate);
  progress(35, 'RMS');
  const rms = computeRms(pcm, prof.sampleRate, { hopMs: prof.hopMs, winMs: prof.winMs });
  const th = thresholds(rms, prof.floor);
  progress(55, 'Wellenform');
  const peaks = computePeaks(pcm, prof.sampleRate);
  progress(70, 'Schreiben');
  writeJson(project.path('audio/rms.json'), {
    hopMs: prof.hopMs, winMs: prof.winMs, sampleRate: prof.sampleRate, n: rms.length,
    db: Array.from(rms, (v) => Math.round(v * 10) / 10),
  });
  writeJson(project.path('audio/floor.json'), { ...th, percentile: prof.floor.percentile, onDb: prof.floor.onDb, offDb: prof.floor.offDb });
  writeJson(project.path('audio/peaks.json'), peaks);
  progress(85, 'WAV für ASR');
  await wav16k(src, project.path('media/audio16k.wav'));
  const summary = { seconds: Math.round(pcm.length / prof.sampleRate * 10) / 10, floorDb: Math.round(th.floor * 10) / 10, onDb: Math.round(th.on * 10) / 10, dynamicDb: Math.round(th.dynamic * 10) / 10 };
  log(`analyse: ${summary.seconds}s · Rauschboden ${summary.floorDb} dB → an ${summary.onDb} dB · Dynamik ${summary.dynamicDb} dB`);
  return { summary };
}

export function loadRms(project) {
  const r = readJson(project.path('audio/rms.json'));
  return { ...r, db: Float32Array.from(r.db) };
}
