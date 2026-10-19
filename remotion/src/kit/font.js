// kit/font.js — Schriften. v1 auf macOS: Systemschriften per Familienname (Chromium findet sie). Später eingebettet
// (build-fonts.sh → font-data.js, gitignored), damit kein Font-Request den Render aushungert (Tim OS, 22.07.).
export const FONT_FAMILY = '"SF Pro Display", "SF Pro Text", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
export const SUB_FAMILY = '"Helvetica Neue", Helvetica, "SF Pro Display", Arial, sans-serif';
export const MONO_FAMILY = '"SF Mono", Menlo, monospace';
export const SERIF_FAMILY = '"Instrument Serif", "Times New Roman", serif';
export const SCRIPT_FAMILY = '"Pinyon Script", cursive';
