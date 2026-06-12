module.exports = {
  ...require('../../../src/core/evidence/linked-evidence-types'),
  ...require('../../../src/core/evidence/linked-evidence-schema'),
  ...require('../../../src/core/evidence/linked-evidence-extractor'),
  ...require('../../../src/core/evidence/linked-evidence-link-classifier'),
  ...require('../../../src/core/evidence/linked-evidence-resolver'),
  ...require('../../../src/core/evidence/impact-classifier'),
  ...require('../../../src/core/evidence/event-bundle-builder'),
  ...require('../../../src/core/evidence/linked-evidence-diagnostics')
};
