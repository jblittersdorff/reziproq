import { SetMetadata } from '@nestjs/common';
import type { Action } from '@reziproq/shared';

export const REQUIRES = 'reziproq:requires';

/**
 * Jeder Endpunkt nennt die Aktion, die er braucht (PLT-05). Der AuthGuard prüft sie über can();
 * ein Test schlägt fehl, wenn ein Endpunkt außer /health und /me keine nennt.
 */
export const Requires = (action: Action) => SetMetadata(REQUIRES, action);
