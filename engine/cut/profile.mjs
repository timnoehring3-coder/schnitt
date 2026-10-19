// cut/profile.mjs — Schnittprofil: Standard aus profile.default.json, je Projekt überschreibbar (cut-profile.json).
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readJson, writeJson } from '../lib/project.mjs';

const DEFAULT = resolve(dirname(fileURLToPath(import.meta.url)), 'profile.default.json');

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v;
  return out;
}

export function loadCutProfile(project) {
  const base = readJson(DEFAULT);
  const file = project.path('cut-profile.json');
  if (!existsSync(file)) { writeJson(file, {}); return base; }
  return merge(base, readJson(file));
}
