import type Anthropic from '@anthropic-ai/sdk';

export const PROMPT_MODEL = Symbol('PROMPT_MODEL');

export interface TurnRequest {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: Anthropic.Beta.BetaTool[];
  /** Jedes Textstück, sobald es da ist; so streamt die Antwort Wort für Wort. */
  onText: (delta: string) => void;
  signal: AbortSignal;
}

export interface TurnResult {
  content: Anthropic.Beta.BetaContentBlock[];
  stopReason: Anthropic.Beta.BetaStopReason | null;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Ein Modell beantwortet einen Schritt des Gesprächs. Ob Claude oder das feste Testmodell
 * antwortet, entscheidet KI_ANBIETER; Werkzeuge und Ablauf sind für beide gleich.
 */
export interface PromptModel {
  turn(request: TurnRequest): Promise<TurnResult>;
}
