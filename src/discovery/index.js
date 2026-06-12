module.exports = {
  ...require('../core/evidence/linked-evidence-types'),
  ...require('../core/evidence/linked-evidence-schema'),
  ...require('../core/evidence/linked-evidence-extractor'),
  ...require('../core/evidence/linked-evidence-link-classifier'),
  ...require('../core/evidence/linked-evidence-resolver'),
  ...require('../core/evidence/impact-classifier'),
  ...require('../core/evidence/event-bundle-builder'),
  ...require('../core/evidence/linked-evidence-diagnostics')
};
