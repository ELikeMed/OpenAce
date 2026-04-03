/**
 * @openace/embed — Main entry point
 *
 * npm usage (React):
 *   import { AceWidget, AceProvider } from '@openace/embed';
 *
 * Server usage:
 *   import { createAceServer } from '@openace/embed/server';
 */

// Client components
export { AceWidget, AceLogo } from './client/AceWidget.jsx';
export { AceProvider, useAceContext } from './client/AceProvider.jsx';

// Client hooks
export { useAceChat } from './client/hooks/useAceChat.js';
export { useLicense } from './client/hooks/useLicense.js';

// Shared
export { VERSION, TIERS, LIMITS, TOOL_GROUPS, TOOL_LABELS } from './shared/constants.js';
