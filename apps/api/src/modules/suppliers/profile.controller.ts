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
  type CompanyProfile,
  type FinancialImportResult,
  type SaveFinancial,
  type SupplierProfile,
  saveCompanyProfileSchema,
  saveExecutivesSchema,
  saveFinancialSchema,
  saveImplicationsSchema,
} from '@reziproq/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { parseImportFile } from './import-file.js';
import { ProfileService } from './profile.service.js';

/** SPL-05: Profil und Finanzen eines Lieferanten, nur für den Käufer. */
@Controller('suppliers/:id/profil')
export class SupplierProfileController {
  constructor(@Inject(ProfileService) private readonly profiles: ProfileService) {}

  @Get()
  @Requires('lieferanten.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierProfile> {
    return this.profiles.get(auth, id);
  }

  @Put('unternehmen')
  @Requires('lieferanten.bearbeiten')
  company(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveCompanyProfileSchema)) body: CompanyProfile,
  ): Promise<SupplierProfile> {
    return this.profiles.saveCompany(auth, id, body);
  }

  @Put('einschaetzung')
  @Requires('lieferanten.bearbeiten')
  implications(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveImplicationsSchema)) body: z.infer<
      typeof saveImplicationsSchema
    >,
  ): Promise<SupplierProfile> {
    return this.profiles.saveImplications(auth, id, body.implications);
  }

  @Put('geschaeftsleitung')
  @Requires('lieferanten.bearbeiten')
  executives(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveExecutivesSchema)) body: z.infer<typeof saveExecutivesSchema>,
  ): Promise<SupplierProfile> {
    return this.profiles.saveExecutives(auth, id, body.executives);
  }

  @Post('kennzahlen')
  @Requires('lieferanten.bearbeiten')
  createFinancial(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveFinancialSchema)) body: SaveFinancial,
  ): Promise<SupplierProfile> {
    return this.profiles.saveFinancial(auth, id, null, body);
  }

  @Post('kennzahlen/import')
  @Requires('lieferanten.bearbeiten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async importFinancials(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ): Promise<FinancialImportResult> {
    if (!file) throw new BadRequestException({ code: 'file_required' });
    return this.profiles.importFinancials(
      auth,
      id,
      await parseImportFile(file.originalname, file.buffer),
    );
  }

  @Put('kennzahlen/:financialId')
  @Requires('lieferanten.bearbeiten')
  updateFinancial(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('financialId', ParseUUIDPipe) financialId: string,
    @Body(new ZodValidationPipe(saveFinancialSchema)) body: SaveFinancial,
  ): Promise<SupplierProfile> {
    return this.profiles.saveFinancial(auth, id, financialId, body);
  }

  @Delete('kennzahlen/:financialId')
  @Requires('lieferanten.bearbeiten')
  removeFinancial(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('financialId', ParseUUIDPipe) financialId: string,
  ): Promise<SupplierProfile> {
    return this.profiles.saveFinancial(auth, id, financialId, null);
  }
}
