import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type Commitments,
  type CreateJbp,
  commitmentStatusSchema,
  createJbpSchema,
  type DecideJbp,
  decideJbpSchema,
  type ImportJbpTopics,
  type InitiativeDetail,
  type Initiatives,
  importJbpTopicsSchema,
  initiativeStatusSchema,
  type JbpApprovalView,
  type JbpPreparation,
  type JbpTopicCandidates,
  type JbpTopicOrder,
  type JbpTopics,
  type JbpVersions,
  jbpTopicOrderSchema,
  type KpiDetail,
  type KpiImportPreview,
  type ParkJbpTopic,
  parkJbpTopicSchema,
  type SaveBusinessUpdate,
  type SaveCommitment,
  type SaveInitiative,
  type SaveJbpTopic,
  type SaveKpi,
  type SaveKpiValue,
  type SaveMilestone,
  type ScorecardView,
  type SetCommitmentStatus,
  type SetInitiativeStatus,
  saveBusinessUpdateSchema,
  saveCommitmentSchema,
  saveInitiativeSchema,
  saveJbpTopicSchema,
  saveKpiSchema,
  saveKpiValueSchema,
  saveMilestoneSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { parseImportFile } from '../suppliers/import-file.js';
import { type JbpScope, JbpService } from './jbp.service.js';
import { JbpApprovalService } from './jbp-approval.service.js';
import { JbpCommitmentsService } from './jbp-commitments.service.js';
import { JbpInitiativesService } from './jbp-initiatives.service.js';
import { JbpScorecardService } from './jbp-scorecard.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';

/** Gemeinsamer Plan beim Käufer (JBP-01). */
@Controller('suppliers/:id/jbp')
export class BuyerJbpController {
  constructor(@Inject(JbpService) private readonly jbp: JbpService) {}

  @Get()
  @Requires('jbp.sehen')
  preparation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.preparation(scope));
  }

  @Post()
  @Requires('jbp.anlegen')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createJbpSchema)) body: CreateJbp,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.create(scope, body));
  }

  @Put('geschaeftsupdate')
  @Requires('jbp.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveBusinessUpdateSchema)) body: SaveBusinessUpdate,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.saveUpdate(scope, body.text));
  }
}

/** Gemeinsamer Plan beim Lieferanten im Kontext des Kunden (JBP-01). */
@Controller('kunden/:id/jbp')
export class SupplierJbpController {
  constructor(@Inject(JbpService) private readonly jbp: JbpService) {}

  @Get()
  @Requires('jbp.sehen')
  preparation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpPreparation> {
    return this.jbp.supplier(auth, id, (scope) => this.jbp.preparation(scope));
  }

  @Put('geschaeftsupdate')
  @Requires('jbp.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveBusinessUpdateSchema)) body: SaveBusinessUpdate,
  ): Promise<JbpPreparation> {
    return this.jbp.supplier(auth, id, (scope) => this.jbp.saveUpdate(scope, body.text));
  }
}

type Side = 'buyer' | 'supplier';

/** JBP-02: Themen beider Seiten; dieselben Endpunkte je Seite. */
function topicRoutes(side: Side) {
  class SideTopicsController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpTopicsService) readonly topics: JbpTopicsService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get()
    @Requires('jbp.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.topics(scope));
    }

    @Post()
    @Requires('jbp.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(saveJbpTopicSchema)) body: SaveJbpTopic,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.create(scope, body));
    }

    @Put('reihenfolge')
    @Requires('jbp.bearbeiten')
    reorder(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(jbpTopicOrderSchema)) body: JbpTopicOrder,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.reorder(scope, body.ids));
    }

    @Put(':topicId')
    @Requires('jbp.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('topicId', ParseUUIDPipe) topicId: string,
      @Body(new ZodValidationPipe(saveJbpTopicSchema)) body: SaveJbpTopic,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.update(scope, topicId, body));
    }

    @Put(':topicId/parken')
    @Requires('jbp.bearbeiten')
    park(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('topicId', ParseUUIDPipe) topicId: string,
      @Body(new ZodValidationPipe(parkJbpTopicSchema)) body: ParkJbpTopic,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.park(scope, topicId, body.reason));
    }

    @Put(':topicId/wieder-aufnehmen')
    @Requires('jbp.bearbeiten')
    restore(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('topicId', ParseUUIDPipe) topicId: string,
    ): Promise<JbpTopics> {
      return this.run(auth, id, (scope) => this.topics.restore(scope, topicId));
    }
  }
  return SideTopicsController;
}

