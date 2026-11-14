// Kontrast nach WCAG 2.2: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
// Bewusst eine eigene kleine Funktion statt einer Abhängigkeit (PLT-10).

/** Mindestwerte nach WCAG AA */
export const minimumContrast = { text: 4.5, large: 3 } as const;

/**
 * Relative Leuchtdichte einer Farbe im Format #rrggbb oder kurz #rgb. Die Kurzform entsteht im
 * gebauten CSS, weil der Minifier sechsstellige Farben mit doppelten Ziffern auf drei kürzt.
 */
export function luminance(color: string): number {
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(color);
  const hex = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : color;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Farbe im Format #rrggbb oder #rgb erwartet: ${color}`);
  }
  const [r = 0, g = 0, b = 0] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis zweier Farben, von 1 (gleich) bis 21 (Schwarz auf Weiß). */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
