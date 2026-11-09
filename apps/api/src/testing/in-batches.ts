/**
 * Wie Promise.all, aber in Gruppen: Zu viele gleichzeitige Verbindungen lehnt das Betriebssystem
 * ab (ECONNRESET bei über 128 offenen Anfragen auf macOS). Reihenfolge der Ergebnisse bleibt.
 */
export async function inBatches<T, R>(
  items: T[],
  work: (item: T) => Promise<R>,
  size = 25,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(work))));
  }
  return results;
}
