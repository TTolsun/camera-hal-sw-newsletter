const { main } = require('./cli/validate-public-newsletter');

if (require.main === module) {
  main();
}

module.exports = require('./cli/validate-public-newsletter');
