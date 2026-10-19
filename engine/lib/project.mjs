// lib/project.mjs — die Bühne: ein Ordner je Projekt in ~/schnitt-projekte/<slug>/, alles JSON, atomar geschrieben.
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, linkSync, copyFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, basename, extname, isAbsolute } from 'node:path';
import { PROJECTS_DIR } from './paths.mjs';
import { probe } from './ffmpeg.mjs';

export function slugify(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'projekt';
}

export function readJson(file, fallback = undefined) {
  if (!existsSync(file)) { if (fallback !== undefined) return fallback; throw new Error(`fehlt: ${file}`); }
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, file);
}

/** Projekt auflösen: absoluter Pfad, Slug oder Ordnername unterhalb von PROJECTS_DIR. */
export function resolveProject(ref) {
  if (!ref) throw new Error('Projekt fehlt (Slug oder Pfad).');
  const dir = isAbsolute(ref) ? ref : resolve(PROJECTS_DIR, ref);
  if (!existsSync(resolve(dir, 'project.json'))) throw new Error(`kein Projekt: ${dir}`);
  return dir;
}

export function loadProject(ref) {
  const dir = resolveProject(ref);
  const json = readJson(resolve(dir, 'project.json'));
  return { dir, json, path: (...p) => resolve(dir, ...p), save() { writeJson(resolve(dir, 'project.json'), json); } };
}

export function listProjects() {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR)
    .filter((n) => existsSync(resolve(PROJECTS_DIR, n, 'project.json')))
    .map((n) => { try { return { slug: n, ...readJson(resolve(PROJECTS_DIR, n, 'project.json')) }; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Legt ein Projekt an. source wird hart verlinkt (gleiche Platte) oder kopiert — nie verschoben. */
export async function createProject(sourcePath, { name, kind = 'raw', fps = 30 } = {}) {
  if (!existsSync(sourcePath)) throw new Error(`Quelle fehlt: ${sourcePath}`);
  const base = basename(sourcePath, extname(sourcePath));
  let slug = slugify(name || base);
  let dir = resolve(PROJECTS_DIR, slug);
  for (let i = 2; existsSync(dir); i++) { dir = resolve(PROJECTS_DIR, `${slug}-${i}`); if (i > 50) throw new Error('zu viele gleichnamige Projekte'); }
  slug = basename(dir);
  for (const sub of ['media', 'audio', 'check', 'out', 'belege', 'graphics']) mkdirSync(resolve(dir, sub), { recursive: true });
  const ext = extname(sourcePath).toLowerCase() || '.mov';
  const dest = resolve(dir, 'media', 'source' + ext);
  try { linkSync(sourcePath, dest); } catch { copyFileSync(sourcePath, dest); }
  const meta = await probe(dest);
  const json = {
    id: slug, name: name || base, createdAt: new Date().toISOString(), fps,
    source: { kind, file: 'media/source' + ext, original: sourcePath, ...meta, bytes: statSync(dest).size },
    styleProfile: 'tim',
    steps: {},
  };
  writeJson(resolve(dir, 'project.json'), json);
  return { dir, json };
}

export function setStep(project, name, status, extra = {}) {
  project.json.steps[name] = { status, at: new Date().toISOString(), ...extra };
  project.save();
}
