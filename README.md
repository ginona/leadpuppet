# LeadPuppet

Open-source B2B lead discovery and contact enrichment. Give it business
categories and cities, and it finds companies via the **Google Places API**,
then visits each company's website to extract a contact (name / role / email)
using regex first and **GPT-4o-mini** as a fallback.

> Personal-use tooling: it does not verify emails with any third-party
> service, and results depend on what businesses publish on their own sites.
> Respect applicable anti-spam laws (CAN-SPAM, GDPR, etc.) when contacting leads.

## What it does

1. **Discover** — searches `category × city` combinations (with pagination,
   optional ICP profiles, AI-generated query variants and geographic bias).
2. Extracts name, website, phone, address, rating and review count.
3. Deduplicates by website domain and drops businesses without a website.
4. **Enrich** — scrapes each site's contact page and extracts a contact in two
   layers: a free regex pass over the full HTML, then an LLM fallback.
   Third-party/agency emails ("site by …") are detected and flagged.
5. Optional `--include-instagram`: also captures Instagram handles and
   WhatsApp click-to-chat links for leads with no email.

Results are written to `leadoutput/*.json`. Contact lookups are cached per
domain in `cache/`.

## Quick start

Requires Node.js ≥ 20 and [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/ginona/leadpuppet.git
cd leadpuppet
pnpm install
cp .env.example .env
```

### Get the API keys

- **Google Places** — [Google Cloud Console](https://console.cloud.google.com/)
  → APIs & Services → enable **"Places API (New)"** → Credentials → create a
  key and restrict it to that API. Put it in `GOOGLE_PLACES_API_KEY`.
- **OpenAI** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
  Put it in `OPENAI_API_KEY`. Optional for discovery, required for `enrich`.

### Try it without spending anything (mock mode, the default)

```bash
pnpm discover --categories="roofing,drywall" --cities="phoenix,dallas"
```

`MOCK_API=true` uses `packages/core/fixtures/places-response.json` instead of
calling Google. Real output of that command's kind:

```
🐶 LeadPuppet — MOCK mode
📋 Categories: roofing
🏙️  Cities: phoenix
🔎 Running 1 searches (max. 5 in parallel)...
  ✅ [1/1] "roofing in phoenix" → 1 page, 3 results
📦 Total results parsed: 3
🧹 Duplicates discarded: 0
🌐 No website (discarded): 1
💾 Saved: 2 leads to leadoutput/leads-2026-09-24T21-03-38-812Z.json
```

### Real mode

```bash
MOCK_API=false pnpm discover --categories="roofing,drywall" --cities="phoenix,dallas"
```

### ICP mode (goal-driven)

Define a profile in `icp/<name>.json` (see [`icp/example.json`](icp/example.json)):

```json
{
  "name": "example",
  "categories": ["roofing", "drywall", "electrical"],
  "cities": ["phoenix", "dallas", "houston"],
  "targetCount": 100,
  "maxQueries": 5
}
```

```bash
MOCK_API=false pnpm discover --icp=example
```

It builds all category × city combinations, shuffles them, and runs queries
until `targetCount` unique leads are found or `maxQueries` searches are spent.
With `OPENAI_API_KEY` set, 2–3 search-phrase variants per category are added.

### Enrich contacts

```bash
pnpm enrich --input=leadoutput/leads-<timestamp>.json
# capture Instagram / WhatsApp when there's no email:
pnpm enrich --input=leadoutput/leads-<timestamp>.json --include-instagram=true
```

Writes `leadoutput/enriched-<timestamp>.json`:

```json
{
  "name": "Phoenix Roofing Pros",
  "website": "https://www.phoenixroofingpros.com",
  "phone": "(602) 555-0142",
  "address": "1234 E Camelback Rd, Phoenix, AZ 85014, USA",
  "rating": 4.8,
  "reviewCount": 152,
  "sourceQuery": "roofing in phoenix",
  "contactName": null,
  "contactRole": null,
  "contactEmail": "info@phoenixroofingpros.com",
  "confidence": "medium"
}
```

`confidence`: `high` = the LLM found an explicit email on the business's
domain, `medium` = the regex layer found an email on the business's domain, or
the LLM inferred one from a person's name, `low` = nothing reliable (or only a
third-party email). The JSON above is an illustrative example.

## Resend MCP integration

_Section pending — to be added._

## Project layout

```
apps/cli/        Terminal entrypoints (discover, enrich)
packages/core/   Discovery + enrichment pipeline (used by the CLI)
  fixtures/      Mock Google Places response
icp/             ICP profile examples
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
