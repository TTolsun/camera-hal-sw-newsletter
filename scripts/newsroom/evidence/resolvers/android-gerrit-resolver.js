const { LINKED_EVIDENCE_TYPES } = require('../linked-evidence-types');

function supports(type) {
  return type === LINKED_EVIDENCE_TYPES.ANDROID_GERRIT;
}

async function resolve(evidence, context) {
  return context.resolveFetchBacked(evidence, {
    resolver: 'android_gerrit',
    extractStructured: body => context.mergeResolved({
      changed_files: context.extractChangedFiles(body)
    })
  }, context);
}

module.exports = {
  name: 'android_gerrit',
  resolve,
  supports
};
