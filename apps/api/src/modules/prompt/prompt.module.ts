import { Module } from '@nestjs/common';
import { env } from '../../config/env.js';
import { ActivitiesModule } from '../activities/activities.module.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { PromptController } from './prompt.controller.js';
import { PromptService } from './prompt.service.js';
import { PromptLog } from './prompt-log.js';
import { PROMPT_MODEL } from './prompt-model.js';
import { RATE_LIMIT, RateLimiter, type RateLimitOptions } from './rate-limiter.js';
import { TestPromptModel } from './test-model.js';

@Module({
  imports: [SuppliersModule, AiGatewayModule, ActivitiesModule],
  controllers: [PromptController],
  providers: [
    // Testmodell für AI_PROVIDER=test; echte Modelle gibt das Gateway je Aufruf (KI-01).
    { provide: PROMPT_MODEL, useValue: new TestPromptModel() },
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
