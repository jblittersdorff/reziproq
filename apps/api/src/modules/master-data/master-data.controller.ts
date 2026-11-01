import {
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
} from '@nestjs/common';
import {
  type AssignmentRequest,
  type AssignmentResponse,
  assignmentRequestSchema,
  type BusinessUnitRequest,
  businessUnitRequestSchema,
  type MaterialGroupRequest,
  materialGroupRequestSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MasterDataService } from './master-data.service.js';

const uuid = new ParseUUIDPipe();

/** Business Units (PLT-06): sehen alle Rollen, pflegen nur Admins. */
@Controller('business-units')
export class BusinessUnitsController {
  constructor(@Inject(MasterDataService) private readonly data: MasterDataService) {}

  @Get()
  @Requires('organisation.sehen')
  async list(@CurrentUser() auth: AuthContext) {
    return { businessUnits: await this.data.businessUnits(auth) };
  }

  @Get(':id')
  @Requires('organisation.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('id', uuid) id: string) {
    return this.data.businessUnit(auth, id);
  }

  @Post()
  @Requires('stammdaten.verwalten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(businessUnitRequestSchema)) body: BusinessUnitRequest,
  ) {
    return this.data.createBusinessUnit(auth, body);
  }

  @Patch(':id')
  @Requires('stammdaten.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(businessUnitRequestSchema)) body: BusinessUnitRequest,
  ) {
    return this.data.updateBusinessUnit(auth, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Requires('stammdaten.verwalten')
  async remove(@CurrentUser() auth: AuthContext, @Param('id', uuid) id: string) {
    await this.data.remove(auth, 'business_unit', id);
  }
}

/** Warengruppen in höchstens zwei Ebenen (PLT-06). */
@Controller('material-groups')
export class MaterialGroupsController {
  constructor(@Inject(MasterDataService) private readonly data: MasterDataService) {}

  @Get()
  @Requires('organisation.sehen')
  async list(@CurrentUser() auth: AuthContext) {
    return { materialGroups: await this.data.materialGroups(auth) };
  }

  @Get(':id')
  @Requires('organisation.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('id', uuid) id: string) {
    return this.data.materialGroup(auth, id);
  }

  @Post()
  @Requires('stammdaten.verwalten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(materialGroupRequestSchema)) body: MaterialGroupRequest,
  ) {
    return this.data.createMaterialGroup(auth, body);
  }

  @Patch(':id')
  @Requires('stammdaten.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(materialGroupRequestSchema)) body: MaterialGroupRequest,
  ) {
    return this.data.updateMaterialGroup(auth, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Requires('stammdaten.verwalten')
  async remove(@CurrentUser() auth: AuthContext, @Param('id', uuid) id: string) {
    await this.data.remove(auth, 'material_group', id);
  }
}

/** Zuordnung eines Lieferanten zu BUs und Warengruppen (PLT-06). */
@Controller('suppliers')
export class AssignmentController {
  constructor(@Inject(MasterDataService) private readonly data: MasterDataService) {}

  @Get(':id/zuordnung')
  @Requires('lieferanten.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', uuid) id: string,
  ): Promise<AssignmentResponse> {
    return this.data.assignment(auth, id);
  }

  @Put(':id/zuordnung')
  @Requires('zuordnung.bearbeiten')
  set(
    @CurrentUser() auth: AuthContext,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(assignmentRequestSchema)) body: AssignmentRequest,
  ): Promise<AssignmentResponse> {
    return this.data.setAssignment(auth, id, body);
  }
}
