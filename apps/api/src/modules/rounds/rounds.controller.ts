import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  type AddAssignment,
  addAssignmentSchema,
  type CreateRound,
  createRoundSchema,
  type ExtendRound,
  extendRoundSchema,
  type SetRoundSuppliers,
  setRoundSuppliersSchema,
  type UpdateAssignment,
  updateAssignmentSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { RoundsService } from './rounds.service.js';

@Controller('rounds')
export class RoundsController {
  constructor(@Inject(RoundsService) private readonly rounds: RoundsService) {}

  @Get()
  @Requires('runden.sehen')
  list(@CurrentUser() auth: AuthContext) {
    return this.rounds.list(auth);
  }

  @Get('raters')
  @Requires('runden.nachnominieren')
  raters(@CurrentUser() auth: AuthContext) {
    return this.rounds.raters(auth);
  }

  @Post()
  @Requires('runden.verwalten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createRoundSchema)) body: CreateRound,
  ) {
    return this.rounds.create(auth, body);
  }

  @Get(':id')
  @Requires('runden.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.rounds.get(auth, id);
  }

  @Patch(':id')
  @Requires('runden.verwalten')
  updateDraft(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createRoundSchema)) body: CreateRound,
  ) {
    return this.rounds.updateDraft(auth, id, body);
  }

  @Get(':id/candidates')
  @Requires('runden.verwalten')
  candidates(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.rounds.candidates(auth, id);
  }

  @Put(':id/suppliers')
  @Requires('runden.verwalten')
  setSuppliers(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setRoundSuppliersSchema)) body: SetRoundSuppliers,
  ) {
    return this.rounds.setSuppliers(auth, id, body);
  }

  @Patch(':id/assignments/:assignmentId')
  @Requires('runden.verwalten')
  updateAssignment(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body(new ZodValidationPipe(updateAssignmentSchema)) body: UpdateAssignment,
  ) {
    return this.rounds.updateAssignment(auth, id, assignmentId, body);
  }

  @Post(':id/assignments')
  @Requires('runden.nachnominieren')
  addAssignment(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addAssignmentSchema)) body: AddAssignment,
  ) {
    return this.rounds.addAssignment(auth, id, body);
  }

  @Post(':id/start')
  @Requires('runden.verwalten')
  start(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.rounds.start(auth, id);
  }

  @Post(':id/extend')
  @Requires('runden.verwalten')
  extend(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(extendRoundSchema)) body: ExtendRound,
  ) {
    return this.rounds.extend(auth, id, body);
  }

  @Post(':id/close')
  @Requires('runden.verwalten')
  close(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.rounds.close(auth, id);
  }
}
