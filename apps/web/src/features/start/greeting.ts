export type DayTime = 'morning' | 'day' | 'evening';

/** Tageszeit für die Begrüßung: Morgen 5–11 Uhr, Tag 11–18 Uhr, sonst Abend. */
export function dayTime(date: Date): DayTime {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  return 'evening';
}
