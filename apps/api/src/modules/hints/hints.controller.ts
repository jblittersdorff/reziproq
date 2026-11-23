import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type DismissHint,
  dismissHintSchema,
  type Hint,
  type HintList,
  type HintSettings,
  hintSettingsSchema,
  hintFeedbackSchema,
  type HintRuleSettings,
  saveHintRuleSettingsSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { HintsService } from './hints.service.js';

/** FS-01: Hinweise, nur beim Käufer. */
@Controller('hinweise')
export class HintsController {
  constructor(@Inject(HintsService) private readonly hints: HintsService) {}

  @Get()
  @Requires('hinweise.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<HintList> {
    return this.hints.list(auth);
  }

  @Get('einstellungen')
  @Requires('hinweise.sehen')
  settings(@CurrentUser() auth: AuthContext): Promise<HintSettings> {
    return this.hints.settings(auth);
  }

  @Put('einstellungen')
  @Requires('hinweise.einstellen')
  saveSettings(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(hintSettingsSchema)) body: HintSettings,
  ): Promise<HintSettings> {
    return this.hints.saveSettings(auth, body);
  }

  // KI-16: Regeln an oder aus, Schwellen und Bewertung je Regel
  @Get('regeln')
  @Requires('hinweise.einstellen')
  ruleSettings(@CurrentUser() auth: AuthContext): Promise<HintRuleSettings> {
    return this.hints.ruleSettingsView(auth);
  }

  @Put('regeln')
  @Requires('hinweise.einstellen')
  saveRuleSettings(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveHintRuleSettingsSchema))
    body: Pick<HintRuleSettings, 'rules' | 'thresholds'>,
  ): Promise<HintRuleSettings> {
    return this.hints.saveRuleSettings(auth, body);
  }

  @Get(':id')
  @Requires('hinweise.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<Hint> {
    return this.hints.get(auth, id);
  }

  @Post(':id/annehmen')
  @HttpCode(200)
  @Requires('hinweise.entscheiden')
  accept(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<Hint> {
    return this.hints.accept(auth, id);
  }

  @Post(':id/in-arbeit')
  @HttpCode(200)
  @Requires('hinweise.entscheiden')
  start(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<Hint> {
    return this.hints.start(auth, id);
  }

  @Post(':id/bewertung')
  @HttpCode(200)
  @Requires('hinweise.sehen')
  rate(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(hintFeedbackSchema)) body: { helpful: boolean },
  ): Promise<Hint> {
    return this.hints.rate(auth, id, body.helpful);
  }

  @Post(':id/verwerfen')
  @HttpCode(200)
  @Requires('hinweise.entscheiden')
  dismiss(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(dismissHintSchema)) body: DismissHint,
  ): Promise<Hint> {
    return this.hints.dismiss(auth, id, body);
  }
}
