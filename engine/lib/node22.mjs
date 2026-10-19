// lib/node22.mjs — Remotion will Node 22. Der Rest der Engine läuft mit jedem Node ≥ 22.
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.SCHNITT_NODE22,
  '/opt/homebrew/opt/node@22/bin/node',   // Apple Silicon
  '/usr/local/opt/node@22/bin/node',      // Intel
];

export function node22() {
  const found = CANDIDATES.filter(Boolean).find((p) => existsSync(p));
  if (found) return found;
  const major = Number(process.versions.node.split('.')[0]);
  if (major === 22) return process.execPath;
  throw new Error('Node 22 nicht gefunden — `brew install node@22` oder SCHNITT_NODE22 setzen.');
}
