const fs = require('fs');
const path = require('path');
const {
  analyzeNewsletterPolicyBlock,
  replaceNewsletterPolicyBlock
} = require('../../common/newsletter-policy');

const policyDocPaths = [
  'README.md',
  'docs/EDITORIAL_POLICY.md',
  'docs/NEWSROOM_WORKFLOW.md'
];

function syncPolicyDocs({ check = false, root = process.cwd() } = {}) {
  const changed = [];
  const failures = [];
  for (const relPath of policyDocPaths) {
    const filePath = path.join(root, relPath);
    const before = fs.readFileSync(filePath, 'utf8');
    if (check) {
      const analysis = analyzeNewsletterPolicyBlock(before);
      if (!analysis.ok) {
        failures.push({ relPath, errors: analysis.errors });
      }
      continue;
    }

    let after;
    try {
      after = replaceNewsletterPolicyBlock(before);
    } catch (error) {
      failures.push({ relPath, errors: [error.message] });
      continue;
    }
    if (after !== before) {
      changed.push(relPath);
      fs.writeFileSync(filePath, after, 'utf8');
    }
  }
  return { changed, failures };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const { changed, failures } = syncPolicyDocs({ check });
  if (failures.length > 0) {
    const mode = check ? 'check failed' : 'sync failed';
    console.error(`Newsletter Policy docs ${mode}:`);
    for (const failure of failures) {
      console.error(`- ${failure.relPath}: ${failure.errors.join('; ')}`);
    }
    process.exit(1);
  }
  if (changed.length > 0) {
    console.error(`Newsletter Policy docs updated: ${changed.join(', ')}`);
    process.exit(0);
  }
  console.log('Newsletter Policy docs are in sync.');
}

module.exports = {
  policyDocPaths,
  syncPolicyDocs
};
