// steps.mjs — der Schritt-DAG. Jeder Schritt: name, needs (Dateien), produces (Dateien), run(project, opts).
// Module werden erst beim Aufruf geladen, damit die CLI auch läuft, wenn ein späterer Schritt noch fehlt.
import { existsSync } from 'node:fs';
import { setStep } from './lib/project.mjs';
import { progress, log } from './lib/progress.mjs';

export const STEPS = {
  analyse:  { needs: [],                 produces: ['audio/rms.json', 'audio/floor.json', 'audio/peaks.json'], mod: './audio/analyse.mjs' },
  blocks:   { needs: ['audio/rms.json'], produces: ['blocks.json'],                                            mod: './audio/blocks.mjs' },
  asr:      { needs: ['blocks.json'],    produces: ['words-src.json'],                                         mod: './asr/transcribe.mjs' },
  takes:    { needs: ['words-src.json'], produces: ['selects.json'],                                           mod: './cut/takes.mjs' },
  seams:    { needs: ['selects.json'],   produces: ['selects.json'],                                           mod: './cut/seams.mjs' },
  cut:      { needs: ['selects.json'],   produces: ['media/camera.mp4', 'cut-map.json', 'words-frames.json', 'check/seams.json'], mod: './cut/concat.mjs' },
  splices:  { needs: ['audio/rms.json'], produces: ['splices.json'],                                           mod: './cut/splices.mjs' },
  chin:     { needs: ['media/camera.mp4'], produces: ['chin.json'],                                            mod: './captions/chin.mjs' },
  untertitel:{ needs: ['words-frames.json'], produces: ['texte.json'],                                         mod: './captions/pages.mjs' },
  render:   { needs: ['media/camera.mp4'], produces: ['out/final.mp4'],                                        mod: './render/render.mjs' },
};

/** Standard-Reihenfolge je Zulieferung. raw = Rohaufnahme mit Takes, cut = fertig geschnitten. */
export function chain(kind) {
  return kind === 'cut'
    ? ['analyse', 'blocks', 'asr', 'splices', 'takes', 'seams', 'cut', 'chin', 'untertitel', 'render']
    : ['analyse', 'blocks', 'asr', 'takes', 'seams', 'cut', 'chin', 'untertitel', 'render'];
}

export async function runStep(project, name, opts = {}) {
  const step = STEPS[name];
  if (!step) throw new Error(`unbekannter Schritt: ${name}`);
  for (const f of step.needs) if (!existsSync(project.path(f))) throw new Error(`Schritt ${name} braucht ${f} — vorher ausführen.`);
  setStep(project, name, 'running');
  const t0 = Date.now();
  try {
    const mod = await import(step.mod);
    progress(0, name);
    const res = await mod.default(project, opts);
    setStep(project, name, 'done', { ms: Date.now() - t0, ...(res?.summary ? { summary: res.summary } : {}) });
    progress(100, name);
    return res;
  } catch (e) {
    setStep(project, name, 'error', { ms: Date.now() - t0, error: String(e?.message || e) });
    log(`✗ ${name}: ${e?.message || e}`);
    throw e;
  }
}

/** Führt die Kette bis einschließlich `until` aus; fertige Schritte werden übersprungen, außer mit force. */
export async function runChain(project, { until, force = false, skip = [] } = {}) {
  const order = chain(project.json.source.kind);
  const stop = until ? order.indexOf(until) : order.length - 1;
  if (stop < 0) throw new Error(`Schritt ${until} nicht in der Kette (${order.join(' → ')})`);
  const results = {};
  for (const name of order.slice(0, stop + 1)) {
    if (skip.includes(name)) { log(`– ${name} übersprungen`); continue; }
    const st = project.json.steps[name];
    const fresh = st?.status === 'done' && STEPS[name].produces.every((f) => existsSync(project.path(f)));
    if (fresh && !force) { log(`✓ ${name} (bereits fertig)`); continue; }
    results[name] = await runStep(project, name, {});
  }
  return results;
}
