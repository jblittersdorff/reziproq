import { Module } from '@nestjs/common';
import { ActionsMetricSource } from '../actions/action-sources.js';
import { JbpMetricSource } from '../jbp/jbp-sources.js';
import { RulesMetricSource } from '../playbook/rule-set-sources.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { RatingsService } from '../ratings/ratings.service.js';
import { SpendMetricSource, TeamMetricSource } from '../suppliers/overview-metrics.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import {
  CYCLE_STEP_SOURCES,
  feedbackCycleStepSource,
  jbpCycleStepSource,
  scorecardCycleStepSource,
  segmentCycleStepSource,
  supplierPlanCycleStepSource,
  touchpointCycleStepSource,
} from './cycle.js';
import { CycleSettingsController } from './cycle-settings.controller.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';
import { OVERVIEW_METRIC_SOURCES } from './overview-metric.js';

/** Überblick des Arbeitsbereichs (NAV-06). Jedes Modul mit Kennzahl trägt hier seine Quelle ein. */
@Module({
  imports: [SuppliersModule, RatingsModule],
  controllers: [OverviewController, CycleSettingsController],
  providers: [
    OverviewService,
    ActionsMetricSource,
    RulesMetricSource,
    JbpMetricSource,
    {
      provide: CYCLE_STEP_SOURCES,
      useValue: [
        segmentCycleStepSource,
        feedbackCycleStepSource,
        touchpointCycleStepSource,
        supplierPlanCycleStepSource,
        jbpCycleStepSource,
        scorecardCycleStepSource,
      ],
    },
    {
      provide: OVERVIEW_METRIC_SOURCES,
      useFactory: (
        spend: SpendMetricSource,
        team: TeamMetricSource,
        ratings: RatingsService,
        actions: ActionsMetricSource,
        rules: RulesMetricSource,
        plan: JbpMetricSource,
      ) => [ratings, spend, team, actions, rules, plan],
      inject: [
        SpendMetricSource,
        TeamMetricSource,
        RatingsService,
        ActionsMetricSource,
        RulesMetricSource,
        JbpMetricSource,
      ],
    },
  ],
  exports: [OverviewService, CYCLE_STEP_SOURCES],
})
export class OverviewModule {}
