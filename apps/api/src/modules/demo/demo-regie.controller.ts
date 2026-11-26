import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import {
  businessTimeHeader,
  type DemoRegie,
  type DemoTimeRequest,
  demoTimeRequestSchema,
} from '@reziproq/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { DemoRegieService } from './demo-regie.service.js';

/** DM-01 (K1-g.1): Demo-Regie, nur im Demo-Mandanten (sonst 404) */
@Controller('demo/regie')
export class DemoRegieController {
  constructor(@Inject(DemoRegieService) private readonly regie: DemoRegieService) {}

  @Get()
  @Requires('demo.regie')
  state(@CurrentUser() auth: AuthContext): Promise<DemoRegie> {
    return this.regie.state(auth);
  }

  @Post('zeit')
  @HttpCode(200)
  @Requires('demo.regie')
  async advance(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(demoTimeRequestSchema)) body: DemoTimeRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DemoRegie> {
    return withBusinessTime(response, await this.regie.advance(auth, body));
  }

  @Post('zuruecksetzen')
  @HttpCode(200)
  @Requires('demo.regie')
  async reset(
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DemoRegie> {
    return withBusinessTime(response, await this.regie.reset(auth));
  }
}

/** Die Antwort nennt die neue Demo-Uhr, nicht die vom Beginn der Anfrage (K1-b.4, lib/clock.ts) */
function withBusinessTime(response: Response, state: DemoRegie): DemoRegie {
  response.setHeader(businessTimeHeader, state.demoNow);
  return state;
}
