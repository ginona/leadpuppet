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
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const html = await response.text();
    if (!html.trim()) return null;

    return { url, html };
  } catch {
    // sitio caído, timeout, redirect infinito, DNS inválido, etc. — se prueba la siguiente URL candidata
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prueba /contact, /contact-us, /about y por último la home, en ese orden,
 * y devuelve la primera que responda 200 con contenido. null si ninguna
 * respondió (sitio inaccesible).
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
