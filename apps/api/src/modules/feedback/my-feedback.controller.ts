import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  type MyFeedback,
  type PublicSurvey,
  type SubmitSurvey,
  submitSurveySchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MyFeedbackService } from './my-feedback.service.js';

/** Feedback in der App: eigene Fragebögen beider Seiten, angemeldet beantworten. */
@Controller('feedback/meine')
export class MyFeedbackController {
  constructor(@Inject(MyFeedbackService) private readonly feedback: MyFeedbackService) {}

  @Get()
  @Requires('feedback.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<MyFeedback> {
    return this.feedback.list(auth);
  }

  @Get(':id')
  @Requires('feedback.sehen')
  read(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicSurvey> {
    return this.feedback.read(auth, id);
  }

  @Post(':id')
  @HttpCode(200)
  @Requires('feedback.sehen')
  submit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submitSurveySchema)) body: SubmitSurvey,
  ): Promise<PublicSurvey> {
    return this.feedback.submit(auth, id, body);
  }
}
