// api.js — die JSON-API des lokalen Servers + SSE-Strom.
const j = async (url, opts) => { const r = await fetch(url, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || r.statusText); return d; };
export const api = {
  status: () => j('/api/status'),
  projects: () => j('/api/projekte'),
  create: (source, name, kind) => j('/api/projekte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, name, kind }) }),
  project: (id) => j(`/api/projekt/${encodeURIComponent(id)}`),
  file: (id, name) => j(`/api/projekt/${encodeURIComponent(id)}/datei/${name}`),
  fileOrNull: (id, name) => j(`/api/projekt/${encodeURIComponent(id)}/datei/${name}`).catch(() => null),
  save: (id, name, data) => j(`/api/projekt/${encodeURIComponent(id)}/datei/${name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  run: (id, steps, opts = {}) => j(`/api/projekt/${encodeURIComponent(id)}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps, ...opts }) }),
  stop: (id) => j(`/api/projekt/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
  media: (id, rel) => `/api/projekt/${encodeURIComponent(id)}/${rel}`,
};
export function subscribe(handlers) {
  const es = new EventSource('/events');
  for (const [ev, fn] of Object.entries(handlers)) es.addEventListener(ev, (e) => fn(JSON.parse(e.data)));
  return () => es.close();
}
export const STEP_LABEL = { analyse: 'Analyse', blocks: 'Blöcke', asr: 'Transkript', splices: 'Klebestellen', takes: 'Takes', seams: 'Nähte', cut: 'Schnitt', chin: 'Kinn', untertitel: 'Untertitel', render: 'Render' };
export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
