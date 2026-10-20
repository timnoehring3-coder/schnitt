// GET /api/key?session_id=cs_… → Schlüssel der Bestellung. Fällt der Webhook aus, stellt dieser Aufruf ihn bei
// bezahlter Session selbst aus (fulfil ist idempotent über die Kundenmetadaten).
import { stripe, fulfil } from '../../../lib/license.js';
export const runtime = 'nodejs';

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('session_id');
  if (!/^cs_/.test(id || '')) return Response.json({ error: 'session_id fehlt' }, { status: 400 });
  const session = await stripe().checkout.sessions.retrieve(id, { expand: ['customer'] });
  const paid = session.payment_status === 'paid' || session.mode === 'subscription';
  if (!paid) return Response.json({ pending: true, status: session.payment_status });
  const r = await fulfil(session);
  return Response.json(r.ok ? { key: r.key, plan: r.plan } : { pending: true, error: r.error });
}
