import { fetchPublicUrl, readTextCapped } from './ssrf-guard.js';

const CONTACT_PATHS = ['/contact', '/contact-us', '/about'];
const REQUEST_TIMEOUT_MS = 8000;

export interface FetchedPage {
  url: string;
  html: string;
}

function toOrigin(website: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<FetchedPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchPublicUrl(url, controller.signal);
    if (!response.ok) return null;

    const html = await readTextCapped(response);
    if (!html.trim()) return null;

    return { url, html };
  } catch {
    // site down, timeout, too many redirects, invalid DNS, private/internal
    // address (SSRF guard), etc. — try the next candidate URL
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries /contact, /contact-us, /about and finally the home page, in that order,
 * and returns the first one that responds 200 with content. null if none
 * responded (unreachable site).
 */
export async function fetchContactPage(website: string): Promise<FetchedPage | null> {
  const origin = toOrigin(website);
  if (!origin) return null;

  const candidateUrls = [...CONTACT_PATHS.map((p) => new URL(p, origin).toString()), origin];

  for (const url of candidateUrls) {
    const page = await fetchPage(url);
    if (page) return page;
  }

  return null;
}
