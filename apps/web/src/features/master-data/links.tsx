import { NetworkIcon, TagsIcon } from 'lucide-react';
import { SettingsLinkRow } from '@/components/ui/settings-group';
import { routerLink } from '@/features/shell/navigation';
import { useT } from '@/lib/i18n';

/** Wege zu Business Units und Warengruppen (PLT-06), für jedes Mitglied eines Käufers. */
export function MasterDataLinks() {
  const t = useT();
  return (
    <>
      <SettingsLinkRow
        href="/einstellungen/business-units"
        label={t.masterData.businessUnits}
        description={t.masterData.businessUnitsHint}
        icon={<NetworkIcon aria-hidden />}
        renderLink={routerLink}
      />
      <SettingsLinkRow
        href="/einstellungen/warengruppen"
        label={t.masterData.materialGroups}
        description={t.masterData.materialGroupsHint}
        icon={<TagsIcon aria-hidden />}
        renderLink={routerLink}
      />
    </>
  );
}
