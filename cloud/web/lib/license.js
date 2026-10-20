// lib/license.js — Lizenzschlüssel ohne Datenbank: Ed25519-signierte Nutzlast, Geräte in Stripe-Kundenmetadaten.
// Schlüssel: SCHNITT-<base64url(JSON [v, plan, customer, subscription, issuedAt, expiresAt])>.<base64url(sig)>
// Pläne: lifetime (Einmalkauf, kein Ablauf), monthly (läuft mit dem Stripe-Abo), beta (festes Ablaufdatum, ohne Stripe).
import { createPrivateKey, createPublicKey, sign, verify, randomBytes } from 'node:crypto';
import Stripe from 'stripe';

const SEATS = Number(process.env.LICENSE_SEATS || 2);
const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function privateKey() {
  const k = process.env.LICENSE_PRIVATE_KEY;
  if (!k) throw new Error('LICENSE_PRIVATE_KEY fehlt');
  return createPrivateKey({ key: Buffer.from(k, 'base64'), format: 'der', type: 'pkcs8' });
}
export function publicKeyPem() { return createPublicKey(privateKey()).export({ type: 'spki', format: 'pem' }); }

export function issueKey({ plan, customer = null, subscription = null, expiresAt = null }) {
  if (!['lifetime', 'monthly', 'beta'].includes(plan)) throw new Error(`unbekannter Plan ${plan}`);
  const exp = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;
  const data = Buffer.from(JSON.stringify([1, plan, customer, subscription, Math.floor(Date.now() / 1000), exp]));
  return `SCHNITT-${b64u(data)}.${b64u(sign(null, data, privateKey()))}`;
}

/** Signatur prüfen und Nutzlast lesen. Wirft bei Formfehler oder falscher Signatur. */
export function parseKey(key) {
  const m = /^SCHNITT-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec((key || '').trim());
  if (!m) throw new Error('Schlüsselformat ungültig');
  const data = Buffer.from(m[1], 'base64url'), sig = Buffer.from(m[2], 'base64url');
  if (!verify(null, data, createPublicKey(privateKey()), sig)) throw new Error('Signatur ungültig');
  const [v, plan, customer, subscription, issued, exp] = JSON.parse(data.toString());
  if (v !== 1) throw new Error(`Schlüsselversion ${v} unbekannt`);
  return { plan, customer, subscription, issuedAt: new Date(issued * 1000).toISOString(), expiresAt: exp ? new Date(exp * 1000).toISOString() : null };
}

let _stripe;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY fehlt');
  return (_stripe ||= new Stripe(process.env.STRIPE_SECRET_KEY));
}

/** Gültigkeit laut Stripe: Abo-Status bzw. Rückerstattung. Liefert {ok, status, expiresAt, error}. */
export async function planStatus(p) {
  if (p.plan === 'beta') {
    const ok = !p.expiresAt || Date.parse(p.expiresAt) > Date.now();
    return { ok, status: ok ? 'active' : 'expired', expiresAt: p.expiresAt, error: ok ? null : 'Beta-Schlüssel abgelaufen' };
  }
  if (!p.customer) return { ok: false, status: 'invalid', error: 'Schlüssel ohne Kunde' };
  const cust = await stripe().customers.retrieve(p.customer);
  if (cust.deleted) return { ok: false, status: 'deleted', error: 'Kunde gelöscht' };
  if (cust.metadata?.schnitt_revoked) return { ok: false, status: 'revoked', error: 'Lizenz zurückgezogen (Rückerstattung)' };
  if (p.plan === 'lifetime') return { ok: true, status: 'active', expiresAt: null, customer: cust };
  const sub = await stripe().subscriptions.retrieve(p.subscription);
  const end = sub.current_period_end || sub.items?.data?.[0]?.current_period_end || null;
  const ok = ['active', 'trialing', 'past_due'].includes(sub.status);
  return { ok, status: sub.status, expiresAt: end ? new Date(end * 1000).toISOString() : null, customer: cust, error: ok ? null : `Abo ${sub.status}` };
}

