import {
  type AcceptInvitationRequest,
  type AcceptPreRead,
  type ActionReminderSetting,
  type ActivityFeed,
  type ActivityFilter,
  type AddAssignment,
  type AddinRegister,
  type AdoptOpportunity,
  type AiMode,
  type AiSettings,
  type AnalysisStep,
  type ApprovalSettings,
  type AssignmentRequest,
  type AwardEligibility,
  type AwardRequest,
  acceptInvitationResponseSchema,
  accountPlanSchema,
  actionItemSchema,
  actionListSchema,
  actionReminderSettingSchema,
  activityFeedSchema,
  addinDetectSchema,
  addinRegisteredSchema,
  adoptOpportunitySchema,
  agentRunDetailSchema,
  agentsResponseSchema,
  aiSettingsResponseSchema,
  aiUsageSchema,
  akteCounterpartSchema,
  akteHeadSchema,
  akteSharedSchema,
  analysisStepSchema,
  apiKeysSchema,
  approvalSettingsViewSchema,
  approvalViewSchema,
  assignmentResponseSchema,
  auditResponseSchema,
  awardEligibilitySchema,
  awardPlanSchema,
  type BriefSettings,
  bridgeSchema,
  briefSettingsSchema,
  businessUnitsResponseSchema,
  type CandidateRequest,
  type CategoryLabel,
  type CategorySegmentation,
  type ChangeAssumptions,
  type ColumnMap,
  type CommentObjectType,
  type CommitmentEvidence,
  type CommitmentStatus,
  type ConsolidateRequest,
  type ContributionObjectiveRequest,
  type CreateAction,
  type CreateApiKey,
  type CreateJbp,
  type CreateMeeting,
  type CreateRound,
  type CreateSupplierRequest,
  type CustomLeverRequest,
  type CycleStatusQuery,
  categoryLabelSchema,
  categoryReviewSchema,
  categoryScorecardSchema,
  categorySegmentationSchema,
  commentListSchema,
  commitmentsSchema,
  contributionDetailSchema,
  contributionSuggestionsResponseSchema,
  createdApiKeySchema,
  createSupplierResponseSchema,
  customerImpactSchema,
  customerListSchema,
  customerRuleSetSchema,
  customersResponseSchema,
  customerWorkspaceSchema,
  cycleArchiveSchema,
  cycleSchema,
  cycleSettingsResponseSchema,
  cycleStatusSchema,
  type DecideCategorySegment,
  type DecideImportRows,
  type DecideJbp,
  type DecideValidation,
  type DemoSignalKey,
  type DemoTimeRequest,
  type DismissHint,
  dataExportListSchema,
  decisionHistorySchema,
  demoRegieSchema,
  demoSessionSchema,
  demoSignalResultSchema,
  deviationExplanationsSchema,
  doneListSchema,
  dueListSchema,
  type EbitGoalRequest,
  type EditBriefAgenda,
  type EditCaptureItem,
  type EditComment,
  type ExtendRound,
  type FileMailRequest,
  type FiscalYearSetting,
  type ForbiddenCode,
  type FreezeBaseline,
  feedbackThemesSchema,
  filedMailBodySchema,
  fileMailResultSchema,
  financialImportResultSchema,
  fiscalYearSettingSchema,
  focusDetailSchema,
  focusListSchema,
  focusMapSchema,
  forbiddenCodes,
  type GoalRequest,
  type HintRuleSettings,
  type HintSettings,
  healthResponseSchema,
  hintListSchema,
  hintRuleSettingsSchema,
  hintSchema,
  hintSettingsSchema,
  type ImpactView,
  type ImportBatchKind,
  type ImportJbpTopics,
  type ImportPreview,
  type ImportResult,
  type ImportType,
  type InitiativeRequest,
  type InitiativeStatus,
  type InviteSupplierRequest,
  type InviteSurveyParticipants,
  impactDetailSchema,
  impactImportPreviewSchema,
  impactListSchema,
  importBatchListSchema,
  importBatchSchema,
  importPreviewSchema,
  importResultSchema,
  initiativeDetailSchema,
  initiativesSchema,
  integrationsSchema,
  invitationListSchema,
  jbpApprovalViewSchema,
  jbpPreparationSchema,
  jbpTopicCandidatesSchema,
  jbpTopicsSchema,
  jbpVersionsSchema,
  type KpiRequest,
  kpiDetailSchema,
  kpiImportPreviewSchema,
  kpiListSchema,
  type LeverChoiceRequest,
  type MailDetectRequest,
  type MarketAnalysis,
  type MaterialGroupRequest,
  type MergeMaterialGroup,
  type MilestoneRequest,
  marketAnalysisSchema,
  materialGroupDetailSchema,
  materialGroupImportPreviewSchema,
  materialGroupImportResultSchema,
  materialGroupOverviewSchema,
  materialGroupsResponseSchema,
  meetingBriefSchema,
  meetingCaptureSchema,
  meetingDetailSchema,
  meetingListSchema,
  meetingTranscriptStateSchema,
  meResponseSchema,
  myActionsSchema,
  myAgentSchema,
  myAgentTaskSchema,
  myConnectionsSchema,
  myDaySchema,
  myFeedbackSchema,
  type NotePatch,
  type NoteRequest,
  needsYouSchema,
  nextActionSchema,
  nextCyclePreviewSchema,
  notificationPrefsSchema,
  type ObjectiveCategoryRequest,
  objectiveCategoriesResponseSchema,
  objectiveCategoryRequestSchema,
  organizationMemberSchema,
  organizationResponseSchema,
  overviewInsightSchema,
  type PlanDecision,
  type PlanObjectiveRequest,
  type ProductGroupRequest,
  type PromptEvent,
  type PromptRequest,
  permissionsResponseSchema,
  planSummaryDraftSchema,
  planVersionsSchema,
  playbookCatalogSchema,
  playbookPreviewSchema,
  pnlLinesSchema,
  portfolioImpactSchema,
  portfolioMatrixSchema,
  portfolioOpenSchema,
  portfolioSchema,
  preReadDraftSchema,
  promptEventSchema,
  publicInvitationSchema,
  publicSurveySchema,
  questionListSchema,
  type RaiseMaturity,
  type RelevanceOverride,
  type RequestContributions,
  type RequestValidation,
  type ResolveConflict,
  type ReviewDecision,
  ratingAssignmentListSchema,
  ratingDetailSchema,
  relationshipSegmentsSchema,
  relationshipsResponseSchema,
  reviewResultSchema,
  reviewStackSchema,
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
  type SaveCapture,
  type SaveComment,
  type SaveCommitment,
  type SaveFinancial,
  type SaveFormatItem,
  type SaveImpactMonth,
  type SaveInitiative,
  type SaveJbpTopic,
  type SaveKpi,
  type SaveKpiValue,
  type SaveMarketForce,
  type SaveMeetingNote,
  type SaveMilestone,
  type SaveNote,
  type SaveNotificationOrg,
  type SaveNotificationPrefs,
  type SavePnlLine,
  type SaveProtocol,
  type SaveRating,
  type SaveRoleDescription,
  type SaveRuleItem,
  type SaveRuleSet,
  type SaveShare,
  type SaveSpendEntry,
  type SaveSso,
  type SaveSurveyQuestion,
  type SaveTouchpoint,
  type SaveTranscriptSettings,
  type SavingsReference,
  type ScorecardSetting,
  type SendDataRequest,
  type SetFocusRequest,
  type SetRoundSuppliers,
  type SetupImpact,
  type SpendRequest,
  type SplitMaterialGroup,
  type StartAgent,
  type StartCategoryRound,
  type StartNextCycle,
  type StartSurveyWave,
  type StrategicTopicOrder,
  type StrategicTopicRequest,
  type StrategyAssessment,
  type SubmitSurvey,
  type SummaryRequest,
  type SupplierMapUpdate,
  type SupplierTargetRequest,
  type SurveyKind,
  type SurveySide,
  type SwotRequest,
  scorecardSettingSchema,
  scorecardViewSchema,
  searchResultsSchema,
  securedResultsSchema,
  segmentationSchema,
  segmentModelResponseSchema,
  setAiModeSchema,
  snoozeResultSchema,
  spendOverviewSchema,
  ssoHintSchema,
  ssoOverviewSchema,
  startSchema,
  strategyAssessmentSchema,
  strategyContextResponseSchema,
  strategyLeverSchema,
  strategyOverviewSchema,
  strategyStepSchema,
  supplierCategoriesSchema,
  supplierContactSchema,
  supplierDetailSchema,
  supplierLookupResponseSchema,
  supplierMapSchema,
  supplierOverviewSchema,
  supplierPlanResponseSchema,
  supplierProfileSchema,
  supplierRingsSchema,
  suppliersResponseSchema,
  supportHeader,
  surveyDetailSchema,
  surveySuggestionsSchema,
  surveysSchema,
  surveyWaveDetailSchema,
  surveyWavesSchema,
  type TeamRequest,
  teamResponseSchema,
  timelineSchema,
  todayAllSchema,
  todayPageSchema,
  touchpointListSchema,
  touchpointSchema,
  transcriptSettingsSchema,
  transcriptTextSchema,
  type UpdateAssignment,
  type UpdateCycleSettings,
  type UpdateMeeting,
  type UpdateMemberRequest,
  type UpdateObjectiveCategory,
  type UpdatePlanSummary,
  type UpdateSegmentBoundaries,
  type UpdateSegmentCriterion,
  type UpdateSegmentGrid,
  type UpdateSegmentType,
  type UpdateSegmentWeights,
  type UpdateSupplierRequest,
  type UpdateTeamRequest,
  type UserLocale,
  undoResultSchema,
  validationDetailSchema,
  validationListSchema,
  valueOpportunitiesSchema,
  valueOverviewSchema,
  type WorkerLevel,
  type WorkItemStatus,
  whyViewSchema,
} from '@reziproq/shared';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { noteBusinessTime } from './clock';
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
  noteBusinessTime(res.headers);
  if (!res.ok) {
    if (res.status !== 403) throw new ApiError(path, res.status);
    // Bei 403 die Antwort mitgeben, damit die Oberfläche den Grund zeigt (z. B. IN-02 nur_sso)
    const answer: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    throw new ApiError(path, res.status, await forbiddenCode(res), answer);
  }
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

