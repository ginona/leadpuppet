import pLimit from 'p-limit';
import type { EnrichConfig } from './enrich-config.js';
import type { Lead, EnrichedLead, ContactInfo } from './types.js';
import { fetchContactPage } from './scrape.js';
import { extractContact } from './contact-extract.js';
import { findSiteEmail } from './email-regex.js';
import { findInstagramHandle } from './instagram.js';
import { normalizeDomain, emailDomain, domainsMatch, isWhatsAppRedirect } from './domain.js';
import { readEnrichedCache, writeEnrichedCache, type CachedContact } from './enrich-cache.js';
import { saveEnrichedResults } from './save-enriched.js';
import { makeLogger, reportProgress, type PipelineCallbacks } from './pipeline-callbacks.js';

const EMPTY_CONTACT: ContactInfo = { name: null, role: null, email: null, confidence: 'low' };

/**
 * Safety net beyond the prompt: if the extracted email's domain doesn't
 * match the site's, it's likely the agency/webmaster's email, not the
 * business's. Not discarded (could be a legitimate corporate email on a
 * different domain) but confidence is lowered for manual review.
 */
function flagDomainMismatch(
  contact: ContactInfo,
  siteDomain: string,
  website: string,
  log: (line: string) => void
): ContactInfo {
  if (!contact.email) return contact;

  const emailHost = emailDomain(contact.email);
  if (!emailHost || domainsMatch(emailHost, siteDomain)) return contact;

  log(
    `  ⚠️  Possible third-party email: "${contact.email}" (${emailHost}) doesn't match the site's domain (${siteDomain}) for ${website}. Lowering confidence to "low" for manual review.`
  );

  return { ...contact, confidence: 'low' };
}

type ContactSource = 'regex' | 'llm';

/**
 * Layer 1: regex over the full HTML (free). If there's an email on the same
 * domain, it's used (confidence "medium": correct data but no name/role) and
 * the LLM is NOT called. Layer 2: only if Layer 1 found nothing usable.
 */
