import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContactInfo } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> raíz del monorepo -> cache/
const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'cache');
const CACHE_PATH = path.join(CACHE_DIR, 'enriched-domains.json');

// Extiende ContactInfo (no lo modifica) para no tocar el contrato del LLM/API;
// "instagram" solo aparece en entradas cacheadas por corridas con --include-instagram.
export interface CachedContact extends ContactInfo {
  instagram?: string | null;
}

export type EnrichedDomainCache = Record<string, CachedContact>;

export async function readEnrichedCache(): Promise<EnrichedDomainCache> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as EnrichedDomainCache;
  } catch {
    return {};
  }
}

export async function writeEnrichedCache(cache: EnrichedDomainCache): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}
