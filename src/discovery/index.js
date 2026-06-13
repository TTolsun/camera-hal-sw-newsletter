module.exports = {
  ...require('../shared/evidence/linked-evidence-types'),
  ...require('../shared/evidence/linked-evidence-schema'),
  ...require('../shared/evidence/linked-evidence-extractor'),
  ...require('../shared/evidence/linked-evidence-link-classifier'),
  ...require('../shared/evidence/linked-evidence-resolver'),
  ...require('../shared/evidence/impact-classifier'),
  ...require('../shared/evidence/event-bundle-builder'),
  ...require('../shared/evidence/linked-evidence-diagnostics')
};
