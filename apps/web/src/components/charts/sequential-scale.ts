/** Ordnet einen Wert einer von `steps` gleich breiten Stufen zwischen min und max zu (0-basiert). */
export function sequentialStep(value: number, min: number, max: number, steps: number): number {
  if (max <= min) return 0;
  const ratio = (value - min) / (max - min);
  return Math.min(steps - 1, Math.max(0, Math.floor(ratio * steps)));
}
