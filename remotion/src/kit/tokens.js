// kit/tokens.js — Marken-Tokens. Standard = Tims Handschrift (Mittelstand Medien, aus Tim OS remotion/src/lib/brand.js);
// ein Stilprofil (style-profile.json → palette) überschreibt sie zur Laufzeit über applyProfile().
export const BRAND = {
  creme: '#F3EFE6', paper: '#FBF9F3', ink: '#1B241F', ink2: '#55605A', ink3: '#8A938C',
  green: '#2F7D4F', greenDeep: '#1F6E43', greenLight: '#7FD3A1', glow: '#5FC48C',
  lineOnWhite: '#E4E6E5', lineOnCreme: '#DAD9D1', greenTint: '#E3F0E8',
  dark: '#1B241F', dark2: '#242F29', cardOnDark: '#2A3630', lineOnDark: '#3E4B44',
  white: '#FFFFFF',
};
export const TOKENS = { ...BRAND };
export function applyProfile(profile) {
  const p = profile?.palette || {};
  if (p.ground) TOKENS.creme = p.ground;
  if (p.ink) TOKENS.ink = p.ink;
  if (p.accent) TOKENS.green = p.accent;
  if (p.accentLight) TOKENS.greenLight = p.accentLight;
  return TOKENS;
}
