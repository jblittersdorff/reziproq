import { Body, Controller, HttpException, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import { type PromptRequest, promptRequestSchema } from '@reziproq/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PromptService } from './prompt.service.js';
import { RateLimiter } from './rate-limiter.js';

@Controller('prompt')
export class PromptController {
  constructor(
    @Inject(PromptService) private readonly prompts: PromptService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  /** Streamt die Antwort als NDJSON: eine Zeile je Ereignis (siehe promptEventSchema). */
  @Post()
  @Requires('prompt.nutzen')
  async ask(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(promptRequestSchema)) request: PromptRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.limiter.tryAcquire(auth.userId)) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'zu_viele_anfragen',
          message: 'Du hast gerade sehr viele Fragen gestellt. Warte eine Minute.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    res.status(200);
    res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.flushHeaders();

    // Schließt der Browser das Fenster, bricht auch die Anfrage an das Modell ab.
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    await this.prompts.answer(
      auth,
      request,
      (event) => res.write(`${JSON.stringify(event)}\n`),
      abort.signal,
    );
    res.end();
  }
}
