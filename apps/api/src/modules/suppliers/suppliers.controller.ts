import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type CreateSupplierRequest,
  type CreateSupplierResponse,
  createSupplierRequestSchema,
  type ImportType,
  importTypes,
  type RoleDescription,
  type SaveRoleDescription,
  type SaveSpendEntry,
  type SpendOverview,
  type SpendRequest,
  type SupplierDetail,
  type SupplierLookupQuery,
  type SupplierLookupResponse,
  type SuppliersResponse,
  saveRoleDescriptionSchema,
  saveSpendEntrySchema,
  spendRequestSchema,
  spendYearSchema,
  supplierLookupQuerySchema,
  type TeamResponse,
  type UpdateSupplierRequest,
  type UpdateTeamRequest,
  updateSupplierRequestSchema,
} from '@reziproq/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { createImportTemplate } from './import-file.js';
import { SpendService } from './spend.service.js';
import { SupplierImportService } from './supplier-import.service.js';
import { SuppliersService } from './suppliers.service.js';
import { TeamService } from './team.service.js';

const yearParam = new ZodValidationPipe(z.coerce.number().pipe(spendYearSchema));
const importTypeQuery = new ZodValidationPipe(z.enum(importTypes));
const templateFormatQuery = new ZodValidationPipe(z.enum(['csv', 'xlsx']));
const localeQuery = new ZodValidationPipe(z.enum(['de', 'en']).default('de'));
const maxUploadBytes = 10 * 1024 * 1024;
type UploadedImportFile = { originalname: string; buffer: Buffer };

@Controller('suppliers')
export class SuppliersController {
  constructor(
    @Inject(SuppliersService) private readonly suppliers: SuppliersService,
    @Inject(TeamService) private readonly teams: TeamService,
    @Inject(SupplierImportService) private readonly imports: SupplierImportService,
    @Inject(SpendService) private readonly spend: SpendService,
  ) {}

  @Get()
  @Requires('lieferanten.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<SuppliersResponse> {
    return this.suppliers.list(auth);
  }