/** Themen beim Käufer (JBP-02), dazu die Übernahme aus dem Lieferantenplan. */
@Controller('suppliers/:id/jbp/themen')
export class BuyerJbpTopicsController extends topicRoutes('buyer') {
  @Get('vorschlaege')
  @Requires('jbp.anlegen')
  candidates(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpTopicCandidates> {
    return this.jbp.buyer(auth, id, (scope) => this.topics.candidates(scope));
  }

  @Post('uebernehmen')
  @Requires('jbp.anlegen')
  importTopics(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(importJbpTopicsSchema)) body: ImportJbpTopics,
  ): Promise<JbpTopics> {
    return this.jbp.buyer(auth, id, (scope) => this.topics.importTopics(scope, body));
  }
}

/** Themen beim Lieferanten im Kontext des Kunden (JBP-02, LIF-04). */
@Controller('kunden/:id/jbp/themen')
export class SupplierJbpTopicsController extends topicRoutes('supplier') {}

/** JBP-03: Initiativen und Roadmap; dieselben Endpunkte je Seite. */
function initiativeRoutes(side: Side) {
  class SideInitiativesController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpInitiativesService) readonly initiatives: JbpInitiativesService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get()
    @Requires('jbp.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<Initiatives> {
      return this.run(auth, id, (scope) => this.initiatives.list(scope));
    }

    @Post()
    @Requires('jbp.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(saveInitiativeSchema)) body: SaveInitiative,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) => this.initiatives.create(scope, body));
    }

    @Get(':initiativeId')
    @Requires('jbp.sehen')
    get(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) => this.initiatives.get(scope, initiativeId));
    }

    @Put(':initiativeId')
    @Requires('jbp.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Body(new ZodValidationPipe(saveInitiativeSchema)) body: SaveInitiative,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) => this.initiatives.update(scope, initiativeId, body));
    }

    @Put(':initiativeId/status')
    @Requires('jbp.bearbeiten')
    status(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Body(new ZodValidationPipe(initiativeStatusSchema)) body: SetInitiativeStatus,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.setStatus(scope, initiativeId, body.status),
      );
    }

    @Post(':initiativeId/meilensteine')
    @Requires('jbp.bearbeiten')
    addMilestone(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Body(new ZodValidationPipe(saveMilestoneSchema)) body: SaveMilestone,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.addMilestone(scope, initiativeId, body),
      );
    }

    @Put(':initiativeId/meilensteine/:milestoneId')
    @Requires('jbp.bearbeiten')
    updateMilestone(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
      @Body(new ZodValidationPipe(saveMilestoneSchema)) body: SaveMilestone,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.updateMilestone(scope, initiativeId, milestoneId, body),
      );
    }

    @Delete(':initiativeId/meilensteine/:milestoneId')
    @Requires('jbp.bearbeiten')
    deleteMilestone(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
      @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    ): Promise<InitiativeDetail> {
      return this.run(auth, id, (scope) =>
        this.initiatives.deleteMilestone(scope, initiativeId, milestoneId),
      );
    }
  }
  return SideInitiativesController;
}

/** Initiativen beim Käufer (JBP-03). */
@Controller('suppliers/:id/jbp/initiativen')
export class BuyerJbpInitiativesController extends initiativeRoutes('buyer') {}

/** Initiativen beim Lieferanten im Kontext des Kunden (JBP-03). */
@Controller('kunden/:id/jbp/initiativen')
export class SupplierJbpInitiativesController extends initiativeRoutes('supplier') {}

