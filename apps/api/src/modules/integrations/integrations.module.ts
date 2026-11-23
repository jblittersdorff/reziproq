import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module.js';
import { ApiKeysService } from './api-keys.service.js';
import { FakeProvider } from './fake-provider.js';
import { FakeGraphClient } from './graph-client.js';
import { ItemHandlers } from './item-handlers.js';
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
    ItemHandlers,
    FakeGraphClient,
  ],
  exports: [IntegrationsService, ApiKeysService, ItemHandlers, FakeGraphClient],
})
export class IntegrationsModule {}
