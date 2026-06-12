const { LINKED_EVIDENCE_TYPES } = require('../linked-evidence-types');

const GITHUB_TYPES = new Set([
  LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST,
  LINKED_EVIDENCE_TYPES.GITHUB_ISSUE,
  LINKED_EVIDENCE_TYPES.GITHUB_COMMIT,
  LINKED_EVIDENCE_TYPES.GITHUB_RELEASE
]);

function supports(type) {
  return GITHUB_TYPES.has(type);
}

async function resolve(evidence, context) {
  return context.resolveFetchBacked(evidence, {
    resolver: 'github',
    extractStructured: body => context.mergeResolved({
      changed_files: context.extractChangedFiles(body),
      labels: context.extractLabels(body)
    })
  }, context);
}

module.exports = {
  name: 'github',
  resolve,
  supports
};
