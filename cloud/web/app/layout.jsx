import './globals.css';
export const metadata = { title: 'schnitt — Shorts-Schnitt aus Claude Code', description: 'Pausen raus, Takes wählen, Untertitel, Render. Lokal auf deinem Mac, gesteuert aus Claude Code.' };
export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <header>
          <svg width="20" height="20" viewBox="0 0 32 32"><g fill="#fff"><circle cx="10" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="22" cy="10" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2.4"/><circle cx="24" cy="16" r="2"/><circle cx="10" cy="22" r="2"/><circle cx="16" cy="22" r="2"/><circle cx="22" cy="22" r="2"/></g></svg>
          <a href="/" style={{ fontWeight: 600, textDecoration: 'none' }}>schnitt</a>
          <nav><a href="/docs">Docs</a><a href="/kaufen">Kaufen</a><a href="https://github.com/timnoehring3-coder/schnitt">GitHub</a></nav>
        </header>
        {children}
        <footer><span>© {new Date().getFullYear()} Tim Nöhring</span><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="https://github.com/timnoehring3-coder/schnitt/blob/main/LICENSE">Lizenz</a></footer>
      </body>
    </html>
  );
}
