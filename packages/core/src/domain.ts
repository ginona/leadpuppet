// Dominios de acortadores/agregadores genéricos: el dominio base lo comparten
// muchos negocios distintos (ej. wa.link/s1lf75 y wa.link/x9k2p1 son negocios
// distintos) — el path es lo que identifica a CADA uno, así que para estos
// casos la clave de caché tiene que incluir el path, no solo el host.
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
      // Los short-codes suelen ser case-sensitive (base62) — el path NO se
      // lowercasea, para no fusionar dos negocios distintos en una clave.
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
 * true si el website es un redirect puro de WhatsApp (wa.link/wa.me/api.whatsapp.com):
 * no tienen HTML real para scrapear, el link en sí ES el dato de contacto.
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

/** true si son el mismo dominio o uno es subdominio del otro (ej. mail.foo.com y foo.com). */
export function domainsMatch(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}
