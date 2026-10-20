#!/usr/bin/env node
// Schlüssel von Hand ausstellen (Beta-Tester, Ersatz). Liest cloud/web/.env.
//   node scripts/issue-key.mjs beta 2026-12-31 [mail] [--mail]   Beta-Schlüssel mit Ablauf, ohne Stripe
//   node scripts/issue-key.mjs lifetime mail@x.de [--mail]        legt/findet den Stripe-Kunden, hängt den Schlüssel an
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(here, '..', '.env'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const { issueKey, stripe, sendKeyMail } = await import('../lib/license.js');
const args = process.argv.slice(2).filter((a) => a !== '--mail');
const mail = process.argv.includes('--mail');
const [plan, a, b] = args;
if (plan === 'beta') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a || '')) { console.error('Ablaufdatum JJJJ-MM-TT fehlt'); process.exit(1); }
  const key = issueKey({ plan: 'beta', expiresAt: `${a}T23:59:59Z` });
  console.log(key); if (mail && b) await sendKeyMail(b, key);
} else if (plan === 'lifetime') {
  if (!a?.includes('@')) { console.error('Mail-Adresse fehlt'); process.exit(1); }
  const s = stripe();
  const found = await s.customers.list({ email: a, limit: 1 });
  const cust = found.data[0] || await s.customers.create({ email: a });
  const key = cust.metadata?.schnitt_key || issueKey({ plan, customer: cust.id });
  await s.customers.update(cust.id, { metadata: { schnitt_key: key, schnitt_plan: plan } });
  console.log(key); if (mail) await sendKeyMail(a, key);
} else { console.error('Plan: beta <JJJJ-MM-TT> | lifetime <mail> (monthly entsteht nur über den Checkout)'); process.exit(1); }
