import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './common/database.module.js';
import { NotificationBusModule } from './common/notification-bus.js';
import { env } from './config/env.js';
import { ActionsModule } from './modules/actions/actions.module.js';
import { ActivitiesModule } from './modules/activities/activities.module.js';
import { AgentsModule } from './modules/agents/agents.module.js';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CalendarModule } from './modules/calendar/calendar.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DataExportModule } from './modules/data-export/data-export.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { FocusModule } from './modules/focus/focus.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HintsModule } from './modules/hints/hints.module.js';
import { ImpactModule } from './modules/impact/impact.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { InvitationsModule } from './modules/invitations/invitations.module.js';
import { JbpModule } from './modules/jbp/jbp.module.js';
import { MailsModule } from './modules/mails/mails.module.js';
import { MasterDataModule } from './modules/master-data/master-data.module.js';
import { MaterialGroupsModule } from './modules/material-groups/material-groups.module.js';
import { MeModule } from './modules/me/me.module.js';
import { MeetingsModule } from './modules/meetings/meetings.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { OverviewModule } from './modules/overview/overview.module.js';
import { PdfExportsModule } from './modules/pdf-exports/pdf-exports.module.js';
import { PlaybookModule } from './modules/playbook/playbook.module.js';
import { PortfolioModule } from './modules/portfolio/portfolio.module.js';
import { PromptModule } from './modules/prompt/prompt.module.js';
import { RatingsModule } from './modules/ratings/ratings.module.js';
import { RoundsModule } from './modules/rounds/rounds.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SegmentModelModule } from './modules/segment-model/segment-model.module.js';
import { SsoModule } from './modules/sso/sso.module.js';
import { StartModule } from './modules/start/start.module.js';
import { SupplierPlansModule } from './modules/supplier-plans/supplier-plans.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { SupportModule } from './modules/support/support.module.js';
import { TouchpointsModule } from './modules/touchpoints/touchpoints.module.js';

// Im Betrieb liefert die API auch die fertig gebaute Web-App aus.
// Im Entwicklungsmodus übernimmt das der Vite-Server.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

@Module({
  imports: [
    DatabaseModule,
    NotificationBusModule,
    AuthModule,
    HealthModule,
    AiGatewayModule,
    AgentsModule,
    MeModule,
    OrganizationsModule,
    OpportunitiesModule,
    SuppliersModule,
    OverviewModule,
    MasterDataModule,
    PromptModule,
    SupportModule,
    AuditModule,
    EmailModule,
    SegmentModelModule,
    PortfolioModule,
    FocusModule,
    RatingsModule,
    RoundsModule,
    StartModule,
    SupplierPlansModule,
    InvitationsModule,
    CustomersModule,
    PlaybookModule,
    MeetingsModule,
    ActionsModule,
    TouchpointsModule,
    CommentsModule,
    DataExportModule,
    PdfExportsModule,
    HintsModule,
    ImportsModule,
    IntegrationsModule,
    SsoModule,
    CalendarModule,
    MailsModule,
    NotificationsModule,
    SearchModule,
    MaterialGroupsModule,
    ActivitiesModule,
    JbpModule,
    ImpactModule,
    FeedbackModule,
    ...(env.NODE_ENV === 'production'
      ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
      : []),
  ],
})
export class AppModule {}
