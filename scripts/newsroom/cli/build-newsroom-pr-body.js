const fs = require('fs');
const path = require('path');

const {
  ensureArray,
  resolvePublishStatus
} = require('../common/publish-status');
const {
  articlePolicy,
  articleCountRangeText,
  publishGateCriteriaText
} = require('../common/newsletter-policy');
const {
  renderEditorPublicationPolicyMarkdown
} = require('../common/editor-publication-policy');
const {
  getChangedRepoVisibleArtifacts
} = require('./resolve-reviewable-artifacts');

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

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function valueOrUnknown(value) {
  if (value === null || value === undefined || value === '') return 'unknown';
  return String(value);
}

function booleanText(value) {
  return value === true ? 'true' : 'false';
}

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

function formatReasonSummary(items) {
  return ensureArray(items)
    .slice(0, 5)
    .map(item => `${item.reason || 'unknown'} (${item.count ?? 'n/a'})`)
    .join('; ') || 'none';
}

function countFromStatus(status, key) {
  return status[key] ?? status.composition_summary?.[key];
}

function mustFixSummaryText(status) {
  return [
    `must_fix_count=${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `source_gap_count=${valueOrUnknown(status.source_gap_count ?? 0)}`
  ].join('; ');
}

function recommendedEditorAction(status) {
  if (ensureArray(status.consistency_errors).length > 0) {
    return 'status artifact와 현재 산출물 재계산 결과가 다릅니다. PR 생성 전에 status artifact와 review artifact를 함께 확인하세요.';
  }
  if (status.final_publish_ready === true && status.validate_outcome === 'success') {
    return '최종 발행 조건이 모두 통과했습니다. 편집 검토를 마친 뒤 병합할 수 있습니다.';
  }
  if (status.stale_claim_hard_failure_count > 0 || status.stale_claim_status === 'NEEDS_FIX') {
    return '발행 전에 stale-claim hard failure를 제거하거나 문장을 다시 작성하고 stale-claim-report를 다시 확인하세요.';
  }
  if (status.must_fix_count > 0 || status.source_gap_count > 0 || status.fact_check_status === 'NEEDS_FIX') {
    return 'fact-check의 must_fix/source-gap 항목을 먼저 해결한 뒤 검증을 다시 실행하세요.';
  }
  if (status.composition_mode === 'THIN_WEEK_REVIEW') {
    return '검토용 PR로만 사용하세요. 더 강한 후보를 추가하거나 기사 풀이 충분해질 때까지 발행을 막아야 합니다.';
  }
  if (status.review_gate_passed === true && status.publish_gate_passed === false) {
    return '검토용 PR로만 사용하세요. 후보 선택 발행 조건을 만족하기 전에는 최종 발행으로 보지 않습니다.';
  }
  if (status.composition_mode === 'FALLBACK_COMPOSITION') {
    return 'SoC/platform/tooling 보조 기사 연결성이 실제 개발 업무에 명확한지 편집자가 확인한 뒤 판단하세요.';
  }
  if (status.validate_outcome === 'failure' || status.quality_status !== 'PASS') {
    return 'quality-report.md와 validation output을 확인하고 약한 section을 수정하거나 demote하세요.';
  }
  return '생성 산출물, label, validation output을 확인한 뒤 발행 여부를 결정하세요.';
}

function renderStatusSection(status) {
  const editorAction = recommendedEditorAction(status);
  const editorialReviewable = status.failure_kind === 'editorial_reviewable';
  return [
    '## 생성 상태',
    '',
    editorialReviewable
      ? '편집장 검토 경고: AI 자동 발행 기준은 통과하지 못했지만 public newsletter files는 생성되었습니다. 편집장이 승인하여 merge하면 Newsletter 사이트에 게시됩니다.'
      : '',
    `전체 상태: ${valueOrUnknown(status.status)}`,
    `생성 실행 상태: ${valueOrUnknown(status.generation_status)}`,
    `failure_kind=${valueOrUnknown(status.failure_kind || 'none')}`,
    `팩트체크 상태: ${valueOrUnknown(status.fact_check_status)}`,
    `팩트체크 must_fix_count: ${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `팩트체크 source_gap_count: ${valueOrUnknown(status.source_gap_count ?? 0)}`,
    `must_fix 요약: ${mustFixSummaryText(status)}`,
    `품질 점수: ${valueOrUnknown(status.quality_score)}`,
    `품질 기준: ${valueOrUnknown(status.quality_threshold)}`,
    '최대 점수: 100',
    `품질 상태: ${valueOrUnknown(status.quality_status)}`,
    `품질 시도 횟수: ${valueOrUnknown(status.quality_attempt_count)}`,
    `잠금 기사 수: ${valueOrUnknown(status.locked_article_count)}`,
    `수정된 section 수: ${valueOrUnknown(status.repaired_section_count ?? 0)}`,
    `건너뛴 repair section 수: ${valueOrUnknown(status.skipped_repair_section_count ?? 0)}`,
    `검증 결과: ${valueOrUnknown(status.validate_outcome)}`,
    `validate_ok=${booleanText(status.validate_ok)}`,
    `selection_publish_ready: ${booleanText(status.selection_publish_ready)}`,
    `최종 발행 가능 여부: ${booleanText(status.final_publish_ready)} (final_publish_ready: ${booleanText(status.final_publish_ready)})`,
    `정책상 발행 조건: ${booleanText(status.publish_gate_passed)} (publish_gate_passed: ${booleanText(status.publish_gate_passed)}; ${publishGateCriteriaText()})`,
    `검토 게이트: ${booleanText(status.review_gate_passed)} (review_gate_passed: ${booleanText(status.review_gate_passed)})`,
    `편집자 검토 필요: ${booleanText(status.editor_review_required)}`,
    `editor_review_required=${booleanText(status.editor_review_required)}`,
    `부족한 후보 경로: ${booleanText(status.underfilled)}`,
    `Stale claim 상태: ${valueOrUnknown(status.stale_claim_status)}`,
    `Stale claim 요약: removed=${valueOrUnknown(status.stale_claim_removed_count ?? 0)}; hard_failures=${valueOrUnknown(status.stale_claim_hard_failure_count ?? 0)}`,
    `상태 일관성 오류: ${ensureArray(status.consistency_errors).length > 0 ? status.consistency_errors.join('; ') : '없음'} (consistency_errors: ${ensureArray(status.consistency_errors).length > 0 ? status.consistency_errors.join('; ') : 'none'})`,
    `권장 조치: ${editorAction}`,
    ''
  ].filter(line => line !== '').join('\n');
}

function renderEditorApprovedPublicationPolicy() {
  return renderEditorPublicationPolicyMarkdown();
}

function renderCompositionSummary(status) {
  return [
    '## 기사 구성 요약',
    '',
    `- composition_mode: ${valueOrUnknown(status.composition_mode)}`,
    `- selection_composition_mode: ${valueOrUnknown(status.selection_composition_mode ?? status.composition_mode)}`,
    `- final_publish_ready: ${booleanText(status.final_publish_ready)}`,
    `- editor_review_required: ${booleanText(status.editor_review_required)}`,
    `- review_gate_passed: ${booleanText(status.review_gate_passed)}`,
    `- publish_gate_passed: ${booleanText(status.publish_gate_passed)} (후보 선택 발행 조건)`,
    `- direct_aosp_camera count: ${valueOrUnknown(countFromStatus(status, 'direct_aosp_camera_count'))}`,
    `- camera_driver_image_pipeline count: ${valueOrUnknown(countFromStatus(status, 'camera_driver_image_pipeline_count'))}`,
    `- android_platform_camera_adjacent count: ${valueOrUnknown(countFromStatus(status, 'android_platform_camera_adjacent_count'))}`,
    `- soc_platform_signal count: ${valueOrUnknown(countFromStatus(status, 'soc_platform_signal_count'))}`,
    `- cpp_ai_tooling_fallback count: ${valueOrUnknown(countFromStatus(status, 'cpp_ai_tooling_fallback_count'))}`,
    `- generic_tech_watchlist count: ${valueOrUnknown(countFromStatus(status, 'generic_tech_watchlist_count'))}`,
    `- primary_camera_stack_topic_count: ${valueOrUnknown(countFromStatus(status, 'primary_camera_stack_topic_count'))}`,
    `- supporting_main_article_count: ${valueOrUnknown(countFromStatus(status, 'supporting_main_article_count'))}`,
    `- forbidden_main_article_count: ${valueOrUnknown(countFromStatus(status, 'forbidden_main_article_count'))}`,
    `- non_fallback_reviewable_article_count: ${valueOrUnknown(countFromStatus(status, 'non_fallback_reviewable_article_count'))}`,
    `- gate thresholds: ${publishGateCriteriaText()}; configured article range ${articleCountRangeText()}`,
    `- source/parser hints: ${ensureArray(status.selection_shortage_hints).join('; ') || 'none'}`,
    `- composition reason: ${valueOrUnknown(status.composition_reason)}`,
    ''
  ].join('\n');
}

function renderCompositionNotes(status) {
  const lines = [];
  if (status.underfilled === true) {
    const finalSelectedCount = Number(status.final_selected_article_count ?? status.selected_article_count);
    const minFinalArticles = Number(status.selection_policy?.min_final_articles || articlePolicy.mainArticleCount.min);
    lines.push(
      `선택된 발행 가능 article 수는 ${Number.isFinite(finalSelectedCount) ? finalSelectedCount : valueOrUnknown(status.final_selected_article_count ?? status.selected_article_count)}개입니다. 최소 기준은 ${minFinalArticles}개입니다.`,
      ''
    );
  }
  if (status.composition_mode === 'FALLBACK_COMPOSITION' || status.selection_composition_mode === 'FALLBACK_COMPOSITION') {
    lines.push(
      'Fallback composition: 설정된 보조 main article로 SoC/platform 또는 C++/AI tooling article이 포함되었습니다. 인위적인 Camera HAL 표현을 추가하지 말고 실제 SoC/platform/native 개발 연결성을 명확히 유지하세요.',
      status.publish_gate_passed === false
        ? '검토 게이트는 통과했더라도 후보 선택 발행 조건이 막혀 있으면 최종 발행 가능 상태가 아닙니다.'
        : '',
      ''
    );
  }
  if (status.composition_mode === 'THIN_WEEK_REVIEW') {
    lines.push(
      'Thin-week review path: 이 PR은 검토 가능하지만 발행 준비 상태가 아닙니다. 자동 publish/deploy는 계속 차단되어야 합니다.',
      ''
    );
  }
  return lines.filter(line => line !== '').join('\n');
}

function renderFinalSelectionStatus(status) {
  return [
    '## 최종 후보 선택 상태',
    '',
    `- deterministic_selected_count: ${valueOrUnknown(status.deterministic_selected_count ?? status.selected_article_count)}`,
    `- rendered_main_article_count: ${valueOrUnknown(status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count)}`,
    `- reserve_candidate_count: ${valueOrUnknown(status.reserve_candidate_count)}`,
    `- input_candidate_count: ${valueOrUnknown(status.input_candidate_count)}`,
    `- eligible_candidate_count: ${valueOrUnknown(status.eligible_candidate_count)}`,
    `- selected_article_count: ${valueOrUnknown(status.selected_article_count)}`,
    `- reporter_candidate_count: ${valueOrUnknown(status.reporter_candidate_count)}`,
    `- reporter_selected_count: ${valueOrUnknown(status.reporter_selected_count)}`,
    `- final_input_candidate_count: ${valueOrUnknown(status.final_input_candidate_count ?? status.input_candidate_count)}`,
    `- final_eligible_candidate_count: ${valueOrUnknown(status.final_eligible_candidate_count ?? status.eligible_candidate_count)}`,
    `- final_selected_article_count: ${valueOrUnknown(status.final_selected_article_count ?? status.selected_article_count)}`,
    `- reporter_selected_but_final_excluded_count: ${valueOrUnknown(status.reporter_selected_but_final_excluded_count)}`,
    `- selection_warnings: ${ensureArray(status.selection_warnings).join('; ') || 'none'}`,
    `- selection_errors: ${ensureArray(status.selection_errors).join('; ') || 'none'}`,
    `- top exclusion reasons: ${formatReasonSummary(status.exclusion_reason_summary)}`,
    `- top final exclusion reasons: ${formatReasonSummary(ensureArray(status.final_exclusion_reason_summary).length > 0 ? status.final_exclusion_reason_summary : status.exclusion_reason_summary)}`,
    '',
    'Source/parser recovery hint:',
    ensureArray(status.selection_shortage_hints).map(item => `- ${item}`).join('\n') || '- none',
    '',
    status.candidate_selection_note || 'Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.',
    ''
  ].join('\n');
}

const TRACE_ARTIFACT_DEFS = [
  { key: 'reporter', path: date => `content/newsroom/${date}/reporter-candidates.json` },
  { key: 'shortlist', path: date => `content/newsroom/${date}/shortlisted-candidates.json` },
  { key: 'collected', path: date => `content/collected-news/${date}/candidates.json` },
  { key: 'quality', path: date => `content/newsroom/${date}/quality-report.json` },
  { key: 'factCheck', path: date => `content/newsroom/${date}/fact-check-report.json` },
  { key: 'fallback', path: date => `content/newsroom/${date}/fallback-public-issue.json` }
];

const TRACE_STATUS_RANK = {
  final_selected: 1,
  primary_selected: 2,
  reserve: 3,
  merged: 4,
  demoted: 5,
  rejected: 6,
  excluded: 7,
  not_main_eligible: 8,
  briefing_only: 9,
  reference_only: 10,
  quality_fail: 11,
  factcheck_fail: 12,
  unknown: 99
};

const FALLBACK_OVERRIDE_STATUSES = new Set(['demoted', 'rejected', 'merged']);
const REPORT_ONLY_STATUSES = new Set(['quality_fail', 'factcheck_fail']);

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrlKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    parsed.hash = parsed.hash || '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString().toLowerCase();
  } catch (_) {
    return text.replace(/\/+$/, '').toLowerCase();
  }
}

