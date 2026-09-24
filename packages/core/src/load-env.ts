import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/core/src -> packages/core -> packages -> raíz del monorepo -> .env
// Ruta fija (no relativa a process.cwd()): el .env siempre vive en la raíz
// del monorepo, sin importar si el proceso arrancó desde el CLI (root o
// pnpm --filter, que cambia el cwd a la carpeta del paquete) o desde la API.
const ROOT_ENV_PATH = path.join(__dirname, '..', '..', '..', '.env');

let loaded = false;

export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  config({ path: ROOT_ENV_PATH });
}
