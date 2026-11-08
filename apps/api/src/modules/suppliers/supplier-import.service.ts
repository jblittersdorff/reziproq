import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, auditedChange, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  amountCentsSchema,
  createSupplierRequestSchema,
  type ImportIssueCode,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportResult,
  type ImportSummary,
  type ImportType,
  parseImportAmount,
  spendYearSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import {
  relationshipAssignmentAudit,
  relationshipAudit,
  relationshipSideAudit,
  relationshipSpendAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { normalizeHeader, type ParsedImportFile, parseImportFile } from './import-file.js';
import { teamRoleOf } from './suppliers.service.js';

type SupplierRecord = {
  relationshipId: string;
  supplierOrgId: string;
  name: string;
  displayName: string | null;
  country: string | null;
  vatId: string | null;
  duns: string | null;
  externalRef: string | null;
  businessUnits: { id: string; name: string; active: boolean }[];
  materialGroups: { id: string; name: string; active: boolean; primary: boolean }[];
  spend: { year: number; amountCents: number; currency: string }[];
};

type CatalogEntry = { id: string; name: string; active: boolean };
type BusinessUnitRecord = CatalogEntry & { code: string };
type ContactRecord = {
  id: string;
  relationshipId: string;
  name: string;
  email: string;
  function: string | null;
  position: string | null;
};
type RowPlan = {
  row: number;
  values: Record<string, string>;
  headers: Record<string, string | undefined>;
  issues: ImportPreviewRow['issues'];
  changes: ImportPreviewRow['changes'];
  existing?: boolean;
  supplier?: {
    name: string;
    country: string;
    vatId?: string;
    duns?: string;
    externalRef?: string;
    businessUnits?: CatalogEntry[];
    materialGroups?: CatalogEntry[];
  };
  spend?: { externalRef: string; year: number; amountCents: number; currency: string };
  businessUnit?: { name: string; code: string; target?: BusinessUnitRecord };
  contact?: {
    name: string;
    email: string;
    function?: string | null;
    position?: string | null;
    target?: ContactRecord;
  };
  target?: SupplierRecord;
};
type ImportPlan = RowPlan & { preview: ImportPreviewRow };

const supplierColumns = {
  name: ['name'],
  country: ['land', 'country'],
  vatId: ['ustidnr', 'vatid', 'vatnumber', 'vatidentificationnumber'],
  duns: ['duns', 'dunsnummer', 'dunsnumber'],
  externalRef: [
    'eigenelieferantennummer',
    'eigenerlieferantennummer',
    'eigeneleferantennummer',
    'eigenenummer',
    'ownsuppliernumber',
    'suppliernumber',
    'ownnumber',
  ],
  businessUnits: ['businessunits', 'businessunit'],
  materialGroups: ['warengruppen', 'warengruppe', 'materialgroups', 'materialgroup'],
} as const;

const spendColumns = {
  externalRef: supplierColumns.externalRef,
  year: ['jahr', 'year'],
  amount: ['betrag', 'amount'],
  currency: ['waehrung', 'wahrung', 'currency'],
} as const;

const businessUnitColumns = {
  name: ['name'],
  code: ['code', 'businessunitcode'],
} as const;

const contactColumns = {
  externalRef: supplierColumns.externalRef,
  name: ['name'],
  email: ['email', 'emailaddress', 'e-mail'],
  function: ['funktion', 'function'],
  position: ['position', 'jobtitle', 'beruflicheposition'],
} as const;

@Injectable()
export class SupplierImportService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
  ) {}

  async preview(
    auth: AuthContext,
    type: ImportType,
    fileName: string,
    buffer: Buffer,
  ): Promise<ImportPreview> {
    const { organization, parsed } = await this.readUpload(auth, fileName, buffer);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const plans = await this.planRows(tx, auth, organization, type, parsed);
      return { type, rows: plans.map((plan) => plan.preview), summary: summaryOf(plans) };
    });
  }

  async import(
    auth: AuthContext,
    type: ImportType,
    fileName: string,
    buffer: Buffer,
  ): Promise<ImportResult> {
    const { organization, parsed } = await this.readUpload(auth, fileName, buffer);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const plans = await this.planRows(tx, auth, organization, type, parsed);
      const actor = await actorOf(tx, auth, organization.id);
      for (const plan of plans) {
        if (plan.preview.status === 'invalid' || plan.preview.status === 'unchanged') continue;
        if (plan.supplier) {
          await this.writeSupplier(tx, organization, actor, plan);
        } else if (plan.spend) {
          await this.writeSpend(tx, actor, plan);
        } else if (plan.businessUnit) {
          await this.writeBusinessUnit(tx, organization.id, plan);
        } else if (plan.contact) {
          await this.writeContact(tx, plan);
        }
      }
      return { type, summary: summaryOf(plans) };
    });
  }

  async listContacts(auth: AuthContext, relationshipId: string): Promise<ContactRecord[]> {
    const organization = this.organizations.current(auth);
    if (!organization?.buyer || !can(auth, 'lieferanten.sehen')) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_berechtigung',
        message: 'Dir fehlt die Rolle, um Lieferantenkontakte zu sehen.',
      });
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({ id: schema.relationship.id })
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.id, relationshipId),
            eq(schema.relationship.buyerOrgId, organization.id),
          ),
        );
      if (!relationship) throw new NotFoundException();
      return tx
        .select({
          id: schema.supplierContact.id,
          relationshipId: schema.supplierContact.relationshipId,
          name: schema.supplierContact.name,
          email: schema.supplierContact.email,
          function: schema.supplierContact.function,
          position: schema.supplierContact.position,
        })
        .from(schema.supplierContact)
        .where(eq(schema.supplierContact.relationshipId, relationshipId));
    });
  }

  async deleteContact(
    auth: AuthContext,
    relationshipId: string,
    contactId: string,
  ): Promise<{ deleted: true }> {
    const organization = this.organizations.current(auth);
    if (!organization?.buyer || !can(auth, 'lieferanten.bearbeiten')) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_berechtigung',
        message: 'Dir fehlt die Rolle, um Lieferantenkontakte zu löschen.',
      });
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({ id: schema.relationship.id })
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.id, relationshipId),
            eq(schema.relationship.buyerOrgId, organization.id),
          ),
        );
      if (!relationship) throw new NotFoundException();
      const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
      if (!can(auth, 'lieferanten.bearbeiten', { teamRole })) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'keine_berechtigung',
          message: 'Diese Beziehung ist für dich schreibgeschützt.',
        });
      }
      const [deleted] = await tx
        .delete(schema.supplierContact)
        .where(
          and(
            eq(schema.supplierContact.id, contactId),
            eq(schema.supplierContact.relationshipId, relationshipId),
          ),
        )
        .returning({ id: schema.supplierContact.id });
      if (!deleted) throw new NotFoundException();
      return { deleted: true };
    });
  }

  private async readUpload(auth: AuthContext, fileName: string, buffer: Buffer) {
    const organization = this.organizations.current(auth);
    if (!organization) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_organisation',
        message: 'Du bist noch keiner Organisation zugeordnet.',
      });
    }
    if (!organization.buyer || !can(auth, 'lieferanten.bearbeiten')) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_berechtigung',
        message: 'Dir fehlt die Rolle, um Daten zu importieren.',
      });
    }
    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'file_too_large',
        message: 'Eine Datei darf höchstens 10 MB groß sein.',
      });
    }
    const parsed = await parseImportFile(fileName, buffer);
    return { organization, parsed };
  }

  private async planRows(
    tx: TenantTransaction,
    auth: AuthContext,
    organization: AccountOrganization,
    type: ImportType,
    file: ParsedImportFile,
  ): Promise<ImportPlan[]> {
    if (type === 'business-units' && !can(auth, 'stammdaten.verwalten')) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_berechtigung',
        message: 'Business Units dürfen nur Admins importieren.',
      });
    }
    const records = await readSupplierRecords(tx, organization.id);
    const units = await tx
      .select({
        id: schema.businessUnit.id,
        name: schema.businessUnit.name,
        active: schema.businessUnit.active,
      })
      .from(schema.businessUnit)
      .where(eq(schema.businessUnit.orgId, organization.id));
    const groups = await tx
      .select({
        id: schema.materialGroup.id,
        name: schema.materialGroup.name,
        active: schema.materialGroup.active,
      })
      .from(schema.materialGroup)
      .where(eq(schema.materialGroup.orgId, organization.id));
    const headers =
      type === 'suppliers'
        ? requiredHeaders(
            file,
            { name: supplierColumns.name, country: supplierColumns.country },
            supplierColumns,
          )
        : type === 'spend'
          ? requiredHeaders(
              file,
              {
                externalRef: spendColumns.externalRef,
                year: spendColumns.year,
                amount: spendColumns.amount,
              },
              spendColumns,
            )
          : type === 'business-units'
            ? requiredHeaders(file, { name: businessUnitColumns.name }, businessUnitColumns)
            : requiredHeaders(
                file,
                {
                  externalRef: contactColumns.externalRef,
                  name: contactColumns.name,
                  email: contactColumns.email,
                },
                contactColumns,
              );
    const knownBusinessUnits =
      type === 'business-units'
        ? await tx
            .select({
              id: schema.businessUnit.id,
              name: schema.businessUnit.name,
              code: schema.businessUnit.code,
              active: schema.businessUnit.active,
            })
            .from(schema.businessUnit)
            .where(eq(schema.businessUnit.orgId, organization.id))
        : [];
    const knownContacts =
      type === 'contacts'
        ? await tx
            .select({
              id: schema.supplierContact.id,
              relationshipId: schema.supplierContact.relationshipId,
              name: schema.supplierContact.name,
              email: schema.supplierContact.email,
              function: schema.supplierContact.function,
              position: schema.supplierContact.position,
            })
            .from(schema.supplierContact)
        : [];
    const plans: ImportPlan[] = [];
    const keys = new Set<string>();

    for (const row of file.rows) {
      const issues: ImportPreviewRow['issues'] = [];
      const changes: ImportPreviewRow['changes'] = [];
      if (type === 'suppliers') {
        const plan = this.planSupplierRow(
          row.row,
          row.values,
          headers,
          records,
          units,
          groups,
          keys,
          issues,
          changes,
        );
        if (plan.target) {
          const teamRole = await teamRoleOf(tx, auth.userId, plan.target.relationshipId);
          if (!can(auth, 'lieferanten.bearbeiten', { teamRole })) {
            issues.push(
              issue(headers.externalRef ?? headers.name ?? 'Name', 'read_only_relationship'),
            );
          }
          if (
            (plan.supplier?.businessUnits || plan.supplier?.materialGroups) &&
            !can(auth, 'zuordnung.bearbeiten', { teamRole })
          ) {
            issues.push(
              issue(
                headers.businessUnits ?? headers.materialGroups ?? 'Zuordnung',
                'read_only_relationship',
              ),
            );
          }
        }
        plans.push(finalizePlan(plan, issues, changes));
      } else if (type === 'spend') {
        const plan = this.planSpendRow(
          row.row,
          row.values,
          headers,
          records,
          keys,
          issues,
          changes,
        );
        if (plan.target) {
          const teamRole = await teamRoleOf(tx, auth.userId, plan.target.relationshipId);
          if (!can(auth, 'lieferanten.bearbeiten', { teamRole })) {
            issues.push(
              issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'read_only_relationship'),
            );
          }
        }
        plans.push(finalizePlan(plan, issues, changes));
      } else if (type === 'business-units') {
        plans.push(
          this.planBusinessUnitRow(
            row.row,
            row.values,
            headers,
            knownBusinessUnits,
            keys,
            issues,
            changes,
          ),
        );
      } else {
        const plan = this.planContactRow(
          row.row,
          row.values,
          headers,
          records,
          knownContacts,
          keys,
          issues,
          changes,
        );
        if (plan.target) {
          const teamRole = await teamRoleOf(tx, auth.userId, plan.target.relationshipId);
          if (!can(auth, 'lieferanten.bearbeiten', { teamRole })) {
            issues.push(
              issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'read_only_relationship'),
            );
          }
        }
        plans.push(finalizePlan(plan, issues, changes));
      }
    }
    return plans;
  }

  private planBusinessUnitRow(
    row: number,
    values: Record<string, string>,
    headers: Record<string, string | undefined>,
    catalog: BusinessUnitRecord[],
    keys: Set<string>,
    issues: ImportPreviewRow['issues'],
    changes: ImportPreviewRow['changes'],
  ): ImportPlan {
    const name = readValue(values, headers.name);
    const explicitCode = readValue(values, headers.code);
    const nameKey = name.toLocaleLowerCase('de');
    let target: BusinessUnitRecord | undefined;
    if (!name) issues.push(issue(headers.name ?? 'Name', 'required'));
    if (name.length > 200) issues.push(issue(headers.name ?? 'Name', 'too_long', name));
    if (explicitCode.length > 50) {
      issues.push(issue(headers.code ?? 'Code', 'too_long', explicitCode));
    }

    if (name) {
      const key = explicitCode ? `code:${explicitCode.toLocaleLowerCase('de')}` : `name:${nameKey}`;
      if (keys.has(key))
        issues.push(issue(headers.code ?? headers.name ?? 'Name', 'duplicate_key'));
      keys.add(key);
      const byCode = explicitCode
        ? catalog.filter(
            (unit) => unit.code.toLocaleLowerCase('de') === explicitCode.toLocaleLowerCase('de'),
          )
        : [];
      const byName = !explicitCode
        ? catalog.filter((unit) => unit.name.toLocaleLowerCase('de') === nameKey)
        : [];
      if (byCode.length > 1 || byName.length > 1) {
        issues.push(issue(headers.code ?? headers.name ?? 'Name', 'duplicate_key'));
      }
      target = byCode[0] ?? byName[0];
    }

    const code = explicitCode || target?.code || generatedBusinessUnitCode(name);
    const collision = catalog.find(
      (unit) =>
        unit.code.toLocaleLowerCase('de') === code.toLocaleLowerCase('de') &&
        unit.id !== target?.id,
    );
    if (collision)
      issues.push(issue(headers.code ?? headers.name ?? 'Code', 'duplicate_key', code));
    if (target) {
      addChange(changes, 'Name', target.name, name);
      if (headers.code) addChange(changes, headers.code, target.code, code);
    }
    return finalizePlan(
      {
        row,
        values,
        headers,
        issues,
        changes,
        ...(target ? { existing: true } : {}),
        businessUnit: { name, code, ...(target ? { target } : {}) },
      },
      issues,
      changes,
    );
  }

  private planContactRow(
    row: number,
    values: Record<string, string>,
    headers: Record<string, string | undefined>,
    suppliers: SupplierRecord[],
    contacts: ContactRecord[],
    keys: Set<string>,
    issues: ImportPreviewRow['issues'],
    changes: ImportPreviewRow['changes'],
  ): ImportPlan {
    const externalRef = readValue(values, headers.externalRef);
    const name = readValue(values, headers.name);
    const email = readValue(values, headers.email).toLocaleLowerCase('en');
    const functionValue = headers.function
      ? readValue(values, headers.function) || null
      : undefined;
    const position = headers.position ? readValue(values, headers.position) || null : undefined;
    if (!externalRef)
      issues.push(issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'required'));
    if (!name) issues.push(issue(headers.name ?? 'Name', 'required'));
    if (!email) issues.push(issue(headers.email ?? 'E-Mail', 'required'));
    else if (!z.email().safeParse(email).success) {
      issues.push(issue(headers.email ?? 'E-Mail', 'invalid_email', email));
    }
    if (name.length > 200) issues.push(issue(headers.name ?? 'Name', 'too_long', name));
    if (functionValue && functionValue.length > 100) {
      issues.push(issue(headers.function ?? 'Funktion', 'too_long', functionValue));
    }
    if (position && position.length > 100) {
      issues.push(issue(headers.position ?? 'Position', 'too_long', position));
    }

    const matches = externalRef
      ? suppliers.filter((supplier) => supplier.externalRef === externalRef)
      : [];
    if (externalRef && matches.length === 0) {
      issues.push(issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'unknown_supplier'));
    } else if (matches.length > 1) {
      issues.push(issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'duplicate_key'));
    }
    const supplier = matches[0];
    const contactKey = supplier && email ? `${supplier.relationshipId}:${email}` : '';
    if (contactKey && keys.has(contactKey)) {
      issues.push(issue(headers.email ?? 'E-Mail', 'duplicate_key', email));
    }
    if (contactKey) keys.add(contactKey);

    const existing = supplier
      ? contacts.find(
          (contact) =>
            contact.relationshipId === supplier.relationshipId &&
            contact.email.toLocaleLowerCase('en') === email,
        )
      : undefined;
    if (existing) {
      addChange(changes, 'Name', existing.name, name);
      addChange(changes, headers.email ?? 'E-Mail', existing.email, email);
      if (headers.function) {
        addChange(changes, headers.function, existing.function ?? '', functionValue ?? '');
      }
      if (headers.position) {
        addChange(changes, headers.position, existing.position ?? '', position ?? '');
      }
    }
    return finalizePlan(
      {
        row,
        values,
        headers,
        issues,
        changes,
        ...(supplier ? { target: supplier } : {}),
        existing: Boolean(existing),
        contact: {
          name,
          email,
          ...(headers.function ? { function: functionValue ?? null } : {}),
          ...(headers.position ? { position: position ?? null } : {}),
          ...(existing ? { target: existing } : {}),
        },
      },
      issues,
      changes,
    );
  }

  private planSupplierRow(
    row: number,
    values: Record<string, string>,
    headers: Record<string, string | undefined>,
    records: SupplierRecord[],
    units: CatalogEntry[],
    groups: CatalogEntry[],
    keys: Set<string>,
    issues: ImportPreviewRow['issues'],
    changes: ImportPreviewRow['changes'],
  ): ImportPlan {
    const name = readValue(values, headers.name);
    const country = readValue(values, headers.country).toUpperCase();
    const vatRaw = readValue(values, headers.vatId);
    const dunsRaw = readValue(values, headers.duns);
    const externalRef = readValue(values, headers.externalRef);
    const base: RowPlan = { row, values, issues, changes, headers };
    const candidate = createSupplierRequestSchema.safeParse({
      name,
      country,
      vatId: vatRaw,
      duns: dunsRaw,
      externalRef,
    });
    if (!candidate.success) {
      for (const error of candidate.error.issues) {
        const path = String(error.path[0] ?? 'name');
        const field =
          path === 'vatId'
            ? headers.vatId
            : path === 'duns'
              ? headers.duns
              : path === 'country'
                ? headers.country
                : headers.name;
        issues.push(
          issue(
            field ?? String(error.path[0] ?? 'Name'),
            importCode(error.message),
            readValue(values, field),
          ),
        );
      }
      return finalizePlan(base, issues, changes);
    }
    const supplier = candidate.data;
    const identityKeys = [
      supplier.externalRef && `external:${supplier.externalRef}`,
      supplier.vatId && `vat:${supplier.vatId}`,
      supplier.duns && `duns:${supplier.duns}`,
    ].filter((key): key is string => Boolean(key));
    if (identityKeys.some((key) => keys.has(key))) {
      issues.push(
        issue(headers.externalRef ?? headers.vatId ?? headers.duns ?? 'Name', 'duplicate_key'),
      );
    }
    for (const key of identityKeys) keys.add(key);

    const matchesByRef = supplier.externalRef
      ? records.filter((record) => record.externalRef === supplier.externalRef)
      : [];
    const matchesByVat = supplier.vatId
      ? records.filter((record) => normalizeIdentifier(record.vatId) === supplier.vatId)
      : [];
    const matchesByDuns = supplier.duns
      ? records.filter((record) => normalizeIdentifier(record.duns) === supplier.duns)
      : [];
    const identityMatches = [...new Set([...matchesByVat, ...matchesByDuns])];
    if (matchesByVat.length > 1 || matchesByDuns.length > 1) {
      issues.push(issue(headers.vatId ?? headers.duns ?? 'USt-IdNr.', 'duplicate_key'));
    }
    const identifierConflict =
      matchesByVat.length > 0 &&
      matchesByDuns.length > 0 &&
      matchesByVat[0]?.relationshipId !== matchesByDuns[0]?.relationshipId;
    if (identifierConflict) {
      issues.push(issue(headers.vatId ?? headers.duns ?? 'USt-IdNr.', 'identity_conflict'));
    }
    const target = matchesByRef[0] ?? identityMatches[0];
    if (target && identityMatches.some((match) => match.relationshipId !== target.relationshipId)) {
      issues.push(issue(headers.vatId ?? headers.duns ?? 'USt-IdNr.', 'identity_conflict'));
    }
    if (matchesByRef.length > 1) {
      issues.push(issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'duplicate_key'));
    }
    if (
      target &&
      (target.country !== supplier.country ||
        (supplier.vatId && normalizeIdentifier(target.vatId) !== supplier.vatId) ||
        (supplier.duns && normalizeIdentifier(target.duns) !== supplier.duns))
    ) {
      issues.push(issue(headers.country ?? 'Land', 'identity_conflict'));
    }
    const businessUnits = parseAssignments(
      values,
      headers.businessUnits,
      units,
      target?.businessUnits ?? [],
      'unknown_business_unit',
      issues,
    );
    const materialGroups = parseAssignments(
      values,
      headers.materialGroups,
      groups,
      target?.materialGroups ?? [],
      'unknown_material_group',
      issues,
    );
    if (target) {
      addChange(changes, 'Name', target.displayName ?? target.name, supplier.name);
      if (headers.externalRef) {
        addChange(
          changes,
          headers.externalRef,
          target.externalRef ?? '',
          supplier.externalRef ?? '',
        );
      }
      if (businessUnits) {
        addChange(
          changes,
          'Business Units',
          target.businessUnits
            .map((unit) => unit.name)
            .sort()
            .join('; '),
          businessUnits
            .map((unit) => unit.name)
            .sort()
            .join('; '),
        );
      }
      if (materialGroups) {
        const old = [...target.materialGroups]
          .sort((a, b) => Number(b.primary) - Number(a.primary))
          .map((group) => group.name)
          .join('; ');
        addChange(
          changes,
          'Warengruppen',
          old,
          materialGroups.map((group) => group.name).join('; '),
        );
      }
    }
    return finalizePlan(
      {
        ...base,
        ...(target ? { target } : {}),
        supplier: {
          name: supplier.name,
          country: supplier.country,
          ...(supplier.vatId ? { vatId: supplier.vatId } : {}),
          ...(supplier.duns ? { duns: supplier.duns } : {}),
          ...(headers.externalRef ? { externalRef: supplier.externalRef ?? '' } : {}),
          ...(headers.businessUnits ? { businessUnits: businessUnits ?? [] } : {}),
          ...(headers.materialGroups ? { materialGroups: materialGroups ?? [] } : {}),
        },
      },
      issues,
      changes,
    );
  }

  private planSpendRow(
    row: number,
    values: Record<string, string>,
    headers: Record<string, string | undefined>,
    records: SupplierRecord[],
    keys: Set<string>,
    issues: ImportPreviewRow['issues'],
    changes: ImportPreviewRow['changes'],
  ): ImportPlan {
    const externalRef = readValue(values, headers.externalRef);
    const yearText = readValue(values, headers.year);
    const amountText = readValue(values, headers.amount);
    const currencyText = readValue(values, headers.currency).toUpperCase() || 'EUR';
    const year = /^\d{4}$/.test(yearText) ? Number(yearText) : Number.NaN;
    const amountCents = parseImportAmount(amountText);
    if (!externalRef)
      issues.push(issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'required'));
    if (!spendYearSchema.safeParse(year).success) {
      issues.push(issue(headers.year ?? 'Jahr', 'invalid_year', yearText));
    }
    if (amountCents === null || !amountCentsSchema.safeParse(amountCents).success) {
      issues.push(issue(headers.amount ?? 'Betrag', 'invalid_amount', amountText));
    }
    if (!/^[A-Z]{3}$/.test(currencyText)) {
      issues.push(issue(headers.currency ?? 'Währung', 'invalid_currency', currencyText));
    }
    const key = externalRef ? `spend:${externalRef}:${yearText}` : undefined;
    if (key && keys.has(key))
      issues.push(issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'duplicate_key'));
    if (key) keys.add(key);
    const matches = externalRef
      ? records.filter((record) => record.externalRef === externalRef)
      : [];
    if (matches.length === 0) {
      issues.push(
        issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'unknown_supplier', externalRef),
      );
    } else if (matches.length > 1) {
      issues.push(
        issue(headers.externalRef ?? 'Eigene Lieferantennummer', 'duplicate_key', externalRef),
      );
    }
    const target = matches[0];
    const before = target?.spend.find((entry) => entry.year === year);
    if (before && amountCents !== null) {
      addChange(changes, 'Betrag', String(before.amountCents), String(amountCents));
      addChange(changes, 'Währung', before.currency, currencyText);
    }
    return finalizePlan(
      {
        row,
        values,
        issues,
        changes,
        headers,
        existing: Boolean(before),
        ...(target ? { target } : {}),
        spend: { externalRef, year, amountCents: amountCents ?? 0, currency: currencyText },
      },
      issues,
      changes,
    );
  }

  private async writeSupplier(
    tx: TenantTransaction,
    organization: AccountOrganization,
    actor: Awaited<ReturnType<typeof actorOf>>,
    plan: ImportPlan,
  ) {
    const input = plan.supplier;
    if (!input) return;
    let target = plan.target;
    if (!target) {
      const found = await tx.execute<{ id: string; existed: boolean }>(sql`
        select id::text, existed from app_lieferant_finden_oder_anlegen(
          ${input.name}, ${input.country}, ${input.vatId ?? null}, ${input.duns ?? null}
        )
      `);
      const supplier = found.rows[0];
      if (!supplier) throw new Error('Lieferant nicht angelegt');
      const [existing] = await tx
        .select({ id: schema.relationship.id })
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.buyerOrgId, organization.id),
            eq(schema.relationship.supplierOrgId, supplier.id),
          ),
        );
      if (existing) {
        target = (await readSupplierRecords(tx, organization.id)).find(
          (record) => record.relationshipId === existing.id,
        );
      } else {
        const relationshipId = await auditedChange(tx, actor, relationshipAudit, async () => {
          const [created] = await tx
            .insert(schema.relationship)
            .values({
              buyerOrgId: organization.id,
              supplierOrgId: supplier.id,
              status: 'draft',
            })
            .returning({ id: schema.relationship.id });
          if (!created) throw new Error('Beziehung nicht angelegt');
          return {
            objectId: created.id,
            relationshipId: created.id,
            action: 'created',
            after: { status: 'draft' },
            result: created.id,
          };
        });
        await auditedChange(tx, actor, relationshipSideAudit, async () => {
          await tx.insert(schema.relationshipSide).values({
            relationshipId,
            orgId: organization.id,
            displayName: input.name,
            externalRef: input.externalRef || null,
          });
          return {
            objectId: relationshipId,
            relationshipId,
            action: 'created',
            after: { display_name: input.name, external_ref: input.externalRef || null },
            result: undefined,
          };
        });
        target = {
          relationshipId,
          supplierOrgId: supplier.id,
          name: input.name,
          displayName: input.name,
          country: input.country,
          vatId: input.vatId ?? null,
          duns: input.duns ?? null,
          externalRef: input.externalRef || null,
          businessUnits: [],
          materialGroups: [],
          spend: [],
        };
      }
    }
    if (!target) throw new Error('Lieferant nach dem Anlegen nicht lesbar');

    const [side] = await tx
      .select({
        displayName: schema.relationshipSide.displayName,
        externalRef: schema.relationshipSide.externalRef,
        notes: schema.relationshipSide.notes,
      })
      .from(schema.relationshipSide)
      .where(
        and(
          eq(schema.relationshipSide.relationshipId, target.relationshipId),
          eq(schema.relationshipSide.orgId, organization.id),
        ),
      );
    const before = {
      display_name: side?.displayName ?? null,
      external_ref: side?.externalRef ?? null,
      notes: side?.notes ?? null,
    };
    const externalRef = Object.hasOwn(input, 'externalRef')
      ? input.externalRef || null
      : (side?.externalRef ?? null);
    const after = {
      display_name: input.name,
      external_ref: externalRef,
      notes: before.notes,
    };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await auditedChange(tx, actor, relationshipSideAudit, async () => {
        await tx
          .insert(schema.relationshipSide)
          .values({
            relationshipId: target.relationshipId,
            orgId: organization.id,
            displayName: after.display_name,
            externalRef: after.external_ref,
            notes: after.notes,
          })
          .onConflictDoUpdate({
            target: [schema.relationshipSide.relationshipId, schema.relationshipSide.orgId],
            set: {
              displayName: after.display_name,
              externalRef: after.external_ref,
              notes: after.notes,
            },
          });
        return {
          objectId: target.relationshipId,
          relationshipId: target.relationshipId,
          action: side ? 'updated' : 'created',
          before: side ? before : null,
          after,
          result: undefined,
        };
      });
    }
    if (input.businessUnits || input.materialGroups) {
      await this.writeAssignments(tx, actor, target.relationshipId, target, input);
    }
  }

  private async writeAssignments(
    tx: TenantTransaction,
    actor: Awaited<ReturnType<typeof actorOf>>,
    relationshipId: string,
    target: SupplierRecord,
    input: NonNullable<ImportPlan['supplier']>,
  ) {
    const currentUnits = await tx
      .select({
        id: schema.businessUnit.id,
        name: schema.businessUnit.name,
        active: schema.businessUnit.active,
      })
      .from(schema.relationshipBusinessUnit)
      .innerJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
      )
      .where(eq(schema.relationshipBusinessUnit.relationshipId, relationshipId));
    const currentGroups = await tx
      .select({
        id: schema.materialGroup.id,
        name: schema.materialGroup.name,
        active: schema.materialGroup.active,
        primary: schema.relationshipMaterialGroup.isPrimary,
      })
      .from(schema.relationshipMaterialGroup)
      .innerJoin(
        schema.materialGroup,
        eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
      )
      .where(eq(schema.relationshipMaterialGroup.relationshipId, relationshipId));
    const unitIds =
      input.businessUnits?.map((unit) => unit.id) ?? currentUnits.map((unit) => unit.id);
    const groupIds =
      input.materialGroups?.map((group) => group.id) ?? currentGroups.map((group) => group.id);
    const primaryId = input.materialGroups
      ? (input.materialGroups[0]?.id ?? null)
      : (currentGroups.find((group) => group.primary)?.id ?? null);
    const sameUnits = equalIds(
      currentUnits.map((unit) => unit.id),
      unitIds,
    );
    const sameGroups =
      equalIds(
        currentGroups.map((group) => group.id),
        groupIds,
      ) && (currentGroups.find((group) => group.primary)?.id ?? null) === primaryId;
    if (sameUnits && sameGroups) return;

    await auditedChange(tx, actor, relationshipAssignmentAudit, async () => {
      const currentUnitIds = new Set(currentUnits.map((unit) => unit.id));
      const desiredUnitIds = new Set(unitIds);
      for (const id of currentUnitIds) {
        if (!desiredUnitIds.has(id)) {
          await tx
            .delete(schema.relationshipBusinessUnit)
            .where(
              and(
                eq(schema.relationshipBusinessUnit.relationshipId, relationshipId),
                eq(schema.relationshipBusinessUnit.businessUnitId, id),
              ),
            );
        }
      }
      for (const id of desiredUnitIds) {
        if (!currentUnitIds.has(id)) {
          await tx.insert(schema.relationshipBusinessUnit).values({
            relationshipId,
            businessUnitId: id,
          });
        }
      }

      const currentGroupIds = new Set(currentGroups.map((group) => group.id));
      const desiredGroupIds = new Set(groupIds);
      for (const id of currentGroupIds) {
        if (!desiredGroupIds.has(id)) {
          await tx
            .delete(schema.relationshipMaterialGroup)
            .where(
              and(
                eq(schema.relationshipMaterialGroup.relationshipId, relationshipId),
                eq(schema.relationshipMaterialGroup.materialGroupId, id),
              ),
            );
        }
      }
      await tx
        .update(schema.relationshipMaterialGroup)
        .set({ isPrimary: false })
        .where(eq(schema.relationshipMaterialGroup.relationshipId, relationshipId));
      for (const id of desiredGroupIds) {
        if (currentGroupIds.has(id)) {
          if (id === primaryId) {
            await tx
              .update(schema.relationshipMaterialGroup)
              .set({ isPrimary: true })
              .where(
                and(
                  eq(schema.relationshipMaterialGroup.relationshipId, relationshipId),
                  eq(schema.relationshipMaterialGroup.materialGroupId, id),
                ),
              );
          }
        } else {
          await tx.insert(schema.relationshipMaterialGroup).values({
            relationshipId,
            materialGroupId: id,
            isPrimary: id === primaryId,
          });
        }
      }

      const afterUnits = await readAssignmentNames(tx, relationshipId, 'units');
      const afterGroups = await readAssignmentNames(tx, relationshipId, 'groups');
      return {
        objectId: relationshipId,
        relationshipId,
        action: 'updated',
        before: {
          business_units: target.businessUnits.map((unit) => ({ name: unit.name })),
          material_groups: target.materialGroups.map((group) => ({ name: group.name })),
          primary_material_group:
            target.materialGroups.find((group) => group.primary)?.name ?? null,
        },
        after: {
          business_units: afterUnits.units.map((unit) => ({ name: unit.name })),
          material_groups: afterGroups.groups.map((group) => ({ name: group.name })),
          primary_material_group: afterGroups.groups.find((group) => group.primary)?.name ?? null,
        },
        result: undefined,
      };
    });
  }

  private async writeSpend(
    tx: TenantTransaction,
    actor: Awaited<ReturnType<typeof actorOf>>,
    plan: ImportPlan,
  ) {
    const spend = plan.spend;
    const target = plan.target;
    if (!spend || !target) return;
    const [before] = await tx
      .select({
        amountCents: schema.relationshipSpend.amountCents,
        currency: schema.relationshipSpend.currency,
      })
      .from(schema.relationshipSpend)
      .where(
        and(
          eq(schema.relationshipSpend.relationshipId, target.relationshipId),
          eq(schema.relationshipSpend.year, spend.year),
        ),
      );
    if (before?.amountCents === spend.amountCents && before.currency === spend.currency) return;
    await auditedChange(tx, actor, relationshipSpendAudit, async () => {
      await tx
        .insert(schema.relationshipSpend)
        .values({
          relationshipId: target.relationshipId,
          year: spend.year,
          amountCents: spend.amountCents,
          currency: spend.currency,
          source: 'import',
        })
        .onConflictDoUpdate({
          target: [schema.relationshipSpend.relationshipId, schema.relationshipSpend.year],
          set: {
            amountCents: spend.amountCents,
            currency: spend.currency,
            source: 'import',
          },
        });
      return {
        objectId: target.relationshipId,
        relationshipId: target.relationshipId,
        action: before ? 'updated' : 'created',
        before: before
          ? {
              year: spend.year,
              amount_cents: before.amountCents,
            }
          : null,
        after: { year: spend.year, amount_cents: spend.amountCents },
        result: undefined,
      };
    });
  }

  private async writeBusinessUnit(tx: TenantTransaction, organizationId: string, plan: ImportPlan) {
    const input = plan.businessUnit;
    if (!input) return;
    if (input.target) {
      await tx
        .update(schema.businessUnit)
        .set({ name: input.name, code: input.code })
        .where(
          and(
            eq(schema.businessUnit.id, input.target.id),
            eq(schema.businessUnit.orgId, organizationId),
          ),
        );
      return;
    }
    await tx.insert(schema.businessUnit).values({
      orgId: organizationId,
      name: input.name,
      code: input.code,
    });
  }

  private async writeContact(tx: TenantTransaction, plan: ImportPlan) {
    const input = plan.contact;
    const relationshipId = plan.target?.relationshipId;
    if (!input || !relationshipId) return;
    if (input.target) {
      const update: {
        name: string;
        function?: string | null;
        position?: string | null;
      } = { name: input.name };
      if (Object.hasOwn(input, 'function')) update.function = input.function ?? null;
      if (Object.hasOwn(input, 'position')) update.position = input.position ?? null;
      await tx
        .update(schema.supplierContact)
        .set(update)
        .where(
          and(
            eq(schema.supplierContact.id, input.target.id),
            eq(schema.supplierContact.relationshipId, relationshipId),
          ),
        );
      return;
    }
    await tx.insert(schema.supplierContact).values({
      relationshipId,
      name: input.name,
      email: input.email,
      function: input.function ?? null,
      position: input.position ?? null,
    });
  }
}

