import { domainsMatch, emailDomain } from './domain.js';

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const MAILTO_PATTERN = /href\s*=\s*["']mailto:([^"'?#>\s]+)/gi;

// Typical false positives when scanning raw HTML: "logo@2x.png", "font@1.woff2", etc.
const ASSET_TLDS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'css', 'js', 'woff', 'woff2', 'ttf', 'map']);

// Platform/tracker/placeholder domains: never the business's contact.
const PLATFORM_DOMAINS = [
  'sentry.io',
  'sentry-next.wixpress.com',
  'wixpress.com',
  'wix.com',
  'godaddy.com',
  'squarespace.com',
  'shopify.com',
  'wordpress.com',
  'cloudflare.com',
  'googleusercontent.com',
  'gstatic.com',
  'w3.org',
  'schema.org',
  'example.com',
  'domain.com',
  'yourdomain.com',
  'email.com',
];

function isPlatformDomain(host: string): boolean {
  return PLATFORM_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

type EmailKind = 'same-domain' | 'cross-domain' | 'platform';

function classify(email: string, siteDomain: string): EmailKind | null {
  const host = emailDomain(email);
  if (!host) return null;

  const tld = host.split('.').pop() ?? '';
  if (ASSET_TLDS.has(tld)) return null;
  if (isPlatformDomain(host)) return 'platform';

  // A different domain can be the agency's email (the WebFX case) or a
  // legitimate multi-brand business: kept apart for manual review.
  return domainsMatch(host, siteDomain) ? 'same-domain' : 'cross-domain';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface SiteEmails {
  /** Best email on the site's own domain (or a subdomain of it). */
  sameDomain: string | null;
  /** Best email on a different domain: not trusted, kept for manual review. */
  crossDomain: string | null;
  /** Emails dropped because they belong to a known platform/placeholder domain. */
  discarded: string[];
}

/**
 * Layer 1 (free): looks for emails in the FULL HTML, without cleaning or
 * truncating (the footer is usually where the email lives). Prefers `mailto:`
 * ones over text ones, and within each group the most repeated. Emails on
 * the site's domain and on other domains are ranked separately.
 */
export function findSiteEmails(html: string, siteDomain: string): SiteEmails {
  const hits = {
    'same-domain': { mailto: new Map<string, number>(), text: new Map<string, number>() },
    'cross-domain': { mailto: new Map<string, number>(), text: new Map<string, number>() },
  };
  const discarded = new Set<string>();

  const record = (email: string, from: 'mailto' | 'text') => {
    const kind = classify(email, siteDomain);
    if (!kind) return;
    if (kind === 'platform') {
      discarded.add(email);
      return;
    }
    const map = hits[kind][from];
    map.set(email, (map.get(email) ?? 0) + 1);
  };

  for (const match of html.matchAll(MAILTO_PATTERN)) {
    // mailto can carry several comma-separated recipients
    for (const part of safeDecode(match[1] ?? '').split(',')) {
      const email = part.trim().toLowerCase();
      if (email) record(email, 'mailto');
    }
  }

  for (const match of html.matchAll(EMAIL_PATTERN)) {
    record(match[0].toLowerCase(), 'text');
  }

  const best = (kind: keyof typeof hits) => mostFrequent(hits[kind].mailto) ?? mostFrequent(hits[kind].text);

  return { sameDomain: best('same-domain'), crossDomain: best('cross-domain'), discarded: [...discarded] };
}

function mostFrequent(hits: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [email, count] of hits) {
    if (count > bestCount) {
      best = email;
      bestCount = count;
    }
  }
  return best;
}
