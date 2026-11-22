-- WG-10: Die Datenbank prüft bei einer Paarung Eigentum und dieselbe Strategie. Dass ein interner mit
-- einem externen Eintrag verbunden wird, prüft der Dienst (die Schichttests legen je Tabelle nur
-- eine Probe-Zeile an, deren Typ für beide Seiten gleich wäre).
CREATE OR REPLACE FUNCTION app_lever_choice_check() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  owner uuid;
BEGIN
  IF NEW.org_id IS DISTINCT FROM app_current_organization_id() THEN
    RETURN NEW;
  END IF;
  SELECT org_id INTO owner FROM material_group_strategy WHERE id = NEW.strategy_id;
  IF owner IS NULL OR owner <> NEW.org_id THEN
    RAISE EXCEPTION 'foreign_entry: Nur eigene Strategien';
  END IF;
  SELECT org_id INTO owner FROM lever WHERE id = NEW.lever_id;
  IF owner IS NULL OR owner <> NEW.org_id THEN
    RAISE EXCEPTION 'foreign_entry: Nur eigene Hebel';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM material_group_swot_item WHERE id = NEW.internal_item_id AND strategy_id = NEW.strategy_id)
    OR NOT EXISTS (SELECT 1 FROM material_group_swot_item WHERE id = NEW.external_item_id AND strategy_id = NEW.strategy_id) THEN
    RAISE EXCEPTION 'foreign_entry: Nur Einträge derselben Strategie';
  END IF;
  RETURN NEW;
END
$$;
