import {
  type AcceptInvitationRequest,
  type ActionReminderSetting,
  type ActionStatus,
  type AddAssignment,
  type AssignmentRequest,
  acceptInvitationResponseSchema,
  accountPlanSchema,
  actionItemSchema,
  actionListSchema,
  actionReminderSettingSchema,
  assignmentResponseSchema,
  auditResponseSchema,
  bridgeSchema,
  businessUnitsResponseSchema,
  type CommitmentStatus,
  type ConsolidateRequest,
  type ContributionObjectiveRequest,
  type CreateAction,
  type CreateJbp,
  type CreateMeeting,
  type CreateRound,
  type CreateSupplierRequest,
  commitmentsSchema,
  contributionDetailSchema,
  contributionSuggestionsResponseSchema,
  createSupplierResponseSchema,
  customerImpactSchema,
  customerListSchema,
  customerRuleSetSchema,
  customersResponseSchema,
  customerWorkspaceSchema,
  cycleSchema,
  cycleSettingsResponseSchema,
  type DecideJbp,
  type DecideValidation,
  decisionHistorySchema,
  dueListSchema,
  type ExtendRound,
  type FiscalYearSetting,
  type ForbiddenCode,
  type FreezeBaseline,
  financialImportResultSchema,
  fiscalYearSettingSchema,
  focusDetailSchema,
  focusListSchema,
  forbiddenCodes,
  healthResponseSchema,
  type ImpactView,
  type ImportJbpTopics,
  type ImportPreview,
  type ImportResult,
  type ImportType,
  type InitiativeStatus,
  type InviteSupplierRequest,
  type InviteSurveyParticipants,
  impactDetailSchema,
  impactImportPreviewSchema,
  impactListSchema,
  importPreviewSchema,
  importResultSchema,
  initiativeDetailSchema,
  initiativesSchema,
  invitationListSchema,
  jbpApprovalViewSchema,
  jbpPreparationSchema,
  jbpTopicCandidatesSchema,
  jbpTopicsSchema,
  jbpVersionsSchema,
  kpiDetailSchema,
  kpiImportPreviewSchema,
  type MaterialGroupRequest,
  materialGroupsResponseSchema,
  meetingDetailSchema,
  meetingListSchema,
  meResponseSchema,
  myActionsSchema,
  type ObjectiveCategoryRequest,
  objectiveCategoriesResponseSchema,
  objectiveCategoryRequestSchema,
  organizationMemberSchema,
  organizationResponseSchema,
  type PlanDecision,
  type PlanObjectiveRequest,
  type PromptEvent,
  type PromptRequest,
  permissionsResponseSchema,
  planVersionsSchema,
  playbookCatalogSchema,
  playbookPreviewSchema,
  pnlLinesSchema,
  portfolioImpactSchema,
  portfolioMatrixSchema,
  portfolioOpenSchema,
  portfolioSchema,
  promptEventSchema,
  publicInvitationSchema,
  publicSurveySchema,
  type RaiseMaturity,
  type RequestContributions,
  type RequestValidation,
  ratingAssignmentListSchema,
  ratingDetailSchema,
  roleDescriptionSchema,
  roundCandidatesSchema,
  roundDetailSchema,
  roundListSchema,
  roundRatersSchema,
  ruleSetProposalSchema,
  ruleSetResponseSchema,
  ruleSetSharePreviewSchema,
  type SaveAccountObjective,
  type SaveAccountSummary,
  type SaveAccountView,
  type SaveAction,
  type SaveAgenda,
  type SaveBenefit,
  type SaveCommitment,
  type SaveFinancial,
  type SaveFormatItem,
  type SaveImpactMonth,
  type SaveInitiative,
  type SaveJbpTopic,
  type SaveKpi,
  type SaveKpiValue,
  type SaveMeetingNote,
  type SaveMilestone,
  type SavePnlLine,
  type SaveProtocol,
  type SaveRating,
  type SaveRoleDescription,
  type SaveRuleItem,
  type SaveRuleSet,
  type SaveShare,
  type SaveSpendEntry,
  type SaveSurveyQuestion,
  type SaveTouchpoint,
  type SavingsReference,
  type ScorecardSetting,
  type SetFocusRequest,
  type SetRoundSuppliers,
  type SetupImpact,
  type SpendRequest,
  type StartSurveyWave,
  type StrategicTopicOrder,
  type StrategicTopicRequest,
  type SubmitSurvey,
  type SurveyKind,
  type SurveySide,
  scorecardSettingSchema,
  scorecardViewSchema,
  segmentationSchema,
  segmentModelResponseSchema,
  spendOverviewSchema,
  startSchema,
  supplierDetailSchema,
  supplierLookupResponseSchema,
  supplierOverviewSchema,
  supplierPlanResponseSchema,
  supplierProfileSchema,
  suppliersResponseSchema,
  supportHeader,
  surveyDetailSchema,
  surveySuggestionsSchema,
  surveysSchema,
  surveyWaveDetailSchema,
  surveyWavesSchema,
  teamResponseSchema,
  touchpointListSchema,
  touchpointSchema,
  type UpdateAssignment,
  type UpdateCycleSettings,
  type UpdateMeeting,
  type UpdateMemberRequest,
  type UpdateObjectiveCategory,
  type UpdatePlanSummary,
  type UpdateSegmentBoundaries,
  type UpdateSegmentCriterion,
  type UpdateSegmentType,
  type UpdateSegmentWeights,
  type UpdateSupplierRequest,
  type UpdateTeamRequest,
  type UserLocale,
  validationDetailSchema,
  validationListSchema,
} from '@reziproq/shared';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { browserLocale } from './i18n';
import { getSupportCustomer } from './support';

export class ApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    /** Bei 403: warum, damit die Oberfläche den passenden Hinweis zeigt. */
    readonly code?: ForbiddenCode,
    /** Antwort der API bei Fehlern, z. B. Feldfehler (400) oder vorhandene Beziehung (409) */
    readonly body?: unknown,
  ) {
    super(`Anfrage an ${path} fehlgeschlagen (${status})`);
  }
}

/** In der Betreiber-Ansicht schickt jede Anfrage den gewählten Kunden mit (PLT-13). */
function supportHeaders(): Record<string, string> {
  const customer = getSupportCustomer();
  return customer ? { [supportHeader]: customer.id } : {};
}

async function getJson<T extends z.ZodType>(
  path: string,
  schema: T,
  accessToken?: string,
): Promise<z.output<T>> {
  const res = await fetch(`/api${path}`, {
    headers: {
      ...supportHeaders(),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res));
  return schema.parse(await res.json());
}

// 401, 403 und 404 ändern sich durch Wiederholen nicht.
const retryUnlessDenied = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && failureCount < 2;

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: ['health'],
    queryFn: () => getJson('/health', healthResponseSchema),
  });

