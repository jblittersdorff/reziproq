import { type PublicInvitation, type SupplierTeamRole, supplierTeamRoles } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { CircleCheckIcon, KeyRoundIcon, LinkIcon, TimerOffIcon } from 'lucide-react';
import { createContext, type FormEvent, type ReactNode, useContext, useState } from 'react';
import { Logo } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
import { PageHeader } from '@/features/shell/page-header';
import { ApiError, acceptInvitation, publicInvitationQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// LIF-01a: Einladung annehmen ohne Login, in drei Schritten mit je eigener Adresse:
// /einladung/<token> (Willkommen), …/name (Name und Rolle), …/passkey (Passkey einrichten).

interface Draft {
  name: string;
  teamRole: SupplierTeamRole | null;
}

interface AcceptContext {
  token: string;
  invitation: PublicInvitation;
  draft: Draft;
  setDraft: (draft: Draft) => void;
}

const Context = createContext<AcceptContext | null>(null);

function useAccept(): AcceptContext {
  const value = useContext(Context);
  if (!value) throw new Error('useAccept braucht AcceptLayout');
  return value;
}

const totalSteps = 3;

/** Schmale Spalte wie vor dem Login, mit dem Namen der App über dem Titel. */
function AcceptFrame({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <main id="inhalt" className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:py-16">
      <Logo name={t.app.name} />
      {children}
    </main>
  );
}

/**
 * Rahmen für alle drei Schritte: lädt die Einladung einmal und hält Name und Rolle, solange die
 * Person zwischen den Schritten wechselt. Ein ungültiger Link zeigt sofort einen klaren Hinweis.
 */
export function AcceptLayout({ token, children }: { token: string; children: ReactNode }) {
  const t = useT();
  const text = t.acceptInvitation;
  const query = useQuery(publicInvitationQueryOptions(token));
  const [draft, setDraft] = useState<Draft>({ name: '', teamRole: null });

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <AcceptFrame>
        <PageHeader title={text.title} />
        {notFound ? (
          <EmptyState
            size="lg"
            icon={<LinkIcon aria-hidden />}
            title={text.notFoundTitle}
            description={text.notFoundDescription}
          />
        ) : (
          <ErrorState title={text.failed} />
        )}
      </AcceptFrame>
    );
  }
  if (!query.data) {
    return (
      <AcceptFrame>
        <PageHeader title={text.title} />
        <LoadingState label={text.loading} />
      </AcceptFrame>
    );
  }
  const invitation = query.data;
  if (invitation.status !== 'open') {
    return (
      <AcceptFrame>
        <PageHeader title={text.title} />
        <Unavailable invitation={invitation} />
      </AcceptFrame>
    );
  }
  return (
    <Context.Provider value={{ token, invitation, draft, setDraft }}>
      <AcceptFrame>
        <PageHeader
          title={text.welcomeTitle(invitation.customer)}
          purpose={text.forSupplier(invitation.supplier)}
        />
        {children}
      </AcceptFrame>
    </Context.Provider>
  );
}

function Unavailable({ invitation }: { invitation: PublicInvitation }) {
  const text = useT().acceptInvitation;
  if (invitation.status === 'used') {
    return (
      <EmptyState
        size="lg"
        icon={<CircleCheckIcon aria-hidden />}
        title={text.usedTitle}
        description={text.usedDescription}
        action={
          <Button asChild>
            <Link to="/start">{text.login}</Link>
          </Button>
        }
      />
    );
  }
  const expired = invitation.status === 'expired';
  return (
    <EmptyState
      size="lg"
      icon={<TimerOffIcon aria-hidden />}
      title={expired ? text.expiredTitle : text.revokedTitle}
      description={
        expired
          ? text.expiredDescription(invitation.customer)
          : text.revokedDescription(invitation.customer)
      }
    />
  );
}

function Progress({ step }: { step: 1 | 2 | 3 }) {
  const text = useT().acceptInvitation;
  return (
    <StepProgress
      current={step}
      total={totalSteps}
      label={text.step}
      stepTitle={text.stepTitles[step - 1] as string}
      steps={[...text.stepTitles]}
    />
  );
}

