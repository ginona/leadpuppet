import { loadRootEnv } from './load-env.js';

loadRootEnv();

export interface Config {
  apiKey: string;
  openaiApiKey: string | undefined;
  mockApi: boolean;
  concurrency: number;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
}

export function loadConfig(): Config {
  const mockApi = parseBool(process.env.MOCK_API, true);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  const concurrency = Number.parseInt(process.env.CONCURRENCY ?? '5', 10) || 5;

  if (!mockApi && !apiKey) {
    throw new Error(
      '❌ GOOGLE_PLACES_API_KEY is not set. Set it in .env or run with MOCK_API=true.'
    );
  }

  return { apiKey, openaiApiKey, mockApi, concurrency };
}