function requiredHeaders(
  file: ParsedImportFile,
  required: Record<string, readonly string[]>,
  optional: Record<string, readonly string[]>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  const find = (aliases: readonly string[]) =>
    file.headers.find((header) => aliases.includes(normalizeHeader(header)));
  const missing: string[] = [];
  for (const [field, aliases] of Object.entries(required)) {
    result[field] = find(aliases);
    if (!result[field]) missing.push(field);
  }
  if (missing.length > 0) {
    throw new BadRequestException({
      code: 'missing_column',
      fields: missing,
      message: `Pflichtspalten fehlen: ${missing.join(', ')}.`,
    });
  }
  for (const [field, aliases] of Object.entries(optional)) {
    result[field] ??= find(aliases);
  }
  return result;
}

async function readSupplierRecords(
  tx: TenantTransaction,
  organizationId: string,
): Promise<SupplierRecord[]> {
  const suppliers = await tx
    .select({
      relationshipId: schema.relationship.id,
      supplierOrgId: schema.relationship.supplierOrgId,
      name: schema.organization.name,
      country: schema.organization.country,
      vatId: schema.organization.vatId,
      duns: schema.organization.duns,
      displayName: schema.relationshipSide.displayName,
      externalRef: schema.relationshipSide.externalRef,
    })
    .from(schema.relationship)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
    .leftJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, organizationId),
      ),
    )
    .where(eq(schema.relationship.buyerOrgId, organizationId));
  const records = suppliers.map(
    (supplier): SupplierRecord => ({
      ...supplier,
      businessUnits: [],
      materialGroups: [],
      spend: [],
    }),
  );
  const ids = records.map((record) => record.relationshipId);
  if (ids.length === 0) return records;

  const spends = await tx
    .select({
      relationshipId: schema.relationshipSpend.relationshipId,
      year: schema.relationshipSpend.year,
      amountCents: schema.relationshipSpend.amountCents,
      currency: schema.relationshipSpend.currency,
    })
    .from(schema.relationshipSpend)
    .where(sql`${schema.relationshipSpend.relationshipId} in ${ids}`);
  const units = await tx
    .select({
      relationshipId: schema.relationshipBusinessUnit.relationshipId,
      id: schema.businessUnit.id,
      name: schema.businessUnit.name,
      active: schema.businessUnit.active,
    })
    .from(schema.relationshipBusinessUnit)
    .innerJoin(
      schema.businessUnit,
      eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
    )
    .where(sql`${schema.relationshipBusinessUnit.relationshipId} in ${ids}`);
  const groups = await tx
    .select({
      relationshipId: schema.relationshipMaterialGroup.relationshipId,
      id: schema.materialGroup.id,
      name: schema.materialGroup.name,
      active: schema.materialGroup.active,
      primary: schema.relationshipMaterialGroup.isPrimary,
    })
    .from(schema.relationshipMaterialGroup)
    .innerJoin(
      schema.materialGroup,
      eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
    )
    .where(sql`${schema.relationshipMaterialGroup.relationshipId} in ${ids}`);
  for (const record of records) {
    record.spend = spends.filter((spend) => spend.relationshipId === record.relationshipId);
    record.businessUnits = units
      .filter((unit) => unit.relationshipId === record.relationshipId)
      .map(({ id, name, active }) => ({ id, name, active }));
    record.materialGroups = groups
      .filter((group) => group.relationshipId === record.relationshipId)
      .map(({ id, name, active, primary }) => ({ id, name, active, primary }));
  }
  return records;
}

