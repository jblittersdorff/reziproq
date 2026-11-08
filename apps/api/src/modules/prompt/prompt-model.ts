import type { LanguageModel, ModelMessage, ToolSet } from 'ai';

export const PROMPT_MODEL = Symbol('PROMPT_MODEL');

export interface TurnRequest {
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
  invokeTool: (name: string, input: unknown) => Promise<unknown>;
  onText: (delta: string) => void;
  signal: AbortSignal;
}

export interface TurnResult {
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Ein Modell beantwortet eine Frage. Provider und Modell kommen aus der Konfiguration;
 * Werkzeugausführung und Datengrenzen bleiben für alle Provider gleich.
 */
export interface PromptModel {
  turn(request: TurnRequest): Promise<TurnResult>;
}

export type PromptLanguageModel = LanguageModel;
