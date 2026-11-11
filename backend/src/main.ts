import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadAppConfig } from './config/app-config';

/** Loads .env for local runs. Variables already set in the environment win, so deployments and tests are unaffected. */
function loadDotEnvIfPresent(): void {
  if (existsSync('.env')) process.loadEnvFile('.env');
}

async function bootstrap(): Promise<void> {
  loadDotEnvIfPresent();
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app, config.FRONTEND_ORIGIN);
  await app.listen(config.PORT);
  new Logger('Bootstrap').log(`API listening on http://localhost:${config.PORT}`);
}

void bootstrap();
