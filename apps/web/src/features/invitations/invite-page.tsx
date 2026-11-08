import { inviteSupplierRequestSchema } from '@reziproq/shared';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { ApiError, inviteSupplier } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { useInvitations, useRefreshInvitations } from './use-invitations';

/** Lieferant › Beziehung › Team › Einladen (LIF-01a): E-Mail und kurze persönliche Nachricht. */
export function InvitePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const teamPath = `/lieferanten/${relationshipId}/beziehung/team`;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="relationship"
      trail={() => [{ label: t.team.title, href: teamPath }]}
      current={t.invitations.formTitle}
      header={<PageHeader title={t.invitations.formTitle} purpose={t.invitations.formPurpose} />}
    >
      {() => <InviteForm relationshipId={relationshipId} teamPath={teamPath} />}
    </SupplierFrame>
  );
}

function InviteForm({ relationshipId, teamPath }: { relationshipId: string; teamPath: string }) {
  const t = useT();
  const text = t.invitations;
  const invitations = useInvitations(relationshipId);
  const refresh = useRefreshInvitations();
  const goBack = useGoBack(teamPath);
  const suggestionsId = useId();
  const [form, setForm] = useState({ email: '', message: '' });
  const [emailError, setEmailError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (invitations.isError) return <ErrorState title={text.failed} />;
  if (!invitations.data) return <LoadingState label={text.loading} />;
  if (!invitations.data.canInvite) {
    return (
      <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
        {text.noPermission}
      </p>
    );
  }
  const suggestions = invitations.data.suggestions;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const parsed = inviteSupplierRequestSchema.safeParse({
      email: form.email,
      ...(form.message.trim() ? { message: form.message } : {}),
    });
    if (!parsed.success) {
      setEmailError(text.errors.invalid_email);
      return;
    }
    setEmailError(undefined);
    setSaving(true);
    try {
      await inviteSupplier(invitations.accessToken, relationshipId, parsed.data);
      await refresh(relationshipId);
      flash.set(text.sent(parsed.data.email));
      goBack();
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: string } | undefined)?.code : undefined;
      if (code === 'already_invited') setEmailError(text.errors.already_invited);
      else if (code === 'relationship_ended') setFailure(text.errors.relationship_ended);
      else setFailure(text.errors.failed);
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-xl flex-col gap-6"
    >
      <FormField
        label={text.email}
        hint={suggestions.length > 0 ? text.emailHint : undefined}
        error={emailError}
      >
        {(field) => (
          <Input
            {...field}
            name="email"
            type="email"
            autoComplete="off"
            list={suggestions.length > 0 ? suggestionsId : undefined}
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        )}
      </FormField>
      {suggestions.length > 0 && (
        <datalist id={suggestionsId}>
          {suggestions.map((contact) => (
            <option key={contact.email} value={contact.email}>
              {contact.name}
            </option>
          ))}
        </datalist>
      )}
      <FormField label={text.message} hint={text.messageHint}>
        {(field) => (
          <Textarea
            {...field}
            name="message"
            rows={4}
            maxLength={500}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
          />
        )}
      </FormField>
      {failure && (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.submit}
        </Button>
      </FormActions>
    </form>
  );
}
