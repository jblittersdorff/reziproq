import { type RoleDescription, saveRoleDescriptionSchema } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { roleDescriptionsQueryOptions, saveRoleDescription } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Einstellungen › Rollen (PLB-04): was der SRO macht und was nicht, nur für Admins. */
export function RolesPage() {
  const t = useT();
  const text = t.settings.roleDescriptions;
  const me = useMe();
  const canManage = useCan('einstellungen.verwalten');
  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.navTitle}
      />
      <PageHeader title={text.title} purpose={text.purpose} />
      {me.isError ? (
        <ErrorState title={t.user.failed} />
      ) : !me.data ? (
        <LoadingState label={text.loading} />
      ) : canManage ? (
        <RoleForms />
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      )}
    </>
  );
}

function RoleForms() {
  const text = useT().settings.roleDescriptions;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...roleDescriptionsQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  return (
    <>
      {query.data.map((role) => (
        <RoleForm key={role.role} role={role} accessToken={accessToken} />
      ))}
    </>
  );
}

const linesOf = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

function RoleForm({ role, accessToken }: { role: RoleDescription; accessToken: string }) {
  const t = useT();
  const text = t.settings.roleDescriptions;
  const queryClient = useQueryClient();
  const [does, setDoes] = useState(role.does.join('\n'));
  const [doesNot, setDoesNot] = useState(role.doesNot.join('\n'));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const title = role.role === 'sro' ? t.team.roleTitle : role.role;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = saveRoleDescriptionSchema.safeParse({
      does: linesOf(does),
      doesNot: linesOf(doesNot),
    });
    if (!parsed.success) {
      setFailed(true);
      return;
    }
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      queryClient.setQueryData(
        roleDescriptionsQueryOptions(accessToken).queryKey,
        await saveRoleDescription(accessToken, role.role, parsed.data),
      );
      // Die Team-Seiten zeigen die Beschreibung; sie laden sie beim nächsten Öffnen neu.
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      aria-labelledby={`rolle-${role.role}`}
      onSubmit={(event) => void submit(event)}
      className="flex max-w-3xl flex-col gap-6"
    >
      <h2 id={`rolle-${role.role}`} className="font-semibold text-lg">
        {title}
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <FormField label={text.does} hint={text.linesHint}>
          {(field) => (
            <Textarea {...field} rows={6} value={does} onChange={(e) => setDoes(e.target.value)} />
          )}
        </FormField>
        <FormField label={text.doesNot} hint={text.linesHint}>
          {(field) => (
            <Textarea
              {...field}
              rows={6}
              value={doesNot}
              onChange={(e) => setDoesNot(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <p className="text-muted-foreground text-sm">
        {role.updatedByName ? t.team.roleChangedBy(role.updatedByName) : text.isDefault}
      </p>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      {saved && <StatusLine message={text.saved} onHidden={() => setSaved(false)} />}
      <FormActions>
        <Button type="submit" disabled={saving}>
          {saving ? text.saving : text.save}
        </Button>
      </FormActions>
    </form>
  );
}
