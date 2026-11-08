import type { FocusDetail } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { setFocus } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useFocusDetail } from './use-portfolio';

/** Portfolio › Fokuslieferanten › Lieferant (SEG-02): Kennzahlen und der Schalter mit Pflicht-Begründung. */
export function FocusDetailPage({ id }: { id: string }) {
  const t = useT();
  const text = t.portfolio.focusPage;
  const query = useFocusDetail(id);
  const data = query.data;
  return (
    <>
      <PagePath
        trail={[
          { label: t.portfolio.title, href: '/portfolio' },
          { label: text.title, href: '/portfolio/fokus' },
        ]}
        current={data?.name ?? text.title}
      />
      {query.isError ? (
        <>
          <PageHeader title={text.title} />
          <ErrorState title={text.detailFailed} />
        </>
      ) : !data ? (
        <>
          <PageHeader title={text.title} />
          <LoadingState label={text.detailLoading} />
        </>
      ) : (
        <>
          <PageHeader title={data.name} purpose={text.detailPurpose} />
          <FocusForm data={data} />
        </>
      )}
    </>
  );
}

function FocusForm({ data }: { data: FocusDetail }) {
  const t = useT();
  const text = t.portfolio.focusPage;
  const format = useFormat();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const [isFocus, setIsFocus] = useState(data.isFocus);
  const [reason, setReason] = useState(data.reason ?? '');
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const type = (levels: FocusDetail['ist']) => levels?.typeName ?? text.none;

  const submit = async () => {
    if (reason.trim() === '') {
      setMissing(true);
      return;
    }
    setMissing(false);
    setState('saving');
    try {
      await setFocus(accessToken, data.relationshipId, { isFocus, reason });
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setState('saved');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          [
            text.spend(data.spendYear),
            data.spendCents > 0
              ? format.money(
                  { amountCents: data.spendCents, currency: data.currency },
                  { wholeUnits: true },
                )
              : '–',
          ],
          [text.shareLabel, text.share(String(data.sharePercent))],
          [text.ist, type(data.ist)],
          [text.soll, type(data.soll)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="font-semibold text-lg">{value}</dd>
          </div>
        ))}
      </dl>
      {data.setAt && data.setBy && (
        <p className="text-muted-foreground text-sm">
          {text.setBy(data.setBy, format.date(data.setAt))}
        </p>
      )}
      {data.canEdit ? (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex min-h-12 items-center gap-3">
            <Switch id="focus-toggle" checked={isFocus} onCheckedChange={setIsFocus} />
            <label htmlFor="focus-toggle" className="text-base">
              {text.toggle}
            </label>
          </div>
          <FormField
            label={text.reason}
            hint={text.reasonHint}
            error={missing ? text.reasonRequired : undefined}
          >
            {(props) => (
              <Textarea
                {...props}
                value={reason}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
          {state === 'saved' && (
            <StatusLine message={text.saved} onHidden={() => setState('idle')} />
          )}
          {state === 'failed' && (
            <p role="alert" className="text-destructive text-sm">
              {text.saveFailed}
            </p>
          )}
          <Button type="submit" loading={state === 'saving'}>
            {text.save}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-sm">{text.readOnly}</p>
      )}
    </div>
  );
}
