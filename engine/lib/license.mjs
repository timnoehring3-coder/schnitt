// lib/license.mjs — Lemon-Squeezy-Lizenz. Kein API-Key nötig: activate/validate/deactivate sind öffentliche Endpunkte.
// Datei ~/.config/schnitt/license.json (chmod 600): {key, instanceId, instanceName, variant, product, status, expiresAt, lastOk, lastCheck}
// Prüfung höchstens 1× je 24 h, Offline-Grace 14 Tage ab lastOk. SCHNITT_DEV=1 umgeht die Prüfung (Entwicklung, Korpus-Tests).
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { hostname } from 'node:os';
import { CONFIG_DIR } from './paths.mjs';

const API = process.env.SCHNITT_LICENSE_API || 'https://api.lemonsqueezy.com/v1/licenses';
const FILE = resolve(CONFIG_DIR, 'license.json');
const DAY = 86400e3, GRACE_DAYS = 14;

export function readLicense() { try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return null; } }
function writeLicense(obj) { mkdirSync(CONFIG_DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(obj, null, 2)); chmodSync(FILE, 0o600); return obj; }

async function call(path, body) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = `HTTP ${res.status}`;
  return json;
}

export async function activate(key) {
  if (!key) throw new Error('Lizenzschlüssel fehlt: lizenz aktivieren <KEY>');
  const r = await call('activate', { license_key: key.trim(), instance_name: hostname() });
  if (!r.activated) return { ok: false, error: r.error || 'Aktivierung abgelehnt' };
  const lic = writeLicense({
    key: key.trim(), instanceId: r.instance?.id, instanceName: r.instance?.name, variant: r.meta?.variant_name, product: r.meta?.product_name,
    status: r.license_key?.status, expiresAt: r.license_key?.expires_at || null, lastOk: Date.now(), lastCheck: Date.now(),
  });
  return { ok: true, variant: lic.variant, product: lic.product, expiresAt: lic.expiresAt };
}

export async function deactivate() {
  const lic = readLicense();
  if (!lic) return { ok: true, note: 'keine Lizenz hinterlegt' };
  const r = await call('deactivate', { license_key: lic.key, instance_id: lic.instanceId }).catch(() => ({}));
  try { unlinkSync(FILE); } catch { /* weg ist weg */ }
  return { ok: true, deactivated: Boolean(r.deactivated) };
}

/** Prüft online, höchstens einmal je 24 h; offline zählt die Grace-Frist ab dem letzten OK. */
export async function status({ force = false } = {}) {
  if (process.env.SCHNITT_DEV === '1') return { ok: true, mode: 'dev' };
  const lic = readLicense();
  if (!lic) return { ok: false, error: 'keine Lizenz — /schnitt:lizenz <KEY>' };
  const stale = Date.now() - (lic.lastCheck || 0) > DAY;
  if (stale || force) {
    try {
      const r = await call('validate', { license_key: lic.key, instance_id: lic.instanceId });
      lic.lastCheck = Date.now();
      if (r.valid) { lic.lastOk = Date.now(); lic.status = r.license_key?.status; lic.expiresAt = r.license_key?.expires_at || null; }
      else if (r.error || r.valid === false) { lic.status = r.license_key?.status || 'invalid'; lic.lastError = r.error || 'ungültig'; }
      writeLicense(lic);
    } catch (e) { lic.lastCheck = Date.now(); lic.offline = true; writeLicense(lic); }
  }
  const sinceOk = (Date.now() - (lic.lastOk || 0)) / DAY;
  const expired = lic.expiresAt && Date.parse(lic.expiresAt) < Date.now();
  const okStatus = lic.status === 'active' && !expired;
  if (okStatus && sinceOk <= GRACE_DAYS) return { ok: true, variant: lic.variant, product: lic.product, expiresAt: lic.expiresAt, lastOk: new Date(lic.lastOk).toISOString(), graceDaysLeft: Math.max(0, Math.round(GRACE_DAYS - sinceOk)) };
  return { ok: false, error: expired ? 'Lizenz abgelaufen' : !okStatus ? `Lizenz ${lic.status || 'ungültig'}` : `seit ${Math.round(sinceOk)} Tagen nicht bestätigt (Grace ${GRACE_DAYS} Tage) — online gehen`, variant: lic.variant };
}

export async function ensureLicensed(what = 'dieser Schritt') {
  const s = await status();
  if (!s.ok) throw new Error(`${what} braucht eine gültige Lizenz: ${s.error}`);
  return s;
}
