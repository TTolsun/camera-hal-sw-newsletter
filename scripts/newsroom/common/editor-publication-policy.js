const EDITOR_PUBLICATION_POLICY_LINES = Object.freeze([
  '`final_publish_ready=false`는 AI 자동 발행 기준 미충족을 뜻합니다.',
  '`review_publication_ready=true`는 public newsletter files가 준비되어 있고 editor가 승인해 merge하면 홈페이지에 표시된다는 뜻입니다.',
  '`diagnostics_only=true`는 public newsletter files가 없어 merge해도 홈페이지에 표시되지 않는다는 뜻입니다.',
  '`publish-ready` label은 `has_ai_publish_ready=true`인 AI 자동 발행 기준 통과 PR에만 사용합니다.',
  '`needs-fix`와 `review-only-publication`은 editor 검토 후 public artifact를 발행할 수 있는 PR에 함께 붙을 수 있습니다.'
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
