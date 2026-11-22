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
  type AcceptAiDraft,
  acceptAiDraftSchema,
  type DismissAiDraft,
  dismissAiDraftSchema,
  type ExtendSurveyWave,
  extendSurveyWaveSchema,
  type FeedbackThemes,
  type InviteSurveyParticipants,
  inviteSurveyParticipantsSchema,
  type PublicSurvey,
  type StartSurveyWave,
  type SubmitSurvey,
  type SurveySuggestions,
  type SurveyWaveDetail,
  type SurveyWaves,
  startSurveyWaveSchema,
  submitSurveySchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AnswerService } from './answer.service.js';
import { FeedbackThemesService } from './feedback-themes.service.js';
import { type WaveScope, WavesService } from './waves.service.js';

type Side = 'buyer' | 'supplier';

/** PUL-02a: dieselben Endpunkte je Seite; Starten und Frist nur beim Käufer. */
function waveRoutes(side: Side) {
  class SideWavesController {
    constructor(
      @Inject(WavesService) readonly waves: WavesService,
      @Inject(FeedbackThemesService) readonly themes: FeedbackThemesService,
    ) {}

    scoped<T>(auth: AuthContext, id: string, work: (scope: WaveScope) => Promise<T>) {
      return side === 'buyer'
        ? this.waves.buyer(auth, id, work)
        : this.waves.supplier(auth, id, work);
    }

    @Get()
    @Requires('feedback.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<SurveyWaves> {
      return this.scoped(auth, id, (scope) => this.waves.list(scope));
    }

    @Get('vorschlaege')
    @Requires('feedback.verwalten')
    suggestions(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<SurveySuggestions> {
      return this.scoped(auth, id, (scope) => this.waves.suggestions(scope));
    }

    @Get(':waveId')
    @Requires('feedback.sehen')
    detail(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
    ): Promise<SurveyWaveDetail> {
      return this.scoped(auth, id, (scope) => this.waves.detail(scope, waveId));
    }

    // PUL-08: KI fasst die Freitexte der anderen Seite zu Themen zusammen.
    @Get(':waveId/themen')
    @Requires('feedback.sehen')
    feedbackThemes(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
    ): Promise<FeedbackThemes> {
      return this.themes.get(side, auth, id, waveId);
    }

    @Post(':waveId/themen')
    @HttpCode(200)
    @Requires('feedback.sehen')
    summarize(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
    ): Promise<FeedbackThemes> {
      return this.themes.summarize(side, auth, id, waveId);
    }

    @Post(':waveId/themen/:draftId/uebernehmen')
    @HttpCode(200)
    @Requires('feedback.sehen')
    acceptThemes(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
      @Param('draftId', ParseUUIDPipe) draftId: string,
      @Body(new ZodValidationPipe(acceptAiDraftSchema.optional())) body: AcceptAiDraft | undefined,
    ): Promise<FeedbackThemes> {
      return this.themes.decide(
        side,
        auth,
        id,
        waveId,
        draftId,
        'accepted',
        undefined,
        body?.content,
      );
    }

    @Post(':waveId/themen/:draftId/verwerfen')
    @HttpCode(200)
    @Requires('feedback.sehen')
    discardThemes(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
      @Param('draftId', ParseUUIDPipe) draftId: string,
      @Body(new ZodValidationPipe(dismissAiDraftSchema.optional())) body:
        | DismissAiDraft
        | undefined,
    ): Promise<FeedbackThemes> {
      return this.themes.decide(side, auth, id, waveId, draftId, 'discarded', body?.reason);
    }

    @Post(':waveId/teilnehmende')
    @Requires('feedback.verwalten')
    invite(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
      @Body(new ZodValidationPipe(inviteSurveyParticipantsSchema)) body: InviteSurveyParticipants,
    ): Promise<SurveyWaveDetail> {
      return this.scoped(auth, id, (scope) => this.waves.invite(scope, waveId, body));
    }

    @Post(':waveId/abschliessen')
    @Requires('feedback.verwalten')
    close(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
    ): Promise<SurveyWaveDetail> {
      return this.scoped(auth, id, (scope) => this.waves.close(scope, waveId));
    }
  }
  return SideWavesController;
}

@Controller('suppliers/:id/feedback')
export class BuyerWavesController extends waveRoutes('buyer') {
  @Post()
  @Requires('feedback.verwalten')
  start(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(startSurveyWaveSchema)) body: StartSurveyWave,
  ): Promise<SurveyWaveDetail> {
    return this.waves.buyer(auth, id, (scope) => this.waves.start(scope, body));
  }

  @Put(':waveId/frist')
  @Requires('feedback.verwalten')
  extend(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('waveId', ParseUUIDPipe) waveId: string,
    @Body(new ZodValidationPipe(extendSurveyWaveSchema)) body: ExtendSurveyWave,
  ): Promise<SurveyWaveDetail> {
    return this.waves.buyer(auth, id, (scope) => this.waves.extend(scope, waveId, body));
  }
}

@Controller('kunden/:id/feedback')
export class SupplierWavesController extends waveRoutes('supplier') {}

/** PUL-02b: Ohne Login beantworten. Der Token im Link ist der einzige Schlüssel. */
@Controller('umfrage')
@Public()
export class PublicSurveyController {
  constructor(@Inject(AnswerService) private readonly answers: AnswerService) {}

  @Get(':token')
  read(@Param('token') token: string): Promise<PublicSurvey> {
    return this.answers.read(token);
  }

  @Post(':token')
  @HttpCode(200)
  submit(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(submitSurveySchema)) body: SubmitSurvey,
  ): Promise<PublicSurvey> {
    return this.answers.submit(token, body);
  }
}
