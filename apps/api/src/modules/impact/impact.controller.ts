import {
  BadRequestException,
  Body,
  Controller,
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
  type DecideValidation,
  decideValidationSchema,
  type FreezeBaseline,
  freezeBaselineSchema,
  type ImpactDetail,
  type ImpactImportPreview,
  type ImpactList,
  type PnlLines,
  type RaiseMaturity,
  type RequestValidation,
  raiseMaturitySchema,
  requestValidationSchema,
  type SaveImpactMonth,
  type SavePnlLine,
  type SetupImpact,
  saveImpactMonthSchema,
  savePnlLineSchema,
  setupImpactSchema,
  type ValidationDetail,
  type ValidationList,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { parseImportFile } from '../suppliers/import-file.js';
import { ImpactService } from './impact.service.js';
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
