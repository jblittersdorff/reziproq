import { Module } from '@nestjs/common';
import { env } from '../../config/env.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { AnthropicPromptModel } from './anthropic-model.js';
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
      useFactory: () =>
        env.KI_ANBIETER === 'anthropic'
          ? new AnthropicPromptModel(env.KI_MODELL, { apiKey: env.ANTHROPIC_API_KEY ?? null })
          : new TestPromptModel(),
    },
    {
      provide: RATE_LIMIT,
      useValue: { perMinute: env.KI_ANFRAGEN_PRO_MINUTE } satisfies RateLimitOptions,
    },
    RateLimiter,
    PromptLog,
    PromptService,
  ],
})
export class PromptModule {}
