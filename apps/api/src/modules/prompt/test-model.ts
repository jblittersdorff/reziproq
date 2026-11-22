import { areas } from '@reziproq/shared';
import type { PromptModel, TurnRequest, TurnResult } from './prompt-model.js';

/**
 * Festes Testmodell für AI_PROVIDER=test: ohne Schlüssel, ohne Internet, immer gleich.
 * Es erkennt die Vorschläge aus PLT-12 und Fragen nach Lieferanten, ruft dafür die echten
 * Werkzeuge auf und antwortet danach nur mit Zahlen aus deren Ergebnis.
 */
export class TestPromptModel implements PromptModel {
  async turn({ system, messages, onText, invokeTool }: TurnRequest): Promise<TurnResult> {
    const last = messages.at(-1);
    const question = typeof last?.content === 'string' ? last.content : '';
    // NAV-10: Kontext der Seite („diesem Lieferanten“, „hier“)
    const context = /Kontext: Die Person ist auf der Seite des Lieferanten „([^“]+)“/.exec(
      system,
    )?.[1];
    if (/diese[mnr]? lieferant|\bhier\b/i.test(question)) {
      return this.say(
        context ? `Die Frage bezieht sich auf ${context}.` : 'Welchen Lieferanten meinst du?',
        onText,
      );
    }
    const supplierName = supplierNameInOpenRequest(question);
    const area = areaIn(question);
    if (supplierName && /öffne|geh zu/i.test(question)) {
      const output = await invokeTool('seite_oeffnen', { lieferant: supplierName });
      return this.say(answerFor(output), onText);
    }
    // „Zeig mir die Lieferanten …“ ist eine Suche; öffnen nur bei „öffne“ oder „geh zu“.
    if (area && /öffne|geh zu/i.test(question)) {
      const output = await invokeTool('seite_oeffnen', { bereich: area.key });
      return this.say(answerFor(output), onText);
    }
    if (/lieferant|spend/i.test(question)) {
      const output = await invokeTool('lieferanten_suchen', searchFor(question));
      return this.say(answerFor(output), onText);
    }
    return this.say(
      'Ich beantworte Fragen zu deinen Lieferanten und öffne Bereiche von Reziproq.',
      onText,
    );
  }

  /** Gibt den Text Wort für Wort aus, wie ein echtes Modell beim Streamen. */
  private async say(text: string, onText: (delta: string) => void): Promise<TurnResult> {
    const words = text.split(' ');
    for (const [index, word] of words.entries()) {
      onText(index === 0 ? word : ` ${word}`);
      await new Promise((resolve) => setImmediate(resolve));
    }
    return {
      usage: { inputTokens: 10, outputTokens: words.length },
    };
  }
}

function areaIn(question: string) {
  const lower = question.toLocaleLowerCase('de');
  return areas.find((area) => lower.includes(area.name.toLocaleLowerCase('de')));
}

function supplierNameInOpenRequest(question: string) {
  return /(?:spend|ausgaben)\s+(?:von|für)\s+(.+?)\s*[?.!]*$/iu.exec(question)?.[1]?.trim();
}

/** Länder, die das Testmodell in Fragen wie „Welche Lieferanten haben wir in Polen?“ erkennt. */
const countries: Record<string, string> = {
  deutschland: 'DE',
  polen: 'PL',
  tschechien: 'CZ',
  italien: 'IT',
  österreich: 'AT',
  frankreich: 'FR',
  china: 'CN',
  mexiko: 'MX',
  ungarn: 'HU',
  slowakei: 'SK',
  spanien: 'ES',
  niederlande: 'NL',
  usa: 'US',
  island: 'IS',
};

function searchFor(question: string): Record<string, unknown> {
  const country = /\bin\s+(?:der\s+|den\s+)?([\p{L}]+)/iu
    .exec(question)?.[1]
    ?.toLocaleLowerCase('de');
  const land = country ? countries[country] : undefined;
  const businessUnit = /business unit\s+([\p{L}\d _-]+)/iu.exec(question)?.[1]?.trim();
  const materialGroup = /warengruppe\s+([\p{L}\d _-]+)/iu.exec(question)?.[1]?.trim();
  const year = /\b(20\d{2})\b/u.exec(question)?.[1];
  return {
    ...(land ? { land } : {}),
    ...(businessUnit ? { businessUnit } : {}),
    ...(materialGroup ? { materialGroup } : {}),
    ...(year ? { year: Number(year) } : {}),
    sortierung: 'spend_absteigend',
  };
}

interface ToolAnswer {
  anzahl?: number;
  treffer?: { name: string; spend: string | null; spendJahr: number }[];
  geoeffnet?: string;
}

function answerFor(value: unknown): string {
  const result = value as ToolAnswer & { fehler?: string };
  if (result.fehler)
    return 'Dazu kann ich dir gerade nichts zeigen. Dir fehlen die Rechte oder die Daten.';
  if (result.geoeffnet) return `Hier ist der Link zu ${result.geoeffnet}.`;
  const [first] = result.treffer ?? [];
  if (!first) return 'Keine Treffer.';
  const count = result.anzahl === 1 ? '1 Lieferanten' : `${result.anzahl} Lieferanten`;
  if (!first.spend) return `Ich habe ${count} gefunden, ohne Spend im Jahr ${first.spendJahr}.`;
  return `Ich habe ${count} gefunden. Den höchsten Spend hat ${first.name} mit ${first.spend}.`;
}
