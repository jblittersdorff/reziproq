import type { TranscriptEntry } from '@reziproq/shared';
import { unzipSync } from 'fflate';

// IN-05: Transkripte als Einträge (Zeit, Sprecher, Text). Teams liefert WebVTT mit <v Name>,
// Meet liefert Einträge, Uploads sind VTT, TXT oder DOCX. Nur Text wird gelesen.

const time = (value: string) => {
  const parts = value
    .trim()
    .split(':')
    .map((part) => Number.parseFloat(part.replace(',', '.')));
  return parts.reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
};

const clean = (text: string) =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** WebVTT: Zeitzeile „00:00:01.000 --> 00:00:04.000“, Text mit <v Sprecher> oder „Sprecher: Text“ */
export function parseVtt(vtt: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const blocks = vtt.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing < 0) continue;
    const at = time(lines[timing]?.split('-->')[0] ?? '0');
    const raw = lines.slice(timing + 1).join(' ');
    const voice = raw.match(/<v(?:\.[^ >]+)?\s+([^>]+)>/);
    let speaker = voice?.[1]?.trim() ?? '';
    let text = clean(raw);
    if (!speaker) {
      const named = text.match(/^([^:]{1,60}):\s+(.*)$/);
      if (named?.[1] && named[2]) {
        speaker = named[1].trim();
        text = named[2];
      }
    }
    if (!text) continue;
    const previous = entries[entries.length - 1];
    // Teams teilt Sätze in kurze Stücke: gleicher Sprecher hintereinander wird zusammengeführt
    if (previous && previous.speaker === speaker && at - previous.at < 30) {
      previous.text = `${previous.text} ${text}`;
    } else {
      entries.push({ at, speaker, text });
    }
  }
  return entries;
}

/** Text mit Zeilen „[00:01:02] Name: Text“, „Name: Text“ oder nur Text */
export function parsePlain(text: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const stamped = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\]?\s*(.*)$/);
    const at = stamped?.[1] ? time(stamped[1]) : (entries[entries.length - 1]?.at ?? 0);
    const rest = stamped?.[2] ?? line;
    const named = rest.match(/^([^:]{1,60}):\s+(.*)$/);
    const speaker = named?.[1]?.trim() ?? '';
    const said = clean(named?.[2] ?? rest);
    if (!said) continue;
    const previous = entries[entries.length - 1];
    if (previous && !named && !stamped) previous.text = `${previous.text} ${said}`;
    else entries.push({ at, speaker, text: said });
  }
  return entries;
}

/** DOCX: Absätze aus word/document.xml, dann wie Text */
export function docxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (file) => file.name === 'word/document.xml' });
  const xml = new TextDecoder().decode(files['word/document.xml'] ?? new Uint8Array());
  return xml
    .split(/<\/w:p>/)
    .map((paragraph) =>
      [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join(''),
    )
    .map((line) => clean(line))
    .filter(Boolean)
    .join('\n');
}

/** Einträge aus einer hochgeladenen Datei; null bei einem nicht unterstützten Format */
export function parseUpload(fileName: string, bytes: Buffer): TranscriptEntry[] | null {
  const name = fileName.toLowerCase();
  if (name.endsWith('.vtt')) return parseVtt(bytes.toString('utf8'));
  if (name.endsWith('.txt')) return parsePlain(bytes.toString('utf8'));
  if (name.endsWith('.docx')) {
    try {
      return parsePlain(docxText(bytes));
    } catch {
      return null;
    }
  }
  return null;
}

/** Text für die Auswertung (KI-17): „Sprecher: Text“ je Zeile */
export function asNotes(entries: TranscriptEntry[]): string {
  return entries
    .map((entry) => (entry.speaker ? `${entry.speaker}: ${entry.text}` : entry.text))
    .join('\n');
}
