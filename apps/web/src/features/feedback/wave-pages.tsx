import {
  type SurveyFunction,
  type SurveyKind,
  type SurveySide,
  type SurveySuggestion,
  type SurveyWave,
  type SurveyWaveDetail,
  surveyFunctions,
  surveyKinds,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { MessagesSquareIcon, PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
import { Tile, TileMetric, TileTitle } from '@/components/ui/tile';
import { CustomerFrame } from '@/features/customers/customer-frame';
import { PdfButton } from '@/features/print/pdf-button';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  ApiError,
  closeSurveyWave,
  extendSurveyWave,
  inviteSurveyParticipants,
  startSurveyWave,
  surveySuggestionsQueryOptions,
  surveyWaveQueryOptions,
  surveyWavesQueryOptions,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { FeedbackThemesPanel } from './feedback-themes';
import { MyInvitationNotice } from './my-feedback';
import { ResultsSection } from './results-section';
import { TrendSection } from './trend-section';

// PUL-02a: Feedback-Wellen unter Beziehung › Feedback, für beide Seiten mit denselben Seiten.
// Der Käufer startet (SRO oder Admin) und lädt beide Seiten ein; der Lieferant lädt eigene ein.

type Trail = { label: string; href: string }[];

export const feedbackPath = (side: SurveySide, relationshipId: string) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/beziehung/feedback`
    : `/kunden/${relationshipId}/beziehung/feedback`;

const linkClass =
  'font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** Pfad und Rahmen je Seite: beim Käufer der Lieferant, beim Lieferanten der Kunde. */
function WaveFrame({
  side,
  relationshipId,
  trail = [],
  current,
  children,
}: {
  side: SurveySide;
  relationshipId: string;
  trail?: Trail;
  current: string;
  children: ReactNode;
}) {
  if (side === 'supplier') {
    return (
      <CustomerFrame relationshipId={relationshipId} trail={trail} current={current}>
        {children}
      </CustomerFrame>
    );
  }
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="relationship"
      trail={() => trail}
      current={current}
    >
      {() => children}
    </SupplierFrame>
  );
}

function useSideLabels(side: SurveySide) {
  const text = useT().feedback;
  return side === 'buyer' ? text.sides : text.sidesSupplier;
}

function TurnoutLine({ wave, side }: { wave: SurveyWave; side: SurveySide }) {
  const text = useT().feedback;
  const labels = useSideLabels(side);
  return (
    <span className="text-muted-foreground text-sm">
      {(['buyer', 'supplier'] as const)
        .map(
          (entry) =>
            `${labels[entry]} ${text.turnoutShort(wave.turnout[entry].completed, wave.turnout[entry].invited)}`,
        )
        .join(' · ')}
    </span>
  );
}

/** Liste der Wellen mit Art, Frist, Rücklauf je Seite und Status. */
export function WavesPage({ side, relationshipId }: { side: SurveySide; relationshipId: string }) {
  const t = useT();
  const text = t.feedback;
  const accessToken = useToken();
  const format = useFormat();
  const [message, hideMessage] = useFlash();
  const query = useQuery({
    ...surveyWavesQueryOptions(accessToken, side, relationshipId),
    enabled: accessToken !== '',
  });
  const base = feedbackPath(side, relationshipId);
  return (
    <WaveFrame side={side} relationshipId={relationshipId} current={text.title}>
      <PageHeader title={text.title} purpose={text.purpose} />
      <MyInvitationNotice relationshipId={relationshipId} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {query.data?.canStart && (
        <div className="flex justify-end">
          {routerLink({
            href: `${base}/neu`,
            className: buttonVariants(),
            children: (
              <>
                <PlusIcon aria-hidden />
                {text.start}
              </>
            ),
          })}
        </div>
      )}
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : query.data.waves.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<MessagesSquareIcon aria-hidden />}
          title={text.empty}
          description={text.emptyHint}
        />
      ) : (
        <ul data-slot="wave-list" className="overflow-hidden rounded-lg bg-card shadow-card">
          {query.data.waves.map((wave) => (
            <li
              key={wave.id}
              data-wave={wave.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-line-soft border-b px-5 py-4 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {routerLink({
                  href: `${base}/${wave.id}`,
                  className: linkClass,
                  children: `${text.kinds[wave.kind]} · ${text.due(format.date(wave.dueDate))}`,
                })}
                <TurnoutLine wave={wave} side={side} />
              </span>
              {wave.topGap && (
                <span className="text-sm">
                  {text.biggestGap(
                    t.settings.survey.dimensions[wave.topGap.dimension] ?? '',
                    format.number(Math.abs(wave.topGap.delta)),
                  )}
                </span>
              )}
              <Badge
                variant={
                  wave.revealedAt ? 'selected' : wave.status === 'open' ? 'success' : 'neutral'
                }
              >
                {wave.revealedAt ? text.revealed : text.statuses[wave.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {query.data?.trends.map((trend) => (
        <TrendSection key={trend.kind} trend={trend} side={side} />
      ))}
    </WaveFrame>
  );
}

// Teilnehmende auswählen: Vorschläge ankreuzen, Funktion wählen, weitere Personen hinzufügen.

export interface DraftParticipant {
  side: SurveySide;
  email: string;
  name: string;
  function: SurveyFunction | '';
}

const sameAs = (a: { email: string; side: SurveySide }, b: { email: string; side: SurveySide }) =>
  a.email.toLowerCase() === b.email.toLowerCase() && a.side === b.side;

function ParticipantPicker({
  sides,
  ownSide,
  suggestions,
  value,
  onChange,
}: {
  sides: SurveySide[];
  ownSide: SurveySide;
  suggestions: SurveySuggestion[];
  value: DraftParticipant[];
  onChange: (next: DraftParticipant[]) => void;
}) {
  const text = useT().feedback;
  const labels = ownSide === 'buyer' ? text.sides : text.sidesSupplier;
  const [person, setPerson] = useState<DraftParticipant>({
    side: sides[0] ?? ownSide,
    email: '',
    name: '',
    function: '',
  });
  const [error, setError] = useState<string | null>(null);
  const toggle = (suggestion: SurveySuggestion, checked: boolean) =>
    onChange(
      checked
        ? [
            ...value,
            {
              side: suggestion.side,
              email: suggestion.email,
              name: suggestion.name,
              function: suggestion.function ?? '',
            },
          ]
        : value.filter((entry) => !sameAs(entry, suggestion)),
    );
  const setFunction = (entry: DraftParticipant, fn: SurveyFunction | '') =>
    onChange(value.map((item) => (sameAs(item, entry) ? { ...item, function: fn } : item)));
  const add = () => {
    const email = person.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(text.invalidEmail);
      return;
    }
    if (value.some((entry) => sameAs(entry, { email, side: person.side }))) {
      setError(text.duplicate);
      return;
    }
    setError(null);
    onChange([...value, { ...person, email, name: person.name.trim() }]);
    setPerson({ ...person, email: '', name: '', function: '' });
  };
  const functionSelect = (entry: DraftParticipant, label: string) => (
    <div className="w-44 shrink-0">
      <NativeSelect
        aria-label={text.functionOf(label)}
        value={entry.function}
        onChange={(event) => setFunction(entry, event.target.value as SurveyFunction | '')}
      >
        <option value="">{text.chooseFunction}</option>
        {surveyFunctions.map((fn) => (
          <option key={fn} value={fn}>
            {text.functions[fn]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {sides.map((side) => {
        const offered = suggestions.filter((entry) => entry.side === side);
        const extra = value.filter(
          (entry) => entry.side === side && !offered.some((item) => sameAs(item, entry)),
        );
        return (
          <section
            key={side}
            aria-labelledby={`teilnehmende-${side}`}
            className="flex flex-col gap-3"
          >
            <h3 id={`teilnehmende-${side}`} className="font-semibold text-lg">
              {labels[side]} · {text.selected(value.filter((entry) => entry.side === side).length)}
            </h3>
            {offered.length + extra.length > 0 && (
              <ul className="overflow-hidden rounded-lg bg-card shadow-card">
                {offered.map((suggestion) => {
                  const chosen = value.find((entry) => sameAs(entry, suggestion));
                  const id = `vorschlag-${side}-${suggestion.email}`;
                  return (
                    <li
                      key={suggestion.email}
                      className="flex flex-wrap items-center gap-3 border-line-soft border-b px-4 py-2 last:border-b-0"
                    >
                      <Checkbox
                        id={id}
                        aria-label={text.select(suggestion.name)}
                        checked={chosen !== undefined}
                        onCheckedChange={(checked) => toggle(suggestion, checked === true)}
                      />
                      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{suggestion.name}</span>
                        <span className="truncate text-muted-foreground text-sm">
                          {suggestion.email} · {text.suggestionSource[suggestion.source]}
                        </span>
                      </label>
                      {chosen && functionSelect(chosen, suggestion.name)}
                    </li>
                  );
                })}
                {extra.map((entry) => (
                  <li
                    key={entry.email}
                    className="flex flex-wrap items-center gap-3 border-line-soft border-b px-4 py-2 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{entry.name || entry.email}</span>
                      {entry.name && (
                        <span className="truncate text-muted-foreground text-sm">
                          {entry.email}
                        </span>
                      )}
                    </span>
                    {functionSelect(entry, entry.name || entry.email)}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={text.remove(entry.name || entry.email)}
                      onClick={() => onChange(value.filter((item) => !sameAs(item, entry)))}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <fieldset className="flex flex-col gap-3 rounded-lg bg-card shadow-card p-4">
        <legend className="sr-only">{text.addPerson}</legend>
        <h3 className="font-semibold">{text.addPerson}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={text.email} error={error ?? undefined}>
            {(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="off"
                value={person.email}
                onChange={(event) => setPerson({ ...person, email: event.target.value })}
              />
            )}
          </FormField>
          <FormField label={text.name}>
            {(field) => (
              <Input
                {...field}
                value={person.name}
                onChange={(event) => setPerson({ ...person, name: event.target.value })}
              />
            )}
          </FormField>
          <FormField label={text.function}>
            {(field) => (
              <NativeSelect
                {...field}
                value={person.function}
                onChange={(event) =>
                  setPerson({ ...person, function: event.target.value as SurveyFunction | '' })
                }
              >
                <option value="">{text.chooseFunction}</option>
                {surveyFunctions.map((fn) => (
                  <option key={fn} value={fn}>
                    {text.functions[fn]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {sides.length > 1 && (
            <FormField label={text.side}>
              {(field) => (
                <NativeSelect
                  {...field}
                  value={person.side}
                  onChange={(event) =>
                    setPerson({ ...person, side: event.target.value as SurveySide })
                  }
                >
                  {sides.map((entry) => (
                    <option key={entry} value={entry}>
                      {labels[entry]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        </div>
        <Button variant="outline" className="self-start" onClick={add}>
          <PlusIcon aria-hidden />
          {text.add}
        </Button>
      </fieldset>
    </div>
  );
}

/** Prüft die Auswahl; gibt einen Fehlertext oder die Teilnehmenden für die API zurück. */
function readyParticipants(value: DraftParticipant[], text: ReturnType<typeof useT>['feedback']) {
  if (value.length === 0) return { error: text.noneSelected } as const;
  if (value.some((entry) => entry.function === '')) return { error: text.functionMissing } as const;
  return {
    participants: value.map((entry) => ({
      side: entry.side,
      email: entry.email,
      name: entry.name || null,
      function: entry.function as SurveyFunction,
    })),
  } as const;
}

// Neue Welle: drei Schritte mit eigener Adresse (?schritt=1…3). Der Entwurf bleibt im Tab
// erhalten (sessionStorage), bis die Welle startet.

interface WaveDraft {
  kind: SurveyKind;
  dueDate: string;
  participants: DraftParticipant[];
  /** Vorschläge einmal vorausgewählt */
  seeded: boolean;
}

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const draftKey = (relationshipId: string) => `reziproq:feedback-welle:${relationshipId}`;

function readDraft(relationshipId: string): WaveDraft {
  const fallback: WaveDraft = {
    kind: 'pulse',
    dueDate: inDays(14),
    participants: [],
    seeded: false,
  };
  try {
    const stored = sessionStorage.getItem(draftKey(relationshipId));
    return stored ? { ...fallback, ...(JSON.parse(stored) as Partial<WaveDraft>) } : fallback;
  } catch {
    return fallback;
  }
}

function useDraft(relationshipId: string) {
  const [draft, setDraft] = useState<WaveDraft>(() => readDraft(relationshipId));
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(relationshipId), JSON.stringify(draft));
    } catch {
      // Ohne Speicher geht der Entwurf beim Neuladen verloren; der Ablauf funktioniert trotzdem.
    }
  }, [draft, relationshipId]);
  const clear = () => {
    try {
      sessionStorage.removeItem(draftKey(relationshipId));
    } catch {
      // siehe oben
    }
  };
  return [draft, setDraft, clear] as const;
}

export function NewWavePage({ relationshipId, step }: { relationshipId: string; step: number }) {
  const t = useT();
  const text = t.feedback;
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const format = useFormat();
  const base = feedbackPath('buyer', relationshipId);
  const [draft, setDraft, clearDraft] = useDraft(relationshipId);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const suggestions = useQuery({
    ...surveySuggestionsQueryOptions(accessToken, 'buyer', relationshipId),
    enabled: accessToken !== '',
  });
  // Vorschläge aus Team und Kontakten sind beim ersten Mal vorausgewählt.
  useEffect(() => {
    if (!suggestions.data || draft.seeded) return;
    setDraft((current) => ({
      ...current,
      seeded: true,
      participants: suggestions.data.suggestions.map((entry) => ({
        side: entry.side,
        email: entry.email,
        name: entry.name,
        function: entry.function ?? '',
      })),
    }));
  }, [suggestions.data, draft.seeded, setDraft]);
  const current = step === 2 || step === 3 ? step : 1;
  const goTo = (next: number) => {
    setError(null);
    void navigate({ to: `${base}/neu`, search: { schritt: next } });
  };
  const stepTitles = [text.steps.kind, text.steps.participants, text.steps.review];
  const counts = (side: SurveySide) =>
    draft.participants.filter((entry) => entry.side === side).length;
  const start = async () => {
    const ready = readyParticipants(draft.participants, text);
    if ('error' in ready) {
      setError(ready.error);
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const detail = await startSurveyWave(accessToken, relationshipId, {
        kind: draft.kind,
        dueDate: draft.dueDate,
        participants: ready.participants,
      });
      clearDraft();
      await queryClient.invalidateQueries({ queryKey: ['feedback', 'buyer', relationshipId] });
      flash.set(text.started);
      await navigate({ to: `${base}/${detail.wave.id}` });
    } catch (failure) {
      const code =
        failure instanceof ApiError ? (failure.body as { code?: string } | null)?.code : undefined;
      setError(code === 'welle_offen' ? text.alreadyOpen : text.startFailed);
      setStarting(false);
    }
  };
  const back = (to: number) => (
    <Button variant="secondary" onClick={() => goTo(to)}>
      {text.back}
    </Button>
  );
  return (
    <WaveFrame
      side="buyer"
      relationshipId={relationshipId}
      trail={[{ label: text.title, href: base }]}
      current={text.start}
    >
      <PageHeader title={text.start} purpose={text.purpose} />
      <div className="flex max-w-3xl flex-col gap-6">
        <StepProgress
          current={current}
          total={3}
          label={text.stepLabel}
          stepTitle={stepTitles[current - 1] ?? ''}
          steps={stepTitles}
        />
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {suggestions.isError ? (
          <ErrorState title={text.failed} />
        ) : !suggestions.data ? (
          <LoadingState label={text.loading} />
        ) : current === 1 ? (
          <form
            noValidate
            className="flex flex-col gap-6"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              goTo(2);
            }}
          >
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 font-medium">{text.kindLabel}</legend>
              {surveyKinds.map((kind) => {
                const template = suggestions.data.templates.find((entry) => entry.kind === kind);
                return (
                  <label
                    key={kind}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg bg-card shadow-card p-5 outline-primary has-checked:outline-2 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input
                      type="radio"
                      name="art"
                      value={kind}
                      checked={draft.kind === kind}
                      onChange={() => setDraft({ ...draft, kind })}
                      className="sr-only"
                    />
                    <span className="font-semibold text-lg">{text.kinds[kind]}</span>
                    <span className="text-muted-foreground">{text.kindHints[kind]}</span>
                    {template && (
                      <span className="text-muted-foreground text-sm">
                        {text.questionCount(template.questions)}
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
            <FormField label={text.dueLabel} hint={text.dueHint}>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  className="w-48"
                  min={inDays(0)}
                  value={draft.dueDate}
                  onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
                />
              )}
            </FormField>
            <StepActions next={<Button type="submit">{text.next}</Button>} />
          </form>
        ) : current === 2 ? (
          <>
            <ParticipantPicker
              sides={['buyer', 'supplier']}
              ownSide="buyer"
              suggestions={suggestions.data.suggestions}
              value={draft.participants}
              onChange={(participants) => setDraft({ ...draft, participants })}
            />
            <StepActions
              back={back(1)}
              next={
                <Button
                  onClick={() => {
                    const ready = readyParticipants(draft.participants, text);
                    if ('error' in ready) setError(ready.error);
                    else goTo(3);
                  }}
                >
                  {text.next}
                </Button>
              }
            />
          </>
        ) : (
          <>
            <dl className="flex flex-col gap-2 rounded-lg bg-card shadow-card p-5">
              <dt className="sr-only">{text.kindLabel}</dt>
              <dd className="font-semibold text-lg">
                {text.reviewText(text.kinds[draft.kind] ?? '', format.date(draft.dueDate))}
              </dd>
              {(['buyer', 'supplier'] as const).map((side) => (
                <dd key={side}>{text.reviewSide(text.sides[side] ?? side, counts(side))}</dd>
              ))}
            </dl>
            <p className="text-muted-foreground text-sm">{text.anonymous}</p>
            <StepActions
              back={back(2)}
              next={
                <Button loading={starting} onClick={() => void start()}>
                  {text.startNow}
                </Button>
              }
            />
          </>
        )}
      </div>
    </WaveFrame>
  );
}

function useWave(side: SurveySide, relationshipId: string, waveId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...surveyWaveQueryOptions(accessToken, side, relationshipId, waveId),
    enabled: accessToken !== '',
  });
  return { query, accessToken };
}

/** Eine Welle: Rücklauf je Seite als Anzahl, eigene Einladungen, Frist und Abschluss. */
export function WavePage({
  side,
  relationshipId,
  waveId,
}: {
  side: SurveySide;
  relationshipId: string;
  waveId: string;
}) {
  const t = useT();
  const text = t.feedback;
  const format = useFormat();
  const labels = useSideLabels(side);
  const queryClient = useQueryClient();
  const { query, accessToken } = useWave(side, relationshipId, waveId);
  const [message, hideMessage] = useFlash();
  const [failure, setFailure] = useState<string | null>(null);
  const base = feedbackPath(side, relationshipId);
  const data = query.data;
  const title = data ? (text.kinds[data.wave.kind] ?? text.title) : text.title;
  const close = async () => {
    setFailure(null);
    try {
      const next = await closeSurveyWave(accessToken, side, relationshipId, waveId);
      queryClient.setQueryData(['feedback', side, relationshipId, waveId], next);
      await queryClient.invalidateQueries({
        queryKey: ['feedback', side, relationshipId],
        exact: true,
      });
      flash.set(text.closed);
    } catch {
      setFailure(text.inviteFailed);
    }
  };
  return (
    <WaveFrame
      side={side}
      relationshipId={relationshipId}
      trail={[{ label: text.title, href: base }]}
      current={title}
    >
      <PageHeader
        title={title}
        purpose={data ? text.due(format.date(data.wave.dueDate)) : text.purpose}
      />
      <MyInvitationNotice relationshipId={relationshipId} waveId={waveId} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <WaveBody
          data={data}
          base={base}
          labels={labels}
          onClose={close}
          pdfPath={`${side === 'buyer' ? '/suppliers' : '/kunden'}/${relationshipId}/feedback/${waveId}/pdf`}
          freeTextSummary={
            <FeedbackThemesPanel side={side} relationshipId={relationshipId} waveId={waveId} />
          }
        />
      )}
    </WaveFrame>
  );
}

function WaveBody({
  data,
  base,
  labels,
  onClose,
  pdfPath,
  freeTextSummary,
}: {
  data: SurveyWaveDetail;
  base: string;
  labels: Record<string, string>;
  onClose: () => Promise<void>;
  /** API-Pfad des Ergebnisses als PDF (QS-03) */
  pdfPath: string;
  /** PUL-08: Themen der Freitexte */
  freeTextSummary: React.ReactNode;
}) {
  const text = useT().feedback;
  const format = useFormat();
  const { wave } = data;
  const closedAt = { buyer: wave.buyerClosedAt, supplier: wave.supplierClosedAt };
  const newActionPath = base.replace('/beziehung/feedback', '/umsetzung/massnahmen/neu');
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant={wave.revealedAt ? 'selected' : wave.status === 'open' ? 'success' : 'neutral'}
        >
          {wave.revealedAt ? text.revealed : text.statuses[wave.status]}
        </Badge>
        <span className="text-muted-foreground text-sm">{text.anonymous}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['buyer', 'supplier'] as const).map((entry) => (
          <Tile key={entry} data-side={entry}>
            <TileTitle>{labels[entry]}</TileTitle>
            <TileMetric
              value={text.turnoutShort(wave.turnout[entry].completed, wave.turnout[entry].invited)}
              label={text.turnout(wave.turnout[entry].completed, wave.turnout[entry].invited)}
            />
            {closedAt[entry] && (
              <p className="text-muted-foreground text-sm">
                {text.closedAt(labels[entry] ?? entry, format.date(closedAt[entry] ?? ''))}
              </p>
            )}
          </Tile>
        ))}
      </div>
      {(data.canInvite || data.canExtend || data.canClose) && (
        <div className="flex flex-wrap items-center gap-3">
          {data.canInvite &&
            routerLink({
              href: `${base}/${wave.id}/einladen`,
              className: buttonVariants(),
              children: (
                <>
                  <PlusIcon aria-hidden />
                  {text.invite}
                </>
              ),
            })}
          {data.canExtend &&
            routerLink({
              href: `${base}/${wave.id}/frist`,
              className: buttonVariants({ variant: 'outline' }),
              children: text.extend,
            })}
          {data.canClose && (
            <ConfirmButton
              variant="default"
              question={text.closeQuestion}
              confirmLabel={text.closeConfirm}
              cancelLabel={text.cancel}
              onConfirm={() => void onClose()}
            >
              {text.close}
            </ConfirmButton>
          )}
        </div>
      )}
      {data.results ? (
        <>
          {/* QS-03, LIF-06: Ergebnis als PDF, auf beiden Seiten mit denselben Zahlen */}
          <PdfButton path={pdfPath} fileName="Feedback-Ergebnis.pdf" />
          <ResultsSection
            results={data.results}
            side={data.ownSide}
            newActionPath={newActionPath}
            freeTextSummary={freeTextSummary}
          />
        </>
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {wave.status === 'open' ? text.waiting : text.tooFew}
        </p>
      )}
      <section aria-labelledby="welle-teilnehmende" className="flex flex-col gap-3">
        <h2
          id="welle-teilnehmende"
          className="font-display font-semibold text-section tracking-section"
        >
          {text.participants}
        </h2>
        {data.participants.length === 0 ? (
          <p className="text-muted-foreground">{text.noParticipants}</p>
        ) : (
          <ul data-slot="participants" className="overflow-hidden rounded-lg bg-card shadow-card">
            {data.participants.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-line-soft border-b px-5 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{entry.name ?? entry.email}</span>
                  <span className="truncate text-muted-foreground text-sm">
                    {entry.email} · {text.invitedAt(format.date(entry.invitedAt))}
                  </span>
                </span>
                <Badge>{text.functions[entry.function]}</Badge>
                <Badge variant="neutral">{labels[entry.side]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Weitere Teilnehmende einladen; der Lieferant nur auf seiner Seite. */
export function InvitePage({
  side,
  relationshipId,
  waveId,
}: {
  side: SurveySide;
  relationshipId: string;
  waveId: string;
}) {
  const t = useT();
  const text = t.feedback;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { query, accessToken } = useWave(side, relationshipId, waveId);
  const suggestions = useQuery({
    ...surveySuggestionsQueryOptions(accessToken, side, relationshipId),
    enabled: accessToken !== '',
  });
  const [value, setValue] = useState<DraftParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const base = feedbackPath(side, relationshipId);
  const back = `${base}/${waveId}`;
  const data = query.data;
  const taken = new Set(data?.participants.map((entry) => entry.email.toLowerCase()));
  const submit = async () => {
    const ready = readyParticipants(value, text);
    if ('error' in ready) {
      setError(ready.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await inviteSurveyParticipants(accessToken, side, relationshipId, waveId, {
        participants: ready.participants,
      });
      await queryClient.invalidateQueries({ queryKey: ['feedback', side, relationshipId] });
      flash.set(text.invited);
      await navigate({ to: back });
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 409
          ? text.alreadyInvited
          : text.inviteFailed,
      );
      setSaving(false);
    }
  };
  return (
    <WaveFrame
      side={side}
      relationshipId={relationshipId}
      trail={[
        { label: text.title, href: base },
        ...(data ? [{ label: text.kinds[data.wave.kind] ?? '', href: back }] : []),
      ]}
      current={text.inviteTitle}
    >
      <PageHeader title={text.inviteTitle} purpose={text.invitePurpose} />
      {query.isError || suggestions.isError ? (
        <ErrorState title={text.failed} />
      ) : !data || !suggestions.data ? (
        <LoadingState label={text.loading} />
      ) : !data.canInvite ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.closed}
        </p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <ParticipantPicker
            sides={side === 'buyer' ? ['buyer', 'supplier'] : ['supplier']}
            ownSide={side}
            suggestions={suggestions.data.suggestions.filter(
              (entry) => !taken.has(entry.email.toLowerCase()),
            )}
            value={value}
            onChange={setValue}
          />
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <FormActions>
            <Button variant="secondary" onClick={() => void navigate({ to: back })}>
              {text.cancel}
            </Button>
            <Button loading={saving} onClick={() => void submit()}>
              {text.invite}
            </Button>
          </FormActions>
        </div>
      )}
    </WaveFrame>
  );
}

/** Frist verlängern (Käufer, SRO oder Admin). */
export function ExtendWavePage({
  relationshipId,
  waveId,
}: {
  relationshipId: string;
  waveId: string;
}) {
  const text = useT().feedback;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { query, accessToken } = useWave('buyer', relationshipId, waveId);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const base = feedbackPath('buyer', relationshipId);
  const back = `${base}/${waveId}`;
  const data = query.data;
  const value = dueDate ?? data?.wave.dueDate ?? '';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data || value <= data.wave.dueDate) {
      setError(text.extendFailed);
      return;
    }
    setSaving(true);
    try {
      await extendSurveyWave(accessToken, relationshipId, waveId, value);
      await queryClient.invalidateQueries({ queryKey: ['feedback', 'buyer', relationshipId] });
      flash.set(text.extended);
      await navigate({ to: back });
    } catch {
      setError(text.extendFailed);
      setSaving(false);
    }
  };
  return (
    <WaveFrame
      side="buyer"
      relationshipId={relationshipId}
      trail={[
        { label: text.title, href: base },
        ...(data ? [{ label: text.kinds[data.wave.kind] ?? '', href: back }] : []),
      ]}
      current={text.extend}
    >
      <PageHeader title={text.extend} purpose={text.extendPurpose} />
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex max-w-xl flex-col gap-6"
        >
          <FormField label={text.dueLabel} hint={text.dueHint} error={error ?? undefined}>
            {(field) => (
              <Input
                {...field}
                type="date"
                className="w-48"
                min={data.wave.dueDate}
                value={value}
                onChange={(event) => setDueDate(event.target.value)}
              />
            )}
          </FormField>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => void navigate({ to: back })}>
              {text.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {text.save}
            </Button>
          </FormActions>
        </form>
      )}
    </WaveFrame>
  );
}
