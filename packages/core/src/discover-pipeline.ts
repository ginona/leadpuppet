import pLimit from 'p-limit';
import type { Config } from './config.js';
import type { IcpProfile, Lead } from './types.js';
import { searchPlaces } from './places.js';
import { toLead } from './parse.js';
import { dedupeLeads } from './dedupe.js';
import { filterHasWebsite } from './filter.js';
import { saveResults } from './save.js';
import { buildIcpQueries } from './icp.js';
import { getLocationBias } from './geocode.js';
import { makeLogger, reportProgress, type PipelineCallbacks } from './pipeline-callbacks.js';

function pageLabel(pages: number): string {
  return `${pages} page${pages === 1 ? '' : 's'}`;
}

export interface DiscoverResult {
  leads: Lead[];
  filePath: string;
}

export async function runManualDiscovery(
  categories: string[],
  cities: string[],
  config: Config,
  includeInstagram: boolean = false,
  callbacks?: PipelineCallbacks
): Promise<DiscoverResult> {
  const log = makeLogger(callbacks);

  log(`📋 Categories: ${categories.join(', ')}`);
  log(`🏙️  Cities: ${cities.join(', ')}`);

  const queries = categories.flatMap((category) => cities.map((city) => `${category} in ${city}`));

  log(`🔎 Running ${queries.length} searches (max. ${config.concurrency} in parallel)...`);

  const limit = pLimit(config.concurrency);
  let completed = 0;

  const results = await Promise.all(
    queries.map((query) =>
      limit(async () => {
        const { places, pages } = await searchPlaces(query, config.apiKey, config.mockApi);
        completed += 1;
        log(`  ✅ [${completed}/${queries.length}] "${query}" → ${pageLabel(pages)}, ${places.length} results`);
        reportProgress(callbacks, completed, queries.length);
        return places.map((raw) => toLead(raw, query, includeInstagram));
      })
    )
  );

  const allLeads = results.flat().filter((lead): lead is Lead => lead !== null);
  log(`📦 Total results parsed: ${allLeads.length}`);

  const { unique, duplicates } = dedupeLeads(allLeads);
  log(`🧹 Duplicates discarded: ${duplicates}`);

  const { kept, discarded } = filterHasWebsite(unique);
  log(`🌐 No website (discarded): ${discarded}`);

  const filePath = await saveResults(kept);
  log(`💾 Saved: ${kept.length} leads to ${filePath}`);

  return { leads: kept, filePath };
}

export interface IcpDiscoverResult extends DiscoverResult {
  queriesUsed: number;
  targetReached: boolean;
}

export async function runIcpDiscovery(
  profile: IcpProfile,
  config: Config,
  includeInstagram: boolean = false,
  callbacks?: PipelineCallbacks
): Promise<IcpDiscoverResult> {
  const log = makeLogger(callbacks);
  const queries = await buildIcpQueries(profile, config.openaiApiKey);

  log(`🧭 ICP profile: ${profile.name}`);
  log(`📋 Categories: ${profile.categories.join(', ')}`);
  log(`🏙️  Cities: ${profile.cities.join(', ')}`);
  log(
    `🎯 Target: ${profile.targetCount} leads | Available combinations: ${queries.length} | Max. queries: ${profile.maxQueries}`
  );

  let allLeads: Lead[] = [];
  let uniqueLeads: Lead[] = [];
  let queriesUsed = 0;
  let stoppedByLimit = false;

  for (const query of queries) {
    if (queriesUsed >= profile.maxQueries) {
      stoppedByLimit = true;
      break;
    }

    const locationBias = getLocationBias(query.city) ?? undefined;
    const { places, pages } = await searchPlaces(query.queryText, config.apiKey, config.mockApi, locationBias);
    queriesUsed += 1;

    const leads = places
      .map((raw) => toLead(raw, query.queryText, includeInstagram))
      .filter((lead): lead is Lead => lead !== null);
    allLeads = allLeads.concat(leads);

    const { unique } = dedupeLeads(allLeads);
    uniqueLeads = filterHasWebsite(unique).kept;

    log(
      `  ✅ [${queriesUsed}/${profile.maxQueries}] "${query.queryText}" → ${pageLabel(pages)}, ${places.length} results | so far: ${uniqueLeads.length}/${profile.targetCount}`
    );
    reportProgress(callbacks, queriesUsed, profile.maxQueries);

    if (uniqueLeads.length >= profile.targetCount) {
      break;
    }
  }

  const targetReached = uniqueLeads.length >= profile.targetCount;

  if (!targetReached) {
    const reason = stoppedByLimit ? 'query limit' : 'category×city combinations exhausted';
    log(`⚠️  Hit the ${reason} without reaching the target of ${profile.targetCount} leads.`);
  }

  const filePath = await saveResults(uniqueLeads);
  log(`💾 Saved: ${uniqueLeads.length} leads to ${filePath}`);
  log(
    `🎯 Target: ${profile.targetCount} | Achieved: ${uniqueLeads.length} | Queries used: ${queriesUsed}/${profile.maxQueries}`
  );

  return { leads: uniqueLeads, filePath, queriesUsed, targetReached };
}
