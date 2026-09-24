import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IcpProfile, IcpQuery } from './types.js';
import { getVariantsForCategories } from './variants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> raíz del monorepo -> icp/
const ICP_DIR = path.join(__dirname, '..', '..', '..', 'icp');

const ICP_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidIcpName(name: string): boolean {
  return ICP_NAME_PATTERN.test(name);
}

/**
 * Valida un objeto crudo (de un archivo de perfil o de un body HTTP inline)
 * contra el schema de IcpProfile. `label` es solo para los mensajes de error.
 */
export function parseIcpProfile(raw: unknown, label: string): IcpProfile {
  const parsed = (raw ?? {}) as Partial<IcpProfile>;

  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
    throw new Error(`❌ ICP profile "${label}" doesn't have valid "categories".`);
  }
  if (!Array.isArray(parsed.cities) || parsed.cities.length === 0) {
    throw new Error(`❌ ICP profile "${label}" doesn't have valid "cities".`);
  }
  if (typeof parsed.targetCount !== 'number' || parsed.targetCount <= 0) {
    throw new Error(`❌ ICP profile "${label}" doesn't have a valid "targetCount".`);
  }
  if (typeof parsed.maxQueries !== 'number' || parsed.maxQueries <= 0) {
    throw new Error(`❌ ICP profile "${label}" doesn't have a valid "maxQueries".`);
  }

  return {
    name: parsed.name ?? label,
    categories: parsed.categories,
    cities: parsed.cities,
    targetCount: parsed.targetCount,
    maxQueries: parsed.maxQueries,
  };
}

export async function loadIcpProfile(name: string): Promise<IcpProfile> {
  if (!isValidIcpName(name)) {
    throw new Error(`❌ Invalid ICP name: "${name}". Only letters, numbers, hyphens and underscores allowed.`);
  }

  const filePath = path.join(ICP_DIR, `${name}.json`);

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`❌ ICP profile "${name}" not found at icp/${name}.json`);
  }

  return parseIcpProfile(JSON.parse(raw), name);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export async function buildIcpQueries(profile: IcpProfile, openaiApiKey: string | undefined): Promise<IcpQuery[]> {
  const variantsByCategory = await getVariantsForCategories(profile.categories, openaiApiKey);

  const combos: IcpQuery[] = [];
  for (const category of profile.categories) {
    const phrases = variantsByCategory[category] ?? [category];
    for (const phrase of phrases) {
      for (const city of profile.cities) {
        combos.push({ queryText: `${phrase} in ${city}`, city });
      }
    }
  }

  return shuffle(combos);
}