function truncateText(value, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sanitizeMarkdownTableCell(value, { fallback = 'unknown', maxLength = 180 } = {}) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return truncateText(text || fallback, maxLength).replace(/\|/g, '\\|');
}

function sanitizeMarkdownLinkUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '%20')
    .replace(/\|/g, '%7C')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

function markdownTableCell(value) {
  if (value && typeof value === 'object' && value.__markdownTableCell === true) {
    return String(value.value || '').replace(/[\r\n]+/g, ' ').trim() || 'unknown';
  }
  return sanitizeMarkdownTableCell(value);
}

function trustedMarkdownTableCell(value) {
  return { __markdownTableCell: true, value };
}

function renderMarkdownTable(headers, rows) {
  const safeHeaders = headers.map(header => sanitizeMarkdownTableCell(header));
  const separator = headers.map((_, index) => (index === 0 ? '---:' : '---'));
  const body = rows.map(row => `| ${row.map(cell => markdownTableCell(cell)).join(' | ')} |`);
  return [
    `| ${safeHeaders.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body
  ].join('\n');
}

function firstText(values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function valuesAsArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function extractCandidateTitle(candidate) {
  return firstText([candidate?.title, candidate?.headline, candidate?.article_title, candidate?.name]);
}

function sourceFromValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return firstText([value.name, value.title, value.source_name, value.source]);
}

function extractCandidateSource(candidate) {
  return firstText([
    candidate?.source_name,
    sourceFromValue(candidate?.source),
    candidate?.publisher,
    candidate?.feed_source,
    sourceFromValue(ensureArray(candidate?.sources)[0])
  ]);
}

function extractCandidateDate(candidate) {
  return firstText([candidate?.published_date, candidate?.publishedAt, candidate?.date, candidate?.source_date]);
}

function extractCandidateBucket(candidate) {
  return firstText([
    candidate?.relevance_bucket,
    candidate?.aosp_camera_stack_bucket,
    candidate?.bucket,
    candidate?.category
  ]);
}

function extractCandidateScore(candidate) {
  const value = candidate?.deterministic_score ??
    candidate?.score_breakdown?.total ??
    candidate?.relevance_score ??
    candidate?.score;
  return value === null || value === undefined || value === '' ? 'n/a' : value;
}

function extractCandidateUrls(candidate) {
  const urls = [
    candidate?.article_url,
    candidate?.articleUrl,
    candidate?.url,
    candidate?.source_url,
    candidate?.sourceUrl,
    candidate?.link
  ];
  for (const source of ensureArray(candidate?.sources)) {
    urls.push(source?.url, source?.source_url, source?.sourceUrl);
  }
  for (const url of valuesAsArray(candidate?.source_urls)) {
    urls.push(url);
  }
  return [...new Set(urls.map(url => String(url || '').trim()).filter(Boolean))];
}

function extractCandidateUrl(candidate) {
  return extractCandidateUrls(candidate)[0] || '';
}

function extractReasonList(candidate) {
  const reasons = [];
  const push = value => {
    for (const item of valuesAsArray(value)) {
      const text = typeof item === 'string' ? item : (item?.reason || item?.problem || item?.message || JSON.stringify(item));
      if (text) reasons.push(text);
    }
  };
  push(candidate?.selection_exclusion_reason);
  push(candidate?.final_exclusion_reasons);
  push(candidate?.exclusion_reasons);
  push(candidate?.watchlist_reason);
  push(candidate?.reason);
  push(candidate?.collection_reason);
  if (candidate?.source_gap_risk === true) reasons.push('source_gap_risk=true');
  push(candidate?.evidence_origin);
  push(candidate?.finalSelectionEligibility);
  return reasons.length > 0 ? [...new Set(reasons)] : ['no explicit reason'];
}

function classifyCandidateStatus(candidate, hint = '') {
  if (candidate?.final_selected === true || hint === 'final_selected') return 'final_selected';
  if (candidate?.primary_selected === true || candidate?.selected_for_editor === true || hint === 'primary_selected') {
    return 'primary_selected';
  }
  if (candidate?.reserve_candidate === true || hint === 'reserve') return 'reserve';
  if (hint === 'merged') return 'merged';
  if (hint === 'demoted') return 'demoted';
  if (hint === 'rejected') return 'rejected';
  if (ensureArray(candidate?.final_exclusion_reasons).length > 0 || ensureArray(candidate?.exclusion_reasons).length > 0 || hint === 'excluded') {
    return 'excluded';
  }
  if (candidate?.main_eligible === false) return 'not_main_eligible';
  if (candidate?.briefing_only === true) return 'briefing_only';
  if (candidate?.reference_only === true) return 'reference_only';
  if (hint === 'quality_fail') return 'quality_fail';
  if (hint === 'factcheck_fail') return 'factcheck_fail';
  return 'unknown';
}

function reasonCodeFor(candidate, status, reportStatus = '') {
  const haystack = [
    status,
    reportStatus,
    ...extractReasonList(candidate)
  ].join(' ').toLowerCase();
  if (status === 'merged' || /merged/.test(haystack)) return 'merged_into_selected_article';
  if (/fact.?check.*source.?gap|source_gap/.test(haystack) && /fact/.test(reportStatus)) return 'factcheck_source_gap';
  if (/fact.?check|must_fix/.test(haystack)) return 'factcheck_must_fix';
  if (/quality|hard_fail/.test(haystack)) return 'quality_hard_fail';
  if (/source.?gap/.test(haystack)) return 'source_gap';
  if (/weak.*hal|hal.*weak|scope.?relevance|hal.*connection|camera.*evidence.*weak/.test(haystack)) return 'weak_hal_connection';
  if (/generic.*ai|generic.*tech|buzzword/.test(haystack)) return 'generic_ai_noise';
  if (/duplicate.*source|duplicate.*url|duplicate_base_url/.test(haystack)) return 'duplicate_source';
  if (/same.*source.*cluster|same.*release/.test(haystack)) return 'same_source_cluster';
  if (/missing.*date|missing.*dated|no date|stale/.test(haystack)) return 'missing_dated_evidence';
  if (candidate?.main_eligible === false || /main_eligible=false|not_main_eligible/.test(haystack)) return 'not_main_eligible';
  if (candidate?.briefing_only === true || /briefing_only=true/.test(haystack)) return 'briefing_only';
  if (candidate?.reference_only === true || /reference_only=true/.test(haystack)) return 'reference_only';
  if (/fallback/.test(haystack)) return 'fallback_only';
  return 'unknown_reason';
}

function formatCandidateLink(candidate) {
  const title = sanitizeMarkdownTableCell(candidate.title || 'unknown title', { maxLength: 120 });
  const url = sanitizeMarkdownLinkUrl(candidate.url);
  return url ? trustedMarkdownTableCell(`[${title}](<${url}>)`) : title;
}

function candidateKeys(candidate) {
  const keys = [];
  for (const url of candidate.urls || []) {
    const key = normalizeUrlKey(url);
    if (key) keys.push(`url:${key}`);
  }
  if (candidate.title && candidate.source) {
    keys.push(`title-source:${normalizeMatchText(candidate.title)}|${normalizeMatchText(candidate.source)}`);
  }
  if (candidate.title && candidate.date) {
    keys.push(`title-date:${normalizeMatchText(candidate.title)}|${normalizeMatchText(candidate.date)}`);
  }
  return [...new Set(keys)];
}

function normalizeTraceCandidate(raw, { statusHint = '', sourceHint = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = extractCandidateTitle(raw);
  const urls = extractCandidateUrls(raw);
  const source = extractCandidateSource(raw);
  const date = extractCandidateDate(raw);
  return {
    raw,
    id: '',
    title: title || 'unknown title',
    url: urls[0] || '',
    urls,
    source: source || 'unknown source',
    date: date || 'unknown date',
    bucket: extractCandidateBucket(raw) || 'unknown bucket',
    score: extractCandidateScore(raw),
    status: classifyCandidateStatus(raw, statusHint),
    reasons: extractReasonList(raw),
    reasonCode: reasonCodeFor(raw, classifyCandidateStatus(raw, statusHint)),
    sourceHints: new Set([sourceHint].filter(Boolean)),
    reportLinks: []
  };
}

function hasSourceHint(candidate, hint) {
  if (!candidate || !candidate.sourceHints) return false;
  if (candidate.sourceHints instanceof Set) return candidate.sourceHints.has(hint);
  if (Array.isArray(candidate.sourceHints)) return candidate.sourceHints.includes(hint);
  return false;
}

function traceStatusRank(status) {
  return TRACE_STATUS_RANK[status] || 99;
}

function shouldReplaceTraceStatus(target, incoming) {
  const incomingStatus = incoming.status || 'unknown';
  const targetStatus = target.status || 'unknown';
  const incomingIsFallback = hasSourceHint(incoming, 'fallback-public-issue');

  if (incomingStatus === 'final_selected') return true;
  if (targetStatus === 'final_selected') return false;

  if (incomingIsFallback && FALLBACK_OVERRIDE_STATUSES.has(incomingStatus)) {
    return true;
  }

  if (REPORT_ONLY_STATUSES.has(incomingStatus) && targetStatus !== 'unknown') {
    return false;
  }

  return traceStatusRank(incomingStatus) < traceStatusRank(targetStatus);
}

function mergeTraceCandidate(target, incoming) {
  const replaceStatus = shouldReplaceTraceStatus(target, incoming);
  target.urls = [...new Set([...target.urls, ...incoming.urls])];
  if (!target.url && incoming.url) target.url = incoming.url;
  for (const field of ['title', 'source', 'date', 'bucket', 'score']) {
    if (!target[field] || /^unknown|n\/a$/.test(String(target[field]))) target[field] = incoming[field];
  }
  target.reasons = [...new Set([...target.reasons, ...incoming.reasons])];
  for (const hint of incoming.sourceHints) target.sourceHints.add(hint);
  if (replaceStatus) {
    target.status = incoming.status;
    target.reasonCode = incoming.reasonCode;
  }
  return target;
}

function addTraceCandidate(index, raw, options = {}) {
  const normalized = normalizeTraceCandidate(raw, options);
  if (!normalized) return null;
  const keys = candidateKeys(normalized);
  const existing = keys.map(key => index.keyToCandidate.get(key)).find(Boolean);
  const candidate = existing ? mergeTraceCandidate(existing, normalized) : normalized;
  if (!existing) index.candidates.push(candidate);
  for (const key of candidateKeys(candidate)) index.keyToCandidate.set(key, candidate);
  return candidate;
}

function readTraceJson(root, relPath, issues) {
  const filePath = path.join(root, ...relPath.split('/'));
  if (!fs.existsSync(filePath)) {
    issues.push(`${relPath}: 파일이 없습니다.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    issues.push(`${relPath}: JSON을 읽을 수 없습니다 (${error.message}).`);
    return null;
  }
}

