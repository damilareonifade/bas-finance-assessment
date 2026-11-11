import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { E2E_TEMPLATE_DATABASE } from './template-database';

/**
 * Once per e2e run: build a template database with the real Prisma migrations (CHECKs and triggers included).
 * Every test app then starts from its own copy of it, so tests are isolated and still exercise the shipped schema.
 */
export default function globalSetup(): void {
  rmSync(E2E_TEMPLATE_DATABASE, { force: true });
  mkdirSync(dirname(E2E_TEMPLATE_DATABASE), { recursive: true });
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_PATH: E2E_TEMPLATE_DATABASE },
    stdio: 'pipe',
  });
}
