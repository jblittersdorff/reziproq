import type { AkteCounterpart, InvitationList, TeamResponse } from '@reziproq/shared';

// AK-01 (K2-c.4): Antworten der Sicht Von <Gegenüber> für Rheintal (Vorlage K2-Akte-Geteilt):
// GET /api/beziehungen/<id>/geteilt, das Team und die Einladungen. Frische Kopie je Aufruf.

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
export const akteCounterpartRelationship = id(1);

const view: AkteCounterpart = {
  counterpart: 'Rheintal Elektronik GmbH (Demo)',
  // Neueste zuerst, wie die API sie liefert
  items: [
    {
      kind: 'topic',
      id: id(1901),
      at: '2026-11-20T09:00:00.000Z',
      personName: 'Tom Weber',
      title: 'Kapazität 2028',
      status: 'proposed',
      planYear: 2027,
    },
    {
      kind: 'comment',
      id: id(620),
      at: '2026-11-18T15:20:00.000Z',
      personName: 'Nils Ott',
      objectType: 'meeting',
      objectId: id(501),
      context: 'JBP Rheintal 2027',
      body: '@Jan-Luka Können wir die Kapazitätsplanung 2028 im JBP vorziehen? Der 8D-Bericht zur Charge 4711 folgt bis Freitag.',
    },
    {
      kind: 'business_update',
      id: id(1902),
      at: '2026-11-15T08:00:00.000Z',
      personName: null,
      planYear: 2027,
      text: 'SMT-Linie 2 ab Februar zu 92 % ausgelastet, Laminat knapp bis März.',
    },
    {
      kind: 'topic',
      id: id(1903),
      at: '2026-11-12T10:00:00.000Z',
      personName: 'Kim Kaiser',
      title: 'Prognosen früher teilen',
      status: 'merged',
      planYear: 2027,
    },
    {
      kind: 'kpi_value',
      id: id(1709),
      at: '2026-11-05T11:00:00.000Z',
      personName: 'Tom Weber',
      kpiId: id(1703),
      name: 'Liefertreue',
      unit: '%',
      period: '2026-10-01',
      value: '94.0000',
      awaitingOwn: true,
    },
    {
      kind: 'kpi_value',
      id: id(1712),
      at: '2026-11-04T11:00:00.000Z',
      personName: 'Tom Weber',
      kpiId: id(1704),
      name: 'Reklamationen je Mio. Teile',
      unit: 'ppm',
      period: '2026-10-01',
      value: '28.0000',
      awaitingOwn: false,
    },
    {
      kind: 'signature',
      id: id(1701),
      at: '2025-12-08T11:00:00.000Z',
      personName: 'Kim Kaiser',
      planYear: 2026,
    },
  ],
  obligations: {
    version: 2,
    typeName: 'Strategisch',
    sharedAt: '2026-10-15T10:00:00.000Z',
    items: [
      {
        id: id(1951),
        title: { de: 'Kapazität jedes Quartal melden', en: 'Report capacity every quarter' },
        cadence: 'quarterly',
      },
      {
        id: id(1952),
        title: { de: 'Liefertreue monatlich melden', en: 'Report delivery reliability monthly' },
        cadence: 'monthly',
      },
      {
        id: id(1953),
        title: {
          de: 'Änderungen am Prozess vorher ankündigen',
          en: 'Announce process changes in advance',
        },
        cadence: null,
      },
    ],
  },
};

const team: TeamResponse = {
  side: 'buyer',
  members: [],
  counterpart: [{ name: 'Kim Kaiser', teamRole: 'sponsor', function: null }],
  candidates: [],
  canEdit: true,
  sroDescription: null,
};

const invitations: InvitationList = {
  invitations: [
    {
      id: id(1961),
      email: 'lea-brandt@rheintal.example',
      status: 'open',
      invitedBy: 'Sara Ost',
      createdAt: '2026-11-10T09:00:00.000Z',
      expiresAt: '2026-11-24T09:00:00.000Z',
      acceptedAt: null,
    },
    {
      id: id(1962),
      email: 'mia-kuhn@rheintal.example',
      status: 'expired',
      invitedBy: 'Sara Ost',
      createdAt: '2026-10-20T09:00:00.000Z',
      expiresAt: '2026-11-03T09:00:00.000Z',
      acceptedAt: null,
    },
    {
      id: id(1963),
      email: 'kim-kaiser@rheintal.example',
      status: 'accepted',
      invitedBy: 'Sara Ost',
      createdAt: '2026-09-01T09:00:00.000Z',
      expiresAt: '2026-09-15T09:00:00.000Z',
      acceptedAt: '2026-09-02T09:00:00.000Z',
    },
  ],
  canInvite: true,
  suggestions: [
    { name: 'Kim Kaiser', email: 'kim-kaiser@rheintal.example' },
    { name: 'Nils Ott', email: 'nils-ott@rheintal.example' },
    { name: 'Tom Weber', email: 'tom-weber@rheintal.example' },
  ],
};

export interface AkteCounterpartSample {
  view: AkteCounterpart;
  team: TeamResponse;
  invitations: InvitationList;
  /** Status je Endpunkt, etwa { view: 500 } */
  status: Partial<Record<'view' | 'team' | 'invitations', number>>;
}

/** Frische Antworten für Rheintal nach der Vorlage K2-Akte-Geteilt */
export function akteCounterpartSample(): AkteCounterpartSample {
  return structuredClone({ view, team, invitations, status: {} });
}
