import type { INestApplication } from '@nestjs/common';
import { movedTo } from '@reziproq/shared';
import type { NextFunction, Request, Response } from 'express';

/** Einstellungen, die für den Betrieb und für Tests gleich sein müssen. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // NAV-10 TN-07: Alte Adressen der App leiten mit 301 auf die neuen weiter, bevor die API die
  // gebaute App ausliefert (Tabelle in packages/shared/src/route-moves.ts). Lesezeichen und Links in
  // Mails funktionieren so weiter. Die API selbst (/api) bleibt unberührt.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const api = request.path === '/api' || request.path.startsWith('/api/');
    if (!api && (request.method === 'GET' || request.method === 'HEAD')) {
      const query = request.originalUrl.split('?')[1] ?? '';
      const target = movedTo(request.path, query);
      if (target) {
        response.redirect(301, target);
        return;
      }
    }
    next();
  });
}
