export interface EnrichCliArgs {
  inputPath: string;
  concurrency?: number;
  includeInstagram: boolean;
}

export function parseEnrichArgs(argv: string[]): EnrichCliArgs {
  const args = new Map<string, string>();

  for (const arg of argv) {
    const match = /^--([a-zA-Z-]+)=(.*)$/.exec(arg);
    if (match) {
      args.set(match[1] ?? '', match[2] ?? '');
    }
  }

  const inputPath = args.get('input')?.trim();
  if (!inputPath) {
    throw new Error('❌ Falta el argumento --input. Ejemplo: --input=leadoutput/leads-2026-01-01T00-00-00-000Z.json');
  }

  const concurrencyRaw = args.get('concurrency');
  const parsedConcurrency = concurrencyRaw ? Number.parseInt(concurrencyRaw, 10) : undefined;
  const concurrency = parsedConcurrency && parsedConcurrency > 0 ? parsedConcurrency : undefined;
  const includeInstagram = args.get('include-instagram') === 'true';

  return { inputPath, concurrency, includeInstagram };
}
