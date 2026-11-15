import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type Bridge,
  type CustomerImpact,
  type DecideValidation,
  decideValidationSchema,
  type FiscalYearSetting,
  type FreezeBaseline,
  fiscalYearSettingSchema,
  freezeBaselineSchema,
  type ImpactDetail,
  type ImpactImportPreview,
  type ImpactList,
  type ImpactView,
  impactViews,
  type PnlLines,
  type PortfolioImpact,
  type RaiseMaturity,
  type RequestValidation,
  raiseMaturitySchema,
  requestValidationSchema,
  type SaveBenefit,
  type SaveImpactMonth,
  type SavePnlLine,
  type SaveShare,
  type SavingsReference,
  type SetupImpact,
  saveBenefitSchema,
  saveImpactMonthSchema,
  savePnlLineSchema,
  saveSavingsReferenceSchema,
  saveShareSchema,
  setupImpactSchema,
  type ValidationDetail,
  type ValidationList,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { parseImportFile } from '../suppliers/import-file.js';
import { ImpactService } from './impact.service.js';
import { PortfolioService } from './portfolio.service.js';
import { SharingService } from './sharing.service.js';
import { ValidationService } from './validation.service.js';

const maxUploadBytes = 10 * 1024 * 1024;
type UploadedImportFile = { originalname: string; buffer: Buffer };

async function parseUpload(file: UploadedImportFile | undefined) {
  if (!file) {
    throw new BadRequestException({
      code: 'file_required',
      message: 'Bitte wähle eine Datei aus.',
    });
  }
  return parseImportFile(file.originalname, file.buffer);
}

/** GuV-Wirkung je Lieferant (PNL-01, PNL-03), nur beim Käufer. */
@Controller('suppliers/:id/wirkung')
export class ImpactController {
  constructor(@Inject(ImpactService) private readonly impact: ImpactService) {}

  @Get()
  @Requires('wirkung.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImpactList> {
    return this.impact.run(auth, id, (scope) => this.impact.list(scope));
  }

  @Get('initiativen/:initiativeId')
  @Requires('wirkung.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.detail(scope, initiativeId));
  }

  @Put('initiativen/:initiativeId/einrichten')
  @Requires('wirkung.bearbeiten')
  setup(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(setupImpactSchema)) body: SetupImpact,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.setup(scope, initiativeId, body));
  }

  @Post('initiativen/:initiativeId/baseline')
  @Requires('wirkung.bearbeiten')
  freeze(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(freezeBaselineSchema)) body: FreezeBaseline,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.freeze(scope, initiativeId, body));
  }

  @Post('initiativen/:initiativeId/reifegrad')
  @Requires('wirkung.bearbeiten')
  raise(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(raiseMaturitySchema)) body: RaiseMaturity,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.raise(scope, initiativeId, body));
  }

  @Post('initiativen/:initiativeId/monate')
  @Requires('wirkung.bearbeiten')
  saveMonth(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(saveImpactMonthSchema)) body: SaveImpactMonth,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.saveMonth(scope, initiativeId, body));
  }

  @Post('initiativen/:initiativeId/import/vorschau')
  @Requires('wirkung.bearbeiten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
  async previewImport(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @UploadedFile() file: UploadedImportFile | undefined,
  ): Promise<ImpactImportPreview> {
    const parsed = await parseUpload(file);
    return this.impact.run(auth, id, (scope) =>
      this.impact.importMonths(scope, initiativeId, parsed.rows, false),
    );
  }

  @Post('initiativen/:initiativeId/import')
  @Requires('wirkung.bearbeiten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
  async applyImport(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @UploadedFile() file: UploadedImportFile | undefined,
  ): Promise<ImpactImportPreview> {
    const parsed = await parseUpload(file);
    return this.impact.run(auth, id, (scope) =>
      this.impact.importMonths(scope, initiativeId, parsed.rows, true),
    );
  }

  @Post('initiativen/:initiativeId/freigabe')
  @Requires('wirkung.bearbeiten')
  requestValidation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(requestValidationSchema)) body: RequestValidation,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) =>
      this.impact.requestValidation(scope, initiativeId, body),
    );
  }
}

/** Freigaben durch Controlling (PNL-06), über alle Lieferanten der Organisation. */
@Controller('wirkung/freigaben')
export class ValidationController {
  constructor(@Inject(ValidationService) private readonly validations: ValidationService) {}

  @Get()
  @Requires('wirkung.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<ValidationList> {
    return this.validations.list(auth);
  }

  @Get(':validationId')
  @Requires('wirkung.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('validationId', ParseUUIDPipe) validationId: string,
  ): Promise<ValidationDetail> {
    return this.validations.detail(auth, validationId);
  }

  @Post(':validationId/entscheiden')
  @Requires('wirkung.freigeben')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('validationId', ParseUUIDPipe) validationId: string,
    @Body(new ZodValidationPipe(decideValidationSchema)) body: DecideValidation,
  ): Promise<ValidationDetail> {
    return this.validations.decide(auth, validationId, body);
  }
}

/** GuV-Zeilen der Organisation (PNL-01, Einstellungen). */
@Controller('pnl-lines')
export class PnlLinesController {
  constructor(@Inject(ImpactService) private readonly impact: ImpactService) {}

  @Get()
  @Requires('wirkung.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<PnlLines> {
    return this.impact.lines(auth);
  }