/** E-K0-33 (K2-b.1): Raster 2 × 2 oder 3 × 3 und Namen der Achsen des Entwurfs */
export const updateSegmentGrid = (accessToken: string, request: UpdateSegmentGrid) =>
  sendJson('PATCH', '/segment-model/draft/grid', request, segmentModelResponseSchema, accessToken);

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
export async function saveStartPage(
  accessToken: string,
  startPage: 'overview' | 'my_day' | null,
): Promise<void> {
  const path = '/me/startseite';
  const res = await fetch(`/api${path}`, {
    method: 'PUT',
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ startPage }),
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
  noteBusinessTime(res.headers);
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
/** Geschäftliche Kontakte des Lieferanten (PLT-07b), für „Profil und Spend“ */
export const supplierContactsQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'kontakte'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/contacts`, z.array(supplierContactSchema), accessToken),
    retry: retryUnlessDenied,
  });

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

// WG-01: Warengruppen mit Team, Produktgruppen, Import, Zusammenlegen, Teilen und Bezeichnung
export const materialGroupOverviewQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen'],
    queryFn: () => getJson('/warengruppen', materialGroupOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const materialGroupDetailQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['warengruppen', id],
    queryFn: () => getJson(`/warengruppen/${id}`, materialGroupDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveMaterialGroupTeam = (accessToken: string, id: string, request: TeamRequest) =>
  sendJson('PUT', `/warengruppen/${id}/team`, request, materialGroupDetailSchema, accessToken);

export const createProductGroup = (accessToken: string, id: string, request: ProductGroupRequest) =>
  sendJson(
    'POST',
    `/warengruppen/${id}/produktgruppen`,
    request,
    materialGroupDetailSchema,
    accessToken,
  );

export const updateProductGroup = (
  accessToken: string,
  id: string,
  productGroupId: string,
  request: ProductGroupRequest,
) =>
  sendJson(
    'PATCH',
    `/warengruppen/${id}/produktgruppen/${productGroupId}`,
    request,
    materialGroupDetailSchema,
    accessToken,
  );

export const deleteProductGroup = (accessToken: string, id: string, productGroupId: string) =>
  sendJson(
    'DELETE',
    `/warengruppen/${id}/produktgruppen/${productGroupId}`,
    undefined,
    materialGroupDetailSchema,
    accessToken,
  );

export const categoryLabelQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'bezeichnung'],
    queryFn: () => getJson('/warengruppen/bezeichnung', categoryLabelSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveCategoryLabel = (accessToken: string, request: CategoryLabel) =>
  sendJson('PUT', '/warengruppen/bezeichnung', request, categoryLabelSchema, accessToken);

export const mergeMaterialGroup = (accessToken: string, id: string, request: MergeMaterialGroup) =>
  sendJson(
    'POST',
    `/warengruppen/${id}/zusammenlegen`,
    request,
    materialGroupDetailSchema,
    accessToken,
  );

export const splitMaterialGroup = (accessToken: string, id: string, request: SplitMaterialGroup) =>
  sendJson('POST', `/warengruppen/${id}/teilen`, request, materialGroupDetailSchema, accessToken);

// WG-04, WG-06: Warengruppenstrategie
export const strategyOverviewQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien'],
    queryFn: () => getJson('/warengruppen/strategien', strategyOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const strategyContextQueryOptions = (accessToken: string, groupId: string) =>
  queryOptions({
    queryKey: ['warengruppen', groupId, 'strategie'],
    queryFn: () =>
      getJson(`/warengruppen/${groupId}/strategie`, strategyContextResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createStrategy = (accessToken: string, groupId: string, year: number) =>
  sendJson(
    'POST',
    `/warengruppen/${groupId}/strategie`,
    { year },
    strategyContextResponseSchema,
    accessToken,
  );

export const strategyStepQueryOptions = (accessToken: string, strategyId: string, step: number) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, step],
    queryFn: () =>
      getJson(
        `/warengruppen/strategien/${strategyId}/schritte/${step}`,
        strategyStepSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** AW-01: Beleg der Übersicht und Ringpaar des Lieferanten */
export const overviewInsightQueryOptions = (accessToken: string, year?: number) =>
  queryOptions({
    queryKey: ['uebersicht', year ?? 'aktuell'],
    queryFn: () =>
      getJson(`/uebersicht${year ? `?jahr=${year}` : ''}`, overviewInsightSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** AW-01 Ergebnisse · Gesichert: Brücke nur aus vom Controlling bestätigten Werten */
export const securedResultsQueryOptions = (
  accessToken: string,
  relationshipId: string,
  year?: number,
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'gesichert', year ?? null],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/ergebnisse/gesichert${year ? `?jahr=${year}` : ''}`,
        securedResultsSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const supplierRingsQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'ringe'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/ergebnisse/ringe`, supplierRingsSchema, accessToken),
    retry: retryUnlessDenied,
  });

const sendNoContent = async (
  accessToken: string,
  method: 'PUT' | 'POST' | 'DELETE',
  path: string,
  body: unknown,
) => {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const answer: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, answer);
  }
};

export const saveEbitGoal = (accessToken: string, request: EbitGoalRequest) =>
  sendNoContent(accessToken, 'PUT', '/uebersicht/ziel', request);
export const proposeSupplierTarget = (
  accessToken: string,
  relationshipId: string,
  request: SupplierTargetRequest,
) => sendNoContent(accessToken, 'PUT', `/suppliers/${relationshipId}/ergebnisse/ziel`, request);
export const approveSupplierTarget = (accessToken: string, relationshipId: string, year: number) =>
  sendNoContent(accessToken, 'POST', `/suppliers/${relationshipId}/ergebnisse/ziel/freigeben`, {
    year,
  });

/** NAV-10: Aktivitäten eines Lieferanten und Notizen */
export const activitiesQueryOptions = (
  accessToken: string,
  relationshipId: string,
  filter?: ActivityFilter,
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'aktivitaeten', filter ?? 'alles'],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/aktivitaeten${filter ? `?filter=${filter}` : ''}`,
        activityFeedSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const addNote = (
  accessToken: string,
  relationshipId: string,
  request: NoteRequest,
): Promise<ActivityFeed> =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/notizen`,
    request,
    activityFeedSchema,
    accessToken,
  );

export const updateNote = (
  accessToken: string,
  relationshipId: string,
  noteId: string,
  change: NotePatch,
): Promise<ActivityFeed> =>
  sendJson(
    'PATCH',
    `/suppliers/${relationshipId}/notizen/${noteId}`,
    change,
    activityFeedSchema,
    accessToken,
  );

export const removeNote = (
  accessToken: string,
  relationshipId: string,
  noteId: string,
): Promise<ActivityFeed> =>
  sendJson(
    'DELETE',
    `/suppliers/${relationshipId}/notizen/${noteId}`,
    undefined,
    activityFeedSchema,
    accessToken,
  );

/** WG-10: Bewertung und Hebel in Schritt 6 */
export const assessmentQueryOptions = (accessToken: string, strategyId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, 'bewertung'],
    queryFn: () =>
      getJson(
        `/warengruppen/strategien/${strategyId}/bewertung`,
        strategyAssessmentSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

const assessmentCall = (
  accessToken: string,
  strategyId: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<StrategyAssessment> =>
  sendJson(
    method,
    `/warengruppen/strategien/${strategyId}${path}`,
    body,
    strategyAssessmentSchema,
    accessToken,
  );

export const addSwotItem = (accessToken: string, strategyId: string, request: SwotRequest) =>
  assessmentCall(accessToken, strategyId, 'POST', '/profil', request);
export const updateSwotItem = (
  accessToken: string,
  strategyId: string,
  itemId: string,
  change: { text?: string; confirm?: boolean },
) => assessmentCall(accessToken, strategyId, 'PATCH', `/profil/${itemId}`, change);
export const removeSwotItem = (accessToken: string, strategyId: string, itemId: string) =>
  assessmentCall(accessToken, strategyId, 'DELETE', `/profil/${itemId}`);
export const saveLeverChoice = (
  accessToken: string,
  strategyId: string,
  request: LeverChoiceRequest,
  choiceId?: string,
) =>
  choiceId
    ? assessmentCall(accessToken, strategyId, 'PATCH', `/paarungen/${choiceId}`, request)
    : assessmentCall(accessToken, strategyId, 'POST', '/paarungen', request);
export const removeLeverChoice = (accessToken: string, strategyId: string, choiceId: string) =>
  assessmentCall(accessToken, strategyId, 'DELETE', `/paarungen/${choiceId}`);
export const addCustomLever = (accessToken: string, request: CustomLeverRequest) =>
  sendJson('POST', '/warengruppen/hebel', request, strategyLeverSchema, accessToken);

/** WG-10 (Schritt 26): Hebelkatalog pflegen (Admins) */
export const leverCatalogQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'hebel'],
    queryFn: () =>
      getJson(
        '/warengruppen/hebel',
        z.object({ levers: z.array(strategyLeverSchema) }),
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const updateLever = (
  accessToken: string,
  id: string,
  change: { name?: string; description?: string; dimensions?: string[]; active?: boolean },
) => sendJson('PATCH', `/warengruppen/hebel/${id}`, change, strategyLeverSchema, accessToken);

/** WG-09: Marktanalyse in Schritt 5 */
export const marketQueryOptions = (accessToken: string, strategyId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, 'markt'],
    queryFn: () =>
      getJson(`/warengruppen/strategien/${strategyId}/markt`, marketAnalysisSchema, accessToken),
    retry: retryUnlessDenied,
  });

const marketPost = (accessToken: string, strategyId: string, path: string, body?: unknown) =>
  sendJson(
    body === undefined ? 'POST' : 'PUT',
    `/warengruppen/strategien/${strategyId}/markt${path}`,
    body,
    marketAnalysisSchema,
    accessToken,
  );

export const requestMarketDraft = (
  accessToken: string,
  strategyId: string,
): Promise<MarketAnalysis> => marketPost(accessToken, strategyId, '/entwurf');
export const confirmMarketForce = (accessToken: string, strategyId: string, force: string) =>
  marketPost(accessToken, strategyId, `/${force}/bestaetigen`);
export const saveMarketForce = (
  accessToken: string,
  strategyId: string,
  force: string,
  request: SaveMarketForce,
) => marketPost(accessToken, strategyId, `/${force}`, request);
export const decideMarketProposal = (
  accessToken: string,
  strategyId: string,
  force: string,
  adopt: boolean,
) =>
  marketPost(accessToken, strategyId, `/${force}/vorschlag/${adopt ? 'uebernehmen' : 'verwerfen'}`);
export const decideMarketSynthesis = (
  accessToken: string,
  strategyId: string,
  draftId: string,
  adopt: boolean,
) =>
  marketPost(
    accessToken,
    strategyId,
    `/zusammenschau/${draftId}/${adopt ? 'uebernehmen' : 'verwerfen'}`,
  );

/** WG-07: Analysen der Schritte 3 und 4 */
export const analysisStepQueryOptions = (accessToken: string, strategyId: string, step: number) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, step, 'analysen'],
    queryFn: () =>
      getJson(
        `/warengruppen/strategien/${strategyId}/schritte/${step}/analysen`,
        analysisStepSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** WG-07 (Schritt 24): Sicht Personen mit Funktion zuweisen; Kommentar zu einer Sicht */
export const assignAnalysisView = (
  accessToken: string,
  strategyId: string,
  view: string,
  userIds: string[],
): Promise<AnalysisStep> =>
  sendJson(
    'PUT',
    `/warengruppen/strategien/${strategyId}/analysen/${view}/zuweisung`,
    { userIds },
    analysisStepSchema,
    accessToken,
  );

export const commentAnalysisView = (
  accessToken: string,
  strategyId: string,
  view: string,
  body: string,
): Promise<AnalysisStep> =>
  sendJson(
    'POST',
    `/warengruppen/strategien/${strategyId}/analysen/${view}/kommentare`,
    { body },
    analysisStepSchema,
    accessToken,
  );

export const saveAnalysis = (
  accessToken: string,
  strategyId: string,
  view: string,
  data: unknown,
): Promise<AnalysisStep> =>
  sendJson(
    'PUT',
    `/warengruppen/strategien/${strategyId}/analysen/${view}`,
    { data },
    analysisStepSchema,
    accessToken,
  );

export const addCandidate = (
  accessToken: string,
  strategyId: string,
  request: CandidateRequest,
): Promise<AnalysisStep> =>
  sendJson(
    'POST',
    `/warengruppen/strategien/${strategyId}/kandidaten`,
    request,
    analysisStepSchema,
    accessToken,
  );

export const removeCandidate = (
  accessToken: string,
  strategyId: string,
  id: string,
): Promise<AnalysisStep> =>
  sendJson(
    'DELETE',
    `/warengruppen/strategien/${strategyId}/kandidaten/${id}`,
    undefined,
    analysisStepSchema,
    accessToken,
  );

export const candidateToSupplier = (accessToken: string, strategyId: string, id: string) =>
  sendJson(
    'POST',
    `/warengruppen/strategien/${strategyId}/kandidaten/${id}/lieferant`,
    undefined,
    z.object({ relationshipId: z.string(), step: analysisStepSchema }),
    accessToken,
  );

/** WG-18: Segmentierung je Warengruppe */
export const categorySegmentationQueryOptions = (accessToken: string, groupId: string) =>
  queryOptions({
    queryKey: ['warengruppen', groupId, 'segmentierung'],
    queryFn: () =>
      getJson(`/warengruppen/${groupId}/segmentierung`, categorySegmentationSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const startCategoryRound = (
  accessToken: string,
  groupId: string,
  request: StartCategoryRound,
): Promise<CategorySegmentation> =>
  sendJson(
    'POST',
    `/warengruppen/${groupId}/runden`,
    request,
    categorySegmentationSchema,
    accessToken,
  );

export const decideCategorySegment = (
  accessToken: string,
  groupId: string,
  relationshipId: string,
  request: DecideCategorySegment,
): Promise<CategorySegmentation> =>
  sendJson(
    'POST',
    `/warengruppen/${groupId}/segmente/${relationshipId}`,
    request,
    categorySegmentationSchema,
    accessToken,
  );

export const saveStrategyNote = (
  accessToken: string,
  strategyId: string,
  step: number,
  request: SaveNote,
) =>
  sendJson(
    'PUT',
    `/warengruppen/strategien/${strategyId}/schritte/${step}/notiz`,
    request,
    strategyStepSchema,
    accessToken,
  );

export const addStrategyMilestone = (
  accessToken: string,
  strategyId: string,
  request: MilestoneRequest,
) =>
  sendJson(
    'POST',
    `/warengruppen/strategien/${strategyId}/meilensteine`,
    request,
    strategyStepSchema,
    accessToken,
  );

export const removeStrategyMilestone = (
  accessToken: string,
  strategyId: string,
  milestoneId: string,
) =>
  sendJson(
    'DELETE',
    `/warengruppen/strategien/${strategyId}/meilensteine/${milestoneId}`,
    undefined,
    strategyStepSchema,
    accessToken,
  );

export const saveStrategyGoal = (
  accessToken: string,
  strategyId: string,
  request: GoalRequest,
  goalId?: string,
) =>
  sendJson(
    goalId ? 'PATCH' : 'POST',
    `/warengruppen/strategien/${strategyId}/ziele${goalId ? `/${goalId}` : ''}`,
    request,
    strategyStepSchema,
    accessToken,
  );

export const removeStrategyGoal = (accessToken: string, strategyId: string, goalId: string) =>
  sendJson(
    'DELETE',
    `/warengruppen/strategien/${strategyId}/ziele/${goalId}`,
    undefined,
    strategyStepSchema,
    accessToken,
  );

export const kpiListQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'kennzahlen'],
    queryFn: () => getJson('/warengruppen/kennzahlen', kpiListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveKpi = (accessToken: string, request: KpiRequest, kpiId?: string) =>
  sendJson(
    kpiId ? 'PATCH' : 'POST',
    `/warengruppen/kennzahlen${kpiId ? `/${kpiId}` : ''}`,
    request,
    kpiListSchema,
    accessToken,
  );

export const questionListQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'leitfragen'],
    queryFn: () => getJson('/warengruppen/leitfragen', questionListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveQuestion = (accessToken: string, questionId: string, text: string) =>
  sendJson(
    'PATCH',
    `/warengruppen/leitfragen/${questionId}`,
    { text },
    questionListSchema,
    accessToken,
  );

/** Import der Warengruppen: Vorschau oder Übernahme; bei Fehlern übernimmt der Server nichts. */
export async function uploadMaterialGroups(accessToken: string, file: File, apply: boolean) {
  const form = new FormData();
  form.append('file', file);
  const path = apply ? '/warengruppen/import' : '/warengruppen/import/vorschau';
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const answer: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(path, res.status, undefined, answer);
  return answer;
}

export const parseMaterialGroupPreview = (answer: unknown) =>
  materialGroupImportPreviewSchema.parse(answer);
export const parseMaterialGroupImport = (answer: unknown) =>
  materialGroupImportResultSchema.parse(answer);

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

// SPL-10: KI-Entwurf der Strategie-Zusammenfassung
export const planSummaryDraftQueryOptions = (
  accessToken: string,
  relationshipId: string,
  planId: string,
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'supplier-plan', planId, 'summary-draft'],
    queryFn: () =>
      getJson(
        `/suppliers/${relationshipId}/plan/${planId}/summary/draft`,
        planSummaryDraftSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const proposePlanSummary = (accessToken: string, relationshipId: string, planId: string) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/summary/draft`,
    {},
    planSummaryDraftSchema,
    accessToken,
  );

