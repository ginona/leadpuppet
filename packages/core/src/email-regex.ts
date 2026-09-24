import { domainsMatch, emailDomain } from './domain.js';

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const MAILTO_PATTERN = /href\s*=\s*["']mailto:([^"'?#>\s]+)/gi;

// Falsos positivos típicos al escanear HTML crudo: "logo@2x.png", "font@1.woff2", etc.
const ASSET_TLDS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'css', 'js', 'woff', 'woff2', 'ttf', 'map']);

// Dominios de plataformas/trackers/placeholders: nunca son el contacto del negocio.
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

function isUsable(email: string, siteDomain: string): boolean {
  const host = emailDomain(email);
  if (!host) return false;

  const tld = host.split('.').pop() ?? '';
  if (ASSET_TLDS.has(tld)) return false;
  if (isPlatformDomain(host)) return false;

  // Mismo dominio que el sitio: evita repetir el caso WebFX (email de la agencia).
  return domainsMatch(host, siteDomain);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Capa 1 (sin costo): busca emails en el HTML COMPLETO, sin limpiar ni truncar
 * (el footer suele ser donde vive el email). Prioriza los de `mailto:` sobre los
 * del texto, y dentro de cada grupo el más repetido. Devuelve null si no hay
 * ningún email usable del mismo dominio que el sitio.
 */
export function findSiteEmail(html: string, siteDomain: string): string | null {
  const mailtoHits = new Map<string, number>();
  for (const match of html.matchAll(MAILTO_PATTERN)) {
    // mailto puede traer varios destinatarios separados por coma
    for (const part of safeDecode(match[1] ?? '').split(',')) {
      const email = part.trim().toLowerCase();
      if (email && isUsable(email, siteDomain)) mailtoHits.set(email, (mailtoHits.get(email) ?? 0) + 1);
    }
  }

  const textHits = new Map<string, number>();
  for (const match of html.matchAll(EMAIL_PATTERN)) {
    const email = match[0].toLowerCase();
    if (isUsable(email, siteDomain)) textHits.set(email, (textHits.get(email) ?? 0) + 1);
  }

  return mostFrequent(mailtoHits) ?? mostFrequent(textHits);
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
