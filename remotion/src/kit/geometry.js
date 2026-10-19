// kit/geometry.js — ALLE Zahlen des 9:16-Rasters, 1:1 aus wissen/doku/PALMIER-GEOMETRY.md und CUT-STYLE.md.
export const W = 1080, H = 1920;
export const IG_SAFE = { top: 270, bottom: 1250, right: 1010, left: 70 };      // Instagram-Reels-Overlays
export const BAND = {
  S: { top: 300, bottom: 905, keyword: [914, 990] },                           // Split: Grafik oben, Kamera-Karte unten
  T: { top: 240, bottom: 1020, keyword: [1115, 1189] },                        // Takeover: Grafik ganz
};
export const SUBTITLE = { fontSize: 54, belowChinPx: 34, minTop: 1010, fadeFrames: 7, tracking: -0.03 };
export const KEYWORD = { fontSize: 56, capHeight: 74, yS: 0.49583, yT: 0.60, shadow: { blur: 14, opacity: 0.25, y: 4 } };
export const ACCENT = { sizeS: 92, sizeT: 100, glow: { blur: 22, blurDark: 34 } };
export const CLOSEUP = { scale: 1.12, cta: 1.22, cx: 0.47, cy: 0.45, drift: 0.02 };
export const SPLIT = { centerY: (headTop) => 1.0260 - headTop, cropTop: (centerY) => 1.1401 - centerY, edgeRounding: 0.208, maxHeadTop: 0.526 };
export const GRAIN = { color: '#F9F9F9', noise: 16, blur: 0.55 };
