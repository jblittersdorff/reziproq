import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type NotificationAction,
  notificationActionSchema,
  type SaveNotificationOrg,
  type SaveNotificationPrefs,
  saveNotificationOrgSchema,
  saveNotificationPrefsSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { NotificationsService } from './notifications.service.js';

/** IN-06: Profil › Benachrichtigungen (eigene Einstellungen, Teams verbinden) */
@Controller('profil/benachrichtigungen')
export class NotificationPrefsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  @Requires('lieferanten.sehen')
  prefs(@CurrentUser() auth: AuthContext) {
    return this.notifications.prefs(auth);
  }

  @Put()
  @Requires('lieferanten.sehen')
  save(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveNotificationPrefsSchema)) body: SaveNotificationPrefs,
  ) {
    return this.notifications.savePrefs(auth, body);
  }

  @Post('teams')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  linkTeams(@CurrentUser() auth: AuthContext) {
    return this.notifications.linkTeams(auth);
  }

  @Delete('teams')
  @Requires('lieferanten.sehen')
  unlinkTeams(@CurrentUser() auth: AuthContext) {
    return this.notifications.unlinkTeams(auth);
  }

  /** Admin: Teams-App und Mailversand für die Organisation */
  @Put('organisation')
  @Requires('einstellungen.verwalten')
  saveOrganization(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveNotificationOrgSchema)) body: SaveNotificationOrg,
  ) {
    return this.notifications.saveOrganization(auth, body);
  }
}

/**
 * IN-06: Knopf auf einer Teams-Karte. Im Betrieb leitet der Bot den Klick mit der Identität der
 * Person hierher weiter; die Aktion läuft über die Domänendienste mit ihren Rechten.
 */
@Controller('benachrichtigungen')
export class NotificationActionsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Post(':id/aktion')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  act(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(notificationActionSchema)) body: NotificationAction,
  ) {
    return this.notifications.act(auth, id, body);
  }
}
