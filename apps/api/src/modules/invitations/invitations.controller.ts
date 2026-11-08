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
  type AcceptInvitationRequest,
  type AcceptInvitationResponse,
  acceptInvitationRequestSchema,
  type InvitationList,
  type InviteSupplierRequest,
  inviteSupplierRequestSchema,
  type PublicInvitation,
} from '@reziproq/shared';
import { AccountStore } from '../../common/database.module.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { InvitationsService } from './invitations.service.js';

/** Einladungen eines Käufers an Personen des Lieferanten (LIF-01a). */
@Controller('suppliers/:id/einladungen')
export class SupplierInvitationsController {
  constructor(
    @Inject(InvitationsService) private readonly invitations: InvitationsService,
    @Inject(AccountStore) private readonly accounts: AccountStore,
  ) {}

  @Get()
  @Requires('lieferanten.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationList> {
    return this.invitations.list(auth, id);
  }

  /** Admin oder SRO der Beziehung; die Mail geht in der Sprache der einladenden Person raus. */
  @Post()
  @Requires('lieferanten.einladen')
  async invite(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(inviteSupplierRequestSchema)) body: InviteSupplierRequest,
  ): Promise<InvitationList> {
    return this.invitations.invite(auth, id, body, await this.accounts.localeOf(auth.userId));
  }

  @Post(':invitationId/zurueckziehen')
  @HttpCode(200)
  @Requires('lieferanten.einladen')
  revoke(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<InvitationList> {
    return this.invitations.revoke(auth, id, invitationId);
  }
}

/** Ohne Login: Einladung ansehen und annehmen. Der Token ist der einzige Schlüssel. */
@Controller('einladungen')
@Public()
export class PublicInvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<PublicInvitation> {
    return this.invitations.preview(token);
  }

  @Post(':token/annahme')
  @HttpCode(200)
  accept(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInvitationRequestSchema)) body: AcceptInvitationRequest,
  ): Promise<AcceptInvitationResponse> {
    return this.invitations.accept(token, body);
  }
}
