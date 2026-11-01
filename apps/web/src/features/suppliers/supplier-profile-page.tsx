import { Link } from '@tanstack/react-router';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { SettingsGroup, SettingsLinkRow, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { AuditHistory } from '@/features/audit/audit-history';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { endSupplier } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';
import { useRefreshSupplier, useSupplier } from './use-supplier';


/**
 * Strategie › Profil eines Lieferanten (PLT-03b): Stammdaten zum Lesen, eigene Werte, Status,
 * Bearbeiten, Beziehung beenden mit Bestätigung auf der Seite und der Verlauf (PLT-08).
 */
export function SupplierProfilePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const format = useFormat();
  const { accessToken } = useSupplier(relationshipId);
  const refresh = useRefreshSupplier();
  const [message, hideMessage] = useFlash();
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Global darf die Person bearbeiten; ob an dieser Beziehung, sagt das Detail (Teamrolle).
  const mayEdit = useCan('lieferanten.bearbeiten');

  const end = async () => {
    setFailed(false);
    try {
      await endSupplier(accessToken, relationshipId);
      refresh(relationshipId);
      setEnded(true);
    } catch {
      setFailed(true);
    }
  };

  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      current={t.workspace.pages.profile.title}
    >
      {(supplier) => {
        const statusLabel = {
          draft: t.suppliers.statusDraft,
          active: t.suppliers.statusActive,
          ended: t.suppliers.statusEnded,
        }[supplier.status];
        const base = `/lieferanten/${relationshipId}/strategie`;
        return (
          <>
            <PageHeader
              title={t.workspace.pages.profile.title}
              purpose={t.suppliers.profilePurpose}
              badge={<InternalBadge />}
            />
            {message && <StatusLine message={message} onHidden={hideMessage} />}
            {ended && (
              <StatusLine message={t.suppliers.endedMessage} onHidden={() => setEnded(false)} />
            )}
            {failed && (
              <p role="alert" className="text-destructive">
                {t.suppliers.saveFailed}
              </p>
            )}

            <SettingsGroup title={t.suppliers.ownValues}>
              <SettingsRow label={t.suppliers.displayName}>
                <span className="text-base">{supplier.name}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.externalRef}>
                <span className="text-base">{supplier.externalRef ?? '–'}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.notes}>
                <span className="whitespace-pre-wrap text-base">{supplier.notes ?? '–'}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.status}>
                <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>
                  {statusLabel}
                </Badge>
              </SettingsRow>
              <SettingsLinkRow
                href={`${base}/spend`}
                label={t.suppliers.spendLink}
                renderLink={routerLink}
              />
              <SettingsLinkRow
                href={`/lieferanten/${relationshipId}/beziehung/team`}
                label={t.team.link}
                renderLink={routerLink}
              />
            </SettingsGroup>
            <p className="-mt-4 px-4 text-muted-foreground text-sm">{t.suppliers.ownValuesHint}</p>

            <SettingsGroup title={t.suppliers.masterData}>
              <SettingsRow label={t.suppliers.name}>
                <span className="text-base">{supplier.organizationName}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.country}>
                <span className="text-base">
                  {format.country(supplier.country)}
                </span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.vatId}>
                <span className="text-base">{supplier.vatId ?? '–'}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.duns}>
                <span className="text-base">{supplier.duns ?? '–'}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.createdAt}>
                <span className="text-base">{format.date(supplier.createdAt)}</span>
              </SettingsRow>
              {supplier.endedAt && (
                <SettingsRow label={t.suppliers.endedAt}>
                  <span className="text-base">{format.date(supplier.endedAt)}</span>
                </SettingsRow>
              )}
            </SettingsGroup>
            <p className="-mt-4 px-4 text-muted-foreground text-sm">{t.suppliers.masterDataHint}</p>

            {mayEdit && !supplier.permissions.edit && (
              <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
                {t.team.readOnly}
              </p>
            )}
            {supplier.permissions.edit && (
              <div className="flex flex-wrap items-start gap-3">
                <Button asChild>
                  <Link
                    to="/lieferanten/$id/strategie/profil/bearbeiten"
                    params={{ id: relationshipId }}
                  >
                    <PencilIcon />
                    {t.suppliers.edit}
                  </Link>
                </Button>
                {supplier.status !== 'ended' && (
                  <ConfirmButton
                    question={t.suppliers.endQuestion}
                    confirmLabel={t.suppliers.endConfirm}
                    cancelLabel={t.suppliers.cancel}
                    onConfirm={() => void end()}
                  >
                    {t.suppliers.end}
                  </ConfirmButton>
                )}
              </div>
            )}

            <section aria-labelledby="lieferant-verlauf" className="flex flex-col gap-4">
              <h2 id="lieferant-verlauf" className="font-semibold text-lg">
                {t.suppliers.history}
              </h2>
              <AuditHistory
                objectType="relationship,relationship_side,relationship_spend"
                objectId={relationshipId}
              />
            </section>
          </>
        );
      }}
    </SupplierFrame>
  );
}
