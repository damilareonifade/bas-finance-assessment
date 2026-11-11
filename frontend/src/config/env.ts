import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3000'),
});

/** The only place in the app that reads import.meta.env. */
export const env = envSchema.parse(import.meta.env);
