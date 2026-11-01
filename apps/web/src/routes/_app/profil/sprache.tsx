import { createFileRoute } from '@tanstack/react-router';
import { LanguagePage } from '@/features/profile/language-page';

export const Route = createFileRoute('/_app/profil/sprache')({
  component: LanguagePage,
});
