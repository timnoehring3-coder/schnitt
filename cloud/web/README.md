# schnitt — Landingpage und Lizenzserver

Next 15 auf Vercel. Keine Datenbank: Lizenzschlüssel sind Ed25519-signiert, Geräte und Schlüssel hängen als
Metadaten am Stripe-Kunden.

## Einrichten (einmalig)

1. **Stripe:** ein Produkt „schnitt“ mit zwei Preisen — einmalig (Lifetime) und monatlich wiederkehrend.
   Die `price_…`-IDs in `.env` eintragen (`STRIPE_PRICE_LIFETIME`, `STRIPE_PRICE_MONTHLY`). Alternativ fertige
   Payment Links in `NEXT_PUBLIC_STRIPE_LINK_*`; dann im Link „Kunden immer anlegen“ wählen und als
   Bestätigungsseite `https://<domain>/erfolg?session_id={CHECKOUT_SESSION_ID}` setzen.
2. **Webhook:** Stripe → Developers → Webhooks → Endpoint `https://<domain>/api/stripe-webhook`,
   Ereignisse `checkout.session.completed` und `charge.refunded`. Signing secret → `STRIPE_WEBHOOK_SECRET`.
3. **Signierschlüssel:** `LICENSE_PRIVATE_KEY` steht in der lokalen `.env` (erzeugt am 20.10.2026); der passende
   öffentliche Teil liegt in `engine/lib/license-public.pem`. Beide gehören zusammen — bei neuem Paar beide tauschen.
4. **Resend:** API-Key und Absender (`RESEND_API_KEY`, `MAIL_FROM`, Domain bei Resend verifizieren).
5. **Vercel:** Projekt aus `cloud/web`, alle Werte aus `.env` als Environment Variables, `NEXT_PUBLIC_SITE_URL`
   auf die Domain. Danach die Adresse in `engine/lib/config.mjs` (`SITE`) eintragen.

## Ablauf eines Kaufs

Kaufen → `/api/checkout?plan=…` → Stripe Checkout → `checkout.session.completed` → `fulfil()` stellt den Schlüssel
aus, schreibt ihn in `customer.metadata.schnitt_key`, mailt ihn → `/erfolg` holt ihn über `/api/key?session_id=…`
(stellt ihn notfalls selbst aus, falls der Webhook hängt).

Engine → `POST /api/license/activate|validate|deactivate` mit `{key, instanceName|instanceId}`.
Aktivierung legt ein Gerät in `customer.metadata.schnitt_instances` an (Limit `LICENSE_SEATS`, Standard 2).
Monatlich: Abo-Status `active|trialing|past_due` zählt als gültig, `expiresAt` = Periodenende.
Rückerstattung: `charge.refunded` setzt `schnitt_revoked`, danach schlägt jede Prüfung fehl.

## Schlüssel von Hand

```
node scripts/issue-key.mjs beta 2026-12-31 [mail@x.de --mail]   # Beta-Tester, ohne Stripe
node scripts/issue-key.mjs lifetime mail@x.de [--mail]          # legt/findet den Stripe-Kunden
node scripts/issue-key.mjs owner                                # Entwickler-Schlüssel: kein Ablauf, kein Stripe, kein Gerätelimit
node scripts/issue-key.mjs lesen <KEY>                          # Nutzlast eines Schlüssels anzeigen (Plan, issued, Ablauf)
```

Der owner-Schlüssel ist der Entwicklerzugang. Es gibt bewusst keine Umgehung per Umgebungsvariable, weil das Repo öffentlich
ist — nur wer `LICENSE_PRIVATE_KEY` hat, kann einen gültigen Schlüssel erzeugen. Verliert ein beta- oder owner-Schlüssel das
Vertrauen: seinen `issued`-Wert (Sekunden, siehe `lesen`) in `LICENSE_REVOKED` (Komma-Liste) auf Vercel eintragen, danach
schlägt die nächste Online-Prüfung fehl (spätestens nach 24 h, offline nach 14 Tagen Grace).

## Lokal testen

```
npm run build && npx next start -p 3999
SCHNITT_LICENSE_API=http://127.0.0.1:3999/api/license node ../../engine/cli.mjs lizenz aktivieren <KEY>
```
