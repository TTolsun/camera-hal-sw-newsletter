const geminiProvider = require('./gemini-provider');
const openApiProvider = require('./openapi-provider');

const providers = Object.freeze([geminiProvider, openApiProvider]);
const providersById = Object.freeze(Object.fromEntries(providers.map(p => [p.id, p])));

function resolveProvider(providerId) {
  const provider = providersById[providerId];
  if (!provider) {
    throw new Error(`Unsupported LLM provider: ${providerId}`);
  }
  return provider;
}

function listProviderIds() {
  return providers.map(p => p.id);
}

module.exports = {
  providers,
  resolveProvider,
  listProviderIds
};
