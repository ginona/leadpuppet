import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * SSRF protection for any URL provided directly by a user (currently: the
 * /analyze endpoint). Validates scheme, hostname and — via DNS resolution —
 * that no resolved IP falls in a private/reserved range, to prevent the
 * server from fetching localhost, an internal network, or a cloud
 * provider's metadata endpoint (169.254.169.254).
 *
 * Also used by the enrich scraper: website URLs come from Google Places
 * listings, which any business owner can edit, so they're untrusted too.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost']);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts as [number, number, number, number];

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local + cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7

  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && mapped[1]) return isPrivateIPv4(mapped[1]);

  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unknown format → treat as unsafe
}

/**
 * Validates that `rawUrl` is http(s), doesn't point to a blocked hostname, and
 * that no IP it resolves to (we check ALL of them, not just the first, to
 * cover DNS rebinding) is private/reserved. Returns the parsed URL (with
 * https:// as the default protocol if none was given) ready to fetch;
 * throws a generic Error if anything is unsafe.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed.');
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('This URL is not allowed.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('This URL is not allowed.');
    }
    return url;
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new Error('Could not resolve this URL.');
  }

  if (addresses.length === 0 || addresses.some((ip) => isPrivateOrReservedIp(ip))) {
    throw new Error('This URL is not allowed.');
  }

  return url;
}

const MAX_REDIRECTS = 5;

/**
 * fetch() that only ever talks to public hosts. Real sites often redirect
 * (http→https, non-www→www, etc.), so redirects are followed manually and
 * EVERY hop is re-validated — otherwise a public URL that redirects to
 * 169.254.169.254 would bypass the check entirely.
 */
export async function fetchPublicUrl(rawUrl: string, signal: AbortSignal): Promise<Response> {
  let url = await assertPublicHttpUrl(rawUrl);
  let redirects = 0;

  for (;;) {
    const response = await fetch(url, { signal, redirect: 'manual' });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('The site redirected without a destination.');
    }
    if (redirects >= MAX_REDIRECTS) {
      throw new Error('Too many redirects.');
    }
    redirects += 1;
    url = await assertPublicHttpUrl(new URL(location, url).toString());
  }
}

/** Real pages are well under 1 MB; the cap only stops a hostile/broken site from exhausting memory. */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** Reads the body as text, stopping (and truncating) at `maxBytes`. */
export async function readTextCapped(response: Response, maxBytes = MAX_HTML_BYTES): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    const remaining = maxBytes - received;
    const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
    received += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });

    if (received >= maxBytes) {
      await reader.cancel();
      break;
    }
  }

  return text + decoder.decode();
}
