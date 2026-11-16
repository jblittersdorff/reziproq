import type {
  CategoryTeamMember,
  MaterialGroupDetail,
  MaterialGroupSummary,
  TeamRequest,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BoxesIcon, PlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ListCard, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  ApiError,
  createProductGroup,
  deleteProductGroup,
  materialGroupDetailQueryOptions,
  materialGroupOverviewQueryOptions,
  saveMaterialGroupTeam,
  updateProductGroup,
} from '@/lib/api';
import { useT } from '@/lib/i18n';

const settingsPath = '/einstellungen/warengruppen';

/**
 * WG-01: Warengruppen als Baum mit Lead, Team, Produktgruppen und Lieferanten. Ohne Warengruppen
 * zwei Wege: anlegen oder importieren (beides unter Einstellungen, nur Admins).
 */
export function MaterialGroupsPage() {
  const text = useT().materialGroupsPage;
  const accessToken = useToken();
  const query = useQuery({
    ...materialGroupOverviewQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const data = query.data;
  const roots = data?.groups.filter((group) => group.parentId === null) ?? [];
  const childrenOf = (id: string) => data?.groups.filter((group) => group.parentId === id) ?? [];
  const actions = data?.canManage ? (
    <div className="flex flex-wrap gap-2">
      {routerLink({
        href: `${settingsPath}/neu`,
        className: buttonVariants(),
        children: (
          <>
            <PlusIcon aria-hidden />
            {text.create}
          </>
        ),
      })}
      {routerLink({
        href: `${settingsPath}/import`,
        className: buttonVariants({ variant: 'secondary' }),
        children: text.import,
      })}
    </div>
  ) : null;

  return (
    <>
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : data.groups.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<BoxesIcon aria-hidden />}
          title={text.emptyTitle}
          description={data.canManage ? text.emptyText : text.emptyReadOnly}
          action={actions ?? undefined}
        />
      ) : (
        <>
          {actions}
          {data.unassignedSpendRows > 0 && (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground text-sm">
              {text.unassigned(data.unassignedSpendRows)}
            </p>
          )}
          {roots.map((root) => (
            <ListCard key={root.id} aria-label={root.name}>
              <ul>
                <GroupRow group={root} />
                {childrenOf(root.id).map((child) => (
                  <GroupRow key={child.id} group={child} nested />
                ))}
              </ul>
            </ListCard>
          ))}
        </>
      )}
    </>
  );
}

function GroupRow({ group, nested = false }: { group: MaterialGroupSummary; nested?: boolean }) {
  const text = useT().materialGroupsPage;
  return (
    <li className={nested ? 'pl-6' : undefined}>
      <ListRow asChild>
        {routerLink({
          href: `/warengruppen/${group.id}`,
          className: '',
          children: (
            <>
              <ListRowText
                title={`${group.name} · ${group.code}`}
                detail={`${group.lead ? `${text.lead}: ${group.lead.name}` : text.noLead} · ${text.counts(group.supplierCount, group.memberCount, group.productGroupCount)}`}
              />
              {!group.active && <Badge variant="neutral">{text.inactive}</Badge>}
            </>
          ),
        })}
      </ListRow>
    </li>
  );
}

/** Eine Warengruppe: Lead, Team, Produktgruppen, Lieferanten und Untergruppen. */
export function MaterialGroupPage({ id }: { id: string }) {
  const t = useT();
  const text = t.materialGroupsPage;
  const accessToken = useToken();
  const options = materialGroupDetailQueryOptions(accessToken, id);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const data = query.data;

  return (
    <>
      <PagePath
        trail={[{ label: text.title, href: '/warengruppen' }]}
        current={data?.group.name ?? text.title}
      />
      {query.isError ? (
        <>
          <PageHeader title={text.title} />
          <ErrorState title={text.failed} />
        </>
      ) : !data ? (
        <>
          <PageHeader title={text.title} />
          <LoadingState label={text.loading} />
        </>
      ) : (
        <Detail data={data} />
      )}
    </>
  );
}

