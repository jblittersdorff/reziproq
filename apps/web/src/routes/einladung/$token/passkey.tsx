import { createFileRoute } from '@tanstack/react-router';
import { PasskeyStep } from '@/features/invitations/accept-pages';

export const Route = createFileRoute('/einladung/$token/passkey')({ component: PasskeyStep });
