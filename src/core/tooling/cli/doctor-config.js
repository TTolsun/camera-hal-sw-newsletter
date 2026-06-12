const {
  readRuntimeConfig,
  sanitizeRuntimeConfig
} = require('../../common/runtime-config');

function main() {
  try {
    const args = process.argv.slice(2);
    const allowMissingLlmCredentials = args.includes('--no-llm-credentials');
    const unknownArgs = args.filter(arg => arg !== '--no-llm-credentials');
    if (unknownArgs.length > 0) {
      throw new Error(`Unknown option(s): ${unknownArgs.join(', ')}`);
    }

    const config = readRuntimeConfig(
      process.env,
      allowMissingLlmCredentials ? {} : { requireLlmCredentials: true }
    );
    console.log('Runtime config validation passed.');
    console.log(JSON.stringify(sanitizeRuntimeConfig(config), null, 2));
  } catch (error) {
    console.error('Runtime config validation failed:');
    for (const line of String(error.message || error).split('\n').filter(Boolean)) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
