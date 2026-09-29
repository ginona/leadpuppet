import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cancel, intro, isCancel, log, outro, password, text } from '@clack/prompts';
import { ENRICH_OUTPUT_FIELDS } from '@leadpuppet/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/cli/src -> apps/cli -> apps -> monorepo root (same .env that core loads).
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, '.env.example');

const DEFAULT_OUTPUT_FIELDS = 'contactEmail';
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 300;

interface KeyPrompt {
  name: 'GOOGLE_PLACES_API_KEY' | 'OPENAI_API_KEY';
  label: string;
  /** Usual prefix of the key; a different one only triggers a warning. */
  expectedPrefix: string;
}

const KEYS: KeyPrompt[] = [
  { name: 'GOOGLE_PLACES_API_KEY', label: 'Google Places API key', expectedPrefix: 'AIza' },
  { name: 'OPENAI_API_KEY', label: 'OpenAI API key', expectedPrefix: 'sk-' },
];

async function readOrEmpty(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function currentValue(env: string, name: string): string {
  const match = new RegExp(`^${name}=(.*)$`, 'm').exec(env);
  return match?.[1]?.trim() ?? '';
}

/** Replaces `NAME=...` in place (keeping comments and order) or appends it. */
function upsert(env: string, name: string, value: string): string {
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  // Function replacer: a string one would interpret "$&", "$1"... inside the value.
  if (pattern.test(env)) return env.replace(pattern, () => `${name}=${value}`);
  return `${env.replace(/\n*$/, '')}\n${name}=${value}\n`;
}

function validateKey(value: string, hasCurrent: boolean): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return hasCurrent ? undefined : 'Required.';
  if (/\s/.test(trimmed)) return "Keys don't contain spaces.";
  if (trimmed.length < MIN_KEY_LENGTH) return `Too short — keys are at least ${MIN_KEY_LENGTH} characters.`;
  if (trimmed.length > MAX_KEY_LENGTH) return 'Too long — check you pasted only the key.';
  return undefined;
}

function validateOutputFields(value: string): string | undefined {
  const fields = value.split(',').map((f) => f.trim()).filter(Boolean);
  const unknown = fields.filter((f) => !(ENRICH_OUTPUT_FIELDS as readonly string[]).includes(f));
  if (unknown.length > 0) return `Unknown: ${unknown.join(', ')}. Valid: ${ENRICH_OUTPUT_FIELDS.join(', ')}`;
  return undefined;
}

async function main(): Promise<void> {
  intro('🐶 LeadPuppet setup');

  // Starts from the existing .env, or from .env.example so the comments come along.
  let env = (await readOrEmpty(ENV_PATH)) ?? (await readOrEmpty(ENV_EXAMPLE_PATH)) ?? '';

  for (const key of KEYS) {
    const hasCurrent = currentValue(env, key.name).length > 0;
    const answer = await password({
      message: hasCurrent ? `${key.label} (Enter to keep the current one)` : key.label,
      mask: '•',
      validate: (value) => validateKey(value ?? '', hasCurrent),
    });

    if (isCancel(answer)) {
      cancel('Setup cancelled. .env was not modified.');
      process.exit(0);
    }

    const value = answer.trim();
    if (!value) continue;

    if (!value.startsWith(key.expectedPrefix)) {
      log.warn(`${key.label} usually starts with "${key.expectedPrefix}". Saved anyway — double-check it if requests fail.`);
    }
    env = upsert(env, key.name, value);
  }

  const outputFields = await text({
    message: 'Fields to keep in the enriched file (comma-separated, Enter = contactEmail)',
    placeholder: DEFAULT_OUTPUT_FIELDS,
    defaultValue: DEFAULT_OUTPUT_FIELDS,
    validate: (value) => validateOutputFields(value ?? ''),
  });

  if (isCancel(outputFields)) {
    cancel('Setup cancelled. .env was not modified.');
    process.exit(0);
  }

  const normalizedFields = outputFields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .join(',');
  env = upsert(env, 'ENRICH_OUTPUT_FIELDS', normalizedFields || DEFAULT_OUTPUT_FIELDS);

  // A real Places key means real searches; mock mode only makes sense without one.
  env = upsert(env, 'MOCK_API', 'false');

  // Owner-only: .env holds API keys. mode only applies on create, so chmod covers an existing file too.
  await writeFile(ENV_PATH, env, { encoding: 'utf-8', mode: 0o600 });
  await chmod(ENV_PATH, 0o600);

  outro(`✅ Keys saved to .env (live mode: MOCK_API=false). Next: pnpm leadpuppet find "roofing" "houston"`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
