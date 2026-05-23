const VALID_STAGES = new Set([
  'manual_source_collect',
  'source_discovery',
  'final_newsletter'
]);

const VALID_NEXT_STEPS = new Set([
  'run_02',
  'run_03',
  'strengthen_candidates',
  'rerun_required',
  'blocked'
]);

function valueOrFallback(value, fallback = '알 수 없음') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function escapeMarkdownCell(value) {
  return valueOrFallback(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function renderRows(headers, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`
  ];
  if (safeRows.length === 0) {
    lines.push(`| ${headers.map((_, index) => index === 0 ? '없음' : '알 수 없음').join(' | ')} |`);
    return lines;
  }
  for (const row of safeRows) {
    const cells = headers.map((_, index) => escapeMarkdownCell(Array.isArray(row) ? row[index] : ''));
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines;
}

function normalizeChecklistItem(item) {
  if (typeof item === 'string') {
    return { label: item, checked: false };
  }
  if (!item || typeof item !== 'object') {
    return { label: '추가 확인 항목 없음', checked: false };
  }
  return {
    label: valueOrFallback(item.label, '추가 확인 항목 없음'),
    checked: item.checked === true
  };
}

function normalizeHandoff(handoff = {}) {
  const nextStep = VALID_NEXT_STEPS.has(handoff.nextStep) ? handoff.nextStep : 'blocked';
  return {
    nextStep,
    label: valueOrFallback(handoff.label, '진행 불가'),
    reason: valueOrFallback(handoff.reason, '판단 근거가 제공되지 않았습니다.')
  };
}

function renderEditorPrSummary({
  stage,
  verdict = {},
  handoff = {},
  summaryRows = [],
  checklistItems = [],
  resultRows = []
} = {}) {
  if (!VALID_STAGES.has(stage)) {
    throw new Error(`Unknown editor PR summary stage: ${valueOrFallback(stage)}`);
  }
  const normalizedHandoff = normalizeHandoff(handoff);
  const checklist = (Array.isArray(checklistItems) && checklistItems.length > 0
    ? checklistItems
    : ['추가 확인 항목 없음'])
    .map(normalizeChecklistItem);

  return [
    '## 최종 판단',
    '',
    `- 상태: ${valueOrFallback(verdict.label, '검토 필요')}`,
    `- 편집장 액션: ${valueOrFallback(verdict.action, '산출물과 검증 결과를 확인하세요.')}`,
    `- 가장 먼저 볼 항목: ${valueOrFallback(verdict.firstLook, '주요 결과와 상세 report를 확인하세요.')}`,
    '',
    '## 이번 PR 요약',
    '',
    ...renderRows(['항목', '값'], summaryRows),
    '',
    `- 다음 단계 안내: ${normalizedHandoff.label}`,
    `- 다음 단계 사유: ${normalizedHandoff.reason}`,
    `- next_step: ${normalizedHandoff.nextStep}`,
    '',
    '## 반드시 확인할 항목',
    '',
    ...checklist.map(item => `- [${item.checked ? 'x' : ' '}] ${item.label}`),
    '',
    '## 주요 결과',
    '',
    ...renderRows(['항목', '값', '판단'], resultRows),
    '',
    '## 상세 report',
    '',
    '아래 항목은 상세 판단용 요약과 artifact pointer입니다. 원본 로그와 전체 artifact는 생성 산출물에서 확인하세요.',
    ''
  ].join('\n');
}

module.exports = {
  VALID_NEXT_STEPS,
  VALID_STAGES,
  escapeMarkdownCell,
  renderEditorPrSummary
};
