import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import {
  businessTimeHeader,
  type DemoPersons,
  type DemoSession,
  type StartDemoSession,
  startDemoSessionSchema,
} from '@reziproq/shared';
import type { Response } from 'express';
import { AccountStore } from '../../common/database.module.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { DemoTokens, demoSessionsEnabled } from '../auth/demo-token.js';
import { Public } from '../auth/public.decorator.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/**
 * DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person. Ohne Zitadel, nur für Personen eines
 * Demo-Mandanten, nur mit DEMO_SESSIONS=true und nie im Betrieb; sonst gibt es die Adressen nicht
 * (404). Die Demo-Regie (K1-g) wechselt darüber die Rolle.
 */
@Controller('demo')
export class DemoController {
  constructor(
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(DemoTokens) private readonly tokens: DemoTokens,
  ) {}

  @Public()
  @Get('personen')
  async persons(): Promise<DemoPersons> {
    if (!demoSessionsEnabled()) throw notFound();
    return { persons: await this.accounts.demoPersons() };
  }

  @Public()
  @Post('sitzung')
  @HttpCode(200)
  async start(
    @Body(new ZodValidationPipe(startDemoSessionSchema)) body: StartDemoSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DemoSession> {
    if (!demoSessionsEnabled()) throw notFound();
    const person = (await this.accounts.demoPersons()).find((entry) => entry.id === body.userId);
    if (!person) throw notFound();
    const { token, expiresAt } = await this.tokens.issue(person.id);
    // K1-b.5: Die Fachzeit des Mandanten gleich mit; die Anfrage hat noch keine Anmeldung, also
    // setzt der ClockInterceptor den Kopf hier nicht. So rechnet die Oberfläche schon beim ersten
    // Bild nach der Demo-Uhr.
    const demoNow = await this.accounts.demoNowOf(person.orgId);
    if (demoNow) response.setHeader(businessTimeHeader, demoNow.toISOString());
    return { accessToken: token, expiresAt: expiresAt.toISOString(), person };
  }
}