function loadCandidateTraceArtifacts(root, date) {
  const issues = [];
  const artifacts = {};
  for (const def of TRACE_ARTIFACT_DEFS) {
    const relPath = def.path(date);
    artifacts[def.key] = {
      relPath,
      value: readTraceJson(root, relPath, issues)
    };
  }
  return { artifacts, issues };
}

function pushArtifactCandidates(index, value, field, statusHint, sourceHint, issues, relPath) {
  if (!value || typeof value !== 'object') return;
  const list = value[field];
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    issues.push(`${relPath}: ${field} 필드가 배열이 아닙니다.`);
    return;
  }
  for (const item of list) addTraceCandidate(index, item, { statusHint, sourceHint });
}

function buildFallbackCandidate(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    title: item.title || item.headline,
    url: item.url || valuesAsArray(item.source_urls)[0] || ensureArray(item.sources)[0]?.url,
    source_name: item.source_name || item.source || ensureArray(item.sources)[0]?.title,
    relevance_bucket: item.relevance_bucket || item.category,
    selection_exclusion_reason: item.reason
  };
}

function buildTraceIndex(artifacts, issues) {
  const index = { candidates: [], keyToCandidate: new Map() };
  const shortlist = artifacts.shortlist.value;
  const reporter = artifacts.reporter.value;
  const collected = artifacts.collected.value;
  const fallback = artifacts.fallback.value;

  pushArtifactCandidates(index, shortlist, 'primary_selected_articles', 'primary_selected', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'selected_articles', 'final_selected', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'shortlisted_candidates', '', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'reserve_candidates', 'reserve', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'demoted_candidates', 'demoted', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'excluded_candidates', 'excluded', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, reporter, 'candidates', '', 'reporter', issues, artifacts.reporter.relPath);
  pushArtifactCandidates(index, collected, 'candidates', '', 'collected', issues, artifacts.collected.relPath);

  if (fallback && typeof fallback === 'object') {
    for (const item of ensureArray(fallback.merged_articles)) {
      addTraceCandidate(index, buildFallbackCandidate(item), { statusHint: 'merged', sourceHint: 'fallback-public-issue' });
    }
    for (const item of ensureArray(fallback.demoted_articles)) {
      addTraceCandidate(index, buildFallbackCandidate(item), { statusHint: 'demoted', sourceHint: 'fallback-public-issue' });
    }
    for (const item of ensureArray(fallback.rejected_candidates)) {
      addTraceCandidate(index, buildFallbackCandidate(item), { statusHint: 'rejected', sourceHint: 'fallback-public-issue' });
    }
  }

  for (const artifact of [artifacts.shortlist, artifacts.reporter, artifacts.collected]) {
    if (!artifact.value) continue;
    const knownCandidateField = ['primary_selected_articles', 'selected_articles', 'shortlisted_candidates', 'reserve_candidates', 'demoted_candidates', 'excluded_candidates', 'candidates']
      .some(field => Array.isArray(artifact.value[field]));
    if (!knownCandidateField) {
      issues.push(`${artifact.relPath}: 후보 배열 필드를 찾지 못했습니다.`);
    }
  }

  return index;
}

