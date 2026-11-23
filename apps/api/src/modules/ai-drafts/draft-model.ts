import type { AiFeature } from '@reziproq/shared';
import { aiFeatureClasses } from '@reziproq/shared';
import { generateText } from 'ai';
import {
  estimateTokens,
  type GatewayContext,
  gatewayProvider,
  type ModelGateway,
} from '../ai-gateway/model-gateway.js';
import { modelIdFor } from '../ai-gateway/routing.js';

export const DRAFT_MODEL = Symbol('DRAFT_MODEL');

export interface DraftRequest {
  /** Organisation, Person und Funktion für das Gateway (KI-01) */
  context: GatewayContext;
  system: string;
  prompt: string;
  maxOutputTokens: number;
}

/**
 * Schreibt einen kurzen Entwurf (SEG-11, PUL-08, SPL-10, QBR-07, WG-09). Jeder Aufruf läuft über das
 * Modell-Gateway (KI-01); ins Protokoll kommen nur Dauer und Tokens, nie der Text.
 */
export interface DraftModel {
  readonly name: string;
  /** Modell, das eine Funktion schreibt; ohne Angabe gilt name. */
  nameFor?(feature: AiFeature): string;
  write(request: DraftRequest): Promise<string>;
}

/** Name des Modells für ai_draft.model */
export const draftModelName = (model: DraftModel, feature: AiFeature) =>
  model.nameFor?.(feature) ?? model.name;

/** Entwürfe über das Gateway; beim Testanbieter schreibt das feste Testmodell. */
export class GatewayDraftModel implements DraftModel {
  readonly name = 'test';

  constructor(
    private readonly gateway: ModelGateway,
    private readonly fallback: DraftModel = new TestDraftModel(),
  ) {}

  nameFor(feature: AiFeature) {
    const provider = gatewayProvider();
    return provider === 'fake' ? 'test' : modelIdFor(provider, aiFeatureClasses[feature]);
  }

  write(request: DraftRequest): Promise<string> {
    const { system, prompt, maxOutputTokens } = request;
    return this.gateway.call(request.context, async (model) => {
      if (!model) {
        const text = await this.fallback.write(request);
        return {
          value: text,
          usage: {
            inputTokens: estimateTokens(system + prompt),
            outputTokens: estimateTokens(text),
          },
        };
      }
      const result = await generateText({ model, system, prompt, maxOutputTokens, maxRetries: 0 });
      return {
        value: result.text.trim(),
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
        },
      };
    });
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
    if (request.prompt.startsWith('Implikationen:')) {
      // KI-08: je eine Chance und ein Risiko mit Quelle und Hebelvorschlag
      return JSON.stringify({
        items: [
          {
            type: 'threat',
            text: 'Wenige Lieferanten tragen den Umsatz; fällt einer aus, wird die Versorgung knapp.',
            sources: ['Q1'],
            lever: 'Neue Lieferanten einführen',
          },
          {
            type: 'opportunity',
            text: 'Umsatz bei weniger Lieferanten bündeln stärkt die Verhandlungsposition.',
            sources: ['Q1'],
            lever: 'Volumen bei weniger Lieferanten bündeln',
          },
        ],
      });
    }
    if (request.prompt.startsWith('Marktkräfte:')) {
      // WG-09: sechs Kräfte; je Kraft ein Punkt ohne gültige Quelle, den Reziproq verwerfen muss.
      // KI-08: dazu ein Punkt, den seine Quelle nicht stützt, und mit Recherche ein öffentlicher.
      const publicSource = /^(Q\d+) \[öffentlich\]/m.exec(request.prompt)?.[1];
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
            {
              text: 'Wenige Lieferanten tragen den Umsatz der Warengruppe.',
              sources: ['Q1', 'Q2'],
            },
            { text: 'Eine Aussage ohne Beleg.', sources: ['Q99'] },
            { text: 'Die Kapazität wird ab 2028 knapp.', sources: ['Q1'] },
            ...(publicSource
              ? [
                  {
                    text: 'Der Kupferindex liegt unter dem Stand bei Preisfestlegung.',
                    sources: [publicSource],
                  },
                ]
              : []),
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
