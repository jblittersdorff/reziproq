import { type OrganizationMember, orgRoles, userFunctions } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchXIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep } from '@/components/ui/next-step';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Switch } from '@/components/ui/switch';
import { AuditHistory } from '@/features/audit/audit-history';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { ApiError, approveMember, memberQueryOptions, updateMember } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';

/**
 * Einstellungen › Organisation › Mitglied (PLT-05): Rolle, Controlling und Standardfunktion.
 * Ändern darf nur ein Admin (can() im Backend); Speichern führt zur Liste zurück.
 */
export function MemberPage({ userId }: { userId: string }) {
  const t = useT();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const member = useQuery({
    ...memberQueryOptions(accessToken, userId),
    enabled: accessToken !== '',
  });
  const trail = [
    { label: t.profile.title, href: '/profil' },
    { label: t.settings.title, href: '/einstellungen' },
    { label: t.settings.organization, href: '/einstellungen/organisation' },
  ];

  if (member.error instanceof ApiError && member.error.status === 404) {
    return (
      <>
        <PagePath trail={trail} current={t.settings.memberNotFound} />
        <EmptyState
          size="lg"
          icon={<SearchXIcon aria-hidden />}
          title={t.settings.memberNotFound}
          description={t.notFound.description}
        />
      </>
    );
  }
  if (member.isError) return <ErrorState title={t.settings.memberFailed} />;
  if (!member.data) return <LoadingState label={t.settings.memberLoading} />;

  return (
    <>
      <PagePath trail={trail} current={member.data.name} />
      <PageHeader title={member.data.name} purpose={t.settings.memberPurpose} />
      {member.data.approvalPending && (
        <ApproveMember member={member.data} accessToken={accessToken} />
      )}
      <MemberForm member={member.data} accessToken={accessToken} />
      <section aria-labelledby="mitglied-verlauf" className="flex flex-col gap-4">
        <h2 id="mitglied-verlauf" className="font-semibold text-lg">
          {t.settings.history}
        </h2>
        <AuditHistory objectType="app_user_role" objectId={member.data.id} />
      </section>
    </>
  );
}

/**
 * IN-02: Neue Person aus der Firmen-Domain prüfen. Tinte-Karte mit genau einer Hauptaktion; bis zur
 * Freigabe sieht die Person nichts (can() im Backend).
 */
function ApproveMember({
  member,
  accessToken,
}: {
  member: OrganizationMember;
  accessToken: string;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const canChange = useCan('rollen.aendern');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const approve = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const approved = await approveMember(accessToken, member.id);
      queryClient.setQueryData(memberQueryOptions(accessToken, member.id).queryKey, approved);
      await queryClient.invalidateQueries({ queryKey: ['organisation'] });
      await queryClient.invalidateQueries({ queryKey: ['start'] });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <NextStep
      eyebrow={t.settings.pendingBadge}
      title={t.settings.approveTitle}
      text={failed ? t.settings.memberFailed : t.settings.approveText}
      {...(canChange && {
        action: (
          <Button variant="mint" size="hero" loading={busy} onClick={() => void approve()}>
            {t.settings.approve}
          </Button>
        ),
      })}
    />
  );
}

function MemberForm({ member, accessToken }: { member: OrganizationMember; accessToken: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const canChange = useCan('rollen.aendern');
  const goBack = useGoBack('/einstellungen/organisation');
  const [form, setForm] = useState({
    orgRole: member.orgRole,
    isControlling: member.isControlling,
    defaultFunction: member.defaultFunction,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateMember(accessToken, member.id, form);
      void queryClient.invalidateQueries({ queryKey: ['organisation'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      flash.set(t.settings.saved);
      goBack();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? t.settings.lastAdmin
          : t.settings.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-xl flex-col gap-6"
    >
      <fieldset disabled={!canChange} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <SegmentedControl
            label={t.settings.memberRole}
            value={form.orgRole}
            onChange={(orgRole) => setForm({ ...form, orgRole })}
            options={orgRoles.map((role) => ({ value: role, label: t.roles[role] }))}
          />
          <p className="text-muted-foreground text-sm">{t.settings.roleHint}</p>
        </div>
        <div className="flex items-start gap-3">
          <Switch
            id="mitglied-controlling"
            checked={form.isControlling}
            onCheckedChange={(isControlling) => setForm({ ...form, isControlling })}
            aria-describedby="mitglied-controlling-hinweis"
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="mitglied-controlling" className="font-medium text-base">
              {t.settings.controllingLabel}
            </label>
            <p id="mitglied-controlling-hinweis" className="text-muted-foreground text-sm">
              {t.settings.controllingHint}
            </p>
          </div>
        </div>
        <FormField label={t.settings.defaultFunction} hint={t.settings.defaultFunctionHint}>
          {(field) => (
            <NativeSelect
              {...field}
              name="defaultFunction"
              value={form.defaultFunction ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  defaultFunction: (event.target.value as (typeof userFunctions)[number]) || null,
                })
              }
            >
              <option value="">{t.settings.noFunction}</option>
              {userFunctions.map((fn) => (
                <option key={fn} value={fn}>
                  {t.roles.functions[fn]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {t.settings.cancel}
        </Button>
        {canChange && (
          <Button type="submit" disabled={saving}>
            {saving ? t.settings.saving : t.settings.save}
          </Button>
        )}
      </FormActions>
    </form>
  );
}
