const { LINKED_EVIDENCE_TYPES } = require('../linked-evidence-types');

function supports(type) {
  return type === LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER;
}

async function resolve(evidence, context) {
  return context.resolveFetchBacked(evidence, {
    resolver: 'google_issue_tracker'
  }, context);
}

module.exports = {
  name: 'google_issue_tracker',
  resolve,
  supports
};
