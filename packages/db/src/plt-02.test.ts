import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed, seedBuyers, seedSupplierOrg } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-02.md direkt in der Datenbank: Mandanten-Session, Rollen, RLS mit FORCE,
// eindeutige Kennungen und die Zuordnung zur Organisation beim Login.
describe('PLT-02 in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    await seed(temp.db, { nodeEnv: 'development' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  /** Führt SQL als Rolle reziproq_api aus, so wie die API es tut. */
  const asApi = <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) =>
    temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_api`);
      return (await tx.execute<T>(query)).rows;
    });

  it('Jede Anfrage setzt app.user_id und app.org_id', async () => {
    const settings = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: seedBuyers.testOem.id },
      async (tx) =>
        (
          await tx.execute<{ user_id: string; org_id: string; rolle: string }>(sql`
            select current_setting('app.user_id') as user_id,
                   current_setting('app.org_id') as org_id,
                   current_user as rolle
          `)
        ).rows[0],
    );
    expect(settings).toEqual({
      user_id: 'demo-test-oem-1',
      org_id: seedBuyers.testOem.id,
      rolle: 'reziproq_app',
    });
  });

  it.each([
    'organization',
    'organization_feature',
    'app_user',
    'relationship',
    'relationship_side',
    'relationship_spend',
    'cycle',
    'business_unit',
    'material_group',
    'relationship_business_unit',
    'relationship_material_group',
    'segment_criterion',
    'segment_model',
    'segment_type',
    'segmentation_round',
    'rating',
    'rating_assignment',
    'segment_decision',
  ])('Ohne gesetzte Session liefert %s keine Zeilen', async (table) => {
    expect(await asApi(sql`select * from ${sql.identifier(table)}`)).toEqual([]);
  });

  it('Die API-Datenbankrolle ist nicht Eigentümer der Tabellen und hat keine Sonderrechte', async () => {
    const owners = await temp.db.execute<{ tablename: string; tableowner: string }>(
      sql`select tablename, tableowner from pg_tables where schemaname = 'public'`,
    );
    expect(owners.rows.length).toBeGreaterThan(0);
    expect(owners.rows.filter((row) => row.tableowner === 'reziproq_api')).toEqual([]);

    const role = await temp.db.execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = 'reziproq_api'`,
    );
    expect(role.rows).toEqual([{ rolsuper: false, rolbypassrls: false }]);
  });

  it('RLS mit FORCE ist auf jeder Mandantentabelle aktiv', async () => {
    const tables = await temp.db.execute<{ relname: string; rls: boolean; force: boolean }>(sql`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as force
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    expect(tables.rows.map((row) => row.relname)).toEqual([
      'action',
      'action_notification',
      'action_private_source',
      'addin_registration',
      'agent',
      'agent_org_state',
      'agent_outbound_query',
      'agent_run',
      'agent_step',
      'agent_version',
      'ai_draft',
      'ai_source',
      'api_key',
      'app_user',
      'audit_event',
      'business_unit',
      'catalog_setup',
      'category_rule',
      'comment',
      'comment_mention',
      'commitment',
      'connection',
      'connection_secret',
      'cycle',
      'cycle_reminder_sent',
      'cycle_setting',
      'data_export',
      'email_log',
      'filed_mail',
      'filed_mail_attachment',
      'format_catalog_item',
      'hint',
      'import_batch',
      'import_row',
      'inbound_hook',
      'inbound_item',
      'initiative',
      'initiative_baseline',
      'initiative_impact',
      'initiative_input_month',
      'initiative_milestone',
      'initiative_share',
      'initiative_topic',
      'initiative_validation',
      'initiative_value',
      'insight_summary',
      'invitation',
      'jbp',
      'jbp_approval',
      'jbp_business_update',
      'jbp_cycle_link',
      'jbp_topic',
      'jbp_topic_origin',
      'jbp_version',
      'kpi_value',
      'lever',
      'material_group',
      'material_group_analysis',
      'material_group_approval',
      'material_group_award',
      'material_group_award_supplier',
      'material_group_candidate',
      'material_group_conflict',
      'material_group_goal',
      'material_group_initiative',
      'material_group_initiative_supplier',
      'material_group_kpi',
      'material_group_lever_choice',
      'material_group_market_force',
      'material_group_member',
      'material_group_milestone',
      'material_group_note',
      'material_group_product_group',
      'material_group_question',
      'material_group_relevance',
      'material_group_review',
      'material_group_strategy',
      'material_group_summary',
      'material_group_supplier_map_row',
      'material_group_swot_item',
      'material_group_view_assignment',
      'material_group_view_comment',
      'maturity_step',
      'meeting',
      'meeting_agenda_item',
      'meeting_attendee',
      'meeting_capture',
      'meeting_decision',
      'meeting_note',
      'meeting_participant',
      'meeting_snapshot',
      'meeting_transcript',
      'model_call',
      'note',
      'notification',
      'notification_channel',
      'notification_pref',
      'objective_category',
      'org_setting',
      'org_sso',
      'organization',
      'organization_feature',
      'outbox_event',
      'plan_approval',
      'plan_contribution',
      'plan_objective',
      'pnl_line',
      'rating',
      'rating_assignment',
      'relationship',
      'relationship_business_unit',
      'relationship_ebit_target',
      'relationship_material_group',
      'relationship_member',
      'relationship_side',
      'relationship_spend',
      'relationship_target',
      'role_description',
      'rule_catalog_item',
      'rule_set',
      'rule_set_item',
      'rule_set_note',
      'savings_reference',
      'scorecard',
      'scorecard_kpi',
      'scorecard_setting',
      'scorecard_signature',
      'segment_criterion',
      'segment_decision',
      'segment_model',
      'segment_type',
      'segmentation_round',
      'spend_period',
      'strategic_topic',
      'strategic_topic_objective',
      'supplier_account_objective',
      'supplier_account_plan',
      'supplier_alias',
      'supplier_benefit',
      'supplier_contact',
      'supplier_domain',
      'supplier_executive',
      'supplier_financial',
      'supplier_plan',
      'supplier_profile',
      'support_access_log',
      'survey_free_text',
      'survey_participant',
      'survey_response',
      'survey_result',
      'survey_template',
      'survey_wave',
      'sync_event',
      'sync_job',
      'touchpoint',
      'touchpoint_review',
      'user_identity',
      'user_setting',
      'value_data_gap',
      'value_market_signal',
      'value_opportunity',
    ]);
    expect(tables.rows.filter((row) => !row.rls || !row.force)).toEqual([]);
  });

  it('Ein Nutzer des Test-OEM sieht in der Mitgliederliste nur Mitglieder des Test-OEM', async () => {
    const members = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: seedBuyers.testOem.id },
      async (tx) =>
        (await tx.execute<{ id: string }>(sql`select id from app_user order by id`)).rows,
    );
    expect(members.map((row) => row.id)).toEqual([
      'demo-test-oem-1',
      'demo-test-oem-2',
      'demo-test-oem-3',
    ]);
  });

  it('Ohne Organisation sieht ein Nutzer nur sich selbst', async () => {
    await temp.db.execute(
      sql`insert into app_user (id, name, email) values ('ohne-org', 'Ohne Org', 'ohne@example.com') on conflict do nothing`,
    );
    const visible = await withTenant(
      temp.db,
      { userId: 'ohne-org', organizationId: null },
      async (tx) => (await tx.execute<{ id: string }>(sql`select id from app_user`)).rows,
    );
    expect(visible).toEqual([{ id: 'ohne-org' }]);
  });

  it.each(['vat_id', 'duns', 'zitadel_org_id'])(
    '%s ist eindeutig, wenn gesetzt, und darf mehrfach leer sein',
    async (column) => {
      const set = (orgId: string, value: string | null) =>
        temp.db.execute(
          sql`update organization set ${sql.identifier(column)} = ${value} where id = ${orgId}`,
        );
      await set(seedBuyers.testOem.id, 'WERT-1');
      const error = await set(seedBuyers.zweitOem.id, 'WERT-1').catch((caught: unknown) => caught);
      expect(String((error as Error).cause)).toMatch(/duplicate key|eindeutig/);
      await set(seedBuyers.testOem.id, null);
      await set(seedBuyers.zweitOem.id, null);
    },
  );

  describe('Zuordnung beim Login', () => {
    const sync = (id: string, zitadelOrgId: string | null, login: boolean) =>
      asApi(sql`select app_nutzer_synchronisieren(
        ${id}, 'Neu Nutzer', 'Neu', 'neu@example.com', ${zitadelOrgId}, ${login}, '{}'::text[], 'de'
      )`);
    const stored = async (id: string) =>
      (
        await temp.db.execute<{ organization_id: string | null; last_login_at: Date | null }>(
          sql`select organization_id, last_login_at from app_user where id = ${id}`,
        )
      ).rows[0];

    it('Beim Login wird organization_id aus der Zitadel-Organisation gesetzt', async () => {
      await temp.db.execute(
        sql`update organization set zitadel_org_id = 'zitadel-test-oem' where id = ${seedBuyers.testOem.id}`,
      );
      await sync('login-1', 'zitadel-test-oem', true);
      expect(await stored('login-1')).toMatchObject({ organization_id: seedBuyers.testOem.id });
      expect((await stored('login-1'))?.last_login_at).not.toBeNull();

      const [own] = await asApi<{ name: string; buyer: boolean }>(
        sql`select name, buyer from app_organisation_des_nutzers('login-1')`,
      );
      expect(own).toEqual({ name: 'Test-OEM (Demo)', buyer: true });
    });

    it('Bei unbekannter Organisation bleibt das Feld leer, auch wenn vorher eine gesetzt war', async () => {
      await sync('login-1', 'zitadel-unbekannt', true);
      expect(await stored('login-1')).toMatchObject({ organization_id: null });
      await sync('login-2', null, true);
      expect(await stored('login-2')).toMatchObject({ organization_id: null });
      expect(await asApi(sql`select * from app_organisation_des_nutzers('login-1')`)).toEqual([]);
    });

    it('meldet einer Organisation ohne Feature buyer keine Käuferfunktionen', async () => {
      await temp.db.execute(
        sql`update organization set zitadel_org_id = 'zitadel-lieferant' where id = ${seedSupplierOrg.id}`,
      );
      await sync('login-3', 'zitadel-lieferant', true);
      const [own] = await asApi<{ name: string; buyer: boolean }>(
        sql`select name, buyer from app_organisation_des_nutzers('login-3')`,
      );
      expect(own).toEqual({ name: 'Test-Lieferant (Demo)', buyer: false });
    });

    it('Die Kundenliste für Betreiber enthält nur Organisationen mit Feature buyer', async () => {
      const customers = await asApi<{ name: string }>(sql`select name from app_betreiber_kunden()`);
      expect(customers.map((row) => row.name)).toEqual(['Test-OEM (Demo)', 'Zweit-OEM (Demo)']);
    });

    it('Die API kommt an Tabellen nur über die Session, nicht direkt an das Protokoll', async () => {
      const error = await asApi(sql`select * from support_access_log`).catch(
        (caught: unknown) => caught,
      );
      expect(String((error as Error).cause)).toMatch(/permission denied/);
      await asApi(
        sql`select app_betreiber_protokoll('betreiber-1', ${seedBuyers.testOem.id}::uuid, 'GET /api/suppliers')`,
      );
      const logged = await temp.db.execute<{ action: string }>(
        sql`select action from support_access_log where user_id = 'betreiber-1'`,
      );
      expect(logged.rows).toEqual([{ action: 'GET /api/suppliers' }]);
    });
  });
});
