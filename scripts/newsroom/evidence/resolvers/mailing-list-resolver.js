const { LINKED_EVIDENCE_TYPES } = require('../linked-evidence-types');

function supports(type) {
  return type === LINKED_EVIDENCE_TYPES.MAILING_LIST;
}

async function resolve(evidence, context) {
  return context.resolveFetchBacked(evidence, {
    resolver: 'mailing_list',
    extractStructured: body => context.mergeResolved({
      changed_files: context.extractChangedFiles(body)
    })
  }, context);
}

module.exports = {
  name: 'mailing_list',
  resolve,
  supports
};
