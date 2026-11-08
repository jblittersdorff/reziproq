import { createFileRoute } from '@tanstack/react-router';
import { NameStep } from '@/features/invitations/accept-pages';

export const Route = createFileRoute('/einladung/$token/name')({ component: NameStep });
