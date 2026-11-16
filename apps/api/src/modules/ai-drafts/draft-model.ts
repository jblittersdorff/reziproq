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
    const subject = /^Kriterium: (.+)$/m.exec(request.prompt)?.[1] ?? 'diesem Kriterium';
    return `Die Bewertungen zu ${subject} gehen auseinander, weil die Funktionen unterschiedliche Erfahrungen schildern. Die Begründungen nennen vor allem Liefertreue und Abstimmung als Ursache.`;
  }
}
