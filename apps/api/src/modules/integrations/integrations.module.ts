import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module.js';
import { ApiKeysService } from './api-keys.service.js';
import { FakeProvider } from './fake-provider.js';
import { IntegrationQueue } from './integration-queue.js';
import {
  InboundHookController,
  IntegrationsController,
  MyConnectionsController,
} from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { IntegrationsWorker } from './integrations.worker.js';

/** IN-01 Integrationsschicht: Registry, Zugänge, Abgleiche, Webhooks, Einstellungen Anbindungen. */
@Module({
  imports: [ActivitiesModule],
  controllers: [IntegrationsController, MyConnectionsController, InboundHookController],
  providers: [
    FakeProvider,
    IntegrationQueue,
    IntegrationsService,
    IntegrationsWorker,
    ApiKeysService,
  ],
  exports: [IntegrationsService, ApiKeysService],
})
export class IntegrationsModule {}
