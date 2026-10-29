import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './common/database.module.js';
import { env } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { HelloController } from './hello/hello.controller.js';

// Im Betrieb liefert die API auch die fertig gebaute Web-App aus.
// Im Entwicklungsmodus übernimmt das der Vite-Server.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

@Module({
  imports: [
    DatabaseModule,
    ...(env.NODE_ENV === 'production'
      ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
      : []),
  ],
  controllers: [HealthController, HelloController],
})
export class AppModule {}
