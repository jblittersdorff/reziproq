import { createFileRoute } from '@tanstack/react-router';
import { WelcomeStep } from '@/features/invitations/accept-pages';

export const Route = createFileRoute('/einladung/$token/')({ component: WelcomeStep });
