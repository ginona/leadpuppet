// Generic shortener/aggregator domains: the base domain is shared by many
// different businesses (e.g. wa.link/s1lf75 and wa.link/x9k2p1 are different
// businesses) — the path is what identifies EACH one, so for these cases the
// cache key has to include the path, not just the host.
const SHORTENER_DOMAINS = new Set([
  'wa.link',
  'wa.me',
  'api.whatsapp.com',
  'bit.ly',
  'tinyurl.com',
  'linktr.ee',
  'lnk.bio',
  'beacons.ai',
  't.co',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'rb.gy',
  'is.gd',
  'shorturl.at',
  's.id',
]);

export function normalizeDomain(website: string): string {
  const trimmed = website.trim();

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (SHORTENER_DOMAINS.has(host)) {
      // Short codes are often case-sensitive (base62) — the path is NOT
      // lowercased, so two different businesses don't merge into one key.
      const path = url.pathname.replace(/\/+$/, '');
      return path ? `${host}${path}` : host;
    }

    return host;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

const WHATSAPP_REDIRECT_DOMAINS = new Set(['wa.link', 'wa.me', 'api.whatsapp.com']);

/**
 * true if the website is a pure WhatsApp redirect (wa.link/wa.me/api.whatsapp.com):
 * they have no real HTML to scrape, the link itself IS the contact data.
 */
export function isWhatsAppRedirect(website: string): boolean {
  const trimmed = website.trim();

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase();
    return WHATSAPP_REDIRECT_DOMAINS.has(host);
  } catch {
    return false;
  }
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  return email
    .slice(at + 1)
    .trim()
    .replace(/^www\./i, '')
    .toLowerCase();
}

/** true if they're the same domain or one is a subdomain of the other (e.g. mail.foo.com and foo.com). */
export function domainsMatch(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}
