import type { ObjectiveCategory } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TargetIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { routerLink } from '@/features/shell/navigation';
import {
  ApiError,
  createObjectiveCategory,
  objectiveCategoriesQueryOptions,
  updateObjectiveCategory,
} from '@/lib/api';
import { flash } from '@/lib/flash';
import { useToken } from '@/features/ratings/use-rating';
import { useT } from '@/lib/i18n';
import { useFlash } from '@/lib/flash';

const categoriesPath = '/einstellungen/zielkategorien';

export function ObjectiveCategoriesPage() {
  const t = useT();
  const accessToken = useToken();
  const canManage = useCan('stammdaten.verwalten');
  const [message, hideMessage] = useFlash();
  const query = useQuery({
    ...objectiveCategoriesQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const title = t.settings.objectiveCategories.title;

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={title}
      />
      <PageHeader
        title={title}
        purpose={t.settings.objectiveCategories.purpose}
      />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {canManage && (
        <div className="flex justify-end">
          {routerLink({
            href: `${categoriesPath}/neu`,
            className: buttonVariants(),
            children: (
              <>
                <PlusIcon aria-hidden />
                {t.settings.objectiveCategories.add}
              </>
            ),
          })}
        </div>
      )}
      {query.isError ? (
        <ErrorState title={t.settings.objectiveCategories.failed} />
      ) : !query.data ? (
        <LoadingState label={t.settings.objectiveCategories.loading} />
      ) : query.data.categories.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<TargetIcon aria-hidden />}
          title={t.settings.objectiveCategories.empty}
          description={t.masterData.emptyDescription}
        />
      ) : (
        <Table>
          <caption className="sr-only">{title}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{t.settings.objectiveCategories.name}</TableHead>
              <TableHead>{t.settings.objectiveCategories.key}</TableHead>
              <TableHead>{t.settings.objectiveCategories.position}</TableHead>
              <TableHead>{t.masterData.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.categories.map((category) => (
              <TableRow key={category.key}>
                <TableCell className="font-medium">
                  {canManage
                    ? routerLink({
                        href: `${categoriesPath}/${encodeURIComponent(category.key)}/bearbeiten`,
                        'aria-label': t.masterData.edit(category.name),
                        className:
                          'inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        children: category.name,
                      })
                    : category.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{category.key}</TableCell>
                <TableCell className="tabular-nums">{category.position}</TableCell>
                <TableCell>
                  <Badge variant={category.active ? 'success' : 'neutral'}>
                    {category.active ? t.masterData.active : t.masterData.inactive}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

export function ObjectiveCategoryFormPage({ categoryKey }: { categoryKey?: string }) {
  const t = useT();
  const accessToken = useToken();
  const canManage = useCan('stammdaten.verwalten');
  const query = useQuery({
    ...objectiveCategoriesQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const category = categoryKey
    ? query.data?.categories.find((entry) => entry.key === categoryKey)
    : undefined;
  const title = category?.name ?? t.settings.objectiveCategories.new;
  const trail = [
    { label: t.profile.title, href: '/profil' },
    { label: t.settings.title, href: '/einstellungen' },
    { label: t.settings.objectiveCategories.title, href: categoriesPath },
  ];

  if (query.isError || !query.data) {
    const pending = categoryKey ? t.settings.objectiveCategories.title : title;
    return (
      <>
        <PagePath trail={trail} current={pending} />
        <PageHeader title={pending} />
        {query.isError ? (
          <ErrorState title={t.settings.objectiveCategories.failed} />
        ) : (
          <LoadingState label={t.settings.objectiveCategories.loading} />
        )}
      </>
    );
  }
  if (categoryKey && !category) {
    return (
      <>
        <PagePath trail={trail} current={t.masterData.notFound} />
        <EmptyState
          size="lg"
          title={t.masterData.notFound}
          description={t.notFound.description}
        />
      </>
    );
  }

  return (
    <>
      <PagePath trail={trail} current={title} />
      <PageHeader
        title={title}
        purpose={
          category ? t.settings.objectiveCategories.editPurpose : t.masterData.newPurpose
        }
      />
      {canManage ? (
        <ObjectiveCategoryForm category={category} />
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      )}
    </>
  );
}

function ObjectiveCategoryForm({ category }: { category: ObjectiveCategory | undefined }) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const goBack = useGoBack(categoriesPath);
  const [form, setForm] = useState({
    key: category?.key ?? '',
    name: category?.name ?? '',
    position: category?.position ?? 1,
    active: category?.active ?? true,
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    setSaving(true);
    try {
      if (category) {
        await updateObjectiveCategory(accessToken, category.key, {
          name: form.name,
          position: form.position,
          active: form.active,
        });
      } else {
        await createObjectiveCategory(accessToken, form);
      }
      await queryClient.invalidateQueries({ queryKey: ['objective-categories'] });
      flash.set(t.masterData.saved);
      goBack();
    } catch (error) {
      const code =
        error instanceof ApiError
          ? (error.body as { code?: string } | null)?.code
          : undefined;
      setFailure(
        code === 'category_taken'
          ? t.supplierPlan.errors.category_taken
          : t.masterData.errors.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {failure && <StatusLine message={failure} tone="warning" />}
      <form className="flex max-w-xl flex-col gap-6" onSubmit={(event) => void save(event)}>
        {!category && (
          <FormField
            label={t.settings.objectiveCategories.key}
            hint={t.settings.objectiveCategories.keyHint}
          >
            {(field) => (
              <Input
                {...field}
                required
                maxLength={40}
                pattern="[a-z][a-z0-9_-]*"
                value={form.key}
                onChange={(event) => setForm({ ...form, key: event.target.value })}
              />
            )}
          </FormField>
        )}
        <FormField label={t.settings.objectiveCategories.name}>
          {(field) => (
            <Input
              {...field}
              required
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={t.settings.objectiveCategories.position}>
          {(field) => (
            <Input
              {...field}
              type="number"
              min={1}
              step={1}
              required
              value={form.position}
              onChange={(event) => setForm({ ...form, position: Number(event.target.value) })}
            />
          )}
        </FormField>
        {category && (
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox
              id="category-active"
              checked={form.active}
              onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
            />
            <label htmlFor="category-active">{t.settings.objectiveCategories.active}</label>
          </div>
        )}
        <FormActions>
          <Button type="button" variant="outline" onClick={goBack}>
            {t.supplierPlan.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {t.supplierPlan.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
