import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type PlaybookCatalog,
  type PlaybookPreview,
  type SaveFormatItem,
  type SaveRuleItem,
  saveFormatItemSchema,
  saveRuleItemSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PlaybookService } from './playbook.service.js';

const levelParam = new ZodValidationPipe(z.coerce.number().int().min(1).max(3));

/** Kataloge für Spielregeln und Formate (PLB-01). */
@Controller('playbook')
export class PlaybookController {
  constructor(@Inject(PlaybookService) private readonly playbook: PlaybookService) {}

  @Get()
  @Requires('spielregeln.sehen')
  catalog(@CurrentUser() auth: AuthContext): Promise<PlaybookCatalog> {
    return this.playbook.catalog(auth);
  }

  @Post('rules')
  @Requires('spielregeln.verwalten')
  createRule(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveRuleItemSchema)) body: SaveRuleItem,
  ): Promise<PlaybookCatalog> {
    return this.playbook.saveRule(auth, null, body);
  }

  @Put('rules/:id')
  @Requires('spielregeln.verwalten')
  updateRule(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveRuleItemSchema)) body: SaveRuleItem,
  ): Promise<PlaybookCatalog> {
    return this.playbook.saveRule(auth, id, body);
  }

  @Post('formats')
  @Requires('spielregeln.verwalten')
  createFormat(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveFormatItemSchema)) body: SaveFormatItem,
  ): Promise<PlaybookCatalog> {
    return this.playbook.saveFormat(auth, null, body);
  }

  @Put('formats/:id')
  @Requires('spielregeln.verwalten')
  updateFormat(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveFormatItemSchema)) body: SaveFormatItem,
  ): Promise<PlaybookCatalog> {
    return this.playbook.saveFormat(auth, id, body);
  }

  @Get('preview/:impact/:quality')
  @Requires('spielregeln.sehen')
  preview(
    @CurrentUser() auth: AuthContext,
    @Param('impact', levelParam) impact: number,
    @Param('quality', levelParam) quality: number,
  ): Promise<PlaybookPreview> {
    return this.playbook.preview(auth, impact, quality);
  }
}
