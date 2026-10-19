#!/usr/bin/env node
// cli.mjs — die eine Tür in die Engine. Dashboard und Claude rufen beide genau das hier.
//
//   node engine/cli.mjs neu <quelle> [--name X] [--typ roh|fertig]
//   node engine/cli.mjs <schritt> <projekt> [--force]            (analyse blocks asr takes seams cut splices chin untertitel render)
//   node engine/cli.mjs run <projekt> [--bis <schritt>] [--force] [--skip a,b]
//   node engine/cli.mjs status <projekt> | liste
//   node engine/cli.mjs serve [--port 4747]
//   node engine/cli.mjs lizenz aktivieren <KEY> | status | abmelden
//   node engine/cli.mjs doctor
import { createProject, loadProject, listProjects } from './lib/project.mjs';
import { STEPS, chain, runStep, runChain } from './steps.mjs';
import { result, log } from './lib/progress.mjs';

function parseArgs(argv) {
  const pos = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { opts[k] = next; i++; } else opts[k] = true;
    } else pos.push(a);
  }
  return { pos, opts };
}

const { pos, opts } = parseArgs(process.argv.slice(2));
const cmd = pos[0];

try {
  if (!cmd || cmd === 'hilfe' || cmd === '--help') {
    log(`schnitt-Engine\n  neu <quelle> [--name X] [--typ roh|fertig]\n  ${Object.keys(STEPS).join(' | ')} <projekt> [--force]\n  run <projekt> [--bis <schritt>] [--force] [--skip a,b]\n  status <projekt> | liste\n  serve [--port 4747]\n  lizenz aktivieren <KEY> | status | abmelden\n  doctor`);
    process.exit(0);
  }
  if (cmd === 'neu') {
    const kind = opts.typ === 'fertig' ? 'cut' : 'raw';
    const { dir, json } = await createProject(pos[1], { name: opts.name, kind, fps: opts.fps ? Number(opts.fps) : 30 });
    log(`Projekt angelegt: ${dir}`);
    result({ ok: true, dir, id: json.id, source: json.source, chain: chain(kind) });
  } else if (cmd === 'liste') {
    result({ ok: true, projects: listProjects() });
  } else if (cmd === 'status') {
    const p = loadProject(pos[1]);
    result({ ok: true, id: p.json.id, dir: p.dir, source: p.json.source, steps: p.json.steps, chain: chain(p.json.source.kind) });
  } else if (cmd === 'run') {
    const p = loadProject(pos[1]);
    const r = await runChain(p, { until: opts.bis, force: Boolean(opts.force), skip: opts.skip ? String(opts.skip).split(',') : [] });
    result({ ok: true, ran: Object.keys(r), steps: p.json.steps });
  } else if (STEPS[cmd]) {
    const p = loadProject(pos[1]);
    const r = await runStep(p, cmd, { ...opts, force: Boolean(opts.force) });
    result({ ok: true, step: cmd, ...(r?.summary ? { summary: r.summary } : {}) });
  } else if (cmd === 'serve') {
    const { serve } = await import('./server.mjs');
    await serve({ port: opts.port ? Number(opts.port) : 4747, open: !opts['no-open'] });
  } else if (cmd === 'lizenz') {
    const lic = await import('./lib/license.mjs');
    const sub = pos[1];
    if (sub === 'aktivieren') result(await lic.activate(pos[2]));
    else if (sub === 'abmelden') result(await lic.deactivate());
    else result(await lic.status());
  } else if (cmd === 'doctor') {
    const { doctor } = await import('./lib/doctor.mjs');
    result(await doctor());
  } else {
    throw new Error(`unbekanntes Kommando: ${cmd}`);
  }
} catch (e) {
  log(`Fehler: ${e?.message || e}`);
  result({ ok: false, error: String(e?.message || e) });
  process.exit(1);
}
