import { type RoundDetail, userFunctions } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { addRoundAssignment, roundRatersQueryOptions } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { errorCode, isNotFound, linkClass, roundsPath, useRound, useToken } from './use-round';

/** Nachnominierung (SEG-03): eine weitere Person bewertet einen Lieferanten der laufenden Runde. */
export function RoundNominatePage({ id }: { id: string }) {
  const t = useT();
  const query = useRound(id);
  const round = query.data;
  return (
    <>
      <PagePath
        trail={[
          { label: t.portfolio.title, href: '/portfolio' },
          { label: t.rounds.title, href: roundsPath },
          { label: round?.name ?? t.rounds.title, href: `${roundsPath}/${id}` },
        ]}
        current={t.rounds.nominateTitle}
      />
      <PageHeader title={t.rounds.nominateTitle} purpose={t.rounds.nominatePurpose} />
      {query.isError ? (
        <ErrorState title={isNotFound(query.error) ? t.rounds.notFound : t.rounds.failed} />
      ) : !round ? (
        <LoadingState label={t.rounds.loading} />
      ) : round.status !== 'open' ? (
        <ErrorState title={t.rounds.nominateClosed} />
      ) : !round.suppliers.some((supplier) => supplier.canNominate) ? (
        <ErrorState title={t.rounds.nominateNone} />
      ) : (
        <NominateForm round={round} />
      )}
    </>
  );
}

function NominateForm({ round }: { round: RoundDetail }) {
  const t = useT();
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const raters = useQuery({ ...roundRatersQueryOptions(accessToken), enabled: accessToken !== '' });
  const suppliers = round.suppliers.filter((supplier) => supplier.canNominate);
  const [relationshipId, setRelationshipId] = useState(suppliers[0]?.relationshipId ?? '');
  const supplier = suppliers.find((item) => item.relationshipId === relationshipId);
  const [businessUnitId, setBusinessUnitId] = useState('');
  const [materialGroupId, setMaterialGroupId] = useState('');
  const [fn, setFn] = useState<(typeof userFunctions)[number]>('purchasing');
  const [raterUserId, setRaterUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (raters.isError) return <ErrorState title={t.rounds.failed} />;
  if (!raters.data) return <LoadingState label={t.rounds.loading} />;

  const unitId = businessUnitId || supplier?.businessUnits[0]?.id || '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supplier || !unitId || !raterUserId) {
      setFailure(t.rounds.nominateFailed);
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const saved = await addRoundAssignment(accessToken, round.id, {
        relationshipId,
        businessUnitId: unitId,
        materialGroupId: materialGroupId || null,
        function: fn,
        raterUserId,
      });
      queryClient.setQueryData(['rounds', round.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['rounds'], exact: true });
      flash.set(t.rounds.nominated);
      await navigate({ to: '/portfolio/runden/$id', params: { id: round.id } });
    } catch (error) {
      const code = errorCode(error);
      setFailure(
        code === 'assignment_exists'
          ? t.rounds.nominateExists
          : code === 'round_closed'
            ? t.rounds.nominateClosed
            : t.rounds.nominateFailed,
      );
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      {failure && <StatusLine message={failure} tone="warning" />}
      <FormField label={t.rounds.nominateSupplier}>
        {(field) => (
          <NativeSelect
            {...field}
            value={relationshipId}
            onChange={(event) => {
              setRelationshipId(event.target.value);
              setBusinessUnitId('');
              setMaterialGroupId('');
            }}
          >
            {suppliers.map((item) => (
              <option key={item.relationshipId} value={item.relationshipId}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t.rounds.nominateUnit}>
        {(field) => (
          <NativeSelect
            {...field}
            value={unitId}
            onChange={(event) => setBusinessUnitId(event.target.value)}
          >
            {supplier?.businessUnits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t.rounds.nominateGroup}>
        {(field) => (
          <NativeSelect
            {...field}
            value={materialGroupId}
            onChange={(event) => setMaterialGroupId(event.target.value)}
          >
            <option value="">{t.rounds.groupNone}</option>
            {supplier?.materialGroups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t.rounds.nominateFunction}>
        {(field) => (
          <NativeSelect
            {...field}
            value={fn}
            onChange={(event) => setFn(event.target.value as typeof fn)}
          >
            {userFunctions.map((item) => (
              <option key={item} value={item}>
                {t.roles.functions[item]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={t.rounds.nominateRater}>
        {(field) => (
          <NativeSelect
            {...field}
            value={raterUserId}
            onChange={(event) => setRaterUserId(event.target.value)}
          >
            <option value="">{t.rounds.raterNone}</option>
            {raters.data.raters.map((rater) => (
              <option key={rater.id} value={rater.id}>
                {rater.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormActions>
        {routerLink({
          href: `${roundsPath}/${round.id}`,
          className: linkClass,
          children: t.rounds.cancel,
        })}
        <Button type="submit" loading={saving}>
          {t.rounds.nominateSave}
        </Button>
      </FormActions>
    </form>
  );
}
