import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import {
  type OrganizationMember,
  type OrganizationResponse,
  type UpdateMemberRequest,
  updateMemberRequestSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { OrganizationService } from './organization.service.js';

@Controller('organisation')
export class OrganizationsController {
  constructor(@Inject(OrganizationService) private readonly organizations: OrganizationService) {}

  /** Name, Land und Mitglieder der eigenen Organisation (PLT-02). Ohne Organisation 403 (Guard). */
  @Get()
  @Requires('organisation.sehen')
  get(@CurrentUser() auth: AuthContext): Promise<OrganizationResponse> {
    return this.organizations.withMembers(auth);
  }

  @Get('mitglieder/:id')
  @Requires('organisation.sehen')
  member(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<OrganizationMember> {
    return this.organizations.member(auth, id);
  }

  /** Rolle, Controlling und Standardfunktion ändern (PLT-05), nur Admin. */
  @Put('mitglieder/:id')
  @Requires('rollen.aendern')
  updateMember(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMemberRequestSchema)) body: UpdateMemberRequest,
  ): Promise<OrganizationMember> {
    return this.organizations.updateMember(auth, id, body);
  }
}
