const {
  readRuntimeConfig,
  sanitizeRuntimeConfig
} = require('./lib/runtime-config');

function main() {
  try {
    const config = readRuntimeConfig(process.env, { requireGeminiApiKey: true });
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
