// Single entrypoint: `pnpm leadpuppet <command> [...args]`. Each command is its
// own module that runs on import; the existing discover/enrich scripts are untouched.

const COMMANDS: Record<string, () => Promise<unknown>> = {
  init: () => import('./init.js'),
  find: () => import('./find.js'),
  discover: () => import('./index.js'),
  enrich: () => import('./enrich.js'),
};

const HELP = `🐶 LeadPuppet

Usage: pnpm leadpuppet <command> [...args]

  init                               Set up your API keys in .env
  find "<categories>" "<cities>"     Discover + enrich in one step
       [--target=100] [--max-queries=15] [--include-instagram=true]
  discover --categories=... --cities=... | --icp=<name>
  enrich --input=leadoutput/leads-<timestamp>.json

Example: pnpm leadpuppet find "roofing,drywall" "houston,dallas"`;

const [command, ...rest] = process.argv.slice(2);
// Own keys only: "constructor", "__proto__"... must not resolve to an Object.prototype member.
const load = command && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;

if (!load) {
  console.log(HELP);
  if (command && command !== 'help' && command !== '--help') process.exitCode = 1;
} else {
  // The command modules read process.argv themselves: drop the command name.
  process.argv = [process.argv[0] ?? 'node', process.argv[1] ?? 'leadpuppet', ...rest];
  await load();
}

export {};
