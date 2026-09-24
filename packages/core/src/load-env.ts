import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> monorepo root -> .env
// Fixed path (not relative to process.cwd()): the .env always lives at the
// monorepo root, regardless of whether the process started from the CLI
// (root or pnpm --filter, which changes the cwd to the package folder).
const ROOT_ENV_PATH = path.join(__dirname, '..', '..', '..', '.env');

let loaded = false;

export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  config({ path: ROOT_ENV_PATH });
}
