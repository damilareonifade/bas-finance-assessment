import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { Clock } from '../src/common/clock/clock';
import { CalendarDate } from '../src/common/dates/calendar-date';
import { E2E_TEMPLATE_DATABASE } from './template-database';

export class FixedClock extends Clock {
  constructor(private todayValue: CalendarDate) {
    super();
  }

  today(): CalendarDate {
    return this.todayValue;
  }

  nowIso(): string {
    return `${this.todayValue}T09:00:00.000Z`;
  }

  setToday(date: CalendarDate): void {
    this.todayValue = date;
  }
}

/** supertest with a session cookie attached to every call. */
export interface HttpClient {
  get(path: string): request.Test;
  post(path: string): request.Test;
  patch(path: string): request.Test;
  delete(path: string): request.Test;
}

export interface TestApp {
  app: INestApplication;
  clock: FixedClock;
  /** Signed in as the seeded administrator. */
  http: HttpClient;
  anonymous: HttpClient;
  /** Signs in with email/password and returns a client carrying that session. */
  loginAs(email: string, password: string): Promise<HttpClient>;
}

export const ADMIN_EMAIL = 'admin@lender.test';
export const ADMIN_PASSWORD = 'AdminPass123!';

function clientFor(app: INestApplication, cookie?: string): HttpClient {
  const withCookie = (test: request.Test): request.Test => (cookie ? test.set('Cookie', cookie) : test);
  const server = app.getHttpServer();
  return {
    get: (path) => withCookie(request(server).get(path)),
    post: (path) => withCookie(request(server).post(path)),
    patch: (path) => withCookie(request(server).patch(path)),
    delete: (path) => withCookie(request(server).delete(path)),
  };
}

/** Boots the real application against a fresh copy of the migrated template database and a pinned clock. */
export async function createTestApp(today: CalendarDate = '2026-01-15' as CalendarDate): Promise<TestApp> {
  const workDirectory = mkdtempSync(join(tmpdir(), 'bas-e2e-'));
  const databasePath = join(workDirectory, 'lending.db');
  copyFileSync(E2E_TEMPLATE_DATABASE, databasePath);
  process.env.DATABASE_PATH = databasePath;
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
  process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.UPLOAD_DIR = join(workDirectory, 'uploads');
  const clock = new FixedClock(today);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, 'http://localhost:5173');
  await app.init();

  const loginAs = async (email: string, password: string): Promise<HttpClient> => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    return clientFor(app, cookies.map((cookie) => cookie.split(';')[0]).join('; '));
  };

  return { app, clock, http: await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD), anonymous: clientFor(app), loginAs };
}

/** Admin invites an officer, the officer accepts; returns their signed-in client and user id. */
export async function inviteOfficer(testApp: TestApp, email: string, fullName = 'Officer'): Promise<{ client: HttpClient; userId: string }> {
  const invite = await testApp.http.post('/team/invitations').send({ email, role: 'LOAN_OFFICER' }).expect(201);
  const token = new URL(invite.body.inviteLink).searchParams.get('token') ?? '';
  await testApp.anonymous.post('/auth/accept-invitation').send({ token, fullName, password: 'OfficerPass1!' }).expect(201);
  const client = await testApp.loginAs(email, 'OfficerPass1!');
  const me = await client.get('/auth/me').expect(200);
  return { client, userId: me.body.user.userId as string };
}

