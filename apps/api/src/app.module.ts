import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './common/database.module.js';
import { env } from './config/env.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MeModule } from './modules/me/me.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';

// Im Betrieb liefert die API auch die fertig gebaute Web-App aus.
// Im Entwicklungsmodus übernimmt das der Vite-Server.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    MeModule,
    SuppliersModule,
    ...(env.NODE_ENV === 'production'
      ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
      : []),
  ],
})
export class AppModule {}
