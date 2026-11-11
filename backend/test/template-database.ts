import { join } from 'node:path';

/** Migrated once by global-setup.ts; copied for every test app. */
export const E2E_TEMPLATE_DATABASE = join(__dirname, '.tmp', 'template.db');
