const androidDevelopersJetpackRelease = require('./adapters/android-developers-jetpack-release');

const ADAPTERS = [
  androidDevelopersJetpackRelease
];

function parseSourceWithAdapters(html, source = {}) {
  const sourceUrl = source.url || source.sourceUrl || '';
  const adapter = ADAPTERS.find(item => item.canHandle(sourceUrl, source));
  return adapter ? adapter.extract(html, source) : [];
}

module.exports = {
  parseSourceWithAdapters
};
