import type Anthropic from '@anthropic-ai/sdk';
import { areas } from '@reziproq/shared';
import type { PromptModel, TurnRequest, TurnResult } from './prompt-model.js';

/**
 * Festes Testmodell für KI_ANBIETER=test: ohne Schlüssel, ohne Internet, immer gleich.
 * Es erkennt die Vorschläge aus PLT-12 und Fragen nach Lieferanten, ruft dafür die echten
 * Werkzeuge auf und antwortet danach nur mit Zahlen aus deren Ergebnis.
 */
export class TestPromptModel implements PromptModel {
  private calls = 0;

  async turn({ messages, onText }: TurnRequest): Promise<TurnResult> {
    const last = messages.at(-1);
    const toolResult = Array.isArray(last?.content)
      ? last.content.find((block) => block.type === 'tool_result')
      : undefined;

    if (toolResult?.type === 'tool_result') {
      const raw = typeof toolResult.content === 'string' ? toolResult.content : '{}';
      return this.say(answerFor(JSON.parse(raw), toolResult.is_error === true), onText);
    }

    const question = typeof last?.content === 'string' ? last.content : '';
    const area = areaIn(question);
    // „Zeig mir die Lieferanten …“ ist eine Suche; öffnen nur bei „öffne“ oder „geh zu“.
    if (area && /öffne|geh zu/i.test(question)) {
      return this.useTool('bereich_oeffnen', { bereich: area.key });
    }
    if (/lieferant|warengruppe|spend/i.test(question)) {
      return this.useTool('lieferanten_suchen', searchFor(question));
    }
    return this.say(
      'Ich beantworte Fragen zu deinen Lieferanten und öffne Bereiche von Reziproq.',
      onText,
    );
  }

  private useTool(name: string, input: Record<string, unknown>): TurnResult {
    this.calls += 1;
    return {
      content: [{ type: 'tool_use', id: `test-${this.calls}`, name, input }],
      stopReason: 'tool_use',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  }

  /** Gibt den Text Wort für Wort aus, wie ein echtes Modell beim Streamen. */
  private async say(text: string, onText: (delta: string) => void): Promise<TurnResult> {
    const words = text.split(' ');
    for (const [index, word] of words.entries()) {
      onText(index === 0 ? word : ` ${word}`);
      await new Promise((resolve) => setImmediate(resolve));
    }
    const content: Anthropic.Beta.BetaContentBlock[] = [{ type: 'text', text, citations: null }];
    return {
      content,
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: words.length },
    };
  }
}

function areaIn(question: string) {
  const lower = question.toLocaleLowerCase('de');
  return areas.find((area) => lower.includes(area.name.toLocaleLowerCase('de')));
}

function searchFor(question: string): Record<string, unknown> {
  const category = /warengruppe\s+([\p{L}-]+)/iu.exec(question)?.[1];
  return {
    ...(category ? { warengruppe: category } : {}),
    sortierung: 'spend_absteigend',
  };
}

interface ToolAnswer {
  anzahl?: number;
  treffer?: { name: string; jahresspend: string }[];
  geoeffnet?: string;
}

function answerFor(result: ToolAnswer, isError: boolean): string {
  if (isError)
    return 'Dazu kann ich dir gerade nichts zeigen. Dir fehlen die Rechte oder die Daten.';
  if (result.geoeffnet) return `Ich öffne ${result.geoeffnet}.`;
  const [first] = result.treffer ?? [];
  if (!first) return 'Keine Treffer.';
  const count = result.anzahl === 1 ? '1 Lieferanten' : `${result.anzahl} Lieferanten`;
  return `Ich habe ${count} gefunden. Den höchsten Spend hat ${first.name} mit ${first.jahresspend}.`;
}
