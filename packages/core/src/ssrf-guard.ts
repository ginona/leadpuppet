import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Protección SSRF para cualquier URL provista directamente por un usuario
 * (hoy: el endpoint /analyze). Valida esquema, hostname y — vía resolución
 * DNS — que ninguna IP resuelta caiga en un rango privado/reservado, para
 * evitar que el servidor haga fetch a localhost, la red interna de Railway,
 * o el endpoint de metadata de un cloud provider (169.254.169.254).
 *
 * No se usa en el pipeline de discover/enrich: ahí las URLs vienen de los
 * resultados de Google Places, no directamente de un input de usuario.
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
  return true; // formato desconocido → tratarlo como inseguro
}

/**
 * Valida que `rawUrl` sea http(s), no apunte a un hostname bloqueado, y que
 * ninguna IP a la que resuelva (chequeamos TODAS, no solo la primera, para
 * cubrir DNS rebinding) sea privada/reservada. Devuelve el URL parseado
 * (con protocolo por defecto https:// si no vino ninguno) listo para hacer
 * fetch; lanza un Error genérico si algo no es seguro.
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