  @Get('import/template')
  @Requires('lieferanten.sehen')
  async importTemplate(
    @CurrentUser() auth: AuthContext,
    @Query('type', importTypeQuery) type: ImportType,
    @Query('format', templateFormatQuery) format: 'csv' | 'xlsx',
    @Query('locale', localeQuery) locale: 'de' | 'en',
    @Res() response: Response,
  ): Promise<void> {
    if (!auth.organization?.buyer) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_berechtigung',
        message: 'Importvorlagen gibt es nur für Käufer.',
      });
    }
    const body = await createImportTemplate(type, format, locale);
    response
      .type(
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .attachment(`reziproq-vorlage-${type}.${format}`)
      .send(body);
  }

  @Post('import/preview')
  @Requires('lieferanten.bearbeiten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
  previewImport(
    @CurrentUser() auth: AuthContext,
    @Query('type', importTypeQuery) type: ImportType,
    @UploadedFile() file: UploadedImportFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'file_required',
        message: 'Bitte wähle eine Datei aus.',
      });
    }
    return this.imports.preview(auth, type, file.originalname, file.buffer);
  }

  @Post('import')
  @Requires('lieferanten.bearbeiten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
  applyImport(
    @CurrentUser() auth: AuthContext,
    @Query('type', importTypeQuery) type: ImportType,
    @UploadedFile() file: UploadedImportFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'file_required',
        message: 'Bitte wähle eine Datei aus.',
      });
    }
    return this.imports.import(auth, type, file.originalname, file.buffer);
  }

  @Get(':id/contacts')
  @Requires('lieferanten.sehen')
  listContacts(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.imports.listContacts(auth, relationshipId);
  }

  @Delete(':id/contacts/:contactId')
  @Requires('lieferanten.bearbeiten')
  deleteContact(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) relationshipId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.imports.deleteContact(auth, relationshipId, contactId);
  }

  /** Gibt es diese USt-IdNr. oder D-U-N-S schon? Nur ja oder nein (PLT-03). */
  @Get('lookup')
  @Requires('lieferanten.bearbeiten')
  lookup(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(supplierLookupQuerySchema)) query: SupplierLookupQuery,
  ): Promise<SupplierLookupResponse> {
    return this.suppliers.lookup(auth, query);
  }

  @Post()
  @Requires('lieferanten.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createSupplierRequestSchema)) body: CreateSupplierRequest,
  ): Promise<CreateSupplierResponse> {
    return this.suppliers.create(auth, body);
  }

  @Get(':id')
  @Requires('lieferanten.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetail> {
    return this.suppliers.detail(auth, id);
  }

  @Patch(':id')
  @Requires('lieferanten.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSupplierRequestSchema)) body: UpdateSupplierRequest,
  ): Promise<SupplierDetail> {
    return this.suppliers.update(auth, id, body);
  }

  @Post(':id/beenden')
  @Requires('lieferanten.bearbeiten')
  @HttpCode(200)
  end(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetail> {
    return this.suppliers.end(auth, id);
  }

  @Put(':id/spend/:year')
  @Requires('lieferanten.bearbeiten')
  putSpend(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('year', yearParam) year: number,
    @Body(new ZodValidationPipe(spendRequestSchema)) body: SpendRequest,
  ): Promise<SupplierDetail> {
    return this.suppliers.putSpend(auth, id, year, body);
  }

  /** SPL-04: Spend-Entwicklung mit Kennzahlen, Summen je Jahr, BU und Warengruppe und Zeilen. */
  @Get(':id/spend')
  @Requires('lieferanten.sehen')
  spendOverview(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SpendOverview> {
    return this.spend.overview(auth, id);
  }

  @Post(':id/spend/eintraege')
  @Requires('lieferanten.bearbeiten')
  createSpendEntry(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveSpendEntrySchema)) body: SaveSpendEntry,
  ): Promise<SpendOverview> {
    return this.spend.save(auth, id, null, body);
  }

  @Put(':id/spend/eintraege/:entryId')
  @Requires('lieferanten.bearbeiten')
  updateSpendEntry(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body(new ZodValidationPipe(saveSpendEntrySchema)) body: SaveSpendEntry,
  ): Promise<SpendOverview> {
    return this.spend.save(auth, id, entryId, body);
  }

  @Delete(':id/spend/eintraege/:entryId')
  @Requires('lieferanten.bearbeiten')
  removeSpendEntry(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<SpendOverview> {
    return this.spend.remove(auth, id, entryId);
  }

  /** Internes Team einer Beziehung (PLT-05b). */
  @Get(':id/team')
  @Requires('lieferanten.sehen')
  team(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamResponse> {
    return this.teams.team(auth, id);
  }

  /** Eigenes Team festlegen: Admin oder SRO (PLB-04). Grenzen prüft der Dienst (409). */
  @Put(':id/team')
  @Requires('team.festlegen')
  setTeam(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTeamRequest,
  ): Promise<TeamResponse> {
    return this.teams.setTeam(auth, id, body);
  }
}

/** PLB-04: Team beim Lieferanten, im Kontext des Kunden; gespiegelte Darstellung. */
@Controller('kunden/:id/team')
export class SupplierTeamController {
  constructor(@Inject(TeamService) private readonly teams: TeamService) {}

  @Get()
  @Requires('kunden.sehen')
  team(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamResponse> {
    return this.teams.team(auth, id, 'supplier');
  }

  /** Eigenes Team: Admin oder Key Account Manager. */
  @Put()
  @Requires('team.festlegen')
  setTeam(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTeamRequest,
  ): Promise<TeamResponse> {
    return this.teams.setTeam(auth, id, body, 'supplier');
  }
}

/** PLB-04: Einstellungen › Rollen, Rollenbeschreibungen der eigenen Organisation. */
@Controller('rollen')
export class RolesController {
  constructor(@Inject(TeamService) private readonly teams: TeamService) {}

  @Get()
  @Requires('einstellungen.verwalten')
  list(@CurrentUser() auth: AuthContext): Promise<RoleDescription[]> {
    return this.teams.roles(auth);
  }

  @Put(':role')
  @Requires('einstellungen.verwalten')
  save(
    @CurrentUser() auth: AuthContext,
    @Param('role') role: string,
    @Body(new ZodValidationPipe(saveRoleDescriptionSchema)) body: SaveRoleDescription,
  ): Promise<RoleDescription[]> {
    return this.teams.saveRole(auth, role, body);
  }
}
