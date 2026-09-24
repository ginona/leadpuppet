const ALLOWED_PATTERN = /^[a-zA-Z0-9\s,'-]+$/;
const ICP_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface ManualCliArgs {
  mode: 'manual';
  categories: string[];
  cities: string[];
  includeInstagram: boolean;
}

export interface IcpCliArgs {
  mode: 'icp';
  icpName: string;
  includeInstagram: boolean;
}

export type CliArgs = ManualCliArgs | IcpCliArgs;

function sanitizeItem(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!ALLOWED_PATTERN.test(trimmed)) {
    throw new Error(
      `❌ Invalid value: "${raw}". Only letters, numbers, spaces, commas, hyphens and apostrophes allowed.`
    );
  }
  return trimmed;
}

function parseList(raw: string | undefined, flagName: string): string[] {
  if (!raw) {
    throw new Error(`❌ Missing --${flagName} argument. Example: --${flagName}="roofing,drywall"`);
  }

  const items = raw
    .split(',')
    .map((item) => sanitizeItem(item))
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    throw new Error(`❌ --${flagName} has no valid values.`);
  }

  return items;
}

export function parseArgs(argv: string[]): CliArgs {
  const args = new Map<string, string>();

  for (const arg of argv) {
    const match = /^--([a-zA-Z-]+)=(.*)$/.exec(arg);
    if (match) {
      args.set(match[1] ?? '', match[2] ?? '');
    }
  }

  const includeInstagram = args.get('include-instagram') === 'true';
  const icp = args.get('icp');

  if (icp !== undefined) {
    if (args.has('categories') || args.has('cities')) {
      throw new Error('❌ You cannot combine --icp with --categories/--cities. Use one or the other.');
    }

    const icpName = icp.trim();
    if (!ICP_NAME_PATTERN.test(icpName)) {
      throw new Error(`❌ Invalid ICP name: "${icp}". Only letters, numbers, hyphens and underscores allowed.`);
    }

    return { mode: 'icp', icpName, includeInstagram };
  }

  return {
    mode: 'manual',
    categories: parseList(args.get('categories'), 'categories'),
    cities: parseList(args.get('cities'), 'cities'),
    includeInstagram,
  };
}