function Detail({ data }: { data: MaterialGroupDetail }) {
  const text = useT().materialGroupsPage;
  const { group } = data;
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <PageHeader
        title={group.name}
        purpose={data.parent ? text.parent(data.parent.name) : text.detailPurpose}
        badge={!group.active ? <Badge variant="neutral">{text.inactive}</Badge> : undefined}
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          [text.lead, group.lead?.name ?? text.noLead],
          [text.commodityManager, group.commodityManager?.name ?? '–'],
          [text.description, group.description ?? text.noDescription],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex min-w-0 flex-col gap-1 rounded-lg bg-card p-4 shadow-card"
          >
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <TeamSection data={data} />
      <ProductGroupsSection data={data} />
      <section aria-labelledby="wg-suppliers" className="flex flex-col gap-3">
        <h2 id="wg-suppliers" className="font-semibold text-lg">
          {text.suppliers}
        </h2>
        {data.suppliers.length === 0 ? (
          <p className="text-muted-foreground">{text.suppliersEmpty}</p>
        ) : (
          <ListCard>
            <ul>
              {data.suppliers.map((supplier) => (
                <li key={supplier.relationshipId}>
                  <ListRow asChild>
                    {routerLink({
                      href: `/lieferanten/${supplier.relationshipId}`,
                      className: '',
                      children: (
                        <>
                          <ListRowText title={supplier.name} />
                          <span className="flex flex-wrap gap-2">
                            {supplier.isPrimary && <Badge variant="shared">{text.primary}</Badge>}
                            <Badge variant="neutral">{text.sources[supplier.source]}</Badge>
                          </span>
                        </>
                      ),
                    })}
                  </ListRow>
                </li>
              ))}
            </ul>
          </ListCard>
        )}
      </section>
      {data.children.length > 0 && (
        <section aria-labelledby="wg-children" className="flex flex-col gap-3">
          <h2 id="wg-children" className="font-semibold text-lg">
            {text.children}
          </h2>
          <ListCard>
            <ul>
              {data.children.map((child) => (
                <li key={child.id}>
                  <ListRow asChild>
                    {routerLink({
                      href: `/warengruppen/${child.id}`,
                      className: '',
                      children: <ListRowText title={`${child.name} · ${child.code}`} />,
                    })}
                  </ListRow>
                </li>
              ))}
            </ul>
          </ListCard>
        </section>
      )}
    </div>
  );
}

function useSave(id: string) {
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const text = useT().materialGroupsPage;
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: (token: string) => Promise<MaterialGroupDetail>) => {
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      queryClient.setQueryData(
        materialGroupDetailQueryOptions(accessToken, id).queryKey,
        await work(accessToken),
      );
      await queryClient.invalidateQueries({ queryKey: ['warengruppen'], exact: true });
      setMessage(text.saved);
      return true;
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;
      setFailure((code && text.errors[code]) || text.failedSave);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, message, failure, busy, clear: () => setMessage(null) };
}

type DraftMember = TeamRequest['members'][number];

