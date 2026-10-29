import type { INestApplication } from '@nestjs/common';

/** Einstellungen, die für den Betrieb und für Tests gleich sein müssen. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
