import KeyBox from './KeyBox.jsx';
export const metadata = { title: 'Danke — schnitt' };

export default async function Erfolg({ searchParams }) {
  const { session_id } = await searchParams;
  return (
    <main>
      <h1>Danke.</h1>
      <KeyBox sessionId={session_id || ''} />
      <h2>So geht es weiter</h2>
      <p className="lead" style={{ fontSize: 17 }}>Eine Zeile im Terminal richtet alles ein, Claude Code eingeschlossen:</p>
      <pre>{`curl -fsSL https://raw.githubusercontent.com/timnoehring3-coder/schnitt/main/tools/install/install.sh | bash`}</pre>
      <p className="lead" style={{ fontSize: 17 }}>Oder direkt in Claude Code:</p>
      <pre>{`/plugin marketplace add timnoehring3-coder/schnitt
/plugin install schnitt@schnitt
/schnitt:lizenz <DEIN-SCHLÜSSEL>`}</pre>
      <p className="muted">Die Einrichtung von ffmpeg, Whisper und Remotion läuft beim ersten Aufruf von selbst. Keine Mail nach zehn Minuten? Spam prüfen, sonst auf die Stripe-Bestätigung antworten.</p>
    </main>
  );
}
