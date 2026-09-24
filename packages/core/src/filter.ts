import type { Lead } from './types.js';

export interface FilterResult {
  kept: Lead[];
  discarded: number;
}

export function filterHasWebsite(leads: Lead[]): FilterResult {
  const kept = leads.filter((lead) => lead.website.length > 0);
  return { kept, discarded: leads.length - kept.length };
}
