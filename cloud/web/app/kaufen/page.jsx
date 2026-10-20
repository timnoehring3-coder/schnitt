import { stripe } from '../../lib/license.js';
export const metadata = { title: 'Kaufen — schnitt' };
export const dynamic = 'force-dynamic';

async function priceLabel(id, fallback) {
  try {
    if (!id || !process.env.STRIPE_SECRET_KEY) return fallback;
    const p = await stripe().prices.retrieve(id);
    const amount = new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency.toUpperCase() }).format(p.unit_amount / 100);
    return p.recurring ? `${amount} im Monat` : `${amount} einmalig`;
  } catch { return fallback; }
}

export default async function Kaufen() {
  const life = await priceLabel(process.env.STRIPE_PRICE_LIFETIME, 'einmalig');
  const month = await priceLabel(process.env.STRIPE_PRICE_MONTHLY, 'im Monat');
  return (
    <main>
      <h1>Lizenz</h1>
      <p className="lead">Ein Schlüssel, zwei Geräte. Der Quellcode ist öffentlich; der Schlüssel schaltet Schnitt und Render frei und bringt Updates.</p>
      <div className="cards" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Lifetime</h3>
          <div className="price">{life}</div>
          <p>Alle Updates der Version 1, zwei Geräte, keine Laufzeit.</p>
          <p style={{ marginTop: 14 }}><a className="btn primary" href="/api/checkout?plan=lifetime">Lifetime kaufen</a></p>
        </div>
        <div className="card">
          <h3>Monatlich</h3>
          <div className="price">{month}</div>
          <p>Jederzeit kündbar, der Schlüssel läuft mit dem Abo.</p>
          <p style={{ marginTop: 14 }}><a className="btn" href="/api/checkout?plan=monthly">Monatlich abonnieren</a></p>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 24 }}>Abwicklung über Stripe. Nach dem Kauf steht der Schlüssel auf der Bestätigungsseite und kommt per Mail.</p>
    </main>
  );
}
