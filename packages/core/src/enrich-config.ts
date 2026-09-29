import { loadRootEnv } from './load-env.js';
import type { EnrichedLead } from './types.js';

loadRootEnv();

export type EnrichOutputField = keyof EnrichedLead;

const OUTPUT_FIELDS: readonly EnrichOutputField[] = [
  'name',
  'website',
  'phone',
  'address',
  'rating',
  'reviewCount',
  'sourceQuery',
  'contactName',
  'contactRole',
  'contactEmail',
  'confidence',
  'instagram',
  'whatsapp',
];

export interface EnrichConfig {
  openaiApiKey: string;
  concurrency: number;
  /** Fields written to enriched-*.json; null = all of them (default). */
  outputFields: EnrichOutputField[] | null;
}

function parseOutputFields(raw: string | undefined): EnrichOutputField[] | null {
  const fields = (raw ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (fields.length === 0) return null;

  const unknown = fields.filter((f) => !OUTPUT_FIELDS.includes(f as EnrichOutputField));
  if (unknown.length > 0) {
    throw new Error(
      `❌ ENRICH_OUTPUT_FIELDS has unknown field(s): ${unknown.join(', ')}. Valid: ${OUTPUT_FIELDS.join(', ')}.`
    );
  }

  return [...new Set(fields)] as EnrichOutputField[];
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

  const outputFields = parseOutputFields(process.env.ENRICH_OUTPUT_FIELDS);

  return { openaiApiKey, concurrency, outputFields };
}
