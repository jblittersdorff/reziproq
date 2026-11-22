import type { ModelClass } from '@reziproq/shared';

export type GatewayProvider = 'bedrock_eu' | 'fake' | 'anthropic';

/** Routing-Tabelle (KI-01): je Modellklasse ein Modell der aktuellen Claude-Familie. */
const modelByClass: Record<ModelClass, string> = {
  small: 'claude-haiku-5-5',
  standard: 'claude-sonnet-5-5',
  synthesis: 'claude-opus-5-5',
};

/**
 * Preistabelle in Mikrocent je Token (Eingabe, Ausgabe). Vorläufig die Listenpreise von Anthropic in
 * US-Dollar je Million Tokens, 1:1 als Euro: Haiku 0,10/0,50, Sonnet 2/10, Opus 4/20. Bedrock rechnet
 * eigene Preise ab; die Tabelle wird mit dem ersten Bedrock-Vertrag nachgezogen.
 */
const priceByModel: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 10, output: 50 },
  'claude-sonnet-5-5': { input: 200, output: 1_000 },
  'claude-opus-5-5': { input: 400, output: 2_000 },
};

/** Modell-ID je Anbieter; das Testmodell heißt nach seiner Klasse. */
export function modelIdFor(
  provider: GatewayProvider,
  modelClass: ModelClass,
  override?: string,
): string {
  if (provider === 'fake') return `fake-${modelClass}`;
  if (override) return override;
  const base = modelByClass[modelClass];
  return provider === 'bedrock_eu' ? `eu.anthropic.${base}` : base;
}

/** Kosten eines Aufrufs in Mikrocent; das Testmodell kostet wie das Modell seiner Klasse. */
export function costMicrocents(
  modelId: string,
  modelClass: ModelClass,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const known = Object.keys(priceByModel).find((name) => modelId.includes(name));
  const price = priceByModel[known ?? modelByClass[modelClass]] ?? { input: 0, output: 0 };
  return usage.inputTokens * price.input + usage.outputTokens * price.output;
}

/**
 * Region der Verarbeitung: Bedrock über das EU-Profil in einer EU-Region; das Testmodell läuft
 * lokal. Anthropic direkt und globale oder US-Profile liegen außerhalb der EU.
 */
export function regionFor(provider: GatewayProvider, modelId: string, awsRegion?: string): string {
  if (provider === 'fake') return 'eu-local';
  if (provider === 'anthropic') return 'us';
  const profile = modelId.split('.')[0];
  if (profile === 'global' || profile === 'us') return profile;
  return awsRegion ?? 'unbekannt';
}

export const isEuRegion = (region: string) => region.startsWith('eu-');
