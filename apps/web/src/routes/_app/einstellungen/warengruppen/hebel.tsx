import { createFileRoute } from '@tanstack/react-router';
import { LeverSettingsPage } from '@/features/material-groups/settings-pages';

// WG-10 (Schritt 26): Hebelkatalog pflegen
export const Route = createFileRoute('/_app/einstellungen/warengruppen/hebel')({
  component: LeverSettingsPage,
});
