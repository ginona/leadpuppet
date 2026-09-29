import { cleanHtml } from './html.js';
import { fetchPublicUrl, readTextCapped } from './ssrf-guard.js';
import { UNTRUSTED_CONTENT_RULES, safePlainText, safeSearchTerms, wrapUntrustedContent } from './untrusted.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 8000;

export interface UrlAnalysis {
  companyName: string;
  description: string;
  suggestedCategories: string[];
  suggestedCities: string[];
}

const SYSTEM_PROMPT = `You analyze a company's website and return ONLY JSON with this schema:
{"companyName": string, "description": string, "suggestedCategories": string[], "suggestedCities": string[]}

- "companyName": the name of the company that owns the site.
- "description": 2-3 lines explaining what the company does.
- "suggestedCategories": 4 to 6 B2B business categories in English, short form (e.g. "roofing", "drywall", "electrical") representing POTENTIAL CUSTOMERS relevant to this company — who it would sell to, not the company itself.
- "suggestedCities": 4 to 6 US cities in lowercase (e.g. "houston", "dallas") where it would make sense to look for those potential customers.

${UNTRUSTED_CONTENT_RULES}`;

async function fetchHtml(rawUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchPublicUrl(rawUrl, controller.signal);

    if (!response.ok) {
      throw new Error(`The site responded ${response.status}.`);
    }

    const html = await readTextCapped(response);
    if (!html.trim()) {
      throw new Error('The site responded with no content.');
    }

    return html;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout connecting to the site (8s).');
    }
    throw error instanceof Error ? error : new Error('Could not connect to the site.');
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAnalysis(raw: unknown): UrlAnalysis {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const companyName = safePlainText(obj.companyName, 100);
  const description = safePlainText(obj.description, 500);
  // These become Google Places queries: same whitelist as CLI input.
  const suggestedCategories = safeSearchTerms(obj.suggestedCategories, 6);
  const suggestedCities = safeSearchTerms(obj.suggestedCities, 6);

  if (!companyName || suggestedCategories.length === 0 || suggestedCities.length === 0) {
    throw new Error('The AI did not return a usable analysis for this site.');
  }

  return { companyName, description, suggestedCategories, suggestedCities };
}

export async function analyzeUrl(url: string, apiKey: string): Promise<UrlAnalysis> {
  const html = await fetchHtml(url);
  const cleaned = cleanHtml(html);

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: wrapUntrustedContent(cleaned).wrapped,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI responded ${response.status}.`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response has no content.');
  }

  return normalizeAnalysis(JSON.parse(content));
}
