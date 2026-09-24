import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EnrichedLead } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> monorepo root -> leadoutput/
const DEFAULT_OUT_DIR = path.join(__dirname, '..', '..', '..', 'leadoutput');

export async function saveEnrichedResults(leads: EnrichedLead[], outDir = DEFAULT_OUT_DIR): Promise<string> {
  await mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `enriched-${timestamp}.json`);

  const payload = {
    generatedAt: new Date().toISOString(),
    count: leads.length,
    leads,
  };

  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return filePath;
}
