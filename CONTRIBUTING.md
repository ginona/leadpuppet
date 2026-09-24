# Contributing

Thanks for your interest in LeadPuppet!

## Setup

```bash
pnpm install
cp .env.example .env   # MOCK_API=true by default: no API keys needed to develop
```

Requires Node.js ≥ 20 and pnpm.

## Running

```bash
pnpm discover --categories="roofing" --cities="phoenix"   # mock mode
pnpm enrich --input=leadoutput/leads-<timestamp>.json      # needs OPENAI_API_KEY
```

## Before opening a PR

```bash
pnpm typecheck
```

It must pass with no errors (`strict` mode, `noUncheckedIndexedAccess` on).

## Guidelines

- Keep PRs focused; describe what changed and why.
- Default behavior of existing flags must not change — new features should be
  opt-in.
- Never commit API keys, `.env`, `leadoutput/` or `cache/` (all gitignored).
- Use mock mode (`MOCK_API=true`) for tests; don't spend real API quota in CI.
