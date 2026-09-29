import { loadConfig, loadEnrichConfig, runIcpDiscovery, runEnrichment, type IcpProfile } from '@leadpuppet/core';
import { splitList } from './cli.js';

const DEFAULT_TARGET = 100;
const DEFAULT_MAX_QUERIES = 15;
// Upper bounds so a typo (e.g. --max-queries=1500) can't burn through the
// Places quota; ICP profiles (discover --icp) keep their own limits.
const MAX_TARGET = 1000;
const MAX_MAX_QUERIES = 100;

const USAGE =
  'Usage: pnpm leadpuppet find "<categories>" "<cities>" [--target=100] [--max-queries=15] [--include-instagram=true]\n' +
  'Example: pnpm leadpuppet find "roofing,drywall" "houston,dallas"';

export interface FindArgs {
  categories: string[];
  cities: string[];
  targetCount: number;
  maxQueries: number;
  includeInstagram: boolean;
}

function parsePositiveInt(raw: string | undefined, flag: string, fallback: number, max: number): number {
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0 || String(value) !== raw.trim()) {
    throw new Error(`❌ --${flag} must be a positive integer (got "${raw}").`);
  }
  if (value > max) {
    throw new Error(`❌ --${flag} can be at most ${max} (got ${value}). For bigger runs, use an ICP profile with discover --icp.`);
  }
  return value;
}

export function parseFindArgs(argv: string[]): FindArgs {
  const flags = new Map<string, string>();
  const positional: string[] = [];

  for (const arg of argv) {
    const match = /^--([a-zA-Z-]+)=(.*)$/.exec(arg);
    if (match) flags.set(match[1] ?? '', match[2] ?? '');
    else if (arg.startsWith('--')) throw new Error(`❌ Unknown flag format "${arg}" — use --flag=value.\n${USAGE}`);
    else positional.push(arg);
  }

  const [categoriesRaw, citiesRaw, ...extra] = positional;
  if (!categoriesRaw || !citiesRaw || extra.length > 0) {
    throw new Error(`❌ Expected exactly two arguments: categories and cities.\n${USAGE}`);
  }

  return {
    categories: splitList(categoriesRaw, 'Categories'),
    cities: splitList(citiesRaw, 'Cities'),
    targetCount: parsePositiveInt(flags.get('target'), 'target', DEFAULT_TARGET, MAX_TARGET),
    maxQueries: parsePositiveInt(flags.get('max-queries'), 'max-queries', DEFAULT_MAX_QUERIES, MAX_MAX_QUERIES),
    includeInstagram: flags.get('include-instagram') === 'true',
  };
}

async function main(): Promise<void> {
  const args = parseFindArgs(process.argv.slice(2));

  // Both configs are loaded up front: a missing OpenAI key fails here,
  // before any Places quota is spent on discovery.
  const config = loadConfig();
  const enrichConfig = loadEnrichConfig();

  const profile: IcpProfile = {
    name: 'find',
    categories: args.categories,
    cities: args.cities,
    targetCount: args.targetCount,
    maxQueries: args.maxQueries,
  };

  console.log(`🐶 LeadPuppet find — ${config.mockApi ? 'MOCK' : 'LIVE'} mode`);
  console.log('\n── 1/2 Discover ──');
  const discovered = await runIcpDiscovery(profile, config, args.includeInstagram);

  if (discovered.leads.length === 0) {
    console.log('\n⚠️  No leads with a website found — nothing to enrich. Try other categories/cities or a higher --max-queries.');
    return;
  }

  console.log('\n── 2/2 Enrich ──');
  const enriched = await runEnrichment(discovered.leads, enrichConfig, args.includeInstagram);

  const { summary } = enriched;
  console.log('\n── Summary ──');
  console.log(`  Leads found:  ${discovered.leads.length} (target ${args.targetCount}, ${discovered.queriesUsed} searches)`);
  console.log(`  With email:   ${summary.withEmail}`);
  console.log(`  Confidence:   high ${summary.high} · medium ${summary.medium} · low ${summary.low}`);
  console.log(`  File:         ${enriched.filePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
