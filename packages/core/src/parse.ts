import type { RawPlace, Lead } from './types.js';
import { extractInstagramHandle } from './instagram.js';

export function toLead(raw: RawPlace, sourceQuery: string, includeInstagram = false): Lead | null {
  const name = raw.displayName?.text?.trim();
  if (!name) return null;

  const lead: Lead = {
    name,
    website: raw.websiteUri?.trim() ?? '',
    phone: raw.nationalPhoneNumber?.trim() ?? null,
    address: raw.formattedAddress?.trim() ?? null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    reviewCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
    sourceQuery,
  };

  // Campo "instagram" solo se agrega cuando el flag está activo — así el
  // shape del objeto (y del JSON de salida) queda idéntico al default.
  if (includeInstagram) {
    lead.instagram = raw.websiteUri ? extractInstagramHandle(raw.websiteUri) : null;
  }

  return lead;
}