function assignCandidateIds(candidates) {
  const statusOrder = status => TRACE_STATUS_RANK[status] || 99;
  candidates.sort((a, b) =>
    statusOrder(a.status) - statusOrder(b.status) ||
    normalizeMatchText(a.title).localeCompare(normalizeMatchText(b.title))
  );
  candidates.forEach((candidate, index) => {
    candidate.id = `cand_${String(index + 1).padStart(3, '0')}`;
  });
}

function matchCandidateForReport(index, item) {
  const urls = extractCandidateUrls(item);
  for (const url of urls) {
    const candidate = index.keyToCandidate.get(`url:${normalizeUrlKey(url)}`);
    if (candidate) return candidate;
  }
  const title = extractCandidateTitle(item) || item?.location || item?.headline;
  const source = extractCandidateSource(item);
  const date = extractCandidateDate(item);
  if (title && source) {
    const candidate = index.keyToCandidate.get(`title-source:${normalizeMatchText(title)}|${normalizeMatchText(source)}`);
    if (candidate) return candidate;
  }
  if (title && date) {
    const candidate = index.keyToCandidate.get(`title-date:${normalizeMatchText(title)}|${normalizeMatchText(date)}`);
    if (candidate) return candidate;
  }
  const normalizedTitle = normalizeMatchText(title);
  if (normalizedTitle) {
    return index.candidates.find(candidate => normalizeMatchText(candidate.title) === normalizedTitle) || null;
  }
  return null;
}

