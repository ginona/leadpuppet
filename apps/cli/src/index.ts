import { loadConfig, loadIcpProfile, runManualDiscovery, runIcpDiscovery } from '@leadpuppet/core';
import { parseArgs } from './cli.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));

  console.log(`🐶 LeadPuppet — ${config.mockApi ? 'MOCK' : 'REAL'} mode`);
  if (args.includeInstagram) {
    console.log('📸 Instagram handle capture: ON');
  }

  if (args.mode === 'icp') {
    const profile = await loadIcpProfile(args.icpName);
    await runIcpDiscovery(profile, config, args.includeInstagram);
  } else {
    await runManualDiscovery(args.categories, args.cities, config, args.includeInstagram);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
