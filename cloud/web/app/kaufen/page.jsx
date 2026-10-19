export const metadata = { title: 'Kaufen — schnitt' };
export default function Kaufen() {
  const life = process.env.NEXT_PUBLIC_LS_CHECKOUT_LIFETIME || '#';
  const month = process.env.NEXT_PUBLIC_LS_CHECKOUT_MONTHLY || '#';
  return (
    <main>
      <h1>Lizenz</h1>
      <p className="lead">Ein Schlüssel, zwei Geräte. Der Quellcode ist öffentlich; der Schlüssel schaltet Schnitt und Render frei und bringt Updates.</p>
      <div className="cards" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Lifetime</h3>
          <div className="price">einmalig</div>
          <p>Alle Updates der Version 1, zwei Geräte, keine Laufzeit.</p>
          <p style={{ marginTop: 14 }}><a className="btn primary" href={life}>Lifetime kaufen</a></p>
        </div>
        <div className="card">
          <h3>Monatlich</h3>
          <div className="price">im Monat</div>
          <p>Jederzeit kündbar, der Schlüssel läuft mit dem Abo.</p>
          <p style={{ marginTop: 14 }}><a className="btn" href={month}>Monatlich abonnieren</a></p>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 24 }}>Abwicklung über Lemon Squeezy (Merchant of Record, Rechnung mit Steuer). Nach dem Kauf kommt der Schlüssel per Mail und steht auf der Bestätigungsseite.</p>
    </main>
  );
}