// Das Token gehört nicht in den Schlüssel: Erneuert es sich im Hintergrund, soll nichts neu laden
// und keine Seite kurz leer werden, sonst gehen Eingaben verloren (PLT-01). Abfragen nutzen beim
// nächsten Laden trotzdem das aktuelle Token. Ein anderer Nutzer heißt immer neu laden, weil
// Tokens nur im Speicher liegen; den Wechsel des Kunden leert use-support-switch.ts.
export const meQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['me'],
    queryFn: () => getJson('/me', meResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Was die Person darf, als Liste von Aktionen aus can() im Backend (PLT-05). */
export const permissionsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['me', 'permissions'],
    queryFn: () => getJson('/me/permissions', permissionsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/**
 * Meldet der API eine abgeschlossene Anmeldung; sie setzt last_login_at (PLT-01).
 * Scheitert das, geht es trotzdem weiter: Die Anmeldung selbst ist gültig.
 */
export async function reportLogin(accessToken: string): Promise<void> {
  try {
    // Die Browsersprache gilt nur beim ersten Login; danach zählt die gespeicherte (PLT-09).
    await fetch('/api/me/anmeldung', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ browserLocale: browserLocale() }),
    });
  } catch {}
}

// PLT-06: Business Units, Warengruppen und Zuordnung zu Lieferanten.

export type MasterDataKind = 'business-units' | 'material-groups';

export const businessUnitsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['master-data', 'business-units'],
    queryFn: () => getJson('/business-units', businessUnitsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const materialGroupsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['master-data', 'material-groups'],
    queryFn: () => getJson('/material-groups', materialGroupsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createEntry = (
  accessToken: string,
  kind: MasterDataKind,
  request: MaterialGroupRequest,
) => sendJson('POST', `/${kind}`, request, z.object({ id: z.string() }), accessToken);

export const updateEntry = (
  accessToken: string,
  kind: MasterDataKind,
  id: string,
  request: MaterialGroupRequest,
) => sendJson('PATCH', `/${kind}/${id}`, request, z.object({ id: z.string() }), accessToken);

// SEG-01: Segmentmodell je Käuferorganisation.
export const segmentModelQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['segment-model'],
    queryFn: () => getJson('/segment-model', segmentModelResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createSegmentModelDraft = (accessToken: string) =>
  sendJson('POST', '/segment-model/draft', {}, segmentModelResponseSchema, accessToken);

export const updateSegmentCriterion = (
  accessToken: string,
  key: string,
  request: UpdateSegmentCriterion,
) =>
  sendJson(
    'PATCH',
    `/segment-model/draft/criteria/${encodeURIComponent(key)}`,
    request,
    segmentModelResponseSchema,
    accessToken,
  );

export const updateSegmentWeights = (accessToken: string, request: UpdateSegmentWeights) =>
  sendJson('PUT', '/segment-model/draft/weights', request, segmentModelResponseSchema, accessToken);

export const updateSegmentBoundaries = (accessToken: string, request: UpdateSegmentBoundaries) =>
  sendJson(
    'PATCH',
    '/segment-model/draft/boundaries',
    request,
    segmentModelResponseSchema,
    accessToken,
  );

export const updateSegmentType = (
  accessToken: string,
  impact: number,
  quality: number,
  request: UpdateSegmentType,
) =>
  sendJson(
    'PATCH',
    `/segment-model/draft/types/${impact}/${quality}`,
    request,
    segmentModelResponseSchema,
    accessToken,
  );

export const activateSegmentModelDraft = (accessToken: string) =>
  sendJson('POST', '/segment-model/draft/activate', {}, segmentModelResponseSchema, accessToken);

/** Nur unbenutzte Einträge; sonst 409 in_use. */
export async function deleteEntry(accessToken: string, kind: MasterDataKind, id: string) {
  const path = `/${kind}/${id}`;
  const res = await fetch(`/api${path}`, {
    method: 'DELETE',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const answer: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, answer);
  }
}

export const assignmentQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'assignment'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/zuordnung`, assignmentResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveAssignment = (
  accessToken: string,
  relationshipId: string,
  request: AssignmentRequest,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/zuordnung`,
    request,
    assignmentResponseSchema,
    accessToken,
  );

/** Eigene Sprache speichern (PLT-09); gilt dann auf jedem Gerät. */
export async function saveLocale(accessToken: string, locale: UserLocale): Promise<void> {
  const path = '/me/sprache';
  const res = await fetch(`/api${path}`, {
    method: 'PUT',
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ locale }),
  });
  if (!res.ok) {
    const answer: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, answer);
  }
}

async function forbiddenCode(res: Response): Promise<ForbiddenCode | undefined> {
  if (res.status !== 403) return undefined;
  const body: unknown = await res.json().catch(() => null);
  const code = (body as { code?: unknown } | null)?.code;
  return forbiddenCodes.find((known) => known === code);
}

