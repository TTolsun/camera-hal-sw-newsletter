// PR body의 정적/고정 안내 텍스트 section을 담당한다.
// editor brief section 추출, 발행 정책 안내, heavy evidence 보존 안내처럼
// 입력 artifact를 거의 읽지 않고 고정 문구를 만들어 내는 render 함수만 모은
// 단일 책임 모듈이다.

const {
  renderEditorPublicationPolicyMarkdown
} = require('../reporter/editor-publication-policy');

const EDITOR_BRIEF_ALLOWED_SECTIONS = new Set([
  '이번 주 핵심 메시지',
  '메인으로 봐야 할 기사',
  'Camera HAL 업무 연결 포인트',
  '편집장 확인 checklist',
  '권장 판단'
]);

const EDITOR_BRIEF_REMOVED_SECTIONS = new Set([
  '검증 결과 요약',
  '품질 게이트',
  'Stale Claim Gate',
  '후보 선택 진단',
  'Generation Status',
  'Composition Summary',
  'Deterministic Final Selection Status',
  'Editor Action Guidance'
]);

function normalizeHeading(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractEditorBriefSections(markdown) {
  if (!markdown) return '';
  const sections = [];
  let current = null;

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        heading: normalizeHeading(match[1]),
        lines: []
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);

  return sections
    .filter(section =>
      EDITOR_BRIEF_ALLOWED_SECTIONS.has(section.heading) &&
      !EDITOR_BRIEF_REMOVED_SECTIONS.has(section.heading)
    )
    .map(section => {
      const body = section.lines.join('\n').trim();
      return body ? `## ${section.heading}\n\n${body}` : `## ${section.heading}`;
    })
    .join('\n\n');
}

function renderEditorApprovedPublicationPolicy() {
  return renderEditorPublicationPolicyMarkdown();
}

function renderHeavyRetentionNote(date) {
  const runId = process.env.GITHUB_RUN_ID || '';
  const artifactName = runId ? `newsroom-final-debug-${runId}` : 'newsroom-final-debug-<run_id>';
  return [
    '## Heavy Evidence Retention',
    '',
    `debug_heavy/transient_attempt artifact는 PR diff에 의도적으로 포함되지 않습니다.`,
    `- Actions artifact: \`${artifactName}\` 다운로드`,
    `- 또는 \`articles/content/newsroom/${date}/artifact-manifest.json\` → \`retained_heavy_artifacts\` 참조`,
    ''
  ].join('\n');
}

module.exports = {
  EDITOR_BRIEF_ALLOWED_SECTIONS,
  EDITOR_BRIEF_REMOVED_SECTIONS,
  normalizeHeading,
  extractEditorBriefSections,
  renderEditorApprovedPublicationPolicy,
  renderHeavyRetentionNote
};
