// render/compile-montage.mjs — baut montage.json (die Props der Montage-Comp) aus der Bühne.
import { readJson, writeJson } from '../lib/project.mjs';
import { existsSync } from 'node:fs';

export function compileMontage(project) {
  const cm = readJson(project.path('cut-map.json'));
  const texte = existsSync(project.path('texte.json')) ? readJson(project.path('texte.json')) : {};
  const chin = existsSync(project.path('chin.json')) ? readJson(project.path('chin.json')) : null;
  const blockplan = existsSync(project.path('blockplan.json')) ? readJson(project.path('blockplan.json')) : null;
  const profile = existsSync(project.path('style-profile.json')) ? readJson(project.path('style-profile.json')) : null;
  const props = {
    fps: cm.fps, frames: cm.frames, camera: 'camera.mp4',
    blocks: blockplan?.blocks || [{ f0: 0, f1: cm.frames, mode: 'W' }],
    subtitles: texte.subtitles || [], chin, captionStyle: profile?.captions || {}, profile,
  };
  writeJson(project.path('montage.json'), props);
  return props;
}
