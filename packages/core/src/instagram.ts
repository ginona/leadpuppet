// instagram.com path segments that are NOT a profile handle (posts, reels, fixed site sections, etc.)
const RESERVED_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'story',
  'explore',
  'accounts',
  'about',
  'legal',
  'directory',
  'developer',
  'tv',
  'embed',
  'graphql',
  'web',
  'invites',
]);

const HANDLE_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

/**
 * Given a URL, if it points to a business profile on instagram.com returns
 * the clean handle (no @, no query params, no trailing slash). null if it's
 * not instagram.com, or if the first path segment is a fixed site section
 * (post, reel, explore, etc.) rather than a user.
 */
export function extractInstagramHandle(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'instagram.com') return null;

  const handle = parsed.pathname.split('/').filter(Boolean)[0];
  if (!handle) return null;
  if (RESERVED_PATHS.has(handle.toLowerCase())) return null;
  if (!HANDLE_PATTERN.test(handle)) return null;

  return handle;
}

const HREF_PATTERN = /href\s*=\s*["']([^"']*instagram\.com[^"']*)["']/gi;

/**
 * Looks for instagram.com links in the raw HTML (same approach as
 * findSiteEmail in email-regex.ts: no cleaning/truncating) and returns the
 * most repeated handle. null if there's no valid profile link.
 */
export function findInstagramHandle(html: string): string | null {
  const hits = new Map<string, number>();

  for (const match of html.matchAll(HREF_PATTERN)) {
    const handle = extractInstagramHandle(match[1] ?? '');
    if (handle) hits.set(handle, (hits.get(handle) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [handle, count] of hits) {
    if (count > bestCount) {
      best = handle;
      bestCount = count;
    }
  }
  return best;
}