/** Schritt 1: Wer einlädt und was die Person erwartet. */
export function WelcomeStep() {
  const text = useT().acceptInvitation;
  const navigate = useNavigate();
  const { token, invitation } = useAccept();
  return (
    <div className="flex flex-col gap-6">
      <Progress step={1} />
      <p>
        {invitation.sro
          ? text.welcomeBy(invitation.sro, invitation.customer)
          : text.welcomeWithoutSro(invitation.customer)}
      </p>
      <section aria-labelledby="erwartet" className="flex flex-col gap-3">
        <h2 id="erwartet" className="font-medium">
          {text.expectTitle}
        </h2>
        <ul className="flex flex-col gap-2 text-muted-foreground">
          {text.expect.map((line) => (
            <li key={line} className="flex gap-2">
              <CircleCheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              {line}
            </li>
          ))}
        </ul>
      </section>
      <StepActions
        next={
          <Button
            onClick={() => void navigate({ to: '/einladung/$token/name', params: { token } })}
          >
            {text.next}
          </Button>
        }
      />
    </div>
  );
}

/** Schritt 2: nur Name und Rolle; alles andere ist vorbelegt. */
export function NameStep() {
  const text = useT().acceptInvitation;
  const navigate = useNavigate();
  const { token, invitation, draft, setDraft } = useAccept();
  const [errors, setErrors] = useState<{ name?: string; role?: string }>({});
  const roles = supplierTeamRoles.filter((role) => role !== 'sro' || !invitation.kamTaken);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: { name?: string; role?: string } = {};
    if (draft.name.trim().length < 2) next.name = text.nameRequired;
    if (!draft.teamRole) next.role = text.role;
    setErrors(next);
    if (next.name || next.role) return;
    void navigate({ to: '/einladung/$token/passkey', params: { token } });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <Progress step={2} />
      <FormField label={text.name} hint={text.nameHint} error={errors.name}>
        {(field) => (
          <Input
            {...field}
            name="name"
            autoComplete="name"
            maxLength={120}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        )}
      </FormField>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">{text.role}</legend>
        {roles.map((role) => (
          <label
            key={role}
            className={cn(
              'flex cursor-pointer gap-3 rounded-lg border px-4 py-3',
              draft.teamRole === role ? 'border-primary bg-primary-soft' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="teamRole"
              value={role}
              checked={draft.teamRole === role}
              onChange={() => setDraft({ ...draft, teamRole: role })}
              className="mt-1 size-4 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{text.roles[role]}</span>
              <span className="text-muted-foreground text-sm">{text.roleHints[role]}</span>
            </span>
          </label>
        ))}
        {invitation.kamTaken && <p className="text-muted-foreground text-sm">{text.kamTaken}</p>}
        {errors.role && (
          <p role="alert" className="text-destructive text-sm">
            {errors.role}
          </p>
        )}
      </fieldset>
      <StepActions
        back={
          <Button asChild variant="secondary">
            <Link to="/einladung/$token" params={{ token }}>
              {text.back}
            </Link>
          </Button>
        }
        next={<Button type="submit">{text.next}</Button>}
      />
    </form>
  );
}

/** Schritt 3: annehmen und weiter zur Einrichtung des Passkeys bei Zitadel. */
export function PasskeyStep() {
  const text = useT().acceptInvitation;
  const { locale } = useLocale();
  const { token, draft } = useAccept();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Nach einem Neuladen fehlen Name und Rolle: zurück zu Schritt 2.
  if (!draft.teamRole || draft.name.trim().length < 2) {
    return <Navigate to="/einladung/$token/name" params={{ token }} replace />;
  }
  const teamRole = draft.teamRole;

  const accept = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const { next } = await acceptInvitation(token, {
        name: draft.name.trim(),
        teamRole,
        locale,
      });
      window.location.assign(next);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      setFailure(status === 503 ? text.acceptUnavailable : text.acceptFailed);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Progress step={3} />
      <div className="flex gap-3">
        <KeyRoundIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>{text.passkeyText}</p>
      </div>
      {failure && (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      )}
      <StepActions
        back={
          <Button asChild variant="secondary">
            <Link to="/einladung/$token/name" params={{ token }}>
              {text.back}
            </Link>
          </Button>
        }
        next={
          <Button loading={busy} onClick={() => void accept()}>
            {text.passkeyButton}
          </Button>
        }
      />
    </div>
  );
}