export const organizationQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['organisation'],
    queryFn: () => getJson('/organisation', organizationResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Verlauf eines Objekts (PLT-08), neueste zuerst. */
export const auditQueryOptions = (
  accessToken: string,
  objectType: string,
  objectId: string,
  /** Lieferantenseite: Verlauf im Kontext dieses Kunden (JBP-03) */
  relationshipId?: string,
) =>
  queryOptions({
    queryKey: ['audit', objectType, objectId],
    queryFn: () =>
      getJson(
        `/audit?${new URLSearchParams({
          object_type: objectType,
          object_id: objectId,
          ...(relationshipId ? { relationship_id: relationshipId } : {}),
        })}`,
        auditResponseSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** Ein Mitglied der eigenen Organisation mit Rolle (PLT-05). */
export const memberQueryOptions = (accessToken: string, userId: string) =>
  queryOptions({
    queryKey: ['organisation', 'mitglieder', userId],
    queryFn: () =>
      getJson(
        `/organisation/mitglieder/${encodeURIComponent(userId)}`,
        organizationMemberSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** Schreibt über die API und prüft die Antwort; Fehler kommen mit Status und Antwort zurück. */
async function sendJson<T extends z.ZodType>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  schema: T,
  accessToken: string,
): Promise<z.output<T>> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const answer: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    throw new ApiError(path, res.status, await forbiddenCode(res), answer);
  }
  return schema.parse(await res.json());
}

/** Ein Lieferant mit Stammdaten, eigenen Werten und Spend je Jahr (PLT-03b). */
export const supplierQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId],
    queryFn: () => getJson(`/suppliers/${relationshipId}`, supplierDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Ist ein Lieferant mit dieser USt-IdNr. oder D-U-N-S schon in Reziproq? Nur ja oder nein. */
export const lookupSupplier = (accessToken: string, query: { ust?: string; duns?: string }) =>
  getJson(
    `/suppliers/lookup?${new URLSearchParams(
      Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
    )}`,
    supplierLookupResponseSchema,
    accessToken,
  );

export const createSupplier = (accessToken: string, request: CreateSupplierRequest) =>
  sendJson('POST', '/suppliers', request, createSupplierResponseSchema, accessToken);

export const updateSupplier = (
  accessToken: string,
  relationshipId: string,
  request: UpdateSupplierRequest,
) => sendJson('PATCH', `/suppliers/${relationshipId}`, request, supplierDetailSchema, accessToken);

export const endSupplier = (accessToken: string, relationshipId: string) =>
  sendJson('POST', `/suppliers/${relationshipId}/beenden`, {}, supplierDetailSchema, accessToken);

/** SPL-04: Spend-Entwicklung mit Kennzahlen, Summen und Zeilen; nur Käufer. */
export const spendOverviewQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'spend'],
    queryFn: () => getJson(`/suppliers/${relationshipId}/spend`, spendOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveSpendEntry = (
  accessToken: string,
  relationshipId: string,
  entryId: string | null,
  request: SaveSpendEntry | null,
) =>
  sendJson(
    request === null ? 'DELETE' : entryId ? 'PUT' : 'POST',
    `/suppliers/${relationshipId}/spend/eintraege${entryId ? `/${entryId}` : ''}`,
    request ?? {},
    spendOverviewSchema,
    accessToken,
  );

/** SPL-05: Profil und Finanzen; nur Käufer. */
export const supplierProfileQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'profil'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/profil`, supplierProfileSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveProfileSection = (
  accessToken: string,
  relationshipId: string,
  section: 'unternehmen' | 'einschaetzung' | 'geschaeftsleitung',
  request: unknown,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/profil/${section}`,
    request,
    supplierProfileSchema,
    accessToken,
  );

export const saveFinancial = (
  accessToken: string,
  relationshipId: string,
  financialId: string | null,
  request: SaveFinancial | null,
) =>
  sendJson(
    request === null ? 'DELETE' : financialId ? 'PUT' : 'POST',
    `/suppliers/${relationshipId}/profil/kennzahlen${financialId ? `/${financialId}` : ''}`,
    request ?? {},
    supplierProfileSchema,
    accessToken,
  );

export async function importFinancials(accessToken: string, relationshipId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const path = `/suppliers/${relationshipId}/profil/kennzahlen/import`;
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const answer: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, answer);
  }
  return financialImportResultSchema.parse(await res.json());
}

export const putSpend = (
  accessToken: string,
  relationshipId: string,
  year: number,
  request: SpendRequest,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/spend/${year}`,
    request,
    supplierDetailSchema,
    accessToken,
  );

export const updateMember = (accessToken: string, userId: string, request: UpdateMemberRequest) =>
  sendJson(
    'PUT',
    `/organisation/mitglieder/${encodeURIComponent(userId)}`,
    request,
    organizationMemberSchema,
    accessToken,
  );

/** Internes Team einer Beziehung (PLT-05b). */
/** Kopf und Kennzahlen des Arbeitsbereichs (NAV-06); neu geladen mit allem unter ['suppliers', id]. */
export const supplierOverviewQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'overview'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/overview`, supplierOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const startSupplierCycle = (accessToken: string, relationshipId: string) =>
  sendJson('POST', `/suppliers/${relationshipId}/cycle`, {}, cycleSchema, accessToken);

export const setSupplierJbpDate = (accessToken: string, relationshipId: string, jbpDate: string) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/cycle/jbp-date`,
    { jbpDate },
    cycleSchema,
    accessToken,
  );

export const cycleSettingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['cycle-settings'],
    queryFn: () => getJson('/cycle/settings', cycleSettingsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const updateCycleSettings = (accessToken: string, request: UpdateCycleSettings) =>
  sendJson('PUT', '/cycle/settings', request, cycleSettingsResponseSchema, accessToken);

// SPL-01: interner Lieferantenplan, Ziele und organisationsweite Zielkategorien.
export const supplierPlanQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'supplier-plan'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/plan`, supplierPlanResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** SPL-07: Versionen des Plans im aktiven Zyklus. */
export const planVersionsQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'supplier-plan', 'versions'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/plan/versions`, planVersionsSchema, accessToken),
  });

export const submitSupplierPlan = (accessToken: string, relationshipId: string, planId: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/submit`,
    {},
    z.unknown(),
    accessToken,
  );

export const decideSupplierPlan = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  request: PlanDecision,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/decision`,
    request,
    z.unknown(),
    accessToken,
  );

export const newSupplierPlanVersion = (
  accessToken: string,
  relationshipId: string,
  planId: string,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/new-version`,
    {},
    z.object({ id: z.string() }),
    accessToken,
  );

export const createSupplierPlan = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan`,
    {},
    z.object({ id: z.string() }),
    accessToken,
  );

export const updateSupplierPlanSummary = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  request: UpdatePlanSummary,
) =>
  sendJson(
    'PATCH',
    `/suppliers/${relationshipId}/plan/${planId}/summary`,
    request,
    z.object({ summary: z.string() }),
    accessToken,
  );

export const createPlanObjective = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  request: PlanObjectiveRequest,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/objectives`,
    request,
    z.object({ id: z.string() }),
    accessToken,
  );

// SPL-03: Beiträge der Funktionen zum Lieferantenplan.
export const contributionSuggestionsQueryOptions = (
  accessToken: string,
  relationshipId: string,
  planId: string,
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'supplier-plan', 'contribution-suggestions', planId],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/plan/${planId}/contribution-suggestions`,
        contributionSuggestionsResponseSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const requestContributions = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  request: RequestContributions,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/contributions`,
    request,
    z.object({ ids: z.array(z.string()) }),
    accessToken,
  );

export const contributionQueryOptions = (
  accessToken: string,
  relationshipId: string,
  contributionId: string,
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'supplier-plan', 'contribution', contributionId],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/plan/contributions/${contributionId}`,
        contributionDetailSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const createContributionObjective = (
  accessToken: string,
  relationshipId: string,
  contributionId: string,
  request: ContributionObjectiveRequest,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/contributions/${contributionId}/objectives`,
    request,
    z.object({ id: z.string() }),
    accessToken,
  );

export const completeContribution = (
  accessToken: string,
  relationshipId: string,
  contributionId: string,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/contributions/${contributionId}/complete`,
    {},
    z.object({ id: z.string() }),
    accessToken,
  );

export const updatePlanObjective = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  objectiveId: string,
  request: PlanObjectiveRequest,
) =>
  sendJson(
    'PATCH',
    `/suppliers/${relationshipId}/plan/${planId}/objectives/${objectiveId}`,
    request,
    z.object({ id: z.string() }),
    accessToken,
  );

export const createStrategicTopic = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  request: StrategicTopicRequest,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/topics`,
    request,
    z.object({ id: z.string() }),
    accessToken,
  );

export const updateStrategicTopic = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  topicId: string,
  request: StrategicTopicRequest,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/plan/${planId}/topics/${topicId}`,
    request,
    z.object({ id: z.string() }),
    accessToken,
  );

export const reorderStrategicTopics = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  request: StrategicTopicOrder,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/plan/${planId}/topic-order`,
    request,
    z.object({ ok: z.boolean() }),
    accessToken,
  );

