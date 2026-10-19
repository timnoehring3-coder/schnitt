export default function Home() {
  return (
    <main>
      <h1>Rohaufnahme rein.<br />Fertiger Short raus.</h1>
      <p className="lead">schnitt ist ein Claude-Code-Plugin, das aus deinen Takes den Zusammenschnitt ohne Sprechpausen baut, Untertitel setzt und das Video rendert. Alles läuft auf deinem Mac. Kein Upload, kein Abo-Cloud-Editor.</p>
      <div className="row" style={{ margin: '28px 0' }}>
        <a className="btn primary" href="/kaufen">Lizenz kaufen</a>
        <a className="btn" href="/docs">So funktioniert es</a>
      </div>
      <h2>Was es macht</h2>
      <div className="cards">
        <div className="card"><h3>Pausen raus, Takes wählen</h3><p>Erkennt jeden Versuch eines Satzes, nimmt den vollständigen ohne Stottern, schneidet schlag auf schlag — gemessen am Handschnitt, nicht geschätzt.</p></div>
        <div className="card"><h3>Untertitel unter dem Kinn</h3><p>Ein Wort, weiß, exakt unter deinem Kinn je Einstellung. Namen korrigierst du einmal, danach sitzen sie.</p></div>
        <div className="card"><h3>Dashboard mit Take-Picker</h3><p>Wellenform, Satzgruppen, Versuche an und aus, Kanten frameweise schieben, Nahtbericht, Vorschau. Lokal im Browser.</p></div>
        <div className="card"><h3>Render in Remotion</h3><p>1080×1920, 30 fps, fertig für Instagram, TikTok, YouTube. Motion-Graphics und Stilprofile folgen.</p></div>
      </div>
      <h2>Für wen</h2>
      <p className="lead" style={{ fontSize: 17 }}>Creator, die Claude Code nutzen und ihre Shorts selbst drehen. Du brauchst einen Mac (Apple Silicon empfohlen), Claude Code und 20 Minuten für die Einrichtung.</p>
      <h2>Drei Zeilen</h2>
      <pre>{`/plugin install schnitt --marketplace timnoehring3-coder/schnitt-marketplace
/schnitt:setup
/schnitt:neu ~/Movies/aufnahme.mov`}</pre>
    </main>
  );
}
