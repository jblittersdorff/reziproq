import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './common/database.module.js';
import { env } from './config/env.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MasterDataModule } from './modules/master-data/master-data.module.js';
import { MeModule } from './modules/me/me.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { OverviewModule } from './modules/overview/overview.module.js';
import { PromptModule } from './modules/prompt/prompt.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { SupportModule } from './modules/support/support.module.js';

// Im Betrieb liefert die API auch die fertig gebaute Web-App aus.
// Im Entwicklungsmodus übernimmt das der Vite-Server.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    MeModule,
    OrganizationsModule,
    SuppliersModule,
    OverviewModule,
    MasterDataModule,
    PromptModule,
    SupportModule,
    AuditModule,
    ...(env.NODE_ENV === 'production'
      ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
      : []),
  ],
})
export class AppModule {}