function promoteReportOnlyStatus(candidate, statusHint) {
  if (!candidate || candidate.status !== 'unknown') return;
  candidate.status = statusHint;
  candidate.reasonCode = reasonCodeFor(candidate.raw, statusHint, statusHint);
}

function reportItemTitle(item) {
  if (typeof item === 'string') {
    const sectionMatch = item.match(/section="([^"]+)"/);
    if (sectionMatch) return sectionMatch[1];
    return item;
  }
  return extractCandidateTitle(item) || item?.location || item?.headline || item?.category || 'unknown item';
}

function reportItemReason(item) {
  if (typeof item === 'string') return item;
  return firstText([
    item?.reason,
    item?.problem,
    item?.message,
    ensureArray(item?.hard_fail_reasons).join('; '),
    ensureArray(item?.soft_deductions).map(entry => entry.reason || entry.category).join('; ')
  ]) || 'no explicit reason';
}

function addReportLink(links, index, item, report, status, label, statusHint) {
  const candidate = matchCandidateForReport(index, item);
  if (candidate) {
    promoteReportOnlyStatus(candidate, statusHint);
    candidate.reportLinks.push({ report, status, label, reason: reportItemReason(item) });
  }
  links.push({
    candidate,
    candidateId: candidate ? '' : 'unmatched',
    title: candidate?.title || reportItemTitle(item),
    report,
    status,
    label,
    reason: reportItemReason(item)
  });
}

