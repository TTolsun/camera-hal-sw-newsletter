const EDITOR_PUBLICATION_POLICY_LINES = Object.freeze([
  '`final_publish_ready=false` means the AI automatic publication criteria are not met.',
  'If public artifacts are included, editor-in-chief merge to `main` is site publication approval.',
  '`02-validate-site.yml` reports quality/fact-check issues as non-blocking GitHub Actions annotations.',
  '`publish-ready` is reserved for `has_ai_publish_ready=true`; `needs-fix` may still include public artifacts for editor-approved publication.'
]);

function renderEditorPublicationPolicyMarkdown() {
  return [
    '## Editor-approved Publication Policy',
    '',
    ...EDITOR_PUBLICATION_POLICY_LINES.map(line => `- ${line}`),
    ''
  ].join('\n');
}

module.exports = {
  EDITOR_PUBLICATION_POLICY_LINES,
  renderEditorPublicationPolicyMarkdown
};