export const decidePlanSummaryDraft = (
  accessToken: string,
  relationshipId: string,
  planId: string,
  draftId: string,
  decision: 'accept' | 'discard',
  input: { content?: string; reason?: string } = {},
) =>
  sendJson(
    'POST',
    `/suppliers/${relationshipId}/plan/${planId}/summary/draft/${draftId}/${decision}`,
    input,
    planSummaryDraftSchema,
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
  context?: PromptRequest['context'],
): Promise<void> {
  const res = await fetch('/api/prompt', {
    method: 'POST',
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(context ? { messages, context } : { messages }),
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

// SEG-11: KI erklärt die größten Abweichungen
export const deviationExplanationsQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['ratings', 'explanations', relationshipId],
    queryFn: () =>
      getJson(
        `/ratings/relationship/${relationshipId}/segmentation/explanations`,
        deviationExplanationsSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const explainDeviations = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `/ratings/relationship/${relationshipId}/segmentation/explanations`,
    {},
    deviationExplanationsSchema,
    accessToken,
  );

export const decideExplanation = (
  accessToken: string,
  relationshipId: string,
  draftId: string,
  decision: 'accept' | 'discard',
  input: { content?: string; reason?: string } = {},
) =>
  sendJson(
    'POST',
    `/ratings/relationship/${relationshipId}/segmentation/explanations/${draftId}/${decision}`,
    input,
    deviationExplanationsSchema,
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

// HE-01, NAV-10 2.0: Heute aus der Triage; die Seitenleiste liest daraus die Zahl an Heute und die
// Zeile „Im Hintergrund“. Seite und Seitenleiste teilen sich die Abfrage (K1-e).
export const todayQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['heute'],
    queryFn: () => getJson('/heute', todayPageSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** HE-01 Ansicht Alles: alles Offene der Person in Gruppen (K1-e) */
export const todayAllQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['heute', 'alles'],
    queryFn: () => getJson('/heute/alles', todayAllSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** „Morgen erinnern“: Fokus-Thema bis zum nächsten Tag 07:00 zurückstellen (HE-01 Dienst 4) */
export const snoozeTopic = (accessToken: string, id: string) =>
  sendJson('POST', `/heute/${id}/morgen`, {}, snoozeResultSchema, accessToken);

/** HE-01 Kurz prüfen (K1-e.2): der Stapel der Entwürfe */
/**
 * HE-01 Kurz prüfen; `entwurf` nimmt einen Vorschlag zum Zuordnen dazu, der nicht im Stapel liegt
 * (Aufgabe Postfach auf Vorschlagen, MA-01)
 */
export const reviewStackQueryOptions = (accessToken: string, entwurf?: string) =>
  queryOptions({
    queryKey: ['heute', 'kurz-pruefen', entwurf ?? null],
    queryFn: () =>
      getJson(
        entwurf ? `/kurz-pruefen?entwurf=${encodeURIComponent(entwurf)}` : '/kurz-pruefen',
        reviewStackSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** HE-01 Warum (K1-e.4): Herleitung zu einem Fokus-Thema, Hinweis oder Lauf */
export const whyQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['heute', 'warum', id],
    queryFn: () => getJson(`/warum/${id}`, whyViewSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** HE-01 Fokus-Mappe (K1-e.4): ein Fokus-Thema als Entscheidung */
export const focusMapQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['heute', 'mappe', id],
    queryFn: () => getJson(`/mappe/${id}`, focusMapSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** HE-01 Erledigt im Hintergrund (K1-e.3): Läufe von Reziproq für die Person */
export const doneQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['heute', 'erledigt'],
    queryFn: () => getJson('/erledigt', doneListSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Zurücknehmen bis 30 Tage, solange das Objekt unverändert ist */
export const undoDone = (accessToken: string, id: string) =>
  sendJson('POST', `/erledigt/${id}/zuruecknehmen`, {}, undoResultSchema, accessToken);

/** DM-01, E-K0-05 (K1-b.2): Demo-Sitzung für eine Person des Demo-Mandanten, ohne Anmeldung */
export async function startDemoSession(userId: string) {
  const res = await fetch('/api/demo/sitzung', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  // K1-b.5: Die Fachzeit kommt gleich mit, damit schon das erste Bild nach der Demo-Uhr rechnet
  noteBusinessTime(res.headers);
  if (!res.ok) throw new ApiError('/demo/sitzung', res.status);
  return demoSessionSchema.parse(await res.json());
}

/** DM-01 (K1-g.4): Demo-Regie, nur im Demo-Mandanten (sonst 404) */
export const demoRegieQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['demo', 'regie'],
    queryFn: () => getJson('/demo/regie', demoRegieSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Demo-Uhr vorwärts: Neuer Tag, eine Stunde weiter oder auf ein Datum springen */
export const advanceDemoClock = (accessToken: string, request: DemoTimeRequest) =>
  sendJson('POST', '/demo/regie/zeit', request, demoRegieSchema, accessToken);

/** Zurücksetzen auf den Stand „start“ (Mo 23.11., 07:30) */
export const resetDemo = (accessToken: string) =>
  sendJson('POST', '/demo/regie/zuruecksetzen', {}, demoRegieSchema, accessToken);

/** Signal einspielen; läuft durch dieselben Dienste wie im Betrieb */
export const playDemoSignal = (accessToken: string, key: DemoSignalKey) =>
  sendJson('POST', '/demo/regie/signal', { key }, demoSignalResultSchema, accessToken);

/** Antworten der KI für alle Organisationen der Demo */
export const setDemoMode = (accessToken: string, mode: AiMode) =>
  sendJson('PUT', '/demo/regie/modus', { mode }, demoRegieSchema, accessToken);

/** DM-01 (K1-b.1): Modus der Modellantworten im Demo-Mandanten umschalten */
export const setAiMode = (accessToken: string, mode: AiMode) =>
  sendJson('PUT', '/einstellungen/ki/modus', { mode }, setAiModeSchema, accessToken);

/** MA-01 Mein Agent (K1-f): eigene Stufen je Aufgabe, Übernahmequote, Zahlen der Woche */
export const myAgentQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['mein-agent'],
    queryFn: () => getJson('/mein-agent', myAgentSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Eigene Stufe einer Aufgabe; die API lehnt nicht wählbare Stufen ab */
export const setWorkerLevel = (accessToken: string, key: string, level: WorkerLevel) =>
  sendJson(
    'PUT',
    `/mein-agent/${encodeURIComponent(key)}`,
    { level },
    myAgentTaskSchema,
    accessToken,
  );

/** Übernehmen (optional angepasst), Verwerfen mit Grund oder Später */
export const decideReview = (accessToken: string, id: string, decision: ReviewDecision) =>
  sendJson('POST', `/kurz-pruefen/${id}`, decision, reviewResultSchema, accessToken);

export const dueQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['start', 'due'],
    queryFn: () => getJson('/start/due', dueListSchema, accessToken),
    retry: retryUnlessDenied,
  });

// NAV-10 1.1 (UX-20 Phase 2): Mein Tag, Terminschiene, „Als Nächstes“ und „Brauchen dich“
export const myDayQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['start', 'mein-tag'],
    queryFn: () => getJson('/start/mein-tag', myDaySchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Terminschiene; mit `relationshipId` nur die Einträge dieses Lieferanten (NAV-10 1.1) */
export const timelineQueryOptions = (accessToken: string, days = 28, relationshipId?: string) =>
  queryOptions({
    queryKey: ['start', 'termine', days, relationshipId ?? 'alle'],
    queryFn: () =>
      getJson(
        `/start/termine?tage=${days}${relationshipId ? `&beziehung=${relationshipId}` : ''}`,
        timelineSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

const nextActionResponseSchema = z.object({ next: nextActionSchema.nullable() });

/** BZ-01: „Als Nächstes“ der Seite Lieferanten, nur Themen mit Beziehung (scope relationships) */
export const relationshipsNextQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['start', 'als-naechstes', 'beziehungen'],
    queryFn: () =>
      getJson('/start/als-naechstes?bereich=beziehungen', nextActionResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/**
 * BZ-01 (K2-b.4): Linse Liste der Seite Lieferanten; mit `portfolio` auch die Entwürfe (E-K2-10),
 * mit `ended` die beendeten Beziehungen (PLT-03)
 */
export const relationshipsQueryOptions = (
  accessToken: string,
  options: { portfolio?: boolean; ended?: boolean } = {},
) => {
  const query = new URLSearchParams();
  if (options.portfolio) query.set('portfolio', '1');
  if (options.ended) query.set('beendet', '1');
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return queryOptions({
    queryKey: ['beziehungen', 'liste', options.portfolio === true, options.ended === true],
    queryFn: () => getJson(`/beziehungen${suffix}`, relationshipsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });
};

/** BZ-01 (K2-b.5): Linse Segmente der Seite Lieferanten, immer das ganze Portfolio (E-K2-10) */
export const relationshipSegmentsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['beziehungen', 'segmente'],
    queryFn: () => getJson('/beziehungen/segmente', relationshipSegmentsSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** AK-01 (K2-c.2): Kopf der Akte, für alle drei Sichten */
export const akteHeadQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['beziehungen', relationshipId, 'kopf'],
    queryFn: () => getJson(`/beziehungen/${relationshipId}`, akteHeadSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** AK-01 (K2-c.2): Akte, Sicht Gemeinsam */
export const akteSharedQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['beziehungen', relationshipId, 'gemeinsam'],
    queryFn: () =>
      getJson(`/beziehungen/${relationshipId}/gemeinsam`, akteSharedSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** AK-01 (K2-c.4): Akte, Sicht Von <Gegenüber>: was das Gegenüber aktiv geteilt hat */
export const akteCounterpartQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['beziehungen', relationshipId, 'geteilt'],
    queryFn: () =>
      getJson(`/beziehungen/${relationshipId}/geteilt`, akteCounterpartSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** „Als Nächstes“ über alle Bereiche; mit `relationshipId` für einen Lieferanten */
export const nextActionQueryOptions = (accessToken: string, relationshipId?: string) =>
  queryOptions({
    queryKey: ['start', 'als-naechstes', relationshipId ?? 'alle'],
    queryFn: () =>
      getJson(
        relationshipId
          ? `/start/als-naechstes?beziehung=${relationshipId}`
          : '/start/als-naechstes',
        nextActionResponseSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const needsYouQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['start', 'brauchen-dich'],
    queryFn: () => getJson('/start/brauchen-dich', needsYouSchema, accessToken),
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

// QS-05: Suche ohne KI; beim Lieferanten nur im aktuellen Kunden
export const searchQueryOptions = (accessToken: string, q: string, kunde?: string) =>
  queryOptions({
    queryKey: ['suche', q, kunde ?? null],
    queryFn: () =>
      getJson(
        `/suche?${new URLSearchParams({ q, ...(kunde ? { kunde } : {}) })}`,
        searchResultsSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
    staleTime: 30_000,
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

/**
 * QBR-06: Pre-Read eines Termins als PDF (bei abgeschlossenen Terminen das Protokoll). Erzeugt
 * der Server, gespeichert wird nichts; der Dateiname kommt vom Server.
 */
// QBR-07: KI-Entwurf der Zusammenfassung im Pre-Read, nur für die eigene Seite
export const preReadDraftQueryOptions = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
) =>
  queryOptions({
    queryKey: ['termine', base, meetingId, 'zusammenfassung'],
    queryFn: () =>
      getJson(`${base}/termine/${meetingId}/zusammenfassung`, preReadDraftSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const proposePreRead = (accessToken: string, base: MeetingBase, meetingId: string) =>
  sendJson(
    'POST',
    `${base}/termine/${meetingId}/zusammenfassung`,
    {},
    preReadDraftSchema,
    accessToken,
  );

export const acceptPreRead = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
  draftId: string,
  request: AcceptPreRead,
) =>
  sendJson(
    'POST',
    `${base}/termine/${meetingId}/zusammenfassung/${draftId}/uebernehmen`,
    request,
    preReadDraftSchema,
    accessToken,
  );

export const discardPreRead = (
  accessToken: string,
  base: MeetingBase,
  meetingId: string,
  draftId: string,
  input: { reason?: string } = {},
) =>
  sendJson(
    'POST',
    `${base}/termine/${meetingId}/zusammenfassung/${draftId}/verwerfen`,
    input,
    preReadDraftSchema,
    accessToken,
  );

export async function downloadPreRead(
  accessToken: string,
  base: string,
  meetingId: string,
  locale: 'de' | 'en',
) {
  await downloadPdf(accessToken, `${base}/termine/${meetingId}/pre-read`, locale, 'Pre-Read.pdf');
}

/**
 * QS-03: PDF vom Server laden und speichern (Baustein aus QBR-06). Den Dateinamen setzt der
 * Server; gespeichert wird nichts.
 */
export async function downloadPdf(
  accessToken: string,
  pathWithoutQuery: string,
  locale: 'de' | 'en',
  fallbackName: string,
) {
  const path = `${pathWithoutQuery}?sprache=${locale}`;
  const res = await fetch(`/api${path}`, {
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res), null);
  const disposition = res.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = encoded ? decodeURIComponent(encoded) : fallbackName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** FS-01: Hinweise, nur beim Käufer. Die Liste prüft die Regeln neu. */
export const hintsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['hinweise'],
    queryFn: () => getJson('/hinweise', hintListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const hintQueryOptions = (accessToken: string, hintId: string) =>
  queryOptions({
    queryKey: ['hinweise', hintId],
    queryFn: () => getJson(`/hinweise/${hintId}`, hintSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const acceptHint = (accessToken: string, hintId: string) =>
  sendJson('POST', `/hinweise/${hintId}/annehmen`, undefined, hintSchema, accessToken);

export const dismissHint = (accessToken: string, hintId: string, request: DismissHint) =>
  sendJson('POST', `/hinweise/${hintId}/verwerfen`, request, hintSchema, accessToken);

/** KI-16: auf „in Arbeit“ setzen und bewerten */
export const startHint = (accessToken: string, hintId: string) =>
  sendJson('POST', `/hinweise/${hintId}/in-arbeit`, undefined, hintSchema, accessToken);

export const rateHint = (accessToken: string, hintId: string, helpful: boolean) =>
  sendJson('POST', `/hinweise/${hintId}/bewertung`, { helpful }, hintSchema, accessToken);

/** KI-16: Regeln an oder aus, Schwellen, Bewertung je Regel (Einstellungen KI, nur Admins) */
export const hintRulesQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['hinweise', 'regeln'],
    queryFn: () => getJson('/hinweise/regeln', hintRuleSettingsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveHintRules = (
  accessToken: string,
  request: Pick<HintRuleSettings, 'rules' | 'thresholds'>,
) => sendJson('PUT', '/hinweise/regeln', request, hintRuleSettingsSchema, accessToken);

export const hintSettingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['hinweise', 'einstellungen'],
    queryFn: () => getJson('/hinweise/einstellungen', hintSettingsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveHintSettings = (accessToken: string, request: HintSettings) =>
  sendJson('PUT', '/hinweise/einstellungen', request, hintSettingsSchema, accessToken);

/** ZYK-05: was in den nächsten Zyklus übergeht, Start und frühere Zyklen. */
export const nextCycleQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'zyklus', 'neu'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/cycle/next`, nextCyclePreviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const startNextCycle = (
  accessToken: string,
  relationshipId: string,
  request: StartNextCycle,
) => sendJson('POST', `/suppliers/${relationshipId}/cycle/next`, request, cycleSchema, accessToken);

export const cycleArchiveQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'zyklus', 'archiv'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/cycle/archive`, cycleArchiveSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** ZYK-04: Stand der Zyklen; Filter und Sortierung wie in der Adresse. */
export const cycleStatusQueryOptions = (accessToken: string, query: CycleStatusQuery) =>
  queryOptions({
    queryKey: ['portfolio', 'zyklen', query],
    queryFn: () => {
      const params = new URLSearchParams(
        Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
      );
      const suffix = params.size > 0 ? `?${params}` : '';
      return getJson(`/portfolio/zyklen${suffix}`, cycleStatusSchema, accessToken);
    },
    retry: retryUnlessDenied,
  });

/** QS-03: Gesamtexport der Organisation; solange er läuft, alle fünf Sekunden neu laden. */
export const dataExportsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['datenexport'],
    queryFn: () => getJson('/einstellungen/export', dataExportListSchema, accessToken),
    retry: retryUnlessDenied,
    refetchInterval: (query) =>
      query.state.data?.exports.some(
        (entry) => entry.status === 'pending' || entry.status === 'running',
      )
        ? 5000
        : false,
  });

export const requestDataExport = (accessToken: string) =>
  sendJson('POST', '/einstellungen/export', undefined, dataExportListSchema, accessToken);

export async function downloadDataExport(accessToken: string, exportId: string) {
  const path = `/einstellungen/export/${exportId}/datei`;
  const res = await fetch(`/api${path}`, {
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res), null);
  const disposition = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1];
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name ?? 'reziproq-export.zip';
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

// Feedback in der App: eigene Fragebögen beider Seiten, angemeldet beantworten
export const myFeedbackQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['feedback', 'meine'],
    queryFn: () => getJson('/feedback/meine', myFeedbackSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const myFeedbackSurveyQueryOptions = (accessToken: string, invitationId: string) =>
  queryOptions({
    queryKey: ['feedback', 'meine', invitationId],
    queryFn: () => getJson(`/feedback/meine/${invitationId}`, publicSurveySchema, accessToken),
    retry: retryUnlessDenied,
  });

export const submitMyFeedback = (
  accessToken: string,
  invitationId: string,
  request: SubmitSurvey,
) => sendJson('POST', `/feedback/meine/${invitationId}`, request, publicSurveySchema, accessToken);

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

// PUL-08: KI fasst die Freitexte der anderen Seite zu Themen zusammen
export const feedbackThemesQueryOptions = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
  waveId: string,
) =>
  queryOptions({
    queryKey: ['feedback', side, relationshipId, waveId, 'themen'],
    queryFn: () =>
      getJson(
        `${feedbackBase(side, relationshipId)}/${waveId}/themen`,
        feedbackThemesSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const summarizeFreeTexts = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
  waveId: string,
) =>
  sendJson(
    'POST',
    `${feedbackBase(side, relationshipId)}/${waveId}/themen`,
    {},
    feedbackThemesSchema,
    accessToken,
  );

export const decideFeedbackThemes = (
  accessToken: string,
  side: SurveySide,
  relationshipId: string,
  waveId: string,
  draftId: string,
  decision: 'uebernehmen' | 'verwerfen',
  input: { content?: string; reason?: string } = {},
) =>
  sendJson(
    'POST',
    `${feedbackBase(side, relationshipId)}/${waveId}/themen/${draftId}/${decision}`,
    input,
    feedbackThemesSchema,
    accessToken,
  );

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

/** ZQ-01 Regel 2: „gehalten“ braucht einen Beleg, sonst antwortet die API mit 422 beleg_fehlt */
export const setCommitmentStatus = (
  accessToken: string,
  base: MeetingBase,
  id: string,
  status: CommitmentStatus,
  evidence?: CommitmentEvidence,
) =>
  sendJson(
    'PUT',
    `${base}/jbp/zusagen/${id}/status`,
    evidence ? { status, evidence } : { status },
    commitmentsSchema,
    accessToken,
  );

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

/** Status je Art; „gehalten“ einer Zusage nur mit Beleg (ZQ-01 Regel 2) */
export const setActionStatus = (
  accessToken: string,
  base: MeetingBase,
  actionId: string,
  status: WorkItemStatus,
  evidence?: CommitmentEvidence,
) =>
  sendJson(
    'PUT',
    `${base}/massnahmen/${actionId}/status`,
    evidence ? { status, evidence } : { status },
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

/** QS-02: Kommentare an einem Objekt; beim Lieferanten unter /kunden. */
const commentsUrl = (
  side: TeamSide,
  relationshipId: string,
  objectType: CommentObjectType,
  objectId: string,
) =>
  `${side === 'buyer' ? '/suppliers' : '/kunden'}/${relationshipId}/kommentare/${objectType}/${objectId}`;

export const commentsQueryOptions = (
  accessToken: string,
  side: TeamSide,
  relationshipId: string,
  objectType: CommentObjectType,
  objectId: string,
) =>
  queryOptions({
    queryKey: ['kommentare', side, relationshipId, objectType, objectId],
    queryFn: () =>
      getJson(
        commentsUrl(side, relationshipId, objectType, objectId),
        commentListSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const createComment = (
  accessToken: string,
  side: TeamSide,
  relationshipId: string,
  objectType: CommentObjectType,
  objectId: string,
  request: SaveComment,
) =>
  sendJson(
    'POST',
    commentsUrl(side, relationshipId, objectType, objectId),
    request,
    commentListSchema,
    accessToken,
  );

export const editComment = (
  accessToken: string,
  side: TeamSide,
  relationshipId: string,
  objectType: CommentObjectType,
  objectId: string,
  commentId: string,
  request: EditComment,
) =>
  sendJson(
    'PUT',
    `${commentsUrl(side, relationshipId, objectType, objectId)}/${commentId}`,
    request,
    commentListSchema,
    accessToken,
  );

export const removeComment = (
  accessToken: string,
  side: TeamSide,
  relationshipId: string,
  objectType: CommentObjectType,
  objectId: string,
  commentId: string,
) =>
  sendJson(
    'DELETE',
    `${commentsUrl(side, relationshipId, objectType, objectId)}/${commentId}`,
    undefined,
    commentListSchema,
    accessToken,
  );

/** KI-01: Einstellungen KI (nur Admins) und Kontingent des Monats (alle Käufer). */
export const aiSettingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['einstellungen', 'ki'],
    queryFn: () => getJson('/einstellungen/ki', aiSettingsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveAiSettings = (accessToken: string, settings: AiSettings) =>
  sendJson('PUT', '/einstellungen/ki', settings, aiSettingsResponseSchema, accessToken);

export const aiUsageQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['ki', 'kontingent'],
    queryFn: () => getJson('/ki/kontingent', aiUsageSchema, accessToken),
    retry: retryUnlessDenied,
  });

const agentsPath = '/ki/agenten';

export const agentsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['agents'],
    queryFn: () => getJson(agentsPath, agentsResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });
// Termin-Briefing von Hand starten (KI-07); die Seite Agenten gibt es nicht mehr (K1-f.5)
export const startAgent = (accessToken: string, id: string, input: StartAgent) =>
  sendJson('POST', `${agentsPath}/${id}/starten`, input, agentRunDetailSchema, accessToken);

/** KI-11: Wertpotenziale eines Lieferanten */
export const valueOpportunitiesQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'wertpotenziale'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/wertpotenziale`, valueOpportunitiesSchema, accessToken),
    retry: retryUnlessDenied,
  });

const opportunityPath = (relationshipId: string, id?: string) =>
  `/suppliers/${relationshipId}/wertpotenziale${id ? `/${id}` : ''}`;

export const runValueFinder = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `${opportunityPath(relationshipId)}/lauf`,
    {},
    valueOpportunitiesSchema,
    accessToken,
  );

export const changeOpportunityAssumptions = (
  accessToken: string,
  relationshipId: string,
  id: string,
  request: ChangeAssumptions,
) =>
  sendJson(
    'PUT',
    `${opportunityPath(relationshipId, id)}/annahmen`,
    request,
    valueOpportunitiesSchema,
    accessToken,
  );

export const dismissOpportunity = (
  accessToken: string,
  relationshipId: string,
  id: string,
  reason: string,
) =>
  sendJson(
    'POST',
    `${opportunityPath(relationshipId, id)}/verwerfen`,
    { reason },
    valueOpportunitiesSchema,
    accessToken,
  );

export const opportunityProposal = (accessToken: string, relationshipId: string, id: string) =>
  getJson(`${opportunityPath(relationshipId, id)}/vorschlag`, adoptOpportunitySchema, accessToken);

export const adoptOpportunity = (
  accessToken: string,
  relationshipId: string,
  id: string,
  request: AdoptOpportunity,
) =>
  sendJson(
    'POST',
    `${opportunityPath(relationshipId, id)}/uebernehmen`,
    request,
    valueOpportunitiesSchema,
    accessToken,
  );

/** KI-11: Wertpotenziale über alle Lieferanten */
export const valueOverviewQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['uebersicht', 'wertpotenziale'],
    queryFn: () => getJson('/uebersicht/wertpotenziale', valueOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** KI-11: Anfrage an den Lieferanten zu einer Datenlücke entwerfen, senden, verwerfen */
const gapPath = (relationshipId: string, gapId: string) =>
  `/suppliers/${relationshipId}/wertpotenziale/luecken/${gapId}/anfrage`;

export const draftDataRequest = (accessToken: string, relationshipId: string, gapId: string) =>
  sendJson('POST', gapPath(relationshipId, gapId), {}, valueOpportunitiesSchema, accessToken);

export const sendDataRequest = (
  accessToken: string,
  relationshipId: string,
  gapId: string,
  request: SendDataRequest,
) =>
  sendJson(
    'POST',
    `${gapPath(relationshipId, gapId)}/senden`,
    request,
    valueOpportunitiesSchema,
    accessToken,
  );

export const discardDataRequest = (accessToken: string, relationshipId: string, gapId: string) =>
  sendJson(
    'POST',
    `${gapPath(relationshipId, gapId)}/verwerfen`,
    {},
    valueOpportunitiesSchema,
    accessToken,
  );

/** AW-01: „Stimmt nicht“ zu einer Aussage von Reziproq */
export const reportStatement = (accessToken: string, id: string) =>
  sendNoContent(accessToken, 'POST', `/aussagen/${id}/stimmt-nicht`, {});

/** KI-07: Termin-Briefing eines Termins, nur beim Käufer */
const briefPath = (relationshipId: string, meetingId: string) =>
  `/suppliers/${relationshipId}/termine/${meetingId}/briefing`;

export const briefQueryOptions = (accessToken: string, relationshipId: string, meetingId: string) =>
  queryOptions({
    queryKey: ['termine', meetingId, 'briefing'],
    queryFn: () => getJson(briefPath(relationshipId, meetingId), meetingBriefSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const decideBrief = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  draftId: string,
  decision: 'uebernehmen' | 'verwerfen',
) =>
  sendJson(
    'POST',
    `${briefPath(relationshipId, meetingId)}/${draftId}/${decision}`,
    {},
    meetingBriefSchema,
    accessToken,
  );

export const editBriefAgenda = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  request: EditBriefAgenda,
) =>
  sendJson(
    'PUT',
    `${briefPath(relationshipId, meetingId)}/agenda`,
    request,
    meetingBriefSchema,
    accessToken,
  );

export const sendBriefQuestion = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  key: string,
) =>
  sendJson(
    'POST',
    `${briefPath(relationshipId, meetingId)}/fragen/${encodeURIComponent(key)}/senden`,
    {},
    meetingBriefSchema,
    accessToken,
  );

/** KI-17: Ergebnisse nach dem Termin, nur beim Käufer */
const capturePath = (relationshipId: string, meetingId: string) =>
  `/suppliers/${relationshipId}/termine/${meetingId}/ergebnisse`;

export const captureQueryOptions = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
) =>
  queryOptions({
    queryKey: ['termine', meetingId, 'ergebnisse'],
    queryFn: () =>
      getJson(capturePath(relationshipId, meetingId), meetingCaptureSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const evaluateCapture = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  request: SaveCapture,
) =>
  sendJson(
    'POST',
    `${capturePath(relationshipId, meetingId)}/auswerten`,
    request,
    meetingCaptureSchema,
    accessToken,
  );

export const acceptCapture = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  ids: string[],
) =>
  sendJson(
    'POST',
    `${capturePath(relationshipId, meetingId)}/uebernehmen`,
    { ids },
    meetingCaptureSchema,
    accessToken,
  );

export const editCapture = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  draftId: string,
  request: EditCaptureItem,
) =>
  sendJson(
    'PUT',
    `${capturePath(relationshipId, meetingId)}/${draftId}`,
    request,
    meetingCaptureSchema,
    accessToken,
  );

export const discardCapture = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  draftId: string,
) =>
  sendJson(
    'POST',
    `${capturePath(relationshipId, meetingId)}/${draftId}/verwerfen`,
    {},
    meetingCaptureSchema,
    accessToken,
  );

export const shareCaptureProtocol = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
) =>
  sendJson(
    'POST',
    `${capturePath(relationshipId, meetingId)}/protokoll-teilen`,
    {},
    meetingCaptureSchema,
    accessToken,
  );

/** KI-15: Import und Zuordnung (Einstellungen › Daten › Import) */
const importsPath = '/einstellungen/importe';

export const importBatchesQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['importe'],
    queryFn: () => getJson(importsPath, importBatchListSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const importBatchQueryOptions = (accessToken: string, id: string) =>
  queryOptions({
    queryKey: ['importe', id],
    queryFn: () => getJson(`${importsPath}/${id}`, importBatchSchema, accessToken),
    retry: retryUnlessDenied,
  });

export async function uploadImportBatch(accessToken: string, kind: ImportBatchKind, file: File) {
  const form = new FormData();
  form.append('file', file);
  const path = `${importsPath}?art=${kind}`;
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const answer: unknown = await res.json().catch(() => null);
    throw new ApiError(path, res.status, undefined, answer);
  }
  return importBatchSchema.parse(await res.json());
}

export const saveImportColumns = (accessToken: string, id: string, columnMap: ColumnMap) =>
  sendJson('PUT', `${importsPath}/${id}/spalten`, { columnMap }, importBatchSchema, accessToken);

export const importBatchAction = (
  accessToken: string,
  id: string,
  action: 'verarbeiten' | 'uebernehmen' | 'rueckgaengig' | 'verwerfen',
) => sendJson('POST', `${importsPath}/${id}/${action}`, {}, importBatchSchema, accessToken);

export const decideImportRows = (accessToken: string, id: string, request: DecideImportRows) =>
  sendJson('POST', `${importsPath}/${id}/entscheiden`, request, importBatchSchema, accessToken);

/** Fehlerzeilen eines Imports als CSV herunterladen (mit Anmeldung) */
export async function downloadImportErrors(accessToken: string, id: string): Promise<void> {
  const path = `${importsPath}/${id}/fehler.csv`;
  const res = await fetch(`/api${path}`, {
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res));
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'reziproq-import-fehler.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** KI-07: Vorlauf je Termintyp (Einstellungen KI, nur Admins) */
export const briefSettingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['einstellungen', 'termin-briefing'],
    queryFn: () => getJson('/einstellungen/termin-briefing', briefSettingsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveBriefSettings = (accessToken: string, request: BriefSettings) =>
  sendJson('PUT', '/einstellungen/termin-briefing', request, briefSettingsSchema, accessToken);

/** IN-01: Einstellungen › Anbindungen (nur Admins) und Profil › Meine Verbindungen */
const integrationsPath = '/einstellungen/anbindungen';

export const integrationsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['anbindungen'],
    queryFn: () => getJson(integrationsPath, integrationsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const connectIntegration = (accessToken: string, key: string) =>
  sendJson('POST', `${integrationsPath}/${key}/verbinden`, {}, integrationsSchema, accessToken);

export const integrationAction = (
  accessToken: string,
  id: string,
  action: 'abgleichen' | 'trennen',
) => sendJson('POST', `${integrationsPath}/${id}/${action}`, {}, integrationsSchema, accessToken);

export const saveIntegrationParts = (accessToken: string, id: string, parts: string[]) =>
  sendJson('PUT', `${integrationsPath}/${id}/teile`, { parts }, integrationsSchema, accessToken);

const myConnectionsPath = '/profil/verbindungen';

export const myConnectionsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['meine-verbindungen'],
    queryFn: () => getJson(myConnectionsPath, myConnectionsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const connectMine = (accessToken: string, key: string) =>
  sendJson('POST', `${myConnectionsPath}/${key}/verbinden`, {}, myConnectionsSchema, accessToken);

export const disconnectMine = (accessToken: string, id: string) =>
  sendJson('POST', `${myConnectionsPath}/${id}/trennen`, {}, myConnectionsSchema, accessToken);

/** IN-07: Schlüssel der Import-API (Einstellungen › Anbindungen › Import-API) */
export const apiKeysQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['anbindungen', 'schluessel'],
    queryFn: () => getJson(`${integrationsPath}/schluessel`, apiKeysSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const createApiKey = (accessToken: string, input: CreateApiKey) =>
  sendJson('POST', `${integrationsPath}/schluessel`, input, createdApiKeySchema, accessToken);

export const revokeApiKey = (accessToken: string, id: string) =>
  sendJson(
    'POST',
    `${integrationsPath}/schluessel/${id}/widerrufen`,
    {},
    apiKeysSchema,
    accessToken,
  );

/** IN-02: Führt eine Mail direkt zu Microsoft oder Google? (Anmeldeseite, ohne Login) */
export async function ssoHint(email: string) {
  const res = await fetch('/api/anmeldung/sso', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { provider: null, scope: null };
  return ssoHintSchema.parse(await res.json());
}

/** IN-02: Anmeldung über Microsoft und Google (Einstellungen › Anbindungen) */
export const ssoQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['anbindungen', 'anmeldung'],
    queryFn: () => getJson(`${integrationsPath}/anmeldung`, ssoOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveSso = (accessToken: string, provider: 'entra' | 'google', input: SaveSso) =>
  sendJson(
    'PUT',
    `${integrationsPath}/anmeldung/${provider}`,
    input,
    ssoOverviewSchema,
    accessToken,
  );

export const verifySsoDomain = (
  accessToken: string,
  provider: 'entra' | 'google',
  domain: string,
) =>
  sendJson(
    'POST',
    `${integrationsPath}/anmeldung/${provider}/domains/${encodeURIComponent(domain)}/bestaetigen`,
    {},
    ssoOverviewSchema,
    accessToken,
  );

export const approveMember = (accessToken: string, id: string) =>
  sendJson(
    'POST',
    `/organisation/mitglieder/${encodeURIComponent(id)}/freigeben`,
    {},
    organizationMemberSchema,
    accessToken,
  );

/** IN-03: Eingangsadresse, zugelassene Absender-Domains (nur Admins) */
export const saveInboundSettings = (accessToken: string, id: string, allowedDomains: string[]) =>
  sendJson(
    'PUT',
    `${integrationsPath}/${id}/einstellungen`,
    { allowedDomains },
    integrationsSchema,
    accessToken,
  );

/** IN-03: Outlook-Add-in */
export const detectAddin = (accessToken: string, attendees: string[], subject: string) =>
  sendJson(
    'POST',
    '/termine/addin/erkennen',
    { attendees, subject },
    addinDetectSchema,
    accessToken,
  );

export const registerAddin = (accessToken: string, input: AddinRegister) =>
  sendJson('POST', '/termine/addin', input, addinRegisteredSchema, accessToken);

/** IN-04: Outlook-Add-in in einer gelesenen Mail */
export const detectMail = (accessToken: string, input: MailDetectRequest) =>
  sendJson('POST', '/mails/addin/erkennen', input, addinDetectSchema, accessToken);

/** IN-04: „In Reziproq ablegen“, die API liest genau diese Mail über Microsoft Graph */
export const fileMail = (accessToken: string, input: FileMailRequest) =>
  sendJson('POST', '/mails/addin/ablegen', input, fileMailResultSchema, accessToken);

/** IN-04: Text einer abgelegten Mail zum Aufklappen */
export const filedMailQueryOptions = (
  accessToken: string,
  relationshipId: string,
  mailId: string,
) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'mails', mailId],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/mails/${mailId}`, filedMailBodySchema, accessToken),
    retry: retryUnlessDenied,
  });

export const removeFiledMail = (accessToken: string, relationshipId: string, mailId: string) =>
  sendNoContent(accessToken, 'DELETE', `/suppliers/${relationshipId}/mails/${mailId}`, {});

/** IN-04: Anhang laden und speichern; nichts wird im Browser aufbewahrt */
export async function downloadMailAttachment(
  accessToken: string,
  relationshipId: string,
  mailId: string,
  attachment: { id: string; fileName: string },
) {
  const path = `/suppliers/${relationshipId}/mails/${mailId}/anhaenge/${attachment.id}`;
  const res = await fetch(`/api${path}`, {
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res), null);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** IN-06: Profil › Benachrichtigungen */
export const notificationPrefsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['profil', 'benachrichtigungen'],
    queryFn: () => getJson('/profil/benachrichtigungen', notificationPrefsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveNotificationPrefs = (accessToken: string, input: SaveNotificationPrefs) =>
  sendJson('PUT', '/profil/benachrichtigungen', input, notificationPrefsSchema, accessToken);

export const linkTeams = (accessToken: string) =>
  sendJson('POST', '/profil/benachrichtigungen/teams', {}, notificationPrefsSchema, accessToken);

export const unlinkTeams = (accessToken: string) =>
  sendJson('DELETE', '/profil/benachrichtigungen/teams', {}, notificationPrefsSchema, accessToken);

export const saveNotificationOrganization = (accessToken: string, input: SaveNotificationOrg) =>
  sendJson(
    'PUT',
    '/profil/benachrichtigungen/organisation',
    input,
    notificationPrefsSchema,
    accessToken,
  );

/** IN-05: Einstellungen › Anbindungen › Transkripte (Admin) */
export const transcriptSettingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['einstellungen', 'transkripte'],
    queryFn: () => getJson('/einstellungen/transkripte', transcriptSettingsSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveTranscriptSettings = (accessToken: string, input: SaveTranscriptSettings) =>
  sendJson('PUT', '/einstellungen/transkripte', input, transcriptSettingsSchema, accessToken);

/** Betriebsvereinbarung bestätigen, mit Datum und optional der Datei */
export async function confirmWorksAgreement(
  accessToken: string,
  confirmedAt: string,
  file: File | null,
) {
  const path = '/einstellungen/transkripte/betriebsvereinbarung';
  const form = new FormData();
  form.append('confirmedAt', confirmedAt);
  if (file) form.append('file', file);
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok)
    throw new ApiError(
      path,
      res.status,
      await forbiddenCode(res),
      await res.json().catch(() => null),
    );
  return transcriptSettingsSchema.parse(await res.json());
}

/** IN-05: Transkript eines Termins (nur Käufer) */
const transcriptPath = (relationshipId: string, meetingId: string) =>
  `/suppliers/${relationshipId}/termine/${meetingId}/transkript`;

export const meetingTranscriptQueryOptions = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
) =>
  queryOptions({
    queryKey: ['termine', meetingId, 'transkript'],
    queryFn: () =>
      getJson(transcriptPath(relationshipId, meetingId), meetingTranscriptStateSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const transcriptTextQueryOptions = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
) =>
  queryOptions({
    queryKey: ['termine', meetingId, 'transkript', 'text'],
    queryFn: () =>
      getJson(
        `${transcriptPath(relationshipId, meetingId)}/text`,
        transcriptTextSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const setTranscriptOptIn = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  optIn: boolean,
) =>
  sendJson(
    'PUT',
    `${transcriptPath(relationshipId, meetingId)}/opt-in`,
    { optIn },
    meetingTranscriptStateSchema,
    accessToken,
  );

export const releaseTranscript = (
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  released: boolean,
) =>
  sendJson(
    'PUT',
    `${transcriptPath(relationshipId, meetingId)}/freigabe`,
    { released },
    meetingTranscriptStateSchema,
    accessToken,
  );

export async function uploadTranscript(
  accessToken: string,
  relationshipId: string,
  meetingId: string,
  file: File,
) {
  const path = `${transcriptPath(relationshipId, meetingId)}/upload`;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...supportHeaders(), authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok)
    throw new ApiError(
      path,
      res.status,
      await forbiddenCode(res),
      await res.json().catch(() => null),
    );
  return meetingTranscriptStateSchema.parse(await res.json());
}

/** WG-12 (Schritt 27): Scorecard der Warengruppe und Quartals-Review */
export const categoryScorecardQueryOptions = (accessToken: string, strategyId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, 'scorecard'],
    queryFn: () =>
      getJson(
        `/warengruppen/strategien/${strategyId}/scorecard`,
        categoryScorecardSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const saveInitiative = (
  accessToken: string,
  strategyId: string,
  request: InitiativeRequest,
  id?: string,
) =>
  sendJson(
    id ? 'PATCH' : 'POST',
    `/warengruppen/strategien/${strategyId}/initiativen${id ? `/${id}` : ''}`,
    request,
    categoryScorecardSchema,
    accessToken,
  );

export const removeInitiative = (accessToken: string, strategyId: string, id: string) =>
  sendJson(
    'DELETE',
    `/warengruppen/strategien/${strategyId}/initiativen/${id}`,
    undefined,
    categoryScorecardSchema,
    accessToken,
  );

export const reportInitiativeProgress = (
  accessToken: string,
  strategyId: string,
  id: string,
  progress: number,
) =>
  sendJson(
    'POST',
    `/warengruppen/strategien/${strategyId}/initiativen/${id}/fortschritt`,
    { progress },
    categoryScorecardSchema,
    accessToken,
  );

export const categoryReviewQueryOptions = (accessToken: string, reviewId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'reviews', reviewId],
    queryFn: () => getJson(`/warengruppen/reviews/${reviewId}`, categoryReviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const holdCategoryReview = (accessToken: string, reviewId: string, summary: string) =>
  sendJson(
    'POST',
    `/warengruppen/reviews/${reviewId}/abschliessen`,
    { summary },
    categoryReviewSchema,
    accessToken,
  );

/** WG-15 (Schritt 28): Supplier Map der Warengruppenstrategie */
export const supplierMapQueryOptions = (accessToken: string, strategyId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, 'supplier-map'],
    queryFn: () =>
      getJson(
        `/warengruppen/strategien/${strategyId}/supplier-map`,
        supplierMapSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

export const saveSupplierMapRow = (
  accessToken: string,
  strategyId: string,
  relationshipId: string,
  update: SupplierMapUpdate,
) =>
  sendJson(
    'PUT',
    `/warengruppen/strategien/${strategyId}/supplier-map/${relationshipId}`,
    update,
    supplierMapSchema,
    accessToken,
  );

/** WG-14 (Schritt 29): Vergabeplan der Warengruppenstrategie */
export const awardPlanQueryOptions = (accessToken: string, strategyId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, 'vergaben'],
    queryFn: () =>
      getJson(`/warengruppen/strategien/${strategyId}/vergaben`, awardPlanSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveAward = (
  accessToken: string,
  strategyId: string,
  request: AwardRequest,
  id?: string,
) =>
  sendJson(
    id ? 'PATCH' : 'POST',
    `/warengruppen/strategien/${strategyId}/vergaben${id ? `/${id}` : ''}`,
    request,
    awardPlanSchema,
    accessToken,
  );

export const removeAward = (accessToken: string, strategyId: string, id: string) =>
  sendJson(
    'DELETE',
    `/warengruppen/strategien/${strategyId}/vergaben/${id}`,
    undefined,
    awardPlanSchema,
    accessToken,
  );

export const awardEligibilityQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'vergabefaehigkeit'],
    queryFn: () => getJson('/warengruppen/vergabefaehigkeit', awardEligibilitySchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveAwardEligibility = (accessToken: string, value: AwardEligibility) =>
  sendJson('PUT', '/warengruppen/vergabefaehigkeit', value, awardEligibilitySchema, accessToken);

/** WG-16 (Schritt 30): Freigabe der Warengruppenstrategie */
export const approvalViewQueryOptions = (accessToken: string, strategyId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'strategien', strategyId, 'freigabe'],
    queryFn: () =>
      getJson(`/warengruppen/strategien/${strategyId}/freigabe`, approvalViewSchema, accessToken),
    retry: retryUnlessDenied,
  });

const approvalAction = (
  accessToken: string,
  method: 'POST' | 'PUT',
  path: string,
  body?: unknown,
) => sendJson(method, `/warengruppen/${path}`, body ?? {}, approvalViewSchema, accessToken);

export const saveRelevance = (
  accessToken: string,
  strategyId: string,
  scores: Record<string, number>,
) => approvalAction(accessToken, 'PUT', `strategien/${strategyId}/relevanz`, { scores });
export const overrideRelevance = (
  accessToken: string,
  strategyId: string,
  input: RelevanceOverride,
) => approvalAction(accessToken, 'PUT', `strategien/${strategyId}/relevanz/uebersteuern`, input);
export const saveStrategySummary = (
  accessToken: string,
  strategyId: string,
  input: SummaryRequest,
) => approvalAction(accessToken, 'PUT', `strategien/${strategyId}/zusammenfassung`, input);
export const confirmStrategySummary = (accessToken: string, strategyId: string) =>
  approvalAction(accessToken, 'POST', `strategien/${strategyId}/zusammenfassung/bestaetigen`);
export const submitStrategy = (accessToken: string, strategyId: string) =>
  approvalAction(accessToken, 'POST', `strategien/${strategyId}/vorlegen`);
export const signApproval = (accessToken: string, approvalId: string) =>
  approvalAction(accessToken, 'POST', `freigaben/${approvalId}/unterschreiben`);
export const returnApproval = (accessToken: string, approvalId: string, comment: string) =>
  approvalAction(accessToken, 'POST', `freigaben/${approvalId}/zurueckgeben`, { comment });

export const newStrategyVersion = (accessToken: string, strategyId: string) =>
  sendJson(
    'POST',
    `/warengruppen/strategien/${strategyId}/neue-version`,
    {},
    z.object({ id: z.uuid(), version: z.number().int() }),
    accessToken,
  );

export const approvalSettingsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'freigabeweg'],
    queryFn: () => getJson('/warengruppen/freigabeweg', approvalSettingsViewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const saveApprovalSettings = (accessToken: string, value: ApprovalSettings) =>
  sendJson('PUT', '/warengruppen/freigabeweg', value, approvalSettingsViewSchema, accessToken);

/** WG-20 (Schritt 31): Zusammenführung je Lieferant über alle Warengruppen */
export const supplierCategoriesQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['warengruppen', 'lieferanten', relationshipId],
    queryFn: () =>
      getJson(`/warengruppen/lieferanten/${relationshipId}`, supplierCategoriesSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const resolveCategoryConflict = (
  accessToken: string,
  conflictId: string,
  input: ResolveConflict,
) =>
  sendJson(
    'POST',
    `/warengruppen/widersprueche/${conflictId}`,
    input,
    supplierCategoriesSchema,
    accessToken,
  );

export const adoptSegmentProposal = (accessToken: string, relationshipId: string) =>
  sendJson(
    'POST',
    `/warengruppen/lieferanten/${relationshipId}/gesamtsegment`,
    {},
    supplierCategoriesSchema,
    accessToken,
  );
