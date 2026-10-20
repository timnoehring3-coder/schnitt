// GET /api/checkout?plan=lifetime|monthly → Stripe Checkout. Payment-Link aus der Umgebung geht vor; sonst eigene Session.
import { stripe } from '../../../lib/license.js';
export const runtime = 'nodejs';

export async function GET(req) {
  const url = new URL(req.url);
  const plan = url.searchParams.get('plan') === 'monthly' ? 'monthly' : 'lifetime';
  const link = plan === 'monthly' ? process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_LINK_LIFETIME;
  if (link) return Response.redirect(link, 303);
  const price = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_LIFETIME;
  if (!price) return new Response(`STRIPE_PRICE_${plan.toUpperCase()} fehlt`, { status: 500 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const session = await stripe().checkout.sessions.create({
    mode: plan === 'monthly' ? 'subscription' : 'payment',
    line_items: [{ price, quantity: 1 }],
    success_url: `${site}/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/kaufen`,
    allow_promotion_codes: true,
    ...(plan === 'monthly' ? {} : { customer_creation: 'always' }),
    ...(process.env.STRIPE_AUTOMATIC_TAX === '1' ? { automatic_tax: { enabled: true } } : {}),
  });
  return Response.redirect(session.url, 303);
}
