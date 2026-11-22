import type { LanguageModel } from 'ai';
import { env } from '../config/env.js';

/**
 * Sprachmodell nach PLT-12: Anbieter aus der Konfiguration, Modell aus der Routing-Tabelle des
 * Gateways (KI-01). Echte Kundendaten nur über bedrock (im Betrieb Pflicht, siehe env.ts). Bei
 * AI_PROVIDER=test gibt es kein Modell; die Aufrufer nehmen dann ihr festes Testmodell.
 */
export async function createLanguageModel(modelId = env.AI_MODEL): Promise<LanguageModel | null> {
  if (env.AI_PROVIDER === 'anthropic') {
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(modelId);
  }
  if (env.AI_PROVIDER === 'bedrock') {
    if (!env.AWS_REGION) throw new Error('AI_PROVIDER=bedrock braucht AWS_REGION.');
    const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
    const { createAmazonBedrock } = await import('@ai-sdk/amazon-bedrock');
    const provider = defaultProvider();
    return createAmazonBedrock({
      region: env.AWS_REGION,
      credentialProvider: async () => {
        const { accessKeyId, secretAccessKey, sessionToken } = await provider();
        return {
          accessKeyId,
          secretAccessKey,
          ...(sessionToken ? { sessionToken } : {}),
        };
      },
    })(modelId);
  }
  return null;
}
