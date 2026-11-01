import { Module } from '@nestjs/common';
import { SpendMetricSource, TeamMetricSource } from '../suppliers/overview-metrics.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';
import { OVERVIEW_METRIC_SOURCES } from './overview-metric.js';

/** Überblick des Arbeitsbereichs (NAV-06). Jedes Modul mit Kennzahl trägt hier seine Quelle ein. */
@Module({
  imports: [SuppliersModule],
  controllers: [OverviewController],
  providers: [
    OverviewService,
    {
      provide: OVERVIEW_METRIC_SOURCES,
      useFactory: (spend: SpendMetricSource, team: TeamMetricSource) => [spend, team],
      inject: [SpendMetricSource, TeamMetricSource],
    },
  ],
})
export class OverviewModule {}
