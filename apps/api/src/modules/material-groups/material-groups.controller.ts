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
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type CategoryLabel,
  categoryLabelSchema,
  type MergeMaterialGroup,
  mergeMaterialGroupSchema,
  type ProductGroupRequest,
  productGroupRequestSchema,
  type SplitMaterialGroup,
  splitMaterialGroupSchema,
  type TeamRequest,
  teamRequestSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { parseImportFile } from '../suppliers/import-file.js';
import { MaterialGroupsService } from './material-groups.service.js';

type UploadedImport = { originalname: string; buffer: Buffer } | undefined;
const upload = FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } });

/** WG-01: Warengruppen mit Team, Produktgruppen, Import, Zusammenlegen, Teilen, Bezeichnung. */
@Controller('warengruppen')
export class MaterialGroupsController {
  constructor(@Inject(MaterialGroupsService) private readonly groups: MaterialGroupsService) {}

  @Get()
  @Requires('warengruppen.sehen')
  overview(@CurrentUser() auth: AuthContext) {
    return this.groups.overview(auth);
  }

  @Get('bezeichnung')
  @Requires('warengruppen.sehen')
  label(@CurrentUser() auth: AuthContext) {
    return this.groups.label(auth);
  }

  @Put('bezeichnung')
  @Requires('stammdaten.verwalten')
  saveLabel(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(categoryLabelSchema)) body: CategoryLabel,
  ) {
    return this.groups.saveLabel(auth, body);
  }

  @Post('import/vorschau')
  @HttpCode(200)
  @Requires('stammdaten.verwalten')
  @UseInterceptors(upload)
  async importPreview(@CurrentUser() auth: AuthContext, @UploadedFile() file: UploadedImport) {
    if (!file) throw new BadRequestException({ code: 'file_required' });
    return this.groups.importPreview(auth, await parseImportFile(file.originalname, file.buffer));
  }

  @Post('import')
  @Requires('stammdaten.verwalten')
  @UseInterceptors(upload)
  async importCommit(@CurrentUser() auth: AuthContext, @UploadedFile() file: UploadedImport) {
    if (!file) throw new BadRequestException({ code: 'file_required' });
    return this.groups.importCommit(auth, await parseImportFile(file.originalname, file.buffer));
  }

  @Get(':id')
  @Requires('warengruppen.sehen')
  detail(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.detail(auth, id);
  }

  @Put(':id/team')
  @Requires('warengruppen.team')
  saveTeam(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(teamRequestSchema)) body: TeamRequest,
  ) {
    return this.groups.saveTeam(auth, id, body);
  }

  @Post(':id/produktgruppen')
  @Requires('warengruppen.team')
  createProductGroup(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(productGroupRequestSchema)) body: ProductGroupRequest,
  ) {
    return this.groups.createProductGroup(auth, id, body);
  }

  @Patch(':id/produktgruppen/:productGroupId')
  @Requires('warengruppen.team')
  updateProductGroup(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productGroupId', ParseUUIDPipe) productGroupId: string,
    @Body(new ZodValidationPipe(productGroupRequestSchema)) body: ProductGroupRequest,
  ) {
    return this.groups.updateProductGroup(auth, id, productGroupId, body);
  }

  @Delete(':id/produktgruppen/:productGroupId')
  @Requires('warengruppen.team')
  removeProductGroup(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productGroupId', ParseUUIDPipe) productGroupId: string,
  ) {
    return this.groups.removeProductGroup(auth, id, productGroupId);
  }

  @Post(':id/zusammenlegen')
  @HttpCode(200)
  @Requires('stammdaten.verwalten')
  merge(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(mergeMaterialGroupSchema)) body: MergeMaterialGroup,
  ) {
    return this.groups.merge(auth, id, body);
  }

  @Post(':id/teilen')
  @HttpCode(200)
  @Requires('stammdaten.verwalten')
  split(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(splitMaterialGroupSchema)) body: SplitMaterialGroup,
  ) {
    return this.groups.split(auth, id, body);
  }
}
