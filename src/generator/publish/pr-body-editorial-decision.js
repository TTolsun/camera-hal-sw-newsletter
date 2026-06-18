// PR body의 편집자 기사 판단(editorial decision) section을 담당한다.
// 후보 artifact를 정규화해 main/supporting/hold 등으로 분류하고, 어떤 artifact를
// 근거로 삼을지 고른 뒤, 편집자가 후보를 어떻게 다뤄야 하는지 표/판정으로
// 보여주는 render 함수만 모은 단일 책임 모듈이다.

const path = require('path');

const {
  ensureArray
} = require('./publish-status');
const {
  loadCollectedReport,
  loadNewsroomJson,
  loadNewsroomReport,
  readJsonObjectIfExists
} = require('./pr-body-artifacts');
const {
  EDITORIAL_DECISION_HEADINGS,
  EDITORIAL_DECISION_TABLE_COLUMNS,
  buildDecisionGuardrailKo,
  buildDecisionReasonKo,
  classifyEditorialDecision
} = require('../reporter/editorial-decision-summary');
const {
  renderMarkdownTable
} = require('../../shared/common/markdown');
const {
  TRACE_STATUS_RANK,
  normalizeMatchText,
  firstText,
  extractCandidateTitle,
  sourceFromValue,
  extractCandidateSource,
  extractCandidateBucket,
  extractCandidateUrls,
  extractReasonList,
  classifyCandidateStatus,
  reasonCodeFor,
  formatCandidateLink
} = require('./pr-body-candidate-shared');