function parseAssignments(
  values: Record<string, string>,
  header: string | undefined,
  catalog: CatalogEntry[],
  existing: { id: string; name: string; active: boolean }[],
  code: 'unknown_business_unit' | 'unknown_material_group',
  issues: ImportPreviewRow['issues'],
) {
  if (!header) return undefined;
  const names = (values[header] ?? '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);
  const selected: CatalogEntry[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLocaleLowerCase('de');
    if (seen.has(key)) {
      issues.push(issue(header, 'duplicate_key', name));
      continue;
    }
    seen.add(key);
    const matches = catalog.filter((item) => item.name.toLocaleLowerCase('de') === key);
    const retained = existing.find((item) => item.name.toLocaleLowerCase('de') === key);
    if (matches.length > 1) {
      issues.push(issue(header, 'duplicate_key', name));
      continue;
    }
    const match = matches[0] ?? retained;
    if (!match || (!match.active && !retained)) {
      issues.push(issue(header, code, name));
    } else {
      selected.push(match);
    }
  }
  return selected;
}

function finalizePlan(
  plan: RowPlan,
  issues: ImportPreviewRow['issues'],
  changes: ImportPreviewRow['changes'],
): ImportPlan {
  const alreadyExists = plan.existing ?? Boolean(plan.target);
  const status =
    issues.length > 0
      ? 'invalid'
      : alreadyExists
        ? changes.length === 0
          ? 'unchanged'
          : 'changed'
        : 'new';
  return {
    ...plan,
    preview: { row: plan.row, values: plan.values, issues, changes, status },
  };
}

function summaryOf(plans: ImportPlan[]): ImportSummary {
  return plans.reduce<ImportSummary>(
    (summary, plan) => {
      summary[plan.preview.status === 'invalid' ? 'invalid' : plan.preview.status] += 1;
      return summary;
    },
    { new: 0, changed: 0, unchanged: 0, invalid: 0 },
  );
}

function readValue(values: Record<string, string>, header: string | undefined) {
  return header ? (values[header] ?? '').trim() : '';
}

function normalizeIdentifier(value: string | null | undefined) {
  return value?.replace(/[\s.-]/g, '').toLocaleUpperCase('en') ?? '';
}

function generatedBusinessUnitCode(name: string) {
  return normalizeHeader(name).toLocaleUpperCase('en');
}

function issue(field: string, code: ImportIssueCode, value?: string) {
  return { field, code, ...(value ? { value } : {}) };
}

function importCode(message: string): ImportIssueCode {
  if (message === 'required') return 'required';
  if (message === 'too_long') return 'too_long';
  if (message === 'invalid_country') return 'invalid_country';
  if (message === 'invalid_vat_id') return 'invalid_vat_id';
  if (message === 'invalid_duns') return 'invalid_duns';
  return 'invalid_amount';
}

function addChange(
  changes: ImportPreviewRow['changes'],
  field: string,
  before: string,
  after: string,
) {
  if (before !== after) changes.push({ field, before, after });
}

function equalIds(current: string[], desired: string[]) {
  return current.length === desired.length && current.every((id) => desired.includes(id));
}

async function readAssignmentNames(
  tx: TenantTransaction,
  relationshipId: string,
  kind: 'units' | 'groups',
) {
  if (kind === 'units') {
    const units = await tx
      .select({ name: schema.businessUnit.name })
      .from(schema.relationshipBusinessUnit)
      .innerJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
      )
      .where(eq(schema.relationshipBusinessUnit.relationshipId, relationshipId));
    return { units, groups: [] as { name: string; primary: boolean }[] };
  }
  const groups = await tx
    .select({
      name: schema.materialGroup.name,
      primary: schema.relationshipMaterialGroup.isPrimary,
    })
    .from(schema.relationshipMaterialGroup)
    .innerJoin(
      schema.materialGroup,
      eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
    )
    .where(eq(schema.relationshipMaterialGroup.relationshipId, relationshipId));
  return { units: [] as { name: string }[], groups };
}