async function enrichWebsite(
  website: string,
  domain: string,
  apiKey: string,
  includeInstagram: boolean,
  log: (line: string) => void
): Promise<{ contact: ContactInfo; source: ContactSource; instagram: string | null } | null> {
  const page = await fetchContactPage(website);
  if (!page) return null;

  const instagram = includeInstagram ? findInstagramHandle(page.html) : null;

  const regexEmail = findSiteEmail(page.html, domain);
  if (regexEmail) {
    return {
      contact: { name: null, role: null, email: regexEmail, confidence: 'medium' },
      source: 'regex',
      instagram,
    };
  }

  try {
    const contact = await extractContact(page.html, domain, apiKey);
    return { contact: flagDomainMismatch(contact, domain, website, log), source: 'llm', instagram };
  } catch (error) {
    log(`  ⚠️  Error extracting contact from ${website}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

export interface EnrichSummary {
  processed: number;
  withEmail: number;
  high: number;
  medium: number;
  low: number;
  unreachable: number;
  resolvedByRegex: number;
  resolvedByLlm: number;
  fromCache: number;
}

export interface EnrichResult {
  leads: EnrichedLead[];
  filePath: string;
  summary: EnrichSummary;
}

export async function runEnrichment(
  leads: Lead[],
  config: EnrichConfig,
  includeInstagram: boolean = false,
  callbacks?: PipelineCallbacks
): Promise<EnrichResult> {
  const log = makeLogger(callbacks);

  const withWebsite = leads.filter((lead) => typeof lead.website === 'string' && lead.website.trim().length > 0);
  const skipped = leads.length - withWebsite.length;

  log(`📋 Total leads: ${leads.length} | with website: ${withWebsite.length} | no website (skipped): ${skipped}`);
  log(`🔎 Enriching with max. concurrency ${config.concurrency}...`);

  const cache = await readEnrichedCache();
  let cacheDirty = false;

  const limit = pLimit(config.concurrency);
  let completed = 0;
  const counts = { high: 0, medium: 0, low: 0, unreachable: 0 };
  const sources = { resolvedByRegex: 0, resolvedByLlm: 0, fromCache: 0 };

  const enrichedLeads = await Promise.all(
    withWebsite.map((lead) =>
      limit(async (): Promise<EnrichedLead> => {
        let contact: ContactInfo;
        let instagramFromEnrich: string | null = null;
        let whatsappLink: string | null = null;
        let reachable = true;
        const isWhatsApp = includeInstagram && isWhatsAppRedirect(lead.website);

        try {
          if (isWhatsApp) {
            // Pure WhatsApp redirect (wa.link/wa.me/api.whatsapp.com): there's no
            // real HTML to scrape — the link itself IS the contact data.
            // The cache is left untouched (nothing to fetch or memoize).
            contact = EMPTY_CONTACT;
            whatsappLink = lead.website.trim();
          } else {
            const domain = normalizeDomain(lead.website);
            const cached = cache[domain];

            if (cached) {
              contact = cached;
              instagramFromEnrich = cached.instagram ?? null;
              sources.fromCache += 1;

              // The cached entry predates --include-instagram (or comes from a run
              // without the flag): the email is already trusted from cache, but
              // instagram was never searched. We do a lightweight fetch ONLY to
              // scan the HTML for the IG link, without touching the contact.
              if (includeInstagram && !('instagram' in cached)) {
                try {
                  const page = await fetchContactPage(lead.website);
                  const found = page ? findInstagramHandle(page.html) : null;
                  instagramFromEnrich = found;
                  cache[domain] = { ...cached, instagram: found };
                  cacheDirty = true;
                } catch {
                  // Best-effort: a failure here doesn't invalidate the already-confirmed contact.
                }
              }
            } else {
              const result = await enrichWebsite(lead.website, domain, config.openaiApiKey, includeInstagram, log);
              if (result) {
                // The "instagram" key is only added to the cache when the flag is
                // on, so default runs don't change the cache shape.
                const cachedEntry: CachedContact = includeInstagram
                  ? { ...result.contact, instagram: result.instagram }
                  : result.contact;
                cache[domain] = cachedEntry;
                cacheDirty = true;
                contact = result.contact;
                instagramFromEnrich = result.instagram;
                if (result.source === 'regex') sources.resolvedByRegex += 1;
                else sources.resolvedByLlm += 1;
              } else {
                reachable = false;
                contact = EMPTY_CONTACT;
              }
            }
          }
        } catch (error) {
          log(`  ⚠️  Unexpected error with ${lead.website}: ${error instanceof Error ? error.message : error}`);
          reachable = false;
          contact = EMPTY_CONTACT;
        }

        if (reachable) {
          counts[contact.confidence] += 1;
        } else {
          counts.unreachable += 1;
        }

        completed += 1;

        if (isWhatsApp) {
          log(`  📱 [${completed}/${withWebsite.length}] ${lead.name} → WhatsApp link (${whatsappLink}) — skipping scrape, no HTML to fetch`);
        } else if (contact.email) {
          log(`  ✅ [${completed}/${withWebsite.length}] ${lead.name} → ${contact.email} (${contact.confidence} confidence)`);
        } else {
          log(`  ⚠️  [${completed}/${withWebsite.length}] ${lead.name} → no contact found`);
        }
        reportProgress(callbacks, completed, withWebsite.length);

        const enrichedLead: EnrichedLead = {
          ...lead,
          contactName: contact.name,
          contactRole: contact.role,
          contactEmail: contact.email,
          confidence: contact.confidence,
        };

        // Same as in Lead: the "instagram"/"whatsapp" keys only exist when
        // the flag is on. instagram prefers what enrich found; if it found
        // nothing, it keeps what already came from discovery (a website
        // that pointed to IG).
        if (includeInstagram) {
          enrichedLead.instagram = instagramFromEnrich ?? lead.instagram ?? null;
          enrichedLead.whatsapp = whatsappLink;
        }

        return enrichedLead;
      })
    )
  );

  if (cacheDirty) {
    await writeEnrichedCache(cache);
  }

  // A lead is kept if it has an email, OR (with the flag on) instagram/whatsapp
  // — otherwise that "captured" data would never reach the final file. With the
  // flag off, instagram/whatsapp are never set and this reduces exactly to the
  // usual filter (contactEmail !== null): default behavior intact.
  const withEmailCount = enrichedLeads.filter((lead) => lead.contactEmail !== null).length;
  const kept = enrichedLeads.filter(
    (lead) => lead.contactEmail !== null || Boolean(lead.instagram) || Boolean(lead.whatsapp)
  );
  const filePath = await saveEnrichedResults(kept);

  log(`📊 ${enrichedLeads.length} processed → ${kept.length} kept (${withEmailCount} with email) → saved to ${filePath}`);
  log(
    `📈 Confidence — high: ${counts.high} | medium: ${counts.medium} | low: ${counts.low} | unreachable: ${counts.unreachable}`
  );

  log(
    `🧮 Resolved by regex (Layer 1, no LLM cost): ${sources.resolvedByRegex} | by LLM (Layer 2): ${sources.resolvedByLlm} | from cache: ${sources.fromCache}`
  );

  const summary: EnrichSummary = {
    processed: enrichedLeads.length,
    withEmail: withEmailCount,
    ...counts,
    ...sources,
  };

  return { leads: kept, filePath, summary };
}
