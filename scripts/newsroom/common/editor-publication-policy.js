const EDITOR_PUBLICATION_POLICY_LINES = Object.freeze([
  '`final_publish_ready=false`는 AI 자동 발행 기준 미충족을 뜻합니다.',
  '`review_publication_ready=true`는 public newsletter files가 준비되어 있고 editor가 승인해 merge하면 홈페이지에 표시된다는 뜻입니다.',
  '`diagnostics_only=true`는 public newsletter files가 없어 merge해도 홈페이지에 표시되지 않는다는 뜻입니다.',
  '`publish-ready` label은 `has_ai_publish_ready=true`인 AI 자동 발행 기준 통과 PR에만 사용합니다.',
  '`review-only` label은 AI 자동 발행 기준 미달로 editor review가 필요한 PR에 사용하고, `review-only-publication` 또는 `diagnostics-only`가 세부 상태를 구분합니다.'
]);

function renderEditorPublicationPolicyMarkdown() {
  return [
    '## 편집자 승인 발행 정책',
    '',
    ...EDITOR_PUBLICATION_POLICY_LINES.map(line => `- ${line}`),
    ''
  ].join('\n');
}

module.exports = {
  EDITOR_PUBLICATION_POLICY_LINES,
  renderEditorPublicationPolicyMarkdown
};