/** JBP-05: Zusagen; dieselben Endpunkte je Seite. */
function commitmentRoutes(side: Side) {
  class SideCommitmentsController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpCommitmentsService) readonly commitments: JbpCommitmentsService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get()
    @Requires('jbp.sehen')
    list(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<Commitments> {
      return this.run(auth, id, (scope) => this.commitments.list(scope));
    }

    @Post()
    @Requires('jbp.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(saveCommitmentSchema)) body: SaveCommitment,
    ): Promise<Commitments> {
      return this.run(auth, id, (scope) => this.commitments.create(scope, body));
    }

    @Put(':commitmentId')
    @Requires('jbp.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('commitmentId', ParseUUIDPipe) commitmentId: string,
      @Body(new ZodValidationPipe(saveCommitmentSchema)) body: SaveCommitment,
    ): Promise<Commitments> {
      return this.run(auth, id, (scope) => this.commitments.update(scope, commitmentId, body));
    }

    @Put(':commitmentId/status')
    @Requires('jbp.bearbeiten')
    status(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('commitmentId', ParseUUIDPipe) commitmentId: string,
      @Body(new ZodValidationPipe(commitmentStatusSchema)) body: SetCommitmentStatus,
    ): Promise<Commitments> {
      return this.run(auth, id, (scope) =>
        this.commitments.setStatus(scope, commitmentId, body.status),
      );
    }
  }
  return SideCommitmentsController;
}

/** Zusagen beim Käufer (JBP-05). */
@Controller('suppliers/:id/jbp/zusagen')
export class BuyerJbpCommitmentsController extends commitmentRoutes('buyer') {}

/** Zusagen beim Lieferanten im Kontext des Kunden (JBP-05). */
@Controller('kunden/:id/jbp/zusagen')
export class SupplierJbpCommitmentsController extends commitmentRoutes('supplier') {}

/** JBP-06: Freigabe und Versionen; dieselben Lese-Endpunkte je Seite. */
function approvalRoutes(side: Side) {
  class SideApprovalController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpApprovalService) readonly approval: JbpApprovalService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get('freigabe')
    @Requires('jbp.sehen')
    view(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<JbpApprovalView> {
      return this.run(auth, id, (scope) => this.approval.view(scope));
    }

    @Post('freigabe/neue-version')
    @Requires('jbp.bearbeiten')
    newVersion(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<JbpApprovalView> {
      return this.run(auth, id, (scope) => this.approval.newVersion(scope));
    }

    @Get('versionen')
    @Requires('jbp.sehen')
    versions(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<JbpVersions> {
      return this.run(auth, id, (scope) => this.approval.versions(scope));
    }
  }
  return SideApprovalController;
}

/** Freigabe beim Käufer: der SRO gibt zur Prüfung (JBP-06). */
@Controller('suppliers/:id/jbp')
export class BuyerJbpApprovalController extends approvalRoutes('buyer') {
  @Post('freigabe/einreichen')
  @Requires('jbp.anlegen')
  submit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpApprovalView> {
    return this.jbp.buyer(auth, id, (scope) => this.approval.submit(scope));
  }
}

/** Freigabe beim Lieferanten: freigeben oder mit Begründung zurückgeben (JBP-06). */
@Controller('kunden/:id/jbp')
export class SupplierJbpApprovalController extends approvalRoutes('supplier') {
  @Post('freigabe/entscheiden')
  @Requires('jbp.bearbeiten')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideJbpSchema)) body: DecideJbp,
  ): Promise<JbpApprovalView> {
    return this.jbp.supplier(auth, id, (scope) => this.approval.decide(scope, body));
  }
}

const maxUploadBytes = 10 * 1024 * 1024;
type UploadedImportFile = { originalname: string; buffer: Buffer };

/** CSV oder XLSX wie in PLT-07; Spaltennamen werden normalisiert (Kennzahl, Monat, Wert). */
async function parseUpload(file: UploadedImportFile | undefined) {
  if (!file) {
    throw new BadRequestException({
      code: 'file_required',
      message: 'Bitte wähle eine Datei aus.',
    });
  }
  return parseImportFile(file.originalname, file.buffer);
}

