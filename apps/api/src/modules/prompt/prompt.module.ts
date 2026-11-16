import { Module } from '@nestjs/common';
import { createLanguageModel } from '../../common/ai-language-model.js';
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
        const model = await createLanguageModel();
        return model ? new AiSdkPromptModel(model) : new TestPromptModel();
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