  @Post()
  @Requires('einstellungen.verwalten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(savePnlLineSchema)) body: SavePnlLine,
  ): Promise<PnlLines> {
    return this.impact.saveLine(auth, null, body);
  }

  @Put(':key')
  @Requires('einstellungen.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(savePnlLineSchema)) body: SavePnlLine,
  ): Promise<PnlLines> {
    return this.impact.saveLine(auth, key, body);
  }
}

/** PNL-07: Teilung und Savings-Verweis beim Käufer. */
@Controller('suppliers/:id/wirkung/initiativen/:initiativeId')
export class ImpactSharingController {
  constructor(@Inject(SharingService) private readonly sharing: SharingService) {}

  @Put('teilung')
  @Requires('teilung.vereinbaren')
  share(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(saveShareSchema)) body: SaveShare,
  ): Promise<ImpactList> {
    return this.sharing.saveShare(auth, id, initiativeId, body);
  }

  @Put('savings')
  @Requires('wirkung.bearbeiten')
  setReference(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(saveSavingsReferenceSchema)) body: SavingsReference,
  ): Promise<ImpactList> {
    return this.sharing.setReference(auth, id, initiativeId, body);
  }

  @Delete('savings')
  @Requires('wirkung.bearbeiten')
  removeReference(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<ImpactList> {
    return this.sharing.setReference(auth, id, initiativeId, null);
  }
}

/** PNL-07: Wirkung beim Lieferanten im Kontext des Kunden. */
@Controller('kunden/:id/wirkung')
export class CustomerImpactController {
  constructor(@Inject(SharingService) private readonly sharing: SharingService) {}

  @Get()
  @Requires('kunden.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerImpact> {
    return this.sharing.customer(auth, id);
  }

  @Post('initiativen/:initiativeId/teilung/bestaetigen')
  @HttpCode(200)
  @Requires('teilung.vereinbaren')
  confirm(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<CustomerImpact> {
    return this.sharing.confirm(auth, id, initiativeId);
  }

  @Post('initiativen/:initiativeId/nutzen')
  @Requires('eigene_sicht.bearbeiten')
  createBenefit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(saveBenefitSchema)) body: SaveBenefit,
  ): Promise<CustomerImpact> {
    return this.sharing.saveBenefit(auth, id, initiativeId, null, body);
  }

  @Put('initiativen/:initiativeId/nutzen/:benefitId')
  @Requires('eigene_sicht.bearbeiten')
  updateBenefit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('benefitId', ParseUUIDPipe) benefitId: string,
    @Body(new ZodValidationPipe(saveBenefitSchema)) body: SaveBenefit,
  ): Promise<CustomerImpact> {
    return this.sharing.saveBenefit(auth, id, initiativeId, benefitId, body);
  }

  @Delete('initiativen/:initiativeId/nutzen/:benefitId')
  @Requires('eigene_sicht.bearbeiten')
  removeBenefit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('benefitId', ParseUUIDPipe) benefitId: string,
  ): Promise<CustomerImpact> {
    return this.sharing.saveBenefit(auth, id, initiativeId, benefitId, null);
  }
}

const viewQuery = new ZodValidationPipe(z.enum(impactViews).optional().default('jahreswirkung'));
const fiscalYearQuery = new ZodValidationPipe(
  z.coerce.number().int().min(2000).max(2100).optional(),
);

/** PNL-10: P&L-Brücke beim Käufer. */
@Controller('suppliers/:id/wirkung/bruecke')
export class BridgeController {
  constructor(@Inject(PortfolioService) private readonly portfolio: PortfolioService) {}

  @Get()
  @Requires('wirkung.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sicht', viewQuery) view: ImpactView,
    @Query('gj', fiscalYearQuery) fiscalYear: number | undefined,
  ): Promise<Bridge> {
    return this.portfolio.bridge(auth, id, view, fiscalYear);
  }
}

/** PNL-10: P&L-Brücke beim Lieferanten, nur geteilte Werte. */
@Controller('kunden/:id/wirkung/bruecke')
export class CustomerBridgeController {
  constructor(@Inject(PortfolioService) private readonly portfolio: PortfolioService) {}

  @Get()
  @Requires('kunden.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sicht', viewQuery) view: ImpactView,
    @Query('gj', fiscalYearQuery) fiscalYear: number | undefined,
  ): Promise<Bridge> {
    return this.portfolio.customerBridge(auth, id, view, fiscalYear);
  }
}

/** PNL-10: Wirkung im Portfolio der Fokuslieferanten und Geschäftsjahr je Kunde. */
@Controller('wirkung')
export class PortfolioImpactController {
  constructor(@Inject(PortfolioService) private readonly portfolio: PortfolioService) {}

  @Get('portfolio')
  @Requires('wirkung.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Query('sicht', viewQuery) view: ImpactView,
    @Query('gj', fiscalYearQuery) fiscalYear: number | undefined,
  ): Promise<PortfolioImpact> {
    return this.portfolio.portfolio(auth, view, fiscalYear);
  }

  @Get('geschaeftsjahr')
  @Requires('wirkung.sehen')
  fiscalYear(@CurrentUser() auth: AuthContext): Promise<FiscalYearSetting> {
    return this.portfolio.fiscalYearSetting(auth);
  }

  @Put('geschaeftsjahr')
  @Requires('einstellungen.verwalten')
  saveFiscalYear(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(fiscalYearSettingSchema)) body: FiscalYearSetting,
  ): Promise<FiscalYearSetting> {
    return this.portfolio.saveFiscalYearSetting(auth, body);
  }
}
