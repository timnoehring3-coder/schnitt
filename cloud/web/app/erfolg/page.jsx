export const metadata = { title: 'Danke — schnitt' };
export default function Erfolg() {
  return (
    <main>
      <h1>Danke.</h1>
      <p className="lead">Dein Schlüssel steht in der Mail von Lemon Squeezy und in der Bestätigung, die gerade an dich rausging. So geht es weiter:</p>
      <pre>{`/plugin install schnitt --marketplace timnoehring3-coder/schnitt-marketplace
/schnitt:setup
/schnitt:lizenz <DEIN-SCHLÜSSEL>`}</pre>
      <p className="muted">Keine Mail nach zehn Minuten? Spam prüfen, sonst antworten auf die Bestellbestätigung.</p>
    </main>
  );
}