function normalizeEditorialDecisionCandidate(raw, { statusHint = '', sourceHint = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = extractCandidateTitle(raw);
  const urls = extractCandidateUrls(raw);
  const status = statusHint || classifyCandidateStatus(raw);
  const reason = firstText([
    raw.selection_reason,
    raw.selection_exclusion_reason,
    raw.exclusion_reason,
    raw.reason,
    raw.problem,
    ...extractReasonList(raw)
  ]);
  return {
    raw,
    title: title || 'unknown title',
    url: urls[0] || '',
    urls,
    source: extractCandidateSource(raw) || sourceFromValue(raw.source) || 'unknown source',
    sourceId: raw.source_id || raw.sourceId || raw.source?.id || '',
    sourceTier: raw.source_tier || raw.sourceTier || '',
    sourceRole: raw.source_role || raw.sourceRole || '',
    sourceReliability: raw.source_reliability || raw.reliability || '',
    bucket: extractCandidateBucket(raw) || 'unknown bucket',
    status,
    sourceHint,
    sourceGapRisk: raw.source_gap_risk === true || raw.sourceGapRisk === true,
    hasDatedEvidence: raw.has_dated_evidence ?? raw.hasDatedEvidence,
    referenceOnly: raw.reference_only === true || raw.referenceOnly === true,
    finalSelectionEligibility: raw.finalSelectionEligibility || raw.final_selection_eligibility || '',
    halImpactAxes: ensureArray(raw.hal_impact_axes || raw.halImpactAxes || raw.impact_axes),
    keyEvidence: ensureArray(raw.key_evidence || raw.keyEvidence || raw.source_extraction),
    reason,
    reasons: extractReasonList(raw),
    reasonCode: reasonCodeFor(raw, status),
    selectionReason: raw.selection_reason || '',
    exclusionReason: raw.exclusion_reason || raw.selection_exclusion_reason || ''
  };
}

function editorialRowsFromCandidates(candidates, limit = 8) {
  const rows = candidates
    .filter(Boolean)
    .map(candidate => {
      const classification = classifyEditorialDecision(candidate);
      return {
        candidate,
        classification,
        reasonKo: buildDecisionReasonKo(candidate, classification),
        guardrailKo: buildDecisionGuardrailKo(candidate, classification)
      };
    });

  const statusRank = row => TRACE_STATUS_RANK[row.candidate.status] || 99;
  const decisionRank = row => ({
    Main: 1,
    Supporting: 2,
    Short: 3,
    Hold: 4,
    Watch: 5,
    Exclude: 6
  })[row.classification.decision] || 99;

  rows.sort((a, b) =>
    statusRank(a) - statusRank(b) ||
    decisionRank(a) - decisionRank(b) ||
    normalizeMatchText(a.candidate.title).localeCompare(normalizeMatchText(b.candidate.title))
  );

  return rows.slice(0, limit);
}

function candidatesFromArray(items, statusHint, sourceHint) {
  return ensureArray(items)
    .map(item => normalizeEditorialDecisionCandidate(item, { statusHint, sourceHint }))
    .filter(Boolean);
}

function selectionReportCandidates(report) {
  if (!report || typeof report !== 'object') return [];
  return [
    ...candidatesFromArray(report.selected_main_articles || report.selected_articles || report.final_selected_articles, 'final_selected', 'selection-report'),
    ...candidatesFromArray(report.primary_selected_articles, 'primary_selected', 'selection-report'),
    ...candidatesFromArray(report.reserve_candidates, 'reserve', 'selection-report'),
    ...candidatesFromArray(report.excluded_candidates || report.excluded_candidates_top, 'excluded', 'selection-report')
  ];
}

function loadEditorialDecisionSource(root, date, status = {}) {
  if (!date) {
    return {
      source: 'status',
      level: 'status',
      candidates: [],
      counts: {
        deterministic: status.deterministic_selected_count ?? status.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
      },
      unavailableReason: 'newsletter date가 없어 후보 artifact를 찾을 수 없습니다.'
    };
  }

  const evidencePath = path.join(root, 'articles', 'content', 'newsroom', date, 'evidence-pack-summary.json');
  const evidence = readJsonObjectIfExists(evidencePath);
  if (evidence) {
    const selected = candidatesFromArray(evidence.selected_main_articles, 'final_selected', 'evidence-pack-summary');
    const reserve = candidatesFromArray(evidence.reserve_candidates, 'reserve', 'evidence-pack-summary');
    const excluded = candidatesFromArray(evidence.excluded_candidates_top, 'excluded', 'evidence-pack-summary');
    const candidates = [...selected, ...reserve, ...excluded];
    if (candidates.length > 0) {
      return {
        source: 'evidence-pack-summary.json',
        level: 'full',
        candidates,
        counts: {
          deterministic: status.deterministic_selected_count ?? status.selected_article_count,
          rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count,
          evidenceSelected: evidence.selection_summary?.selected_main_article_count,
          candidateFinal: selected.length
        }
      };
    }
  }

  const selectionReport = loadNewsroomReport(root, date, 'selection-report.json');
  const selectionCandidates = selectionReportCandidates(selectionReport);
  if (selectionCandidates.length > 0) {
    return {
      source: 'selection-report.json',
      level: 'partial',
      candidates: selectionCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? selectionReport?.counts?.deterministic_selected_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? selectionReport?.counts?.selected_article_count,
        selectionReport: selectionReport?.counts?.selected_article_count ?? selectionReport?.gate_summary?.selected_article_count,
        candidateFinal: selectionCandidates.filter(candidate => ['final_selected', 'primary_selected'].includes(candidate.status)).length
      }
    };
  }

  const reporter = loadNewsroomJson(root, date, 'reporter-candidates.json');
  const reporterItems = Array.isArray(reporter)
    ? reporter
    : reporter?.candidates || reporter?.selected_candidates || reporter?.selectedCandidates;
  const reporterCandidates = candidatesFromArray(reporterItems, 'report_only', 'reporter-candidates');
  if (reporterCandidates.length > 0) {
    return {
      source: 'reporter-candidates.json',
      level: 'partial',
      candidates: reporterCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? status.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
      }
    };
  }

  const shortlist = loadNewsroomReport(root, date, 'shortlisted-candidates.json');
  const shortlistCandidates = [
    ...candidatesFromArray(shortlist?.primary_selected_articles, 'primary_selected', 'shortlisted-candidates'),
    ...candidatesFromArray(shortlist?.selected_articles, 'final_selected', 'shortlisted-candidates'),
    ...candidatesFromArray(shortlist?.reserve_candidates, 'reserve', 'shortlisted-candidates'),
    ...candidatesFromArray(shortlist?.excluded_candidates, 'excluded', 'shortlisted-candidates')
  ];
  if (shortlistCandidates.length > 0) {
    return {
      source: 'shortlisted-candidates.json',
      level: 'partial',
      candidates: shortlistCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? shortlist?.deterministic_selected_count ?? shortlist?.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? shortlist?.selected_article_count,
        candidateFinal: shortlistCandidates.filter(candidate => ['final_selected', 'primary_selected'].includes(candidate.status)).length
      }
    };
  }

  const collected = loadCollectedReport(root, date, 'candidates.json');
  const collectedCandidates = candidatesFromArray(collected?.candidates, 'report_only', 'collected-candidates');
  if (collectedCandidates.length > 0) {
    return {
      source: 'articles/content/collected-news candidates.json',
      level: 'collected',
      candidates: collectedCandidates,
      counts: {
        deterministic: status.deterministic_selected_count ?? status.selected_article_count,
        rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
      },
      unavailableReason: '수집 후보만 있어 editorial decision을 제한적으로 표시합니다.'
    };
  }

  return {
    source: 'status',
    level: 'status',
    candidates: [],
    counts: {
      deterministic: status.deterministic_selected_count ?? status.selected_article_count,
      rendered: status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count
    },
    unavailableReason: '후보 artifact가 없어 status 값만 확인할 수 있습니다.'
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function editorialCountWarnings(source) {
  const pairs = Object.entries(source.counts || {})
    .map(([label, value]) => [label, numberOrNull(value)])
    .filter(([, value]) => value !== null);
  const unique = [...new Set(pairs.map(([, value]) => value))];
  if (unique.length <= 1) return [];
  return [
    `주의: 선택 count가 section 간 다릅니다 (${pairs.map(([label, value]) => `${label}=${value}`).join('; ')}). 이 PR에서는 warning만 표시하고 hard fail로 처리하지 않습니다.`
  ];
}

function editorialPublishRecommendation(status = {}, handoff = null) {
  if (handoff?.diagnosticsOnly) return '공개 발행 불가 / Diagnostics-only';
  if (status.final_publish_ready === true) return '자동 발행 가능 / Publish-ready';
  return '자동 발행 금지 / Review-only';
}

function renderEditorialLegend() {
  return [
    `## ${EDITORIAL_DECISION_HEADINGS.legend}`,
    '',
    '- 메인(Main): Camera HAL / driver / image pipeline 직접성이 충분한 기사',
    '- 보조(Supporting): HAL 개발 workflow에는 유용하지만 Camera 직접성은 약한 기사',
    '- 짧은 소식(Short): 짧게 언급할 수 있으나 main으로는 약한 기사',
    '- 관찰(Watch): 참고만 하고 본문 승격은 보류할 기사',
    '- 보류(Hold): source/parser/evidence 보완 후 재검토할 기사',
    '- 제외(Exclude): 뉴스레터 본문에 넣지 않을 기사',
    ''
  ].join('\n');
}

function renderEditorialDecisionSummary(root, date, status = {}, handoff = null) {
  const source = loadEditorialDecisionSource(root, date, status);
  const diagnosticsOnly = handoff?.diagnosticsOnly === true;
  const insufficientEvidence = source.candidates.length === 0 || (diagnosticsOnly && ['status', 'collected'].includes(source.level));
  const rows = insufficientEvidence ? [] : editorialRowsFromCandidates(source.candidates, 8);
  const displayedCandidateCount = rows.length;
  const totalCandidateCount = source.candidates.length;
  const omittedCandidateCount = Math.max(0, totalCandidateCount - displayedCandidateCount);
  const table = renderMarkdownTable(
    EDITORIAL_DECISION_TABLE_COLUMNS,
    rows.map((row, index) => [
      ['final_selected', 'primary_selected'].includes(row.candidate.status) ? String(index + 1) : '-',
      formatCandidateLink(row.candidate),
      row.classification.label,
      row.classification.pipelineLabel,
      row.candidate.bucket || 'unknown bucket',
      row.reasonKo,
      row.guardrailKo
    ])
  );
  const mainRows = rows.filter(row => row.classification.decision === 'Main');
  const supportingRows = rows.filter(row => row.classification.decision === 'Supporting' || row.classification.decision === 'Short');
  const holdRows = rows.filter(row => row.classification.decision === 'Hold');
  const concerns = [];
  if (insufficientEvidence) concerns.push(source.unavailableReason || '후보 evidence가 부족합니다.');
  if (mainRows.length <= 1 && supportingRows.length >= 2) {
    concerns.push('fallback/supporting 기사가 이번 호를 과도하게 채울 수 있습니다.');
  }
  if (holdRows.length > 0) concerns.push('parser/source extraction 보완 후 재검토할 후보가 있습니다.');
  concerns.push(...editorialCountWarnings(source));

  return [
    `## ${EDITORIAL_DECISION_HEADINGS.summary}`,
    '',
    insufficientEvidence
      ? '편집자 기사 판단 요약을 생성할 충분한 evidence가 없습니다.'
      : `이 section은 기계의 selected 상태가 아니라 편집자가 후보를 어떻게 다뤄야 하는지 먼저 보여줍니다. source: ${source.source}`,
    '',
    table,
    '',
    `## ${EDITORIAL_DECISION_HEADINGS.verdict}`,
    '',
    `- 발행 권고: ${editorialPublishRecommendation(status, handoff)}`,
    `- 가장 좋은 메인 기사: ${mainRows[0]?.candidate.title || '없음'}`,
    `- 메인(Main) 판단 기사 수: ${mainRows.length}`,
    `- 보조/짧은 소식 판단 기사 수: ${supportingRows.length}`,
    `- 보류(Hold) 후보 수: ${holdRows.length}`,
    `- 표시된 후보: ${displayedCandidateCount}개 / 전체 후보: ${totalCandidateCount}개`,
    `- 생략된 후보: ${omittedCandidateCount > 0 ? `${omittedCandidateCount}개, 전체 후보는 \`후보 기사 추적\` 또는 관련 JSON artifact에서 확인하세요.` : '없음'}`,
    `- 핵심 우려: ${concerns.length > 0 ? concerns.join('; ') : 'none'}`,
    '',
    renderEditorialLegend()
  ].join('\n');
}

module.exports = {
  normalizeEditorialDecisionCandidate,
  editorialRowsFromCandidates,
  candidatesFromArray,
  selectionReportCandidates,
  loadEditorialDecisionSource,
  numberOrNull,
  editorialCountWarnings,
  editorialPublishRecommendation,
  renderEditorialLegend,
  renderEditorialDecisionSummary
};