function buildQualityFactcheckLinks(index, qualityReport, factCheckReport) {
  const links = [];
  for (const result of ensureArray(qualityReport?.article_results)) {
    const hardReasons = ensureArray(result?.hard_fail_reasons);
    if (result?.status === 'FAIL' || hardReasons.length > 0) {
      addReportLink(links, index, result, 'quality-report.json', 'hard_fail', `article_results[${result.index ?? '?'}]`, 'quality_fail');
    }
    for (const deduction of ensureArray(result?.soft_deductions)) {
      addReportLink(links, index, { ...deduction, headline: result?.headline, sources: result?.sources }, 'quality-report.json', 'deduction', `article_results[${result.index ?? '?'}].soft_deductions`, 'quality_fail');
    }
  }
  for (const [indexNumber, deduction] of ensureArray(qualityReport?.deductions).entries()) {
    addReportLink(links, index, {
      ...deduction,
      title: deduction?.location,
      headline: deduction?.location
    }, 'quality-report.json', deduction?.blocking === true ? 'hard_fail' : 'deduction', `deductions[${indexNumber}]`, 'quality_fail');
  }
  for (const [indexNumber, item] of ensureArray(factCheckReport?.must_fix).entries()) {
    addReportLink(links, index, {
      ...item,
      url: item?.source_url || item?.url,
      title: item?.location
    }, 'fact-check-report.json', 'must_fix', `must_fix[${indexNumber}]`, 'factcheck_fail');
  }
  for (const [indexNumber, item] of ensureArray(factCheckReport?.source_gaps).entries()) {
    const urlMatch = typeof item === 'string' ? item.match(/https?:\/\/[^\s;")]+/) : null;
    addReportLink(links, index, typeof item === 'string' ? {
      title: reportItemTitle(item),
      url: urlMatch?.[0] || '',
      reason: item
    } : item, 'fact-check-report.json', 'source_gap', `source_gaps[${indexNumber}]`, 'factcheck_fail');
  }
  return links;
}

function candidateReasonCells(candidate, reasonLabel) {
  const reasons = candidate.reasons.join('; ');
  if (reasonLabel === 'code-and-reason') return [candidate.reasonCode, reasons];
  if (reasonLabel === 'code') return [candidate.reasonCode];
  return [reasons];
}

function renderCandidateRows(candidates, limit, reasonLabel) {
  const rows = candidates.slice(0, limit).map((candidate, index) => [
    String(index + 1),
    `\`${candidate.id}\``,
    candidate.status,
    formatCandidateLink(candidate),
    `${candidate.source} / ${candidate.date}`,
    candidate.bucket,
    String(candidate.score),
    ...candidateReasonCells(candidate, reasonLabel)
  ]);
  return rows;
}

function renderCandidateTraceability(root, date) {
  const { artifacts, issues } = loadCandidateTraceArtifacts(root, date);
  const traceIndex = buildTraceIndex(artifacts, issues);
  const links = buildQualityFactcheckLinks(traceIndex, artifacts.quality.value, artifacts.factCheck.value);
  assignCandidateIds(traceIndex.candidates);

  const finalCandidates = traceIndex.candidates.filter(candidate => ['final_selected', 'primary_selected'].includes(candidate.status));
  const reserveCandidates = traceIndex.candidates.filter(candidate => candidate.status === 'reserve');
  const notableCandidates = traceIndex.candidates.filter(candidate =>
    !['final_selected', 'primary_selected', 'reserve', 'unknown'].includes(candidate.status)
  );
  const mergedCount = traceIndex.candidates.filter(candidate => candidate.status === 'merged').length;
  const demotedCount = traceIndex.candidates.filter(candidate => candidate.status === 'demoted').length;
  const rejectedCount = traceIndex.candidates.filter(candidate => candidate.status === 'rejected').length;
  const excludedCount = traceIndex.candidates.filter(candidate =>
    ['excluded', 'not_main_eligible', 'briefing_only', 'reference_only', 'quality_fail', 'factcheck_fail'].includes(candidate.status)
  ).length;
  const unmatchedCount = links.filter(link => !link.candidate).length;
  const collectedCount = Array.isArray(artifacts.collected.value?.candidates)
    ? artifacts.collected.value.candidates.length
    : traceIndex.candidates.length;
  const reporterCount = Array.isArray(artifacts.reporter.value?.candidates)
    ? artifacts.reporter.value.candidates.length
    : 0;
  const noCandidateArtifacts = traceIndex.candidates.length === 0;
  const detailPaths = TRACE_ARTIFACT_DEFS.map(def => def.path(date));

  const lines = [
    '## 후보 기사 추적',
    '',
    noCandidateArtifacts
      ? '후보 기사 artifact를 찾을 수 없어 추적 섹션을 생성하지 못했습니다.'
      : `총 후보 ${traceIndex.candidates.length}개 중 최종 선택 ${finalCandidates.length}개, reserve ${reserveCandidates.length}개, 제외/강등/거절/병합 주요 후보 ${Math.min(notableCandidates.length, 10)}개를 표시합니다.`,
    '',
    '### 한눈에 보는 후보 판단',
    '',
    `- 전체 수집 후보: ${collectedCount}`,
    `- reporter 후보: ${reporterCount}`,
    `- 최종 선택 기사: ${finalCandidates.length}`,
    `- reserve 후보: ${reserveCandidates.length}`,
    `- 제외 후보: ${excludedCount}`,
    `- 강등 후보: ${demotedCount}`,
    `- 거절 후보: ${rejectedCount}`,
    `- 병합 후보: ${mergedCount}`,
    `- 품질/팩트체크 연결 항목: ${links.length}`,
    `- unmatched 품질/팩트체크 연결 항목: ${unmatchedCount}`
  ];

  if (reserveCandidates.length > 5) lines.push(`- 생략된 reserve 후보: ${reserveCandidates.length - 5}`);
  if (notableCandidates.length > 10) lines.push(`- 생략된 제외/강등/거절 후보: ${notableCandidates.length - 10}`);
  if (links.length > 10) lines.push(`- 생략된 품질/팩트체크 연결 항목: ${links.length - 10}`);

  lines.push(
    '',
    '읽기/형식 요약:',
    ...(issues.length > 0 ? issues.map(issue => `- ${issue}`) : ['- none']),
    '',
    '### 최종 선택 기사',
    '',
    finalCandidates.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '상태', '원문 기사', '출처/날짜', 'Bucket', '점수', '판단 사유'],
        renderCandidateRows(finalCandidates, finalCandidates.length, 'reason')
      )
      : '- none',
    '',
    '### Reserve 후보',
    '',
    reserveCandidates.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '상태', '원문 기사', '출처/날짜', 'Bucket', '점수', 'Reserve 사유'],
        renderCandidateRows(reserveCandidates, 5, 'reason')
      )
      : '- none',
    '',
    '### 제외/강등/거절된 주요 후보',
    '',
    notableCandidates.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '상태', '원문 기사', '출처/날짜', 'Bucket', '점수', '사유 코드', '설명'],
        renderCandidateRows(notableCandidates, 10, 'code-and-reason')
      )
      : '- none',
    '',
    '### 품질/팩트체크 연결',
    '',
    links.length > 0
      ? renderMarkdownTable(
        ['#', 'Candidate ID', '기사', 'Report', '상태', '연결 항목', '사유'],
        links.slice(0, 10).map((link, index) => [
          String(index + 1),
          link.candidate ? `\`${link.candidate.id}\`` : 'unmatched',
          link.title,
          link.report,
          link.status,
          link.label,
          link.reason
        ])
      )
      : '- none',
    '',
    '### 상세 artifact',
    '',
    ...detailPaths.map(relPath => `- \`${relPath}\``),
    ''
  );

  return lines.join('\n');
}

