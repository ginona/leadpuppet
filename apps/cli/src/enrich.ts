import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnrichConfig, runEnrichment, type Lead } from '@leadpuppet/core';
import { parseEnrichArgs } from './enrich-cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/cli/src -> apps/cli -> apps -> raíz del monorepo. Fijo en vez de process.cwd():
// `pnpm --filter` cambia el cwd a apps/cli, y --input se escribe relativo a la raíz.
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

async function main(): Promise<void> {
  const {
    inputPath,
    concurrency: concurrencyOverride,
    includeInstagram,
  } = parseEnrichArgs(process.argv.slice(2));
  const config = loadEnrichConfig(concurrencyOverride);
  const resolvedInputPath = path.resolve(REPO_ROOT, inputPath);

  console.log('🐶 LeadPuppet enrich');
  console.log(`📂 Leyendo ${resolvedInputPath}`);
  if (includeInstagram) {
    console.log('📸 Instagram handle capture: ON');
  }

  const raw = await readFile(resolvedInputPath, 'utf-8');
  const parsed = JSON.parse(raw) as { leads?: Lead[] };
  const leads = parsed.leads ?? [];

  await runEnrichment(leads, config, includeInstagram);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
