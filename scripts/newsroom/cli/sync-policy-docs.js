const fs = require('fs');
const path = require('path');
const {
  replaceNewsletterPolicyBlock
} = require('../common/newsletter-policy');

const policyDocPaths = [
  'README.md',
  'docs/editorial-policy.md',
  'docs/newsroom-workflow.md'
];

function syncPolicyDocs({ check = false, root = process.cwd() } = {}) {
  const changed = [];
  for (const relPath of policyDocPaths) {
    const filePath = path.join(root, relPath);
    const before = fs.readFileSync(filePath, 'utf8');
    const after = replaceNewsletterPolicyBlock(before);
    if (after !== before) {
      changed.push(relPath);
      if (!check) {
        fs.writeFileSync(filePath, after, 'utf8');
      }
    }
  }
  return changed;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const changed = syncPolicyDocs({ check });
  if (changed.length > 0) {
    const action = check ? 'drift detected' : 'updated';
    console.error(`Newsletter Policy docs ${action}: ${changed.join(', ')}`);
    process.exit(check ? 1 : 0);
  }
  console.log('Newsletter Policy docs are in sync.');
}

module.exports = {
  policyDocPaths,
  syncPolicyDocs
};
