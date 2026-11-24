import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { currentTime, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { WavesService } from '../feedback/waves.service.js';
import { type JbpScope, JbpService } from '../jbp/jbp.service.js';
import { JbpCommitmentsService } from '../jbp/jbp-commitments.service.js';
import { JbpInitiativesService } from '../jbp/jbp-initiatives.service.js';
import { JbpScorecardService } from '../jbp/jbp-scorecard.service.js';
import { JbpTopicsService } from '../jbp/jbp-topics.service.js';
import { feedbackHtml, jbpHtml, supplierPlanHtml } from '../print/documents.js';
import { PdfService } from '../print/pdf.service.js';
import { type PrintLocale, sendPdf } from '../print/print-parts.js';
import { SupplierPlansService } from '../supplier-plans/supplier-plans.service.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';

const localeQuery = new ZodValidationPipe(z.enum(['de', 'en']).default('de'));
const day = () => currentTime().toISOString().slice(0, 10);

/** Name der anderen Seite, wie die eigene Seite ihn sieht (Organisation, PLT-04). */
async function counterpart(tx: TenantTransaction, scope: JbpScope): Promise<string> {
  const [relationship] = await tx
    .select({
      buyerOrgId: schema.relationship.buyerOrgId,
      supplierOrgId: schema.relationship.supplierOrgId,
    })
    .from(schema.relationship)
    .where(eq(schema.relationship.id, scope.relationshipId));
  const id = scope.side === 'buyer' ? relationship?.supplierOrgId : relationship?.buyerOrgId;
  if (!id) return '';
  const [organization] = await tx
    .select({ name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.id, id));
  return organization?.name ?? '';
}

/** QS-03 (SPL-08): Lieferantenplan als PDF, nur beim Käufer und ganz intern. */
@Controller('suppliers/:id/plan')
export class SupplierPlanPdfController {
  constructor(
    @Inject(SupplierPlansService) private readonly plans: SupplierPlansService,
    @Inject(SuppliersService) private readonly suppliers: SuppliersService,
    @Inject(PdfService) private readonly pdf: PdfService,
  ) {}

  @Get('pdf')
  @Requires('lieferanten.sehen')
  async plan(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sprache', localeQuery) locale: PrintLocale,
    @Res() response: Response,
  ) {
    const [plan, supplier] = await Promise.all([
      this.plans.get(auth, id),
      this.suppliers.detail(auth, id),
    ]);
    if (!plan.plan) {
      response.status(404).json({ statusCode: 404, code: 'nicht_gefunden' });
      return;
    }
    const buffer = await this.pdf.render(supplierPlanHtml(plan.plan, supplier.name, locale));
    const kind = locale === 'de' ? 'Lieferantenplan' : 'Supplier plan';
    sendPdf(response, buffer, `${kind} ${supplier.name} ${day()}.pdf`);
  }
}

/** QS-03, LIF-06: Gemeinsamer Plan und Feedback-Ergebnis als PDF, je Seite. */
function sideRoutes(side: 'buyer' | 'supplier') {
  class SidePdfController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpTopicsService) readonly topics: JbpTopicsService,
      @Inject(JbpInitiativesService) readonly initiatives: JbpInitiativesService,
      @Inject(JbpCommitmentsService) readonly commitments: JbpCommitmentsService,
      @Inject(JbpScorecardService) readonly scorecard: JbpScorecardService,
      @Inject(WavesService) readonly waves: WavesService,
      @Inject(PdfService) readonly pdf: PdfService,
    ) {}

    @Get('jbp/pdf')
    @Requires('jbp.sehen')
    async jointPlan(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Query('sprache', localeQuery) locale: PrintLocale,
      @Res() response: Response,
    ) {
      const work = async (scope: JbpScope) => ({
        topics: await this.topics.topics(scope),
        initiatives: await this.initiatives.list(scope),
        commitments: await this.commitments.list(scope),
        scorecard: await this.scorecard.view(scope),
        name: await counterpart(scope.tx, scope),
      });
      const data =
        side === 'buyer'
          ? await this.jbp.buyer(auth, id, work)
          : await this.jbp.supplier(auth, id, work);
      const buffer = await this.pdf.render(jbpHtml(data, data.name, locale));
      const kind = locale === 'de' ? 'Gemeinsamer Plan' : 'Joint plan';
      sendPdf(response, buffer, `${kind} ${data.name} ${day()}.pdf`);
    }

    @Get('feedback/:waveId/pdf')
    @Requires('feedback.sehen')
    async feedback(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('waveId', ParseUUIDPipe) waveId: string,
      @Query('sprache', localeQuery) locale: PrintLocale,
      @Res() response: Response,
    ) {
      const run =
        side === 'buyer' ? this.waves.buyer.bind(this.waves) : this.waves.supplier.bind(this.waves);
      const data = await run(auth, id, async (scope) => ({
        detail: await this.waves.detail(scope, waveId),
        name: side === 'buyer' ? scope.names.supplier : scope.names.buyer,
      }));
      const buffer = await this.pdf.render(feedbackHtml(data.detail, data.name, locale));
      const kind = locale === 'de' ? 'Feedback-Ergebnis' : 'Feedback result';
      sendPdf(response, buffer, `${kind} ${data.name} ${day()}.pdf`);
    }
  }
  return SidePdfController;
}

@Controller('suppliers/:id')
export class BuyerPdfController extends sideRoutes('buyer') {}

@Controller('kunden/:id')
export class SupplierPdfController extends sideRoutes('supplier') {}
