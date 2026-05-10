const { LINKED_EVIDENCE_TYPES } = require('../linked-evidence-types');

function supports(type) {
  return type === LINKED_EVIDENCE_TYPES.GENERIC_URL;
}

async function resolve(evidence, context) {
  return context.resolveFetchBacked(evidence, {
    resolver: 'generic_url',
    extractStructured: body => context.mergeResolved({
      changed_files: context.extractChangedFiles(body),
      labels: context.extractLabels(body)
    })
  }, context);
}

module.exports = {
  name: 'generic_url',
  resolve,
  supports
};
