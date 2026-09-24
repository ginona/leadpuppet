// Segmentos de path de instagram.com que NO son un handle de perfil (posts, reels, secciones fijas del sitio, etc.)
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
 * Dado un URL, si apunta al perfil de un negocio en instagram.com devuelve
 * el handle limpio (sin @, sin query params, sin trailing slash). null si
 * no es instagram.com, o si el primer segmento del path es una sección fija
 * del sitio (post, reel, explore, etc.) en vez de un usuario.
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
 * Busca links a instagram.com en el HTML crudo (mismo enfoque que
 * findSiteEmail en email-regex.ts: sin limpiar/truncar) y devuelve el
 * handle más repetido. null si no hay ningún link de perfil válido.
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
