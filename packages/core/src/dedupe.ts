import type { Lead } from './types.js';

function normalizeKey(lead: Lead): string {
  if (lead.website) {
    try {
      const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
      return `domain:${url.hostname.replace(/^www\./, '').toLowerCase()}`;
    } catch {
      // website no es una URL válida, seguimos al fallback por nombre
    }
  }
  return `name:${lead.name.trim().toLowerCase()}`;
}

export interface DedupeResult {
  unique: Lead[];
  duplicates: number;
}

export function dedupeLeads(leads: Lead[]): DedupeResult {
  const seen = new Map<string, Lead>();

  for (const lead of leads) {
    const key = normalizeKey(lead);
    if (!seen.has(key)) {
      seen.set(key, lead);
    }
  }

  return { unique: [...seen.values()], duplicates: leads.length - seen.size };
}
