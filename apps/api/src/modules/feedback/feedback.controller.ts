import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import {
  type SaveSurveyQuestion,
  type SurveyDetail,
  type SurveyKind,
  type Surveys,
  saveSurveyQuestionSchema,
  surveyKinds,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { SurveyService } from './survey.service.js';

const kindSchema = z.enum(surveyKinds);
const versionSchema = z.coerce.number().int().min(1).optional();
const keySchema = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);

/** PUL-01: Einstellungen › Fragebogen (nur Admins des Käufers). */
@Controller('fragebogen')
export class SurveyController {
  constructor(@Inject(SurveyService) private readonly surveys: SurveyService) {}

  @Get()
  @Requires('einstellungen.verwalten')
  list(@CurrentUser() auth: AuthContext): Promise<Surveys> {
    return this.surveys.list(auth);
  }

  @Get(':kind')
  @Requires('einstellungen.verwalten')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('kind', new ZodValidationPipe(kindSchema)) kind: SurveyKind,
    @Query('version', new ZodValidationPipe(versionSchema)) version: number | undefined,
  ): Promise<SurveyDetail> {
    return this.surveys.detail(auth, kind, version);
  }

  @Post(':kind/fragen')
  @Requires('einstellungen.verwalten')
  add(
    @CurrentUser() auth: AuthContext,
    @Param('kind', new ZodValidationPipe(kindSchema)) kind: SurveyKind,
    @Body(new ZodValidationPipe(saveSurveyQuestionSchema)) body: SaveSurveyQuestion,
  ): Promise<SurveyDetail> {
    return this.surveys.saveQuestion(auth, kind, null, body);
  }

  @Put(':kind/fragen/:key')
  @Requires('einstellungen.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('kind', new ZodValidationPipe(kindSchema)) kind: SurveyKind,
    @Param('key', new ZodValidationPipe(keySchema)) key: string,
    @Body(new ZodValidationPipe(saveSurveyQuestionSchema)) body: SaveSurveyQuestion,
  ): Promise<SurveyDetail> {
    return this.surveys.saveQuestion(auth, kind, key, body);
  }
}
