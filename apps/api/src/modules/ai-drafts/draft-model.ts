import { Logger } from '@nestjs/common';
import { generateText, type LanguageModel } from 'ai';
import { env } from '../../config/env.js';

export const DRAFT_MODEL = Symbol('DRAFT_MODEL');

export interface DraftRequest {
  system: string;
  prompt: string;
  maxOutputTokens: number;
}

/**
 * Schreibt einen kurzen Entwurf (SEG-11, später PUL-08, SPL-10, QBR-07). Anbieter und Modell wie im
 * Prompt (PLT-12). Ins Protokoll kommen nur Dauer und Tokens, nie der Text.
 */
export interface DraftModel {
  readonly name: string;
  write(request: DraftRequest): Promise<string>;
}

export class AiSdkDraftModel implements DraftModel {
  private readonly logger = new Logger('KI-Entwurf');
  readonly name = env.AI_MODEL;

  constructor(private readonly model: LanguageModel) {}

  async write({ system, prompt, maxOutputTokens }: DraftRequest): Promise<string> {
    const started = Date.now();
    const result = await generateText({ model: this.model, system, prompt, maxOutputTokens });
    this.logger.log(
      JSON.stringify({
        dauerMs: Date.now() - started,
        eingabeTokens: result.usage.inputTokens ?? 0,
        ausgabeTokens: result.usage.outputTokens ?? 0,
      }),
    );
    return result.text.trim();
  }
}

/**
 * Festes Testmodell für AI_PROVIDER=test: ohne Schlüssel und Internet, immer gleich. Es merkt sich
 * die Anfragen, damit Tests prüfen können, was an die KI ginge.
 */
export class TestDraftModel implements DraftModel {
  static readonly requests: DraftRequest[] = [];
  readonly name = 'test';

  async write(request: DraftRequest): Promise<string> {
    TestDraftModel.requests.push(request);
    if (request.prompt.startsWith('Marktkräfte:')) {
      // WG-09: sechs Kräfte; je Kraft ein Punkt ohne gültige Quelle, den Reziproq verwerfen muss.
      const forces = [
        'supplier_power',
        'customer_power',
        'new_entrants',
        'substitutes',
        'external_factors',
        'rivalry',
      ];
      return JSON.stringify({
        forces: forces.map((force, index) => ({
          force,
          today: index % 2 === 0 ? 'high' : 'low',
          future: 'high',
          relevant: index !== 1,
          points: [
            {
              text: `Zwei Lieferanten tragen den größten Teil des Umsatzes (${force}).`,
              sources: ['Q1'],
            },
            { text: 'Die Kapazität wird ab 2028 knapp.', sources: ['Q1', 'Q2'] },
            { text: 'Eine Aussage ohne Beleg.', sources: ['Q99'] },
          ],
        })),
        synthesis: 'Die Macht der Lieferanten und knappe Kapazität sind das größte Risiko.',
      });
    }
    if (request.prompt.startsWith('Termin:')) {
      // Absichtlich zu lang: Reziproq kürzt auf höchstens 200 Wörter (QBR-07).
      const sentence =
        'Stand: Die Zusammenarbeit läuft stabil, die meisten Zusagen sind gehalten und die Initiativen kommen voran. Offen bleiben einzelne Maßnahmen mit Termin im nächsten Quartal.';
      return Array.from({ length: 10 }, () => sentence).join(' ');
    }
    if (request.prompt.startsWith('Lieferant:')) {
      // Absichtlich zu lang: Reziproq kürzt auf höchstens 120 Wörter (SPL-10).
      const sentence =
        'Die Beziehung soll sich zu einer verlässlichen Partnerschaft mit gemeinsamen Zielen entwickeln, gemessen an Liefertreue, Kosten und Feedback.';
      return Array.from({ length: 8 }, () => sentence).join(' ');
    }
    if (request.prompt.startsWith('Freitexte:')) {
      return [
        '- Abstimmungen bei Änderungen dauern aus Sicht der anderen Seite zu lange.',
        '- Die Prognosen für Abrufe kommen oft spät und schwanken stark.',
        '- Ansprechpartner wechseln häufig, Zuständigkeiten sind unklar.',
      ].join('\n');
    }
    const subject = /^Kriterium: (.+)$/m.exec(request.prompt)?.[1] ?? 'diesem Kriterium';
    return `Die Bewertungen zu ${subject} gehen auseinander, weil die Funktionen unterschiedliche Erfahrungen schildern. Die Begründungen nennen vor allem Liefertreue und Abstimmung als Ursache.`;
  }
}