/** JBP-07: Scorecard mit Kennzahlen und Unterschriften; dieselben Endpunkte je Seite. */
function scorecardRoutes(side: Side) {
  class SideScorecardController {
    constructor(
      @Inject(JbpService) readonly jbp: JbpService,
      @Inject(JbpScorecardService) readonly scorecard: JbpScorecardService,
    ) {}

    run<T>(auth: AuthContext, id: string, work: (scope: JbpScope) => Promise<T>) {
      return side === 'buyer' ? this.jbp.buyer(auth, id, work) : this.jbp.supplier(auth, id, work);
    }

    @Get()
    @Requires('jbp.sehen')
    view(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ScorecardView> {
      return this.run(auth, id, (scope) => this.scorecard.view(scope));
    }

    @Post('kennzahlen')
    @Requires('jbp.bearbeiten')
    create(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Body(new ZodValidationPipe(saveKpiSchema)) body: SaveKpi,
    ): Promise<ScorecardView> {
      return this.run(auth, id, (scope) => this.scorecard.createKpi(scope, body));
    }

    @Put('kennzahlen/:kpiId')
    @Requires('jbp.bearbeiten')
    update(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('kpiId', ParseUUIDPipe) kpiId: string,
      @Body(new ZodValidationPipe(saveKpiSchema)) body: SaveKpi,
    ): Promise<ScorecardView> {
      return this.run(auth, id, (scope) => this.scorecard.updateKpi(scope, kpiId, body));
    }

    @Delete('kennzahlen/:kpiId')
    @Requires('jbp.bearbeiten')
    remove(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('kpiId', ParseUUIDPipe) kpiId: string,
    ): Promise<ScorecardView> {
      return this.run(auth, id, (scope) => this.scorecard.deleteKpi(scope, kpiId));
    }

    @Post('unterschreiben')
    @Requires('jbp.bearbeiten')
    sign(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ScorecardView> {
      return this.run(auth, id, (scope) => this.scorecard.sign(scope));
    }

    @Post('neue-version')
    @Requires('jbp.bearbeiten')
    newVersion(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ScorecardView> {
      return this.run(auth, id, (scope) => this.scorecard.newVersion(scope));
    }

    @Get('kennzahlen/:kpiId')
    @Requires('jbp.sehen')
    kpi(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('kpiId', ParseUUIDPipe) kpiId: string,
    ): Promise<KpiDetail> {
      return this.run(auth, id, (scope) => this.scorecard.kpiDetail(scope, kpiId));
    }

    @Post('kennzahlen/:kpiId/werte')
    @Requires('jbp.bearbeiten')
    enterValue(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @Param('kpiId', ParseUUIDPipe) kpiId: string,
      @Body(new ZodValidationPipe(saveKpiValueSchema)) body: SaveKpiValue,
    ): Promise<KpiDetail> {
      return this.run(auth, id, (scope) => this.scorecard.enterValue(scope, kpiId, body));
    }

    @Post('import/vorschau')
    @Requires('jbp.bearbeiten')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
    async previewImport(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @UploadedFile() file: UploadedImportFile | undefined,
    ): Promise<KpiImportPreview> {
      const parsed = await parseUpload(file);
      return this.run(auth, id, (scope) => this.scorecard.importPreview(scope, parsed.rows));
    }

    @Post('import')
    @Requires('jbp.bearbeiten')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
    async applyImport(
      @CurrentUser() auth: AuthContext,
      @Param('id', ParseUUIDPipe) id: string,
      @UploadedFile() file: UploadedImportFile | undefined,
    ): Promise<KpiImportPreview> {
      const parsed = await parseUpload(file);
      return this.run(auth, id, (scope) => this.scorecard.importApply(scope, parsed.rows));
    }
  }
  return SideScorecardController;
}

/** Scorecard beim Käufer (JBP-07). */
@Controller('suppliers/:id/jbp/scorecard')
export class BuyerJbpScorecardController extends scorecardRoutes('buyer') {}

/** Scorecard beim Lieferanten im Kontext des Kunden (JBP-07). */
@Controller('kunden/:id/jbp/scorecard')
export class SupplierJbpScorecardController extends scorecardRoutes('supplier') {}
