Lemon Squeezy sendet den Schlüssel bei Abos oft erst im Ereignis `license_key_created`. Wenn die Beta zeigt, dass
`order_created` ohne Schlüssel ankommt: in Lemon Squeezy das Ereignis `license_key_created` zusätzlich abonnieren —
der Handler oben nimmt `attr.key` dann ebenso (Feld `key` im Ereignis-Payload).
