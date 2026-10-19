// Lemon-Squeezy-Webhook: prüft die HMAC-Signatur, nimmt order_created / subscription_created, schickt dem Käufer
// den Lizenzschlüssel mit den drei Installationszeilen. Keine Datenbank — Lemon Squeezy ist die Quelle der Wahrheit.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req) {
  const secret = process.env.LS_WEBHOOK_SECRET;
  if (!secret) return new Response('LS_WEBHOOK_SECRET fehlt', { status: 500 });
  const raw = await req.text();
  const sig = req.headers.get('x-signature') || '';
  const digest = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(digest), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response('Signatur ungültig', { status: 401 });

  const ev = JSON.parse(raw);
  const name = ev.meta?.event_name;
  if (!['order_created', 'subscription_created'].includes(name)) return Response.json({ ok: true, ignored: name });

  const attr = ev.data?.attributes || {};
  const email = attr.user_email;
  const keys = (attr.first_order_item?.license_keys || ev.meta?.custom_data?.license_keys || []).map((k) => k.key || k).filter(Boolean);
  // Bei Abos hängt der Schlüssel an der Bestellung; license_key_created kommt separat — wir mailen, sobald wir einen haben.
  if (!email) return Response.json({ ok: true, note: 'keine Mail-Adresse' });
  if (!keys.length) return Response.json({ ok: true, note: 'noch kein Schlüssel im Ereignis' });

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.MAIL_FROM || 'schnitt <onboarding@resend.dev>',
      to: email,
      subject: 'Dein schnitt-Schlüssel',
      text: `Danke für deinen Kauf.\n\nDein Lizenzschlüssel:\n${keys.join('\n')}\n\nIn Claude Code:\n/plugin install schnitt --marketplace timnoehring3-coder/schnitt-marketplace\n/schnitt:setup\n/schnitt:lizenz ${keys[0]}\n\nFragen? Einfach auf diese Mail antworten.\n`,
    });
  }
  return Response.json({ ok: true, mailed: Boolean(process.env.RESEND_API_KEY), keys: keys.length });
}