function renderEditorActionGuidance(status, date) {
  const lines = [
    '## 편집자 조치 가이드',
    '',
    `- 권장 조치: ${recommendedEditorAction(status)}`,
    '- 이 PR은 editor review용으로 생성되며 자동 merge되지 않습니다.',
    '- fact-check must_fix 항목과 editorial quality deduction을 분리해서 처리하세요.',
    '- 사실 확인이 안 되면 source-gap article을 승격하지 말고 briefing/watchlist로 내리거나 제외하세요.',
    '- 유효한 locked article은 유지하고 URL, title, source-date-title 조합 중복을 피하세요.'
  ];

  if (status.status !== 'PASS' || status.validate_outcome === 'failure' || status.final_publish_ready !== true) {
    lines.push(
      `- 발행 전에 content/newsroom/${date}/fact-check-report.md, content/newsroom/${date}/quality-report.md, validation output을 확인하세요.`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderGeneratedArtifacts(date, status = {}, root = process.cwd(), changedArtifacts = null) {
  const changed = [...new Set((Array.isArray(changedArtifacts)
    ? changedArtifacts
    : getChangedRepoVisibleArtifacts({ root, date }))
    .filter(filePath =>
      filePath.startsWith(`content/collected-news/${date}/`) ||
      filePath.startsWith(`content/newsroom/${date}/`) ||
      filePath.startsWith(`newsletters/${date}/`) ||
      filePath === 'data/newsletters.json'
    ))].sort();
  const lines = [
    '## 생성 산출물',
    '',
    ...(changed.length > 0 ? changed.map(filePath => `- ${filePath}`) : ['- none'])
  ];
  return lines.join('\n');
}

function renderPublicNewsletterNotice(status = {}) {
  if (status.final_publish_ready === true) return '';
  return [
    '## Public Newsletter Notice',
    '',
    'AI 자동 발행 기준은 통과하지 못했지만, public newsletter files는 생성되었습니다. 편집장이 이 PR을 승인하여 merge하면 Newsletter 사이트에 게시됩니다.'
  ].join('\n');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function renderFallbackPublicIssueNotes(root, date) {
  const report = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'));
  if (!report) return '';
  const demoted = ensureArray(report.demoted_articles);
  const fallback = ensureArray(report.fallback_articles);
  if (demoted.length === 0 && fallback.length === 0) return '';
  const lines = [
    '## 교체/강등된 기사',
    ''
  ];
  if (demoted.length === 0) {
    lines.push('- none');
  } else {
    for (const item of demoted) {
      lines.push(`- ${valueOrUnknown(item.headline)}: ${valueOrUnknown(item.reason)}`);
    }
  }
  if (fallback.length > 0) {
    lines.push('', '## Fallback 기사', '');
    for (const item of fallback) {
      lines.push(`- ${valueOrUnknown(item.headline)}: ${valueOrUnknown(item.reason)} (${valueOrUnknown(item.relevance_bucket)})`);
    }
  }
  return lines.join('\n');
}

function buildNewsroomPrBody(options = {}) {
  const resolved = options.publishStatus || resolvePublishStatus(options);
  const root = resolved.root || options.root || process.cwd();
  const date = resolved.date || options.date || '';
  const status = resolved.status;
  const editorBrief = date ? readTextIfExists(path.join(root, 'content', 'newsroom', date, 'editor-in-chief-brief.md')) : '';
  const editorBriefSections = extractEditorBriefSections(editorBrief);
  const lines = [];

  if (editorBriefSections) {
    lines.push(editorBriefSections, '');
  }

  lines.push(
    renderStatusSection(status),
    renderEditorApprovedPublicationPolicy(),
    renderCompositionSummary(status),
    renderCompositionNotes(status),
    renderPublicNewsletterNotice(status),
    renderFallbackPublicIssueNotes(root, date),
    renderFinalSelectionStatus(status),
    renderCandidateTraceability(root, date),
    renderEditorActionGuidance(status, date),
    renderGeneratedArtifacts(date, status, root, options.changedArtifacts)
  );

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function main() {
  process.stdout.write(buildNewsroomPrBody());
}

if (require.main === module) {
  main();
}

module.exports = {
  buildNewsroomPrBody,
  extractEditorBriefSections,
  renderCandidateTraceability,
  renderGeneratedArtifacts,
  renderEditorApprovedPublicationPolicy,
  recommendedEditorAction
};
