// lib/license.mjs — Lizenz gegen den eigenen Server (cloud/web, Stripe dahinter). Schlüssel sind Ed25519-signiert:
// die Signatur prüft die Engine offline mit license-public.pem, Abo-Status und Geräte prüft der Server.
// Datei ~/.config/schnitt/license.json (chmod 600): {key, instanceId, instanceName, plan, status, expiresAt, lastOk, lastCheck}
// Prüfung höchstens 1× je 24 h, Offline-Grace 14 Tage ab lastOk. Es gibt KEINE Umgehung per Umgebungsvariable (öffentliches
// Repo): Entwicklung läuft mit einem signierten owner-Schlüssel, den nur der private Schlüssel des Betreibers erzeugt.
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { createPublicKey, verify } from 'node:crypto';
import { CONFIG_DIR } from './paths.mjs';
import { LICENSE_API } from './config.mjs';

const API = process.env.SCHNITT_LICENSE_API || LICENSE_API;
const PUB = process.env.SCHNITT_LICENSE_PUBKEY || resolve(dirname(fileURLToPath(import.meta.url)), 'license-public.pem');
const FILE = resolve(CONFIG_DIR, 'license.json');
const DAY = 86400e3, GRACE_DAYS = 14;
const PLAN_LABEL = { lifetime: 'Lifetime', monthly: 'Monatlich', beta: 'Beta', owner: 'Entwickler' };

export function readLicense() { try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return null; } }
function writeLicense(obj) { mkdirSync(CONFIG_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(obj, null, 2)); chmodSync(FILE, 0o600); return obj; }

/** Form und Signatur offline prüfen; liefert {plan, expiresAt} oder wirft. */
export function parseKey(key) {
  const m = /^SCHNITT-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec((key || '').trim());
  if (!m) throw new Error('Schlüsselformat ungültig (erwartet SCHNITT-…)');
  const data = Buffer.from(m[1], 'base64url'), sig = Buffer.from(m[2], 'base64url');
  if (!verify(null, data, createPublicKey(readFileSync(PUB, 'utf8')), sig)) throw new Error('Schlüssel-Signatur ungültig');
  const [v, plan, , , , exp] = JSON.parse(data.toString());
  if (v !== 1) throw new Error(`Schlüsselversion ${v} unbekannt`);
  return { plan, expiresAt: exp ? new Date(exp * 1000).toISOString() : null };
}

async function call(path, body) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  // Antwort nicht von unserem Server (Vercel-404, Proxy, Wartungsseite): error fehlt oder ist kein Text → wie „nicht erreichbar"
  if (!res.ok && typeof json.error !== 'string') throw new Error(`HTTP ${res.status}${json?.error?.code && json.error.code !== String(res.status) ? ` ${json.error.code}` : ''}`);
  return json;
}

export async function activate(key) {
  if (!key) throw new Error('Lizenzschlüssel fehlt: lizenz aktivieren <KEY>');
  const k = key.trim();
  const local = parseKey(k);
  // owner-Schlüssel dürfen auch ohne erreichbaren Server aktivieren (Signatur reicht); die Grace-Frist läuft dann ab jetzt.
  const r = await call('activate', { key: k, instanceName: hostname() }).catch((e) => {
    if (local.plan === 'owner') return { activated: true, plan: 'owner', status: 'active', offline: true };
    throw new Error(`Lizenzserver nicht erreichbar (${e?.cause?.code || e?.message || e})`);
  });
  if (!r.activated) return { ok: false, error: r.error || 'Aktivierung abgelehnt' };
  const lic = writeLicense({
    key: k, instanceId: r.instance?.id, instanceName: r.instance?.name, plan: r.plan || local.plan,
    status: r.status || 'active', expiresAt: r.expiresAt || local.expiresAt || null, lastOk: Date.now(), lastCheck: Date.now(),
    ...(r.offline ? { offline: true } : {}),
  });
  return { ok: true, plan: lic.plan, variant: PLAN_LABEL[lic.plan] || lic.plan, expiresAt: lic.expiresAt };
}

export async function deactivate() {
  const lic = readLicense();
  if (!lic) return { ok: true, note: 'keine Lizenz hinterlegt' };
  const r = await call('deactivate', { key: lic.key, instanceId: lic.instanceId }).catch(() => ({}));
  try { unlinkSync(FILE); } catch { /* weg ist weg */ }
  return { ok: true, deactivated: Boolean(r.deactivated) };
}

/** Prüft online, höchstens einmal je 24 h; offline zählt die Grace-Frist ab dem letzten OK. */
export async function status({ force = false } = {}) {
  const lic = readLicense();
  if (!lic) return { ok: false, error: 'keine Lizenz — /schnitt:lizenz <KEY>' };
  const stale = Date.now() - (lic.lastCheck || 0) > DAY;
  if (stale || force) {
    try {
      const r = await call('validate', { key: lic.key, instanceId: lic.instanceId });
      lic.lastCheck = Date.now(); delete lic.offline;
      if (r.valid) { lic.lastOk = Date.now(); lic.status = r.status || 'active'; lic.expiresAt = r.expiresAt || null; delete lic.lastError; }
      else if (r.valid === false || r.error) { lic.status = r.status || 'invalid'; lic.lastError = r.error || 'ungültig'; }
      writeLicense(lic);
    } catch { lic.lastCheck = Date.now(); lic.offline = true; writeLicense(lic); }
  }
  const sinceOk = (Date.now() - (lic.lastOk || 0)) / DAY;
  const expired = lic.expiresAt && Date.parse(lic.expiresAt) < Date.now();
  const okStatus = ['active', 'trialing', 'past_due'].includes(lic.status) && !expired;
  const variant = PLAN_LABEL[lic.plan] || lic.plan;
  if (okStatus && sinceOk <= GRACE_DAYS) return { ok: true, plan: lic.plan, variant, expiresAt: lic.expiresAt, lastOk: new Date(lic.lastOk).toISOString(), graceDaysLeft: Math.max(0, Math.round(GRACE_DAYS - sinceOk)) };
  return { ok: false, error: expired ? 'Lizenz abgelaufen' : !okStatus ? `Lizenz ${lic.lastError || lic.status || 'ungültig'}` : `seit ${Math.round(sinceOk)} Tagen nicht bestätigt (Grace ${GRACE_DAYS} Tage) — online gehen`, plan: lic.plan, variant };
}

export async function ensureLicensed(what = 'dieser Schritt') {
  const s = await status();
  if (!s.ok) throw new Error(`${what} braucht eine gültige Lizenz: ${s.error}`);
  return s;
}