function readInstances(cust) { try { return JSON.parse(cust?.metadata?.schnitt_instances || '[]'); } catch { return []; } }
async function writeInstances(cust, list) {
  await stripe().customers.update(cust.id, { metadata: { schnitt_instances: JSON.stringify(list) } });
}

export async function activate(key, instanceName) {
  const p = parseKey(key);
  const st = await planStatus(p);
  if (!st.ok) return { activated: false, error: st.error };
  const inst = { id: randomBytes(6).toString('hex'), name: String(instanceName || 'Mac').slice(0, 60), at: new Date().toISOString() };
  if (st.customer) {
    const list = readInstances(st.customer);
    if (list.length >= SEATS) return { activated: false, error: `Schon ${SEATS} Geräte aktiviert — erst eines abmelden (/schnitt:lizenz abmelden)` };
    await writeInstances(st.customer, [...list, inst]);
  }
  return { activated: true, instance: inst, plan: p.plan, status: st.status, expiresAt: st.expiresAt };
}

export async function validate(key, instanceId) {
  const p = parseKey(key);
  const st = await planStatus(p);
  if (!st.ok) return { valid: false, status: st.status, error: st.error, plan: p.plan };
  if (st.customer && instanceId && !readInstances(st.customer).some((i) => i.id === instanceId)) {
    return { valid: false, status: 'inactive', error: 'Gerät nicht (mehr) aktiviert — /schnitt:lizenz <KEY> erneut', plan: p.plan };
  }
  return { valid: true, status: st.status, plan: p.plan, expiresAt: st.expiresAt };
}

export async function deactivate(key, instanceId) {
  const p = parseKey(key);
  if (p.customer) {
    const cust = await stripe().customers.retrieve(p.customer);
    if (!cust.deleted) await writeInstances(cust, readInstances(cust).filter((i) => i.id !== instanceId));
  }
  return { deactivated: true };
}

/** Nach dem Kauf: Schlüssel ausstellen, am Kunden merken, Mail schicken. Idempotent über metadata.schnitt_key. */
export async function fulfil(session) {
  const s = stripe();
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) return { ok: false, error: 'Checkout ohne Kunde (customer_creation: always setzen)' };
  const cust = await s.customers.retrieve(customerId);
  if (cust.metadata?.schnitt_key) return { ok: true, key: cust.metadata.schnitt_key, plan: cust.metadata.schnitt_plan, already: true };
  const plan = session.mode === 'subscription' ? 'monthly' : 'lifetime';
  const subscription = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const key = issueKey({ plan, customer: customerId, subscription });
  await s.customers.update(customerId, { metadata: { schnitt_key: key, schnitt_plan: plan } });
  const email = session.customer_details?.email || cust.email;
  const mailed = email ? await sendKeyMail(email, key) : false;
  return { ok: true, key, plan, mailed };
}

export const INSTALL_LINES = (key) => `Im Terminal (installiert alles und richtet Claude Code ein):
curl -fsSL https://raw.githubusercontent.com/timnoehring3-coder/schnitt/main/tools/install/install.sh | bash

Oder direkt in Claude Code:
/plugin marketplace add timnoehring3-coder/schnitt
/plugin install schnitt@schnitt
/schnitt:lizenz ${key}

Danach: /schnitt:neu ~/Movies/aufnahme.mov — die Einrichtung (ffmpeg, Whisper, Remotion) läuft beim ersten Aufruf von selbst.`;

export async function sendKeyMail(to, key) {
  if (!process.env.RESEND_API_KEY) return false;
  const { Resend } = await import('resend');
  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.MAIL_FROM || 'schnitt <onboarding@resend.dev>',
    to, subject: 'Dein schnitt-Schlüssel',
    text: `Danke für deinen Kauf.\n\nDein Lizenzschlüssel:\n${key}\n\n${INSTALL_LINES(key)}\n\nFragen? Einfach auf diese Mail antworten.\n`,
  });
  return true;
}
