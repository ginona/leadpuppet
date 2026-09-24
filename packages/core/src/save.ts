import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lead } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> raíz del monorepo -> leadoutput/
// Fijo en vez de relativo a process.cwd(): así cae siempre en el mismo lugar
// sin importar si lo invoca el CLI (root o pnpm --filter) o la API.
const DEFAULT_OUT_DIR = path.join(__dirname, '..', '..', '..', 'leadoutput');

export async function saveResults(leads: Lead[], outDir = DEFAULT_OUT_DIR): Promise<string> {
  await mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `leads-${timestamp}.json`);

  const payload = {
    generatedAt: new Date().toISOString(),
    count: leads.length,
    leads,
  };

  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return filePath;
}