export const objectiveCategoriesQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['objective-categories'],
    queryFn: () => getJson('/objective-categories', objectiveCategoriesResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createObjectiveCategory = (accessToken: string, request: ObjectiveCategoryRequest) =>
  sendJson('POST', '/objective-categories', request, objectiveCategoryRequestSchema, accessToken);

export const updateObjectiveCategory = (
  accessToken: string,
  key: string,
  request: UpdateObjectiveCategory,
) =>
  sendJson(
    'PATCH',
    `/objective-categories/${encodeURIComponent(key)}`,
    request,
    z.object({
      key: z.string(),
      name: z.string(),
      position: z.number(),
      active: z.boolean(),
    }),
    accessToken,
  );

/** Team einer Beziehung (PLT-05b, PLB-04); der Lieferant liest es unter /kunden. */
export type TeamSide = 'buyer' | 'supplier';
const teamUrl = (side: TeamSide, relationshipId: string) =>
  side === 'buyer' ? `/suppliers/${relationshipId}/team` : `/kunden/${relationshipId}/team`;

export const teamQueryOptions = (
  accessToken: string,
  relationshipId: string,
  side: TeamSide = 'buyer',
) =>
  queryOptions({
    queryKey: [side === 'buyer' ? 'suppliers' : 'kunden', relationshipId, 'team'],
    queryFn: () => getJson(teamUrl(side, relationshipId), teamResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const updateTeam = (
  accessToken: string,
  relationshipId: string,
  request: UpdateTeamRequest,
  side: TeamSide = 'buyer',
) => sendJson('PUT', teamUrl(side, relationshipId), request, teamResponseSchema, accessToken);

/** PLB-04: Einstellungen › Rollen. */
export const roleDescriptionsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['rollen'],
    queryFn: () => getJson('/rollen', z.array(roleDescriptionSchema), accessToken),
    retry: retryUnlessDenied,
  });

export const saveRoleDescription = (
  accessToken: string,
  role: string,
  request: SaveRoleDescription,
) =>
  sendJson(
    'PUT',
    `/rollen/${encodeURIComponent(role)}`,
    request,
    z.array(roleDescriptionSchema),
    accessToken,
  );

export const suppliersQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['suppliers'],
    queryFn: () => getJson('/suppliers', suppliersResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

async function uploadImport<T extends z.ZodType>(
  path: string,
  type: ImportType,
  file: File,
  schema: T,
  accessToken: string,
): Promise<z.output<T>> {
  const form = new FormData();
  form.append('file', file);
  const url = `/suppliers/import${path}?${new URLSearchParams({ type })}`;
  const res = await fetch(`/api${url}`, {
    method: 'POST',
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });
  if (!res.ok) {
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    throw new ApiError(url, res.status, await forbiddenCode(res), body);
  }
  return schema.parse(await res.json());
}

export const previewImport = (
  accessToken: string,
  type: ImportType,
  file: File,
): Promise<ImportPreview> => uploadImport('/preview', type, file, importPreviewSchema, accessToken);

export const applyImport = (
  accessToken: string,
  type: ImportType,
  file: File,
): Promise<ImportResult> => uploadImport('', type, file, importResultSchema, accessToken);

export async function downloadImportTemplate(
  accessToken: string,
  type: ImportType,
  format: 'csv' | 'xlsx',
  locale: UserLocale,
): Promise<void> {
  const path = `/suppliers/import/template?${new URLSearchParams({ type, format, locale })}`;
  const res = await fetch(`/api${path}`, {
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    throw new ApiError(path, res.status, await forbiddenCode(res), body);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `reziproq-vorlage-${type}.${format}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Stellt eine Frage an das Prompt-Fenster (PLT-12) und meldet jedes Ereignis der gestreamten
 * Antwort, sobald seine Zeile vollständig angekommen ist.
 */
export async function streamPrompt(
  accessToken: string,
  messages: PromptRequest['messages'],
  onEvent: (event: PromptEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/prompt', {
    method: 'POST',
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError('/prompt', res.status, await forbiddenCode(res));

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) onEvent(promptEventSchema.parse(JSON.parse(line)));
    }
  }
  if (buffer.trim()) onEvent(promptEventSchema.parse(JSON.parse(buffer)));
}

export const customersQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['betreiber-kunden'],
    queryFn: () => getJson('/betreiber/kunden', customersResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

// SEG-03: Bewertungsrunden.
export const roundsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['rounds'],
    queryFn: () => getJson('/rounds', roundListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const roundQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['rounds', id],
    queryFn: () => getJson(`/rounds/${id}`, roundDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const roundCandidatesQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['rounds', id, 'candidates'],
    queryFn: () => getJson(`/rounds/${id}/candidates`, roundCandidatesSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const roundRatersQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['rounds', 'raters'],
    queryFn: () => getJson('/rounds/raters', roundRatersSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createRound = (accessToken: string, request: CreateRound) =>
  sendJson('POST', '/rounds', request, roundDetailSchema, accessToken);

export const updateRoundDraft = (accessToken: string, id: string, request: CreateRound) =>
  sendJson('PATCH', `/rounds/${id}`, request, roundDetailSchema, accessToken);

export const setRoundSuppliers = (accessToken: string, id: string, request: SetRoundSuppliers) =>
  sendJson('PUT', `/rounds/${id}/suppliers`, request, roundDetailSchema, accessToken);

export const updateRoundAssignment = (
  accessToken: string,
  id: string,
  assignmentId: string,
  request: UpdateAssignment,
) =>
  sendJson(
    'PATCH',
    `/rounds/${id}/assignments/${assignmentId}`,
    request,
    roundDetailSchema,
    accessToken,
  );

export const addRoundAssignment = (accessToken: string, id: string, request: AddAssignment) =>
  sendJson('POST', `/rounds/${id}/assignments`, request, roundDetailSchema, accessToken);

export const startRound = (accessToken: string, id: string) =>
  sendJson('POST', `/rounds/${id}/start`, {}, roundDetailSchema, accessToken);

export const extendRound = (accessToken: string, id: string, request: ExtendRound) =>
  sendJson('POST', `/rounds/${id}/extend`, request, roundDetailSchema, accessToken);

export const closeRound = (accessToken: string, id: string) =>
  sendJson('POST', `/rounds/${id}/close`, {}, roundDetailSchema, accessToken);

export const myRatingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['ratings', 'mine'],
    queryFn: () => getJson('/ratings/mine', ratingAssignmentListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const ratingQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['ratings', id],
    queryFn: () => getJson(`/ratings/${id}`, ratingDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const segmentationQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['ratings', 'segmentation', relationshipId],
    queryFn: () =>
      getJson(
        `/ratings/relationship/${relationshipId}/segmentation`,
        segmentationSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const portfolioQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['portfolio'],
    queryFn: () => getJson('/portfolio', portfolioSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const portfolioMatrixQueryOptions = (
  accessToken: string,
  filter: { businessUnitId?: string | undefined; materialGroupId?: string | undefined },
) =>
  queryOptions({
    queryKey: ['portfolio', 'matrix', filter.businessUnitId ?? '', filter.materialGroupId ?? ''],
    queryFn: () => {
      const query = new URLSearchParams();
      if (filter.businessUnitId) query.set('businessUnitId', filter.businessUnitId);
      if (filter.materialGroupId) query.set('materialGroupId', filter.materialGroupId);
      const suffix = query.size > 0 ? `?${query}` : '';
      return getJson(`/portfolio/matrix${suffix}`, portfolioMatrixSchema, accessToken);
    },
    retry: retryUnlessDenied,
  });

export const portfolioOpenQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['portfolio', 'open'],
    queryFn: () => getJson('/portfolio/open', portfolioOpenSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const focusQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['portfolio', 'focus'],
    queryFn: () => getJson('/portfolio/fokus', focusListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const focusDetailQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['portfolio', 'focus', relationshipId],
    queryFn: () => getJson(`/portfolio/fokus/${relationshipId}`, focusDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const setFocus = (accessToken: string, relationshipId: string, request: SetFocusRequest) =>
  sendJson('PUT', `/portfolio/fokus/${relationshipId}`, request, focusDetailSchema, accessToken);

export const decisionsQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['ratings', 'decisions', relationshipId],
    queryFn: () =>
      getJson(
        `/ratings/relationship/${relationshipId}/decisions`,
        decisionHistorySchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const consolidate = (
  accessToken: string,
  relationshipId: string,
  request: ConsolidateRequest,
) =>
  sendJson(
    'POST',
    `/ratings/relationship/${relationshipId}/decisions`,
    request,
    decisionHistorySchema,
    accessToken,
  );

export const saveRating = (accessToken: string, id: string, request: SaveRating) =>
  sendJson('PUT', `/ratings/${id}`, request, ratingDetailSchema, accessToken);

export const submitRating = (accessToken: string, id: string) =>
  sendJson('POST', `/ratings/${id}/submit`, {}, ratingDetailSchema, accessToken);

export const startQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['start'],
    queryFn: () => getJson('/start', startSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const dueQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['start', 'due'],
    queryFn: () => getJson('/start/due', dueListSchema, accessToken),
    retry: retryUnlessDenied,
  });

// LIF-01a: Personen des Lieferanten einladen; die Annahme läuft ohne Login.

export const invitationsQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'invitations'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/einladungen`, invitationListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const inviteSupplier = (
  accessToken: string,
  relationshipId: string,
  request: InviteSupplierRequest,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/einladungen`,
    request,
    invitationListSchema,
    accessToken,
  );

export const revokeInvitation = (accessToken: string, relationshipId: string, id: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/einladungen/${id}/zurueckziehen`,
    {},
    invitationListSchema,
    accessToken,
  );

/** Ohne Login: Der Token im Link ist der einzige Schlüssel. */
export const publicInvitationQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['einladung', token],
    queryFn: () => getJson(`/einladungen/${encodeURIComponent(token)}`, publicInvitationSchema),
    retry: retryUnlessDenied,
  });

export async function acceptInvitation(token: string, request: AcceptInvitationRequest) {
  const path = `/einladungen/${encodeURIComponent(token)}/annahme`;
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const answer: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, answer);
  }
  return acceptInvitationResponseSchema.parse(await res.json());
}

// LIF-02: Kunden der Lieferantenseite und ihr Arbeitsbereich.

export const customerListQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['kunden'],
    queryFn: () => getJson('/kunden', customerListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const customerWorkspaceQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['kunden', relationshipId],
    queryFn: () => getJson(`/kunden/${relationshipId}`, customerWorkspaceSchema, accessToken),
    retry: retryUnlessDenied,
  });

// PLB-01: Kataloge für Spielregeln und Formate.

export const playbookQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['playbook'],
    queryFn: () => getJson('/playbook', playbookCatalogSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const playbookPreviewQueryOptions = (accessToken: string, impact: number, quality: number) =>
  queryOptions({
    queryKey: ['playbook', 'preview', impact, quality],
    queryFn: () =>
      getJson(`/playbook/preview/${impact}/${quality}`, playbookPreviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveRuleItem = (accessToken: string, id: string | null, request: SaveRuleItem) =>
  sendJson(
    id ? 'PUT' : 'POST',
    id ? `/playbook/rules/${id}` : '/playbook/rules',
    request,
    playbookCatalogSchema,
    accessToken,
  );

export const saveFormatItem = (accessToken: string, id: string | null, request: SaveFormatItem) =>
  sendJson(
    id ? 'PUT' : 'POST',
    id ? `/playbook/formats/${id}` : '/playbook/formats',
    request,
    playbookCatalogSchema,
    accessToken,
  );

// PLB-03: Spielregeln je Beziehung.

export const ruleSetQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'rule-set'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/spielregeln`, ruleSetResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const ruleSetProposalQueryOptions = (
  accessToken: string,
  relationshipId: string,
  basis: 'soll' | 'aktuell',
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'rule-set', 'proposal', basis],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/spielregeln/vorschlag?basis=${basis}`,
        ruleSetProposalSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const adoptRuleSetProposal = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/spielregeln`,
    {},
    ruleSetResponseSchema,
    accessToken,
  );

export const saveRuleSet = (accessToken: string, relationshipId: string, request: SaveRuleSet) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/spielregeln`,
    request,
    ruleSetResponseSchema,
    accessToken,
  );

export const approveRuleSet = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/spielregeln/freigabe`,
    {},
    ruleSetResponseSchema,
    accessToken,
  );

// SEG-10: Beziehungstyp und Spielregeln teilen; Lieferantenseite liest nur Geteiltes.

export const ruleSetSharePreviewQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'rule-set', 'share'],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/spielregeln/teilen`,
        ruleSetSharePreviewSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const shareRuleSet = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/spielregeln/teilen`,
    {},
    ruleSetResponseSchema,
    accessToken,
  );

export const customerRuleSetQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['kunden', relationshipId, 'spielregeln'],
    queryFn: () =>
      getJson(`/kunden/${relationshipId}/spielregeln`, customerRuleSetSchema, accessToken),
    retry: retryUnlessDenied,
  });

// QBR-01a: Termine auf beiden Seiten; base ist /suppliers/<id> (Käufer) oder /kunden/<id> (Lieferant).

export type MeetingBase = `/suppliers/${string}` | `/kunden/${string}`;

export const meetingListQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['meetings', base],
    queryFn: () => getJson(`${base}/termine`, meetingListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const meetingQueryOptions = (accessToken: string, base: MeetingBase, meetingId: string) =>
  queryOptions({
    queryKey: ['meetings', base, meetingId],
    queryFn: () => getJson(`${base}/termine/${meetingId}`, meetingDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createMeeting = (accessToken: string, base: MeetingBase, request: CreateMeeting) =>
  sendJson('POST', `${base}/termine`, request, meetingDetailSchema, accessToken);

export const updateMeeting = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
  request: UpdateMeeting,
) => sendJson('PUT', `${base}/termine/${meetingId}`, request, meetingDetailSchema, accessToken);

export const saveMeetingAgenda = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
  request: SaveAgenda,
) =>
  sendJson('PUT', `${base}/termine/${meetingId}/agenda`, request, meetingDetailSchema, accessToken);

export const saveMeetingProtocol = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
  request: SaveProtocol,
) =>
  sendJson(
    'PUT',
    `${base}/termine/${meetingId}/protokoll`,
    request,
    meetingDetailSchema,
    accessToken,
  );

/** JBP-01: Vorbereitung des Gemeinsamen Plans, je Seite unter ihrer Basis. */
export const jbpQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', base],
    queryFn: () => getJson(`${base}/jbp`, jbpPreparationSchema, accessToken),
  });

export const createJbp = (accessToken: string, base: MeetingBase, request: CreateJbp) =>
  sendJson('POST', `${base}/jbp`, request, jbpPreparationSchema, accessToken);

export const saveBusinessUpdate = (accessToken: string, base: MeetingBase, text: string) =>
  sendJson('PUT', `${base}/jbp/geschaeftsupdate`, { text }, jbpPreparationSchema, accessToken);

/** JBP-02: Themen beider Seiten im Gemeinsamen Plan. */
export const jbpTopicsQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', base, 'themen'],
    queryFn: () => getJson(`${base}/jbp/themen`, jbpTopicsSchema, accessToken),
  });

export const jbpTopicCandidatesQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', base, 'themen', 'vorschlaege'],
    queryFn: () => getJson(`${base}/jbp/themen/vorschlaege`, jbpTopicCandidatesSchema, accessToken),
  });

export const createJbpTopic = (accessToken: string, base: MeetingBase, request: SaveJbpTopic) =>
  sendJson('POST', `${base}/jbp/themen`, request, jbpTopicsSchema, accessToken);

export const updateJbpTopic = (
  accessToken: string,
  base: MeetingBase,
  topicId: string,
  request: SaveJbpTopic,
) => sendJson('PUT', `${base}/jbp/themen/${topicId}`, request, jbpTopicsSchema, accessToken);

export const parkJbpTopic = (
  accessToken: string,
  base: MeetingBase,
  topicId: string,
  reason: string,
) =>
  sendJson('PUT', `${base}/jbp/themen/${topicId}/parken`, { reason }, jbpTopicsSchema, accessToken);

export const restoreJbpTopic = (accessToken: string, base: MeetingBase, topicId: string) =>
  sendJson(
    'PUT',
    `${base}/jbp/themen/${topicId}/wieder-aufnehmen`,
    {},
    jbpTopicsSchema,
    accessToken,
  );

export const reorderJbpTopics = (accessToken: string, base: MeetingBase, ids: string[]) =>
  sendJson('PUT', `${base}/jbp/themen/reihenfolge`, { ids }, jbpTopicsSchema, accessToken);

export const importJbpTopics = (accessToken: string, base: MeetingBase, request: ImportJbpTopics) =>
  sendJson('POST', `${base}/jbp/themen/uebernehmen`, request, jbpTopicsSchema, accessToken);

/** JBP-03: Initiativen und Roadmap, je Seite unter ihrer Basis. */
export const initiativesQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', 'initiatives', base],
    queryFn: () => getJson(`${base}/jbp/initiativen`, initiativesSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const initiativeQueryOptions = (accessToken: string, base: MeetingBase, id: string) =>
  queryOptions({
    queryKey: ['jbp', 'initiatives', base, id],
    queryFn: () => getJson(`${base}/jbp/initiativen/${id}`, initiativeDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createInitiative = (accessToken: string, base: MeetingBase, request: SaveInitiative) =>
  sendJson('POST', `${base}/jbp/initiativen`, request, initiativeDetailSchema, accessToken);

export const updateInitiative = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  request: SaveInitiative,
) => sendJson('PUT', `${base}/jbp/initiativen/${id}`, request, initiativeDetailSchema, accessToken);

export const setInitiativeStatus = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  status: InitiativeStatus,
) =>
  sendJson(
    'PUT',
    `${base}/jbp/initiativen/${id}/status`,
    { status },
    initiativeDetailSchema,
    accessToken,
  );

export const addMilestone = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  request: SaveMilestone,
) =>
  sendJson(
    'POST',
    `${base}/jbp/initiativen/${id}/meilensteine`,
    request,
    initiativeDetailSchema,
    accessToken,
  );

export const updateMilestone = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  milestoneId: string,
  request: SaveMilestone,
) =>
  sendJson(
    'PUT',
    `${base}/jbp/initiativen/${id}/meilensteine/${milestoneId}`,
    request,
    initiativeDetailSchema,
    accessToken,
  );

export const deleteMilestone = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  milestoneId: string,
) =>
  sendJson(
    'DELETE',
    `${base}/jbp/initiativen/${id}/meilensteine/${milestoneId}`,
    {},
    initiativeDetailSchema,
    accessToken,
  );

/** JBP-07: Scorecard mit Kennzahlen und Unterschriften. */
export const scorecardQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', 'scorecard', base],
    queryFn: () => getJson(`${base}/jbp/scorecard`, scorecardViewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createKpi = (accessToken: string, base: MeetingBase, request: SaveKpi) =>
  sendJson('POST', `${base}/jbp/scorecard/kennzahlen`, request, scorecardViewSchema, accessToken);

export const updateKpi = (accessToken: string, base: MeetingBase, id: string, request: SaveKpi) =>
  sendJson(
    'PUT',
    `${base}/jbp/scorecard/kennzahlen/${id}`,
    request,
    scorecardViewSchema,
    accessToken,
  );

export const deleteKpi = (accessToken: string, base: MeetingBase, id: string) =>
  sendJson(
    'DELETE',
    `${base}/jbp/scorecard/kennzahlen/${id}`,
    {},
    scorecardViewSchema,
    accessToken,
  );

export const signScorecard = (accessToken: string, base: MeetingBase) =>
  sendJson('POST', `${base}/jbp/scorecard/unterschreiben`, {}, scorecardViewSchema, accessToken);

export const startScorecardVersion = (accessToken: string, base: MeetingBase) =>
  sendJson('POST', `${base}/jbp/scorecard/neue-version`, {}, scorecardViewSchema, accessToken);

/** PNL-01, PNL-03: GuV-Wirkung je Lieferant (nur Käufer) und GuV-Zeilen. */
export const impactListQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['impact', relationshipId],
    queryFn: () => getJson(`/suppliers/${relationshipId}/wirkung`, impactListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const impactDetailQueryOptions = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
) =>
  queryOptions({
    queryKey: ['impact', relationshipId, initiativeId],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}`,
        impactDetailSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** PNL-10: Brücke je Beziehung, Wirkung im Portfolio, Geschäftsjahr. */
export const bridgeQueryOptions = (
  accessToken: string,
  relationshipId: string,
  side: TeamSide,
  view: ImpactView,
  fiscalYear: number | undefined,
) =>
  queryOptions({
    queryKey: ['bruecke', side, relationshipId, view, fiscalYear ?? null],
    queryFn: () =>
      getJson(
        `/${side === 'buyer' ? 'suppliers' : 'kunden'}/${relationshipId}/wirkung/bruecke?sicht=${view}${fiscalYear ? `&gj=${fiscalYear}` : ''}`,
        bridgeSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const portfolioImpactQueryOptions = (
  accessToken: string,
  view: ImpactView,
  fiscalYear: number | undefined,
) =>
  queryOptions({
    queryKey: ['wirkung-portfolio', view, fiscalYear ?? null],
    queryFn: () =>
      getJson(
        `/wirkung/portfolio?sicht=${view}${fiscalYear ? `&gj=${fiscalYear}` : ''}`,
        portfolioImpactSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const fiscalYearQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['geschaeftsjahr'],
    queryFn: () => getJson('/wirkung/geschaeftsjahr', fiscalYearSettingSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveFiscalYear = (accessToken: string, request: FiscalYearSetting) =>
  sendJson('PUT', '/wirkung/geschaeftsjahr', request, fiscalYearSettingSchema, accessToken);

/** PNL-11: Excel-Export der Wirkung; der Dateiname kommt vom Server. */
export async function downloadImpactExport(
  accessToken: string,
  view: ImpactView,
  fiscalYear: number | undefined,
  relationshipId?: string,
) {
  const query = new URLSearchParams({
    sicht: view,
    ...(fiscalYear ? { gj: String(fiscalYear) } : {}),
  });
  const path = `${relationshipId ? `/suppliers/${relationshipId}` : ''}/wirkung/export?${query}`;
  const res = await fetch(`/api${path}`, {
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    throw new ApiError(path, res.status, await forbiddenCode(res), body);
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = encoded ? decodeURIComponent(encoded) : 'Wirkung.xlsx';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** PNL-07: Teilung und Savings-Verweis beim Käufer; Wirkung beim Lieferanten. */
export const saveImpactShare = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: SaveShare,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/teilung`,
    request,
    impactListSchema,
    accessToken,
  );

export const saveSavingsReference = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: SavingsReference | null,
) =>
  sendJson(
    request ? 'PUT' : 'DELETE',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/savings`,
    request ?? {},
    impactListSchema,
    accessToken,
  );

export const customerImpactQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['kunden', relationshipId, 'wirkung'],
    queryFn: () => getJson(`/kunden/${relationshipId}/wirkung`, customerImpactSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const confirmImpactShare = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
) =>
  sendJson(
    'POST',
    `/kunden/${relationshipId}/wirkung/initiativen/${initiativeId}/teilung/bestaetigen`,
    {},
    customerImpactSchema,
    accessToken,
  );

export const saveSupplierBenefit = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  benefitId: string | null,
  request: SaveBenefit | null,
) =>
  sendJson(
    request === null ? 'DELETE' : benefitId ? 'PUT' : 'POST',
    `/kunden/${relationshipId}/wirkung/initiativen/${initiativeId}/nutzen${benefitId ? `/${benefitId}` : ''}`,
    request ?? {},
    customerImpactSchema,
    accessToken,
  );

export const setupImpact = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: SetupImpact,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/einrichten`,
    request,
    impactDetailSchema,
    accessToken,
  );

export const freezeBaseline = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: FreezeBaseline,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/baseline`,
    request,
    impactDetailSchema,
    accessToken,
  );

export const raiseMaturity = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: RaiseMaturity,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/reifegrad`,
    request,
    impactDetailSchema,
    accessToken,
  );

/** PNL-05: Monat erfassen, Import; PNL-06: Freigabe anfordern und entscheiden. */
export const saveImpactMonth = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: SaveImpactMonth,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/monate`,
    request,
    impactDetailSchema,
    accessToken,
  );

export async function uploadImpactMonths(
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  file: File,
  apply: boolean,
) {
  const form = new FormData();
  form.append('file', file);
  const path = `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/import${apply ? '' : '/vorschau'}`;
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, body);
  }
  return impactImportPreviewSchema.parse(await res.json());
}

export const requestValidation = (
  accessToken: string,
  relationshipId: string,
  initiativeId: string,
  request: RequestValidation,
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/wirkung/initiativen/${initiativeId}/freigabe`,
    request,
    impactDetailSchema,
    accessToken,
  );

export const validationsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['validations'],
    queryFn: () => getJson('/wirkung/freigaben', validationListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const validationQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['validations', id],
    queryFn: () => getJson(`/wirkung/freigaben/${id}`, validationDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const decideValidation = (accessToken: string, id: string, request: DecideValidation) =>
  sendJson(
    'POST',
    `/wirkung/freigaben/${id}/entscheiden`,
    request,
    validationDetailSchema,
    accessToken,
  );

export const pnlLinesQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['pnl-lines'],
    queryFn: () => getJson('/pnl-lines', pnlLinesSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const savePnlLine = (accessToken: string, key: string | null, request: SavePnlLine) =>
  sendJson(
    key ? 'PUT' : 'POST',
    key ? `/pnl-lines/${encodeURIComponent(key)}` : '/pnl-lines',
    request,
    pnlLinesSchema,
    accessToken,
  );

/** PUL-01: Fragebogen der Organisation; jede Änderung eine neue Version. */
export const surveysQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['surveys'],
    queryFn: () => getJson('/fragebogen', surveysSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const surveyQueryOptions = (accessToken: string, kind: SurveyKind) =>
  queryOptions({
    queryKey: ['surveys', kind],
    queryFn: () => getJson(`/fragebogen/${kind}`, surveyDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveSurveyQuestion = (
  accessToken: string,
  kind: SurveyKind,
  key: string | null,
  request: SaveSurveyQuestion,
) =>
  sendJson(
    key ? 'PUT' : 'POST',
    key ? `/fragebogen/${kind}/fragen/${encodeURIComponent(key)}` : `/fragebogen/${kind}/fragen`,
    request,
    surveyDetailSchema,
    accessToken,
  );

/** LIF-03: Eigene Sicht des Lieferanten, nur unter /kunden. */
export const accountPlanQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['eigene-sicht', relationshipId],
    queryFn: () =>
      getJson(`/kunden/${relationshipId}/eigene-sicht`, accountPlanSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveAccountSummary = (
  accessToken: string,
  relationshipId: string,
  request: SaveAccountSummary,
) =>
  sendJson(
    'PUT',
    `/kunden/${relationshipId}/eigene-sicht/zusammenfassung`,
    request,
    accountPlanSchema,
    accessToken,
  );

export const saveAccountView = (
  accessToken: string,
  relationshipId: string,
  request: SaveAccountView,
) =>
  sendJson(
    'PUT',
    `/kunden/${relationshipId}/eigene-sicht/sicht`,
    request,
    accountPlanSchema,
    accessToken,
  );

export const saveAccountObjective = (
  accessToken: string,
  relationshipId: string,
  objectiveId: string | null,
  request: SaveAccountObjective | null,
) =>
  sendJson(
    request === null ? 'DELETE' : objectiveId ? 'PUT' : 'POST',
    `/kunden/${relationshipId}/eigene-sicht/ziele${objectiveId ? `/${objectiveId}` : ''}`,
    request ?? {},
    accountPlanSchema,
    accessToken,
  );

/** PUL-02b: Beantworten ohne Anmeldung; der Token im Link ist der einzige Schlüssel. */
export const publicSurveyQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['umfrage', token],
    queryFn: () => getJson(`/umfrage/${encodeURIComponent(token)}`, publicSurveySchema),
    retry: retryUnlessDenied,
  });

export async function submitSurvey(token: string, request: SubmitSurvey) {
  const path = `/umfrage/${encodeURIComponent(token)}`;
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, body);
  }
  return publicSurveySchema.parse(await res.json());
}

/** PUL-02a: Feedback-Wellen; Käufer unter /suppliers, Lieferant unter /kunden. */
export const feedbackBase = (side: SurveySide, relationshipId: string) =>
  `/${side === 'buyer' ? 'suppliers' : 'kunden'}/${relationshipId}/feedback`;

export const surveyWavesQueryOptions = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
) =>
  queryOptions({
    queryKey: ['feedback', side, relationshipId],
    queryFn: () => getJson(feedbackBase(side, relationshipId), surveyWavesSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const surveyWaveQueryOptions = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
  waveId: string,
) =>
  queryOptions({
    queryKey: ['feedback', side, relationshipId, waveId],
    queryFn: () =>
      getJson(
        `${feedbackBase(side, relationshipId)}/${waveId}`,
        surveyWaveDetailSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const surveySuggestionsQueryOptions = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
) =>
  queryOptions({
    queryKey: ['feedback', side, relationshipId, 'vorschlaege'],
    queryFn: () =>
      getJson(
        `${feedbackBase(side, relationshipId)}/vorschlaege`,
        surveySuggestionsSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const startSurveyWave = (
  accessToken: string,
  relationshipId: string,
  request: StartSurveyWave,
) =>
  sendJson(
    'POST',
    feedbackBase('buyer', relationshipId),
    request,
    surveyWaveDetailSchema,
    accessToken,
  );

export const inviteSurveyParticipants = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
  waveId: string,
  request: InviteSurveyParticipants,
) =>
  sendJson(
    'POST',
    `${feedbackBase(side, relationshipId)}/${waveId}/teilnehmende`,
    request,
    surveyWaveDetailSchema,
    accessToken,
  );

export const extendSurveyWave = (
  accessToken: string,
  relationshipId: string,
  waveId: string,
  dueDate: string,
) =>
  sendJson(
    'PUT',
    `${feedbackBase('buyer', relationshipId)}/${waveId}/frist`,
    { dueDate },
    surveyWaveDetailSchema,
    accessToken,
  );

export const closeSurveyWave = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
  waveId: string,
) =>
  sendJson(
    'POST',
    `${feedbackBase(side, relationshipId)}/${waveId}/abschliessen`,
    {},
    surveyWaveDetailSchema,
    accessToken,
  );

/** JBP-09: Ist-Werte der Kennzahlen, Import und Toleranz „knapp“. */
export const kpiDetailQueryOptions = (accessToken: string, base: MeetingBase, kpiId: string) =>
  queryOptions({
    queryKey: ['jbp', 'scorecard', base, kpiId],
    queryFn: () =>
      getJson(`${base}/jbp/scorecard/kennzahlen/${kpiId}`, kpiDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const enterKpiValue = (
  accessToken: string,
  base: MeetingBase,
  kpiId: string,
  request: SaveKpiValue,
) =>
  sendJson(
    'POST',
    `${base}/jbp/scorecard/kennzahlen/${kpiId}/werte`,
    request,
    kpiDetailSchema,
    accessToken,
  );

/** Datei hochladen: Vorschau oder Übernahme; Fehler kommen als ApiError mit Vorschau im Body. */
export async function uploadKpiValues(
  accessToken: string,
  base: MeetingBase,
  file: File,
  apply: boolean,
) {
  const form = new FormData();
  form.append('file', file);
  const path = `${base}/jbp/scorecard/import${apply ? '' : '/vorschau'}`;
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, body);
  }
  return kpiImportPreviewSchema.parse(await res.json());
}

export const scorecardSettingQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['scorecard-setting'],
    queryFn: () => getJson('/scorecard/settings', scorecardSettingSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveScorecardSetting = (accessToken: string, request: ScorecardSetting) =>
  sendJson('PUT', '/scorecard/settings', request, scorecardSettingSchema, accessToken);

/** PLB-06: Kontaktpunkte; beim Lieferanten nur lesend unter /kunden. */
const touchpointsUrl = (side: TeamSide, relationshipId: string) =>
  side === 'buyer'
    ? `/suppliers/${relationshipId}/kontaktpunkte`
    : `/kunden/${relationshipId}/kontaktpunkte`;

export const touchpointsQueryOptions = (
  accessToken: string,
  relationshipId: string,
  side: TeamSide,
) =>
  queryOptions({
    queryKey: ['kontaktpunkte', side, relationshipId],
    queryFn: () => getJson(touchpointsUrl(side, relationshipId), touchpointListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveTouchpoint = (
  accessToken: string,
  relationshipId: string,
  touchpointId: string | null,
  request: SaveTouchpoint,
) =>
  sendJson(
    touchpointId ? 'PUT' : 'POST',
    `${touchpointsUrl('buyer', relationshipId)}${touchpointId ? `/${touchpointId}` : ''}`,
    request,
    touchpointSchema,
    accessToken,
  );

export const shareTouchpoint = (
  accessToken: string,
  relationshipId: string,
  touchpointId: string,
) =>
  sendJson(
    'POST',
    `${touchpointsUrl('buyer', relationshipId)}/${touchpointId}/teilen`,
    {},
    touchpointSchema,
    accessToken,
  );

export const deleteTouchpoint = (
  accessToken: string,
  relationshipId: string,
  touchpointId: string,
) =>
  sendJson(
    'DELETE',
    `${touchpointsUrl('buyer', relationshipId)}/${touchpointId}`,
    {},
    touchpointListSchema,
    accessToken,
  );

export const reviewTouchpoints = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `${touchpointsUrl('buyer', relationshipId)}/geprueft`,
    {},
    touchpointListSchema,
    accessToken,
  );

/** QBR-04: Erinnerungstage für Maßnahmen, je Organisation (beide Seiten). */
export const actionReminderSettingQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['action-reminder-setting'],
    queryFn: () => getJson('/massnahmen/einstellungen', actionReminderSettingSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveActionReminderSetting = (accessToken: string, request: ActionReminderSetting) =>
  sendJson('PUT', '/massnahmen/einstellungen', request, actionReminderSettingSchema, accessToken);

/** JBP-06: Freigabe und Versionen des Gemeinsamen Plans. */
export const jbpApprovalQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', 'approval', base],
    queryFn: () => getJson(`${base}/jbp/freigabe`, jbpApprovalViewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const submitJbp = (accessToken: string, base: MeetingBase) =>
  sendJson('POST', `${base}/jbp/freigabe/einreichen`, {}, jbpApprovalViewSchema, accessToken);

export const decideJbp = (accessToken: string, base: MeetingBase, request: DecideJbp) =>
  sendJson('POST', `${base}/jbp/freigabe/entscheiden`, request, jbpApprovalViewSchema, accessToken);

export const startJbpVersion = (accessToken: string, base: MeetingBase) =>
  sendJson('POST', `${base}/jbp/freigabe/neue-version`, {}, jbpApprovalViewSchema, accessToken);

export const jbpVersionsQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', 'versions', base],
    queryFn: () => getJson(`${base}/jbp/versionen`, jbpVersionsSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** JBP-05: Zusagen beider Seiten, je Seite unter ihrer Basis. */
export const commitmentsQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['jbp', 'commitments', base],
    queryFn: () => getJson(`${base}/jbp/zusagen`, commitmentsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createCommitment = (accessToken: string, base: MeetingBase, request: SaveCommitment) =>
  sendJson('POST', `${base}/jbp/zusagen`, request, commitmentsSchema, accessToken);

export const updateCommitment = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  request: SaveCommitment,
) => sendJson('PUT', `${base}/jbp/zusagen/${id}`, request, commitmentsSchema, accessToken);

export const setCommitmentStatus = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  status: CommitmentStatus,
) =>
  sendJson('PUT', `${base}/jbp/zusagen/${id}/status`, { status }, commitmentsSchema, accessToken);

/** QBR-03: Maßnahmen einer Beziehung, je Seite unter ihrer Basis (wie Termine). */
export const actionListQueryOptions = (accessToken: string, base: MeetingBase) =>
  queryOptions({
    queryKey: ['actions', base],
    queryFn: () => getJson(`${base}/massnahmen`, actionListSchema, accessToken),
  });

export const myActionsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['actions', 'mine'],
    queryFn: () => getJson('/start/massnahmen', myActionsSchema, accessToken),
  });

export const createAction = (accessToken: string, base: MeetingBase, request: CreateAction) =>
  sendJson('POST', `${base}/massnahmen`, request, actionItemSchema, accessToken);

export const updateAction = (
  accessToken: string,
  base: MeetingBase,
  actionId: string,
  request: SaveAction,
) => sendJson('PUT', `${base}/massnahmen/${actionId}`, request, actionItemSchema, accessToken);

export const setActionStatus = (
  accessToken: string,
  base: MeetingBase,
  actionId: string,
  status: ActionStatus,
) =>
  sendJson(
    'PUT',
    `${base}/massnahmen/${actionId}/status`,
    { status },
    actionItemSchema,
    accessToken,
  );

/** QBR-01b: Termin abschließen und den Stand einfrieren. */
export const closeMeeting = (accessToken: string, base: MeetingBase, meetingId: string) =>
  sendJson(
    'POST',
    `${base}/termine/${meetingId}/abschliessen`,
    {},
    meetingDetailSchema,
    accessToken,
  );

export const saveMeetingNote = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
  request: SaveMeetingNote,
) =>
  sendJson('PUT', `${base}/termine/${meetingId}/notiz`, request, meetingDetailSchema, accessToken);
