import { loadRootEnv } from './load-env.js';

loadRootEnv();

export interface EnrichConfig {
  openaiApiKey: string;
  concurrency: number;
}

export function loadEnrichConfig(concurrencyOverride?: number): EnrichConfig {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) {
    throw new Error(
      '❌ OPENAI_API_KEY is not set. It is required for enrichment (contact extraction). Set it in .env.'
    );
  }

  const envConcurrency = Number.parseInt(process.env.ENRICH_CONCURRENCY ?? '5', 10);
  const concurrency = concurrencyOverride ?? (envConcurrency > 0 ? envConcurrency : 5);

  return { openaiApiKey, concurrency };
}
