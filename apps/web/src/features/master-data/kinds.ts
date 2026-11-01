import type { BusinessUnit, MaterialGroup } from '@reziproq/shared';
import type { MasterDataKind } from '@/lib/api';
import type { Messages } from '@/locales/de';

/** Business Units und Warengruppen teilen Liste und Formular (PLT-06); das unterscheidet sie. */
export interface KindConfig {
  kind: MasterDataKind;
  /** Adresse der Liste unter Einstellungen */
  path: string;
  title: (t: Messages) => string;
  purpose: (t: Messages) => string;
  newTitle: (t: Messages) => string;
  emptyTitle: (t: Messages) => string;
  createFirst: (t: Messages) => string;
  /** Warengruppen haben eine Oberebene */
  hasParent: boolean;
}

export type Entry = BusinessUnit & Partial<Pick<MaterialGroup, 'parentId' | 'childCount'>>;

export const kinds = {
  'business-units': {
    kind: 'business-units',
    path: '/einstellungen/business-units',
    title: (t) => t.masterData.businessUnits,
    purpose: (t) => t.masterData.businessUnitsPurpose,
    newTitle: (t) => t.masterData.newBusinessUnit,
    emptyTitle: (t) => t.masterData.emptyBusinessUnitsTitle,
    createFirst: (t) => t.masterData.createFirstBusinessUnit,
    hasParent: false,
  },
  'material-groups': {
    kind: 'material-groups',
    path: '/einstellungen/warengruppen',
    title: (t) => t.masterData.materialGroups,
    purpose: (t) => t.masterData.materialGroupsPurpose,
    newTitle: (t) => t.masterData.newMaterialGroup,
    emptyTitle: (t) => t.masterData.emptyMaterialGroupsTitle,
    createFirst: (t) => t.masterData.createFirstMaterialGroup,
    hasParent: true,
  },
} satisfies Record<MasterDataKind, KindConfig>;