function TeamSection({ data }: { data: MaterialGroupDetail }) {
  const text = useT().materialGroupsPage;
  const save = useSave(data.group.id);
  const [editing, setEditing] = useState(false);
  const editable = data.members.filter(
    (member) => member.role === 'buyer' || member.role === 'function',
  );
  const [draft, setDraft] = useState<DraftMember[]>([]);
  const start = () => {
    setDraft(
      editable.map((member) => ({
        userId: member.userId,
        role: member.role as 'buyer' | 'function',
        businessUnitId: member.businessUnit?.id ?? null,
        region: member.region,
        task: member.task,
      })),
    );
    setEditing(true);
  };
  const update = (index: number, change: Partial<DraftMember>) =>
    setDraft((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...change } : entry)),
    );

  return (
    <section aria-labelledby="wg-team" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wg-team" className="font-semibold text-lg">
          {text.team}
        </h2>
        {data.canEdit && !editing && (
          <Button variant="secondary" size="sm" onClick={start}>
            {text.editTeam}
          </Button>
        )}
      </div>
      {save.message && <StatusLine message={save.message} onHidden={save.clear} />}
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {!editing ? (
        data.members.length === 0 ? (
          <p className="text-muted-foreground">{text.teamEmpty}</p>
        ) : (
          <ListCard>
            <ul>
              {data.members.map((member: CategoryTeamMember) => (
                <li key={member.id}>
                  <ListRow>
                    <ListRowText
                      title={member.name}
                      detail={
                        [member.businessUnit?.name, member.region, member.task]
                          .filter(Boolean)
                          .join(' · ') || undefined
                      }
                    />
                    <Badge variant={member.role === 'lead' ? 'shared' : 'neutral'}>
                      {text.roles[member.role]}
                    </Badge>
                  </ListRow>
                </li>
              ))}
            </ul>
          </ListCard>
        )
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            const done = await save.run((token) =>
              saveMaterialGroupTeam(token, data.group.id, {
                members: draft.filter((entry) => entry.userId),
              }),
            );
            if (done) setEditing(false);
          }}
        >
          <p className="text-muted-foreground text-sm">{text.teamHint}</p>
          {draft.map((entry, index) => (
            <fieldset
              // biome-ignore lint/suspicious/noArrayIndexKey: Entwurfszeilen haben keine eigene ID
              key={index}
              className="grid gap-3 rounded-lg bg-card p-4 shadow-card sm:grid-cols-2"
            >
              <legend className="sr-only">{`${text.person} ${index + 1}`}</legend>
              <FormField label={text.person}>
                {(field) => (
                  <NativeSelect
                    {...field}
                    value={entry.userId}
                    onChange={(event) => update(index, { userId: event.target.value })}
                  >
                    <option value="">–</option>
                    {data.people.map((person) => (
                      <option key={person.userId} value={person.userId}>
                        {person.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField label={text.role}>
                {(field) => (
                  <NativeSelect
                    {...field}
                    value={entry.role}
                    onChange={(event) =>
                      update(index, { role: event.target.value as 'buyer' | 'function' })
                    }
                  >
                    <option value="buyer">{text.roles.buyer}</option>
                    <option value="function">{text.roles.function}</option>
                  </NativeSelect>
                )}
              </FormField>
              <FormField label={text.businessUnit}>
                {(field) => (
                  <NativeSelect
                    {...field}
                    value={entry.businessUnitId ?? ''}
                    onChange={(event) =>
                      update(index, { businessUnitId: event.target.value || null })
                    }
                  >
                    <option value="">{text.noBusinessUnit}</option>
                    {data.businessUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField label={text.region}>
                {(field) => (
                  <Input
                    {...field}
                    value={entry.region ?? ''}
                    maxLength={100}
                    onChange={(event) => update(index, { region: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label={text.task} className="sm:col-span-2">
                {(field) => (
                  <Input
                    {...field}
                    value={entry.task ?? ''}
                    maxLength={200}
                    onChange={(event) => update(index, { task: event.target.value })}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
              >
                {text.remove}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() =>
              setDraft((current) => [
                ...current,
                { userId: '', role: 'buyer', businessUnitId: null },
              ])
            }
          >
            <PlusIcon aria-hidden />
            {text.addMember}
          </Button>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              {text.cancel}
            </Button>
            <Button type="submit" loading={save.busy}>
              {text.saveTeam}
            </Button>
          </FormActions>
        </form>
      )}
    </section>
  );
}

function ProductGroupsSection({ data }: { data: MaterialGroupDetail }) {
  const text = useT().materialGroupsPage;
  const id = data.group.id;
  const save = useSave(id);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  return (
    <section aria-labelledby="wg-product-groups" className="flex flex-col gap-3">
      <h2 id="wg-product-groups" className="font-semibold text-lg">
        {text.productGroups}
      </h2>
      {save.message && <StatusLine message={save.message} onHidden={save.clear} />}
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {data.productGroups.length === 0 ? (
        <p className="text-muted-foreground">{text.productGroupsEmpty}</p>
      ) : (
        <ListCard>
          <ul>
            {data.productGroups.map((group) => (
              <li key={group.id}>
                <ListRow>
                  {renaming?.id === group.id ? (
                    <form
                      className="flex flex-1 flex-wrap items-end gap-2"
                      onSubmit={async (event: FormEvent) => {
                        event.preventDefault();
                        const done = await save.run((token) =>
                          updateProductGroup(token, id, group.id, { name: renaming.name }),
                        );
                        if (done) setRenaming(null);
                      }}
                    >
                      <FormField label={text.productGroupName} className="min-w-0 flex-1 basis-48">
                        {(field) => (
                          <Input
                            {...field}
                            value={renaming.name}
                            maxLength={100}
                            onChange={(event) =>
                              setRenaming({ id: group.id, name: event.target.value })
                            }
                          />
                        )}
                      </FormField>
                      <Button type="submit" size="sm" loading={save.busy}>
                        {text.save}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <ListRowText title={group.name} detail={group.description ?? undefined} />
                      {data.canEdit && (
                        <span className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            aria-label={`${text.rename}: ${group.name}`}
                            onClick={() => setRenaming({ id: group.id, name: group.name })}
                          >
                            {text.rename}
                          </Button>
                          <ConfirmButton
                            question={`${text.deleteProductGroup}: ${group.name}?`}
                            confirmLabel={text.deleteProductGroup}
                            cancelLabel={text.cancel}
                            onConfirm={() =>
                              void save.run((token) => deleteProductGroup(token, id, group.id))
                            }
                          >
                            {text.deleteProductGroup}
                          </ConfirmButton>
                        </span>
                      )}
                    </>
                  )}
                </ListRow>
              </li>
            ))}
          </ul>
        </ListCard>
      )}
      {data.canEdit && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            if (!name.trim()) return;
            const done = await save.run((token) => createProductGroup(token, id, { name }));
            if (done) setName('');
          }}
        >
          <FormField label={text.newProductGroup} className="min-w-0 flex-1 basis-60">
            {(field) => (
              <Input
                {...field}
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FormField>
          <Button type="submit" variant="secondary" disabled={!name.trim()} loading={save.busy}>
            {text.add}
          </Button>
        </form>
      )}
    </section>
  );
}
