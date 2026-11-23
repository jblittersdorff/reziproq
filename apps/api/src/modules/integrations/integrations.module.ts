import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module.js';
import { ApiKeysService } from './api-keys.service.js';
import { FakeProvider } from './fake-provider.js';
import { FakeGraphClient, GRAPH_CLIENT } from './graph-client.js';
import { MicrosoftGraphClient } from './microsoft-provider.js';
import { ItemHandlers } from './item-handlers.js';
import { IntegrationQueue } from './integration-queue.js';
import {
  InboundHookController,
  IntegrationsController,
  MicrosoftCallbackController,
  MyConnectionsController,
} from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { IntegrationsWorker } from './integrations.worker.js';

/** IN-01 Integrationsschicht: Registry, Zugänge, Abgleiche, Webhooks, Einstellungen Anbindungen. */
@Module({
  imports: [ActivitiesModule],
  controllers: [
    IntegrationsController,
    MyConnectionsController,
    InboundHookController,
    MicrosoftCallbackController,
  ],
  providers: [
    FakeProvider,
    IntegrationQueue,
    IntegrationsService,
    IntegrationsWorker,
    ApiKeysService,
    ItemHandlers,
    FakeGraphClient,
    {
      // Durchstich: Graph echt, wenn MICROSOFT_PROVIDER=live; sonst der Nachbau
      provide: GRAPH_CLIENT,
      useFactory: (fake: FakeGraphClient, integrations: IntegrationsService) =>
        integrations.microsoftLive ? new MicrosoftGraphClient(integrations.microsoftLive) : fake,
      inject: [FakeGraphClient, IntegrationsService],
    },
  ],
  exports: [IntegrationsService, ApiKeysService, ItemHandlers, FakeGraphClient, GRAPH_CLIENT],
})
export class IntegrationsModule {}
