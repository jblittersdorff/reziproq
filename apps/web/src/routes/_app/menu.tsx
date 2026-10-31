import { createFileRoute } from '@tanstack/react-router';
import { MenuPage } from '@/features/shell/menu-page';

export const Route = createFileRoute('/_app/menu')({
  component: MenuPage,
});
