import type { OpportunityTemplateKey } from '@reziproq/shared';

/** Titel der Hebel-Vorlagen (KI-11, Startbestand) */
export const templateTitles: Record<OpportunityTemplateKey, string> = {
  forecast_sharing: 'Prognose teilen',
  market_standard: 'Spezifikation auf Marktstandard',
  consignment: 'Konsignationslager',
  volume_bundling: 'Volumen bündeln',
  quality_costs: 'Fehlerkosten senken',
  logistics_bundling: 'Logistik bündeln',
  index_clause: 'Preisgleitklausel nach Index',
  capacity_shortage: 'Kapazität bei Marktengpass sichern',
  tariffs: 'Zölle und Herkunft',
};

/**
 * Teilbare Beschreibung für das JBP-Thema: ohne Zahl, ohne Quelle. Der SRO kann sie vor dem
 * Übernehmen ändern (KI-11, Ablauf 4).
 */
export const templateShareText: Record<OpportunityTemplateKey, string> = {
  forecast_sharing:
    'Wir möchten Bedarfsprognosen regelmäßig teilen, damit ihr Umrüstungen und Bestände besser planen könnt.',
  market_standard:
    'Wir möchten gemeinsam prüfen, welche Spezifikationen auf einen Marktstandard umgestellt werden können.',
  consignment:
    'Wir möchten ein Konsignationslager prüfen, das Bestand und Abrufe für beide vereinfacht.',
  volume_bundling:
    'Wir möchten Mengen aus mehreren Bereichen bündeln und dafür Staffeln vereinbaren.',
  quality_costs:
    'Wir möchten Fehlerursachen gemeinsam abstellen und Reklamationskosten auf beiden Seiten senken.',
  logistics_bundling: 'Wir möchten Lieferungen bündeln und die Auslastung der Transporte erhöhen.',
  index_clause:
    'Wir möchten den Materialanteil im Preis an einen öffentlichen Index koppeln, damit beide gegen starke Schwankungen abgesichert sind.',
  capacity_shortage:
    'Wir möchten Kapazität für den Fall eines Engpasses im Markt gemeinsam absichern.',
  tariffs: 'Wir möchten Herkunft der Vorprodukte und Zollfolgen gemeinsam prüfen.',
};

/** Wirkung für den Lieferanten, wo sie kein Betrag ist */
export const templateSupplierEffect: Partial<Record<OpportunityTemplateKey, string>> = {
  index_clause: 'Absicherung gegen Anstieg des Index',
};

export { templateAssumptionDefaults as templateAssumptions } from '@reziproq/shared';

/** Beschreibung je fehlender Eingabe für die Datenlücke */
export const dataGapDescriptions: Record<string, string> = {
  forecast_accuracy: 'Prognosetreue der letzten zwölf Monate',
  setups_per_year: 'Eilaufträge mit Umrüstung je Jahr',
  cost_per_setup_cents: 'Kosten je Umrüstung beim Lieferanten',
  supplier_inventory_cents: 'Sicherheitsbestand beim Lieferanten',
  eligible_quantity: 'Mengen der Teile mit Spezifikation über Standard',
  unit_price_cents: 'Preis je Teil mit Spezifikation über Standard',
  eligible_buyer_inventory_cents: 'Eigener Bestand der Teile des Lieferanten',
  annual_draws: 'Abrufe je Jahr',
  annual_storage_cost_cents: 'Lagerkosten beim Lieferanten',
  supplier_share: 'Anteil des Lieferanten am Bedarf',
  bundled_quantity: 'Mengen je Business Unit, die sich bündeln lassen',
  price_old: 'Preis je Teil heute',
  price_new: 'Staffelpreis bei gebündelter Menge',
  defects_before: 'Reklamationen je Jahr heute',
  cost_per_defect: 'Eigene Kosten je Reklamation',
  defects_after: 'Erwartete Reklamationen nach der Maßnahme',
  supplier_cost_per_defect_cents: 'Kosten je Reklamation beim Lieferanten',
  unit_cost_before: 'Logistikkosten je Lieferung heute',
  unit_cost_after: 'Logistikkosten je Lieferung gebündelt',
  quantity: 'Lieferungen je Jahr',
  utilization: 'Auslastung der Transporte',
  base_index: 'Indexwert bei Preisfestlegung (aus dem Marktumfeld)',
  current_index: 'Indexwert heute (aus dem Marktumfeld)',
  material_share: 'Materialanteil an den Herstellkosten',
  eligible_annual_cost_cents: 'Spend mit dem Lieferanten im letzten Jahr',
  market_utilization: 'Auslastung im Markt',
  own_demand: 'Eigener Bedarf je Woche',
  weekly_loss_cents: 'Kosten einer Woche Lieferausfall',
  capacity_shortfall_risk: 'Wahrscheinlichkeit und Dauer eines Lieferausfalls',
  tariff_before: 'Zollsatz bisher (aus dem Marktumfeld)',
  tariff_after: 'Zollsatz neu (aus dem Marktumfeld)',
  affected_customs_value_cents: 'Zollwert der betroffenen Vorprodukte',
  amount_out_of_range: 'Plausible Eingaben (Ergebnis außerhalb des Wertebereichs)',
};
