// Stripe-Webhook: Signatur prüfen, bei abgeschlossenem Checkout den Schlüssel ausstellen und mailen,
// bei voller Rückerstattung die Lizenz zurückziehen. Keine Datenbank — Stripe ist die Quelle der Wahrheit.
import { stripe, fulfil } from '../../../lib/license.js';
export const runtime = 'nodejs';

export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET fehlt', { status: 500 });
  const raw = await req.text();
  let ev;
  try { ev = stripe().webhooks.constructEvent(raw, req.headers.get('stripe-signature') || '', secret); }
  catch (e) { return new Response(`Signatur ungültig: ${e.message}`, { status: 401 }); }

  if (ev.type === 'checkout.session.completed') {
    const session = ev.data.object;
    if (session.payment_status !== 'paid' && session.mode !== 'subscription') return Response.json({ ok: true, note: 'noch nicht bezahlt' });
    const r = await fulfil(session);
    return Response.json({ ok: r.ok, plan: r.plan, mailed: r.mailed, already: r.already, error: r.error });
  }
  if (ev.type === 'charge.refunded') {
    const ch = ev.data.object;
    if (ch.refunded && ch.customer) await stripe().customers.update(ch.customer, { metadata: { schnitt_revoked: new Date().toISOString() } });
    return Response.json({ ok: true, revoked: Boolean(ch.refunded) });
  }
  return Response.json({ ok: true, ignored: ev.type });
}
