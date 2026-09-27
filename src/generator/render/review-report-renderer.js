const { ensureArray } = require('../../shared/common/value-coercion');
const { renderCandidateSelectionDiagnostics } = require('../select/selection-diagnostics');
const { renderReleaseQaInventorySection } = require('../publish/review-artifact-inventory');

module.exports = function reviewReportRenderers({ bulletsMarkdown, articleSectionContractMarkdown }) {
function buildFactCheckMarkdown(date, report) {
  const mustFix = ensureArray(report.must_fix);
  return `# 사실 검증 보고서 - ${date}

## 상태

${report.status}

## 반드시 수정할 항목

${mustFix.length === 0 ? '- 없음' : mustFix.map(item => `- 위치: ${item.location}
  - 문제: ${item.problem}
  - 제안: ${item.suggestion}
  - 출처: ${item.source_url}`).join('\n')}

## 권장 수정

${ensureArray(report.recommended_fixes).length === 0 ? '- 없음' : bulletsMarkdown(report.recommended_fixes)}

## 출처 공백

${ensureArray(report.source_gaps).length === 0 ? '- 없음' : bulletsMarkdown(report.source_gaps)}

## 최종 의견

${report.final_comment}
`;
}

function qualitySummaryMarkdown(qualityReport) {
  if (!qualityReport) return '- 품질 점수: 생성되지 않음';
  return [
    `- 품질 점수: ${qualityReport.score}/100`,
    `- 품질 기준: ${qualityReport.threshold}`,
    `- 품질 상태: ${qualityReport.status}`,
    `- 주요 감점: ${ensureArray(qualityReport.deductions).slice(0, 5).map(item => `${item.points}pt ${item.category}${item.location ? ` (${item.location})` : ''}`).join('; ') || '없음'}`
  ].join('\n');
}

function staleClaimSummaryMarkdown(staleClaimReport) {
  if (!staleClaimReport) return '- Stale claim report: not generated';
  return [
    `- Stale claim status: ${staleClaimReport.status || 'UNKNOWN'}`,
    `- Removed global stale items: ${ensureArray(staleClaimReport.stale_claim_items_removed).length}`,
    `- Removed unsupported release claims: ${ensureArray(staleClaimReport.unsupported_release_claims_removed).length}`,
    `- Unused references removed: ${ensureArray(staleClaimReport.unused_references_removed).length}`,
    `- Hard failures: ${ensureArray(staleClaimReport.hard_failures).length}`
  ].join('\n');
}

function articleSectionContractSummaryMarkdown(issue, qualityReport = null) {
  return `## Article Structure Contract

${articleSectionContractMarkdown(issue, qualityReport)}`;
}

function buildEditorChiefBrief(date, issue, factCheck, qualityReport = null, selectionDiagnostics = null, staleClaimReport = null) {
  const firstSection = ensureArray(issue.sections)[0] || {};
  const decision = factCheck.status === 'PASS' && (!qualityReport || qualityReport.status === 'PASS')
    ? 'APPROVE'
    : 'REQUEST_CHANGES';
  return `# 편집장 브리핑 - ${date}

## 이번 주 핵심 메시지

${issue.summary}

## 메인으로 봐야 할 기사

${firstSection.headline || '첫 번째 메인 기사 확인 필요'}

## Camera HAL 업무 연결 포인트
${bulletsMarkdown(ensureArray(issue.action_items).slice(0, 5))}

## 검증 결과 요약

- 상태: ${factCheck.status}
- must_fix 개수: ${ensureArray(factCheck.must_fix).length}
- source gap 개수: ${ensureArray(factCheck.source_gaps).length}
- 의견: ${factCheck.final_comment}

## 품질 게이트
${qualitySummaryMarkdown(qualityReport)}

${articleSectionContractSummaryMarkdown(issue, qualityReport)}

## Stale Claim Gate

${staleClaimSummaryMarkdown(staleClaimReport)}

${selectionDiagnostics ? `${renderCandidateSelectionDiagnostics(selectionDiagnostics)}
` : ''}

## 편집장 확인 checklist

- [ ] 이번 주 핵심 메시지가 Camera HAL 업무와 직접 연결되는가?
- [ ] 주요 항목의 출처가 충분하고 과장 표현이 없는가?
- [ ] 검증 결과의 must_fix가 모두 해소되었는가?
- [ ] 팀 공유용으로도 충분한 action item이 정리되었는가?

## 권장 판단

${decision}
`;
}

function buildReleaseQaReport(date, files, validateResult, factCheck, todoFound, emptySourceSections, qualityReport = null, reviewInventory = null) {
  return `# 릴리스 QA 보고서 - ${date}

## 생성 파일 목록

${files.map(file => `- ${file}`).join('\n')}

${reviewInventory ? `${renderReleaseQaInventorySection(reviewInventory)}
` : ''}

## npm run validate 실행 결과

${validateResult}

## 잔여 TODO 여부

${todoFound ? 'TODO 문자가 남아 있습니다.' : '없음'}

## 출처 누락 여부

${emptySourceSections.length === 0 ? '없음' : emptySourceSections.map(section => `- ${section}`).join('\n')}

## Gemini 검증 결과

- 상태: ${factCheck.status}
- must_fix 개수: ${ensureArray(factCheck.must_fix).length}
- source gap 개수: ${ensureArray(factCheck.source_gaps).length}

## 품질 게이트
${qualitySummaryMarkdown(qualityReport)}
`;
}


return { buildFactCheckMarkdown, buildEditorChiefBrief, buildReleaseQaReport };
};
