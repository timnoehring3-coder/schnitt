#!/usr/bin/env bash
# doctor.sh — ruft die Engine-Prüfung auf und druckt sie lesbar.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
node "$ROOT/engine/cli.mjs" doctor 2>/dev/null | sed -n 's/^@@RESULT //p' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const r of j.rows)console.log((r.ok?"ok  ":"--  ")+r.name.padEnd(26)+r.detail+(r.fix?"  → "+r.fix:""));process.exit(j.ok?0:1)})'
