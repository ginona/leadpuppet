import { cleanHtml } from './html.js';
import type { ContactInfo } from './types.js';
import { UNTRUSTED_CONTENT_RULES, safeEmail, safePersonName, safeRole, wrapUntrustedContent } from './untrusted.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You extract contact information for local businesses from their website's HTML.
Return ONLY JSON with this schema: {"name": string|null, "role": string|null, "email": string|null, "confidence": "high"|"medium"|"low"}.

The domain of the business you're analyzing is given to you as "Domain: <domain>" in the user message. An email whose domain is clearly different from that does NOT belong to the business — it's usually the agency/designer/webmaster who built the site. Completely ignore those emails, especially ones appearing in credit contexts like "site by", "designed by", "made by", "powered by", or agency/webmaster signatures in the footer: never return them as "email", not even with low confidence.

Confidence rules:
- "high": you found an explicit email in the text/HTML WHOSE DOMAIN MATCHES the business's domain.
- "medium": you found the name and/or role of a person at the business but no explicit email at their domain, so you infer the email using the standard pattern firstname.lastname@<business domain>.
- "low": you found nothing useful about the business's domain (this includes the case where the only visible email belongs to a third party/agency — in that case "email" must be null).

Never invent a name or role that isn't suggested by the text. Never return an email from a domain other than the business being analyzed.

${UNTRUSTED_CONTENT_RULES}`;

function normalizeContactInfo(raw: unknown): ContactInfo {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const email = safeEmail(obj.email);
  const claimed =
    obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low' ? obj.confidence : 'low';

  return {
    name: safePersonName(obj.name),
    role: safeRole(obj.role),
    email,
    // "high"/"medium" only make sense with an email; the domain check happens in the pipeline.
    confidence: email ? claimed : 'low',
  };
}

export async function extractContact(html: string, domain: string, apiKey: string): Promise<ContactInfo> {
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
          content: `Domain: ${domain}\n\n${wrapUntrustedContent(cleaned).wrapped}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI responded ${response.status}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response has no content');
  }

  return normalizeContactInfo(JSON.parse(content));
}
