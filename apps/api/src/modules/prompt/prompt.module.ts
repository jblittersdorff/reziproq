import { Module } from '@nestjs/common';
import { env } from '../../config/env.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { AiSdkPromptModel } from './ai-sdk-model.js';
import { PromptController } from './prompt.controller.js';
import { PromptService } from './prompt.service.js';
import { PromptLog } from './prompt-log.js';
import { PROMPT_MODEL } from './prompt-model.js';
import { RATE_LIMIT, RateLimiter, type RateLimitOptions } from './rate-limiter.js';
import { TestPromptModel } from './test-model.js';

@Module({
  imports: [SuppliersModule],
  controllers: [PromptController],
  providers: [
    {
      provide: PROMPT_MODEL,
      useFactory: async () => {
        if (env.AI_PROVIDER === 'anthropic') {
          const { anthropic } = await import('@ai-sdk/anthropic');
          return new AiSdkPromptModel(anthropic(env.AI_MODEL));
        }
        if (env.AI_PROVIDER === 'bedrock') {
          if (!env.AWS_REGION) throw new Error('AI_PROVIDER=bedrock braucht AWS_REGION.');
          const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
          const { createAmazonBedrock } = await import('@ai-sdk/amazon-bedrock');
          const provider = defaultProvider();
          return new AiSdkPromptModel(
            createAmazonBedrock({
              region: env.AWS_REGION,
              credentialProvider: async () => {
                const { accessKeyId, secretAccessKey, sessionToken } = await provider();
                return {
                  accessKeyId,
                  secretAccessKey,
                  ...(sessionToken ? { sessionToken } : {}),
                };
              },
            })(env.AI_MODEL),
          );
        }
        return new TestPromptModel();
      },
    },
    {
      provide: RATE_LIMIT,
      useValue: { perMinute: env.AI_REQUESTS_PER_MINUTE } satisfies RateLimitOptions,
    },
    RateLimiter,
    PromptLog,
    PromptService,
  ],
})
export class PromptModule {}
