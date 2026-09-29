import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EnrichedLead } from './types.js';
import type { EnrichOutputField } from './enrich-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> monorepo root -> leadoutput/
const DEFAULT_OUT_DIR = path.join(__dirname, '..', '..', '..', 'leadoutput');

/**
 * Keeps only the requested fields. Entries where every kept field is null
 * are dropped (e.g. an Instagram-only lead when only contactEmail is asked for).
 */
function projectFields(leads: EnrichedLead[], fields: EnrichOutputField[]): Partial<EnrichedLead>[] {
  return leads
    .map((lead) => Object.fromEntries(fields.map((f) => [f, lead[f] ?? null])) as Partial<EnrichedLead>)
    .filter((entry) => Object.values(entry).some((v) => v !== null));
}

export async function saveEnrichedResults(
  leads: EnrichedLead[],
  outputFields: EnrichOutputField[] | null = null,
  outDir = DEFAULT_OUT_DIR
): Promise<string> {
  await mkdir(outDir, { recursive: true });

  const output = outputFields ? projectFields(leads, outputFields) : leads;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `enriched-${timestamp}.json`);

  const payload = {
    generatedAt: new Date().toISOString(),
    count: output.length,
    leads: output,
  };

  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return filePath;
}
