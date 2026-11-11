import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// The Prisma CLI reads the same DATABASE_PATH as the API (src/config/app-config.ts). Variables already set win over .env.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: `file:${resolve(process.env.DATABASE_PATH ?? './data/lending.db')}` },
});
