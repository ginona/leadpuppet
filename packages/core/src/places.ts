import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawPlace, RawSearchResponse, SearchResult } from './types.js';
import type { LocationBias } from './geocode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'places-response.json');

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
].join(',');

const MAX_RETRIES = 4;
const MAX_PAGES = 3;
// Google takes a moment to activate the nextPageToken; requesting it earlier returns INVALID_ARGUMENT.
const NEXT_PAGE_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestBody(query: string, pageToken: string | undefined, locationBias: LocationBias | undefined) {
  const body: Record<string, unknown> = pageToken ? { textQuery: query, pageToken } : { textQuery: query };

  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: locationBias.radiusMeters,
      },
    };
  }

  return body;
}

async function fetchPage(
  query: string,
  apiKey: string,
  pageToken: string | undefined,
  locationBias: LocationBias | undefined
): Promise<RawSearchResponse> {
  let attempt = 0;

  while (true) {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(buildRequestBody(query, pageToken, locationBias)),
    });

    if (response.ok) {
      return (await response.json()) as RawSearchResponse;
    }

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt >= MAX_RETRIES) {
      const body = await response.text();
      throw new Error(`❌ Google Places API responded ${response.status} for "${query}": ${body.slice(0, 200)}`);
    }

    const backoffMs = 2 ** attempt * 500 + Math.random() * 250;
    attempt += 1;
    await sleep(backoffMs);
  }
}

async function searchPlacesReal(
  query: string,
  apiKey: string,
  locationBias: LocationBias | undefined
): Promise<SearchResult> {
  const places: RawPlace[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    if (pageToken) {
      await sleep(NEXT_PAGE_DELAY_MS);
    }

    const data = await fetchPage(query, apiKey, pageToken, locationBias);
    places.push(...(data.places ?? []));
    pages += 1;
    pageToken = data.nextPageToken;
  } while (pageToken && pages < MAX_PAGES);

  return { places, pages };
}

let fixtureCache: RawPlace[] | null = null;

async function searchPlacesMock(): Promise<SearchResult> {
  if (!fixtureCache) {
    const raw = await readFile(FIXTURE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as RawSearchResponse;
    fixtureCache = parsed.places ?? [];
  }
  return { places: fixtureCache, pages: 1 };
}

export async function searchPlaces(
  query: string,
  apiKey: string,
  mockApi: boolean,
  locationBias?: LocationBias
): Promise<SearchResult> {
  return mockApi ? searchPlacesMock() : searchPlacesReal(query, apiKey, locationBias);
}
