export const metadata = { title: 'Docs — schnitt' };
export default function Docs() {
  return (
    <main>
      <h1>Docs</h1>
      <h2>Installation</h2>
      <pre>{`curl -fsSL https://raw.githubusercontent.com/timnoehring3-coder/schnitt/main/tools/install/install.sh | bash`}</pre>
      <p className="muted">oder in Claude Code:</p>
      <pre>{`/plugin marketplace add timnoehring3-coder/schnitt
/plugin install schnitt@schnitt
/schnitt:lizenz <KEY>`}</pre>
      <p className="muted">Setup installiert ffmpeg, whisper-cpp, node@22 über Homebrew, lädt das Whisper-Modell (1,6 GB), richtet Remotion ein und baut das Dashboard. Wiederholbar.</p>
      <h2>Ablauf</h2>
      <ol>
        <li><code>/schnitt:neu ~/Movies/aufnahme.mov</code> — Analyse, Blöcke, Transkript, Takes.</li>
        <li><code>/schnitt:dashboard</code> — Versuche prüfen, Kanten schieben, „Schnitt bauen“.</li>
        <li><code>/schnitt:render aufnahme</code> — fertiges MP4 in <code>~/schnitt-projekte/aufnahme/out/</code>.</li>
      </ol>
      <h2>Weiter lesen</h2>
      <ul>
        <li><a href="https://github.com/timnoehring3-coder/schnitt/blob/main/docs/INSTALL.md">INSTALL.md</a> — Fehlerbilder</li>
        <li><a href="https://github.com/timnoehring3-coder/schnitt/blob/main/docs/REGELWERK.md">REGELWERK.md</a> — die Zahlen hinter dem Schnitt</li>
        <li><a href="https://github.com/timnoehring3-coder/schnitt/blob/main/docs/BUEHNE.md">BUEHNE.md</a> — Dateiformat eines Projekts</li>
      </ul>
    </main>
  );
}
