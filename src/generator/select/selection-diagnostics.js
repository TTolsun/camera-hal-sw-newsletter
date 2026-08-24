const { ensureArray } = require('../../shared/common/value-coercion');
const REPORTER_SELECTION_NOTE =
  'Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.';

const REPORTER_SELECTED_ALIAS_NOTE =
  'selected is reporter-stage only; use final_selected or shortlisted-candidates.json for final publication selection.';
const {
  candidateGroupKey,
  groupCoverageSummary
} = require('../../shared/common/article-groups');

function text(value) {
  return String(value || '').trim();
}

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function candidateUrl(candidate = {}) {
  return text(candidate.normalized_url || candidate.url || candidate.article_url || candidate.articleUrl);
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const hash = parsed.hash;
    const preserveHash = parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera' &&
      /^#(?:camera-[a-z0-9-]+-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(hash);
    if (!preserveHash) parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function candidateKey(candidate = {}) {
  return normalizeUrl(candidateUrl(candidate));
}

function finalSelectionEligibility(candidate = {}) {
  return text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility) || null;
}

function finalExclusionReasons(candidate = {}) {
  if (Array.isArray(candidate.final_exclusion_reasons)) return candidate.final_exclusion_reasons;
  return ensureArray(candidate.exclusion_reasons);
}

function isReporterSelected(candidate = {}) {
  if (typeof candidate.reporter_selected === 'boolean') return candidate.reporter_selected;
  if (typeof candidate.evidence_eligible === 'boolean') return candidate.evidence_eligible;
  return bool(candidate.selected);
}

function isFinalSelected(candidate = {}) {
  if (typeof candidate.final_selected === 'boolean') return candidate.final_selected;
  if (typeof candidate.selected_for_editor === 'boolean') return candidate.selected_for_editor;
  return bool(candidate.selected);
}

function reporterSelectedUrlSet(reporter) {
  return new Set(ensureArray(reporter?.candidates)
    .filter(isReporterSelected)
    .map(candidateKey)
    .filter(Boolean));
}

function finalSelectedUrlSet(shortlistReport) {
  return new Set(ensureArray(shortlistReport?.selected_articles)
    .map(candidateKey)
    .filter(Boolean));
}

function candidatesByUrl(candidates) {
  const map = new Map();
  for (const candidate of ensureArray(candidates)) {
    const key = candidateKey(candidate);
    if (key && !map.has(key)) map.set(key, candidate);
  }
  return map;
}

function finalCandidateMap(shortlistReport) {
  return candidatesByUrl([
    ...ensureArray(shortlistReport?.primary_selected_articles),
    ...ensureArray(shortlistReport?.selected_articles),
    ...ensureArray(shortlistReport?.reserve_candidates),
    ...ensureArray(shortlistReport?.shortlisted_candidates),
    ...ensureArray(shortlistReport?.demoted_candidates),
    ...ensureArray(shortlistReport?.excluded_candidates)
  ]);
}

function summarizeFinalExclusionReasons(candidates) {
  const counts = new Map();
  for (const candidate of ensureArray(candidates)) {
    if (isFinalSelected(candidate)) continue;
    for (const reason of finalExclusionReasons(candidate)) {
      const key = text(reason) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function normalizeShortlistCandidate(candidate, reporterSelectedUrls = null) {
  const finalSelected = isFinalSelected(candidate);
  const reserveCandidate = bool(candidate.reserve_candidate);
  const primarySelected = finalSelected && bool(candidate.primary_selected, true);
  const key = candidateKey(candidate);
  const reporterSelected = reporterSelectedUrls
    ? reporterSelectedUrls.has(key)
    : bool(candidate.reporter_selected);
  const reasons = finalSelected ? [] : finalExclusionReasons(candidate);
  const selectionStage = finalSelected
    ? 'deterministic-primary'
    : reserveCandidate
      ? 'deterministic-reserve'
      : candidate.selection_stage || 'deterministic-final';
  return {
    ...candidate,
    article_group_key: candidateGroupKey(candidate),
    related_context_candidates: ensureArray(candidate.related_context_candidates),
    selection_stage: selectionStage,
    final_selected: finalSelected,
    primary_selected: primarySelected,
    reserve_candidate: reserveCandidate,
    reporter_selected: reporterSelected,
    selected_for_editor: finalSelected,
    selected: finalSelected,
    final_selection_eligibility: finalSelectionEligibility(candidate),
    final_exclusion_reasons: reasons
  };
}

function normalizeShortlistReport(shortlistReport, reporter = null) {
  const reporterSelectedUrls = reporter ? reporterSelectedUrlSet(reporter) : null;
  const shortlistedCandidates = ensureArray(shortlistReport?.shortlisted_candidates)
    .map(candidate => normalizeShortlistCandidate(candidate, reporterSelectedUrls));
  const selectedSource = ensureArray(shortlistReport?.primary_selected_articles).length > 0
    ? shortlistReport.primary_selected_articles
    : shortlistReport?.selected_articles;
  const selectedArticles = ensureArray(selectedSource)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: true }, reporterSelectedUrls));
  const reserveCandidates = ensureArray(shortlistReport?.reserve_candidates)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: false, reserve_candidate: true }, reporterSelectedUrls));
  const demotedCandidates = ensureArray(shortlistReport?.demoted_candidates)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: false }, reporterSelectedUrls));
  const excludedCandidates = ensureArray(shortlistReport?.excluded_candidates)
    .map(candidate => normalizeShortlistCandidate({ ...candidate, final_selected: false }, reporterSelectedUrls));
  const reporterSelectedCount = reporter
    ? ensureArray(reporter.candidates).filter(isReporterSelected).length
    : shortlistReport?.reporter_selected_count ?? null;
  const reporterCandidateCount = reporter
    ? ensureArray(reporter.candidates).length
    : shortlistReport?.reporter_candidate_count ?? null;
  const reporterSelectedButFinalExcludedCount = reporter
    ? ensureArray(reporter.candidates).filter(candidate => isReporterSelected(candidate) && !isFinalSelected(candidate)).length
    : shortlistReport?.reporter_selected_but_final_excluded_count ?? null;
  const finalExclusionReasonSummary = summarizeFinalExclusionReasons([
    ...shortlistedCandidates,
    ...reserveCandidates,
    ...demotedCandidates,
    ...excludedCandidates
  ]);
  const deterministicSelectedCount =
    shortlistReport?.deterministic_selected_count ??
    shortlistReport?.primary_selected_article_count ??
    shortlistReport?.selected_article_count ??
    selectedArticles.length;
  const reserveCandidateCount = shortlistReport?.reserve_candidate_count ?? reserveCandidates.length;
  const demotedCandidateCount = shortlistReport?.demoted_candidate_count ?? demotedCandidates.length;
  const groupCoverage = groupCoverageSummary({
    selectedGroupKeys: selectedArticles.map(candidateGroupKey),
    renderedGroupKeys: ensureArray(shortlistReport?.rendered_group_keys),
    demotedGroups: ensureArray(shortlistReport?.explicitly_demoted_group_keys).map(key => ({ article_group_key: key, demotion_reason: 'shortlist_report' }))
  });

  return {
    ...shortlistReport,
    schema_version: Math.max(Number(shortlistReport?.schema_version || 1), 3),
    selection_stage: 'deterministic-final',
    final_input_candidate_count: shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: deterministicSelectedCount,
    deterministic_selected_count: deterministicSelectedCount,
    selected_group_count: shortlistReport?.selected_group_count ?? groupCoverage.selected_group_count,
    rendered_group_count: shortlistReport?.rendered_group_count ?? null,
    explicitly_demoted_group_count: shortlistReport?.explicitly_demoted_group_count ?? 0,
    selected_representative_group_keys: ensureArray(shortlistReport?.selected_representative_group_keys).length > 0
      ? shortlistReport.selected_representative_group_keys
      : groupCoverage.selected_representative_group_keys,
    rendered_group_keys: ensureArray(shortlistReport?.rendered_group_keys),
    explicitly_demoted_group_keys: ensureArray(shortlistReport?.explicitly_demoted_group_keys),
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? selectedArticles.length,
    reserve_candidate_count: reserveCandidateCount,
    demoted_candidate_count: demotedCandidateCount,
    composition_mode: shortlistReport?.composition_mode || null,
    selection_composition_mode: shortlistReport?.selection_composition_mode || shortlistReport?.composition_mode || null,
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    headline_decision: shortlistReport?.headline_decision || null,
    headline_latest_inclusion: shortlistReport?.headline_latest_inclusion || null,
    headline_public_render_reconciliation: shortlistReport?.headline_public_render_reconciliation || null,
    removed_due_to_headline_inclusion: ensureArray(shortlistReport?.removed_due_to_headline_inclusion),
    article_exposure_coverage: shortlistReport?.article_exposure_coverage || null,
    editor_review_required: shortlistReport?.editor_review_required === true,
    reporter_candidate_count: reporterCandidateCount,
    reporter_selected_count: reporterSelectedCount,
    reporter_selected_but_final_excluded_count: reporterSelectedButFinalExcludedCount,
    shortlisted_candidates: shortlistedCandidates,
    primary_selected_articles: selectedArticles,
    selected_articles: selectedArticles,
    reserve_candidates: reserveCandidates,
    demoted_candidates: demotedCandidates,
    excluded_candidates: excludedCandidates,
    final_exclusion_reason_summary: finalExclusionReasonSummary,
    exclusion_reason_summary: ensureArray(shortlistReport?.exclusion_reason_summary).length > 0
      ? shortlistReport.exclusion_reason_summary
      : finalExclusionReasonSummary
  };
}

function normalizeReporterReport(reporter, shortlistReport = null) {
  const finalSelectedUrls = finalSelectedUrlSet(shortlistReport);
  const finalByUrl = finalCandidateMap(shortlistReport);
  const candidates = ensureArray(reporter?.candidates).map(candidate => {
    const key = candidateKey(candidate);
    const finalCandidate = finalByUrl.get(key) || {};
    const reporterSelected = isReporterSelected(candidate);
    const finalSelected = finalSelectedUrls.has(key);
    const reserveCandidate = bool(finalCandidate.reserve_candidate, bool(candidate.reserve_candidate));
    const primarySelected = finalSelected && bool(finalCandidate.primary_selected, true);
    const reasons = finalSelected
      ? []
      : finalExclusionReasons(finalCandidate).length > 0
        ? finalExclusionReasons(finalCandidate)
        : finalExclusionReasons(candidate);
    return {
      ...candidate,
      selection_stage: 'reporter',
      reporter_selected: reporterSelected,
      final_selected: finalSelected,
      primary_selected: primarySelected,
      reserve_candidate: reserveCandidate,
      selected_for_editor: finalSelected,
      selected: reporterSelected,
      final_selection_eligibility: finalSelectionEligibility(finalCandidate) || finalSelectionEligibility(candidate),
      final_exclusion_reasons: reasons
    };
  });
  const reporterSelectedCount = candidates.filter(isReporterSelected).length;
  return {
    ...reporter,
    schema_version: Math.max(Number(reporter?.schema_version || 1), 2),
    date: reporter?.date || shortlistReport?.date || '',
    selection_stage: 'reporter',
    reporter_candidate_count: candidates.length,
    reporter_selected_count: reporterSelectedCount,
    final_input_candidate_count: shortlistReport?.final_input_candidate_count ?? shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.final_eligible_candidate_count ?? shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: shortlistReport?.final_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    deterministic_selected_count: shortlistReport?.deterministic_selected_count ?? shortlistReport?.selected_article_count ?? null,
    selected_group_count: shortlistReport?.selected_group_count ?? null,
    rendered_group_count: shortlistReport?.rendered_group_count ?? null,
    explicitly_demoted_group_count: shortlistReport?.explicitly_demoted_group_count ?? null,
    selected_representative_group_keys: ensureArray(shortlistReport?.selected_representative_group_keys),
    rendered_group_keys: ensureArray(shortlistReport?.rendered_group_keys),
    explicitly_demoted_group_keys: ensureArray(shortlistReport?.explicitly_demoted_group_keys),
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reserve_candidate_count: shortlistReport?.reserve_candidate_count ?? null,
    demoted_candidate_count: shortlistReport?.demoted_candidate_count ?? null,
    composition_mode: shortlistReport?.composition_mode || null,
    selection_composition_mode: shortlistReport?.selection_composition_mode || shortlistReport?.composition_mode || null,
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    editor_review_required: shortlistReport?.editor_review_required === true,
    reporter_selected_but_final_excluded_count: candidates
      .filter(candidate => isReporterSelected(candidate) && !isFinalSelected(candidate)).length,
    final_exclusion_reason_summary: summarizeFinalExclusionReasons(candidates),
    note: REPORTER_SELECTED_ALIAS_NOTE,
    candidates
  };
}

function selectionDiagnosticsFromReports(shortlistReport = null, reporterReport = null) {
  return {
    reporter_candidate_count: reporterReport?.reporter_candidate_count ?? shortlistReport?.reporter_candidate_count ?? null,
    reporter_selected_count: reporterReport?.reporter_selected_count ?? shortlistReport?.reporter_selected_count ?? null,
    final_input_candidate_count: shortlistReport?.final_input_candidate_count ?? shortlistReport?.input_candidate_count ?? null,
    final_eligible_candidate_count: shortlistReport?.final_eligible_candidate_count ?? shortlistReport?.eligible_candidate_count ?? null,
    final_selected_article_count: shortlistReport?.final_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    deterministic_selected_count: shortlistReport?.deterministic_selected_count ?? shortlistReport?.selected_article_count ?? null,
    selected_group_count: shortlistReport?.selected_group_count ?? reporterReport?.selected_group_count ?? null,
    rendered_group_count: shortlistReport?.rendered_group_count ?? reporterReport?.rendered_group_count ?? null,
    explicitly_demoted_group_count: shortlistReport?.explicitly_demoted_group_count ?? reporterReport?.explicitly_demoted_group_count ?? null,
    selected_representative_group_keys: ensureArray(shortlistReport?.selected_representative_group_keys ?? reporterReport?.selected_representative_group_keys),
    rendered_group_keys: ensureArray(shortlistReport?.rendered_group_keys ?? reporterReport?.rendered_group_keys),
    explicitly_demoted_group_keys: ensureArray(shortlistReport?.explicitly_demoted_group_keys ?? reporterReport?.explicitly_demoted_group_keys),
    primary_selected_article_count: shortlistReport?.primary_selected_article_count ?? shortlistReport?.selected_article_count ?? null,
    reserve_candidate_count: shortlistReport?.reserve_candidate_count ?? null,
    demoted_candidate_count: shortlistReport?.demoted_candidate_count ?? null,
    composition_mode: shortlistReport?.composition_mode || null,
    selection_composition_mode: shortlistReport?.selection_composition_mode || shortlistReport?.composition_mode || null,
    composition_reason: shortlistReport?.composition_reason || '',
    composition_summary: shortlistReport?.composition_summary || {},
    editor_review_required: shortlistReport?.editor_review_required === true,
    release_class_catch_up: shortlistReport?.release_class_catch_up || null,
    // #879: 1차(선정 직후)와 2차(coverage 재조정 뒤)를 나란히 남긴다. 하나로 접으면 "판정
    // 시점이 달라서 결과가 달라졌다"는 이 이슈의 관측 자체가 사라진다.
    release_class_catch_up_after_reconciliation:
      shortlistReport?.release_class_catch_up_after_reconciliation || null,
    reporter_selected_but_final_excluded_count:
      reporterReport?.reporter_selected_but_final_excluded_count ??
      shortlistReport?.reporter_selected_but_final_excluded_count ??
      null,
    final_exclusion_reason_summary: ensureArray(
      shortlistReport?.final_exclusion_reason_summary?.length > 0
        ? shortlistReport.final_exclusion_reason_summary
        : reporterReport?.final_exclusion_reason_summary?.length > 0
          ? reporterReport.final_exclusion_reason_summary
          : shortlistReport?.exclusion_reason_summary
    ),
    note: REPORTER_SELECTION_NOTE
  };
}

function formatCount(value) {
  return value === null || value === undefined ? 'unknown' : String(value);
}

// #914: coverage_decision은 editorial-plan LLM이 쓴 자유 문자열이라(스키마에 enum도 maxLength도
// 없다) markdown 제어문자가 그대로 들어온다. 이 렌더는 표가 아니라 목록이므로 표 전용
// escapeMarkdownCell(파이프와 개행만 다룬다)로는 부족하다. 개행 하나면 목록 항목이 끊기고,
// 백틱·링크·raw HTML은 그대로 재해석돼 원문이 눈에서 사라진다.
//
// 값은 잘라내지 않는다. 진단 artifact에서 LLM 설명의 뒷부분을 조용히 버리는 것이 긴 줄보다
// 나쁘다. 대신 공백을 접어 한 줄로 만들고 구조를 바꾸는 문자만 escape한다.

// 값 안 어디에서든 구조를 바꾸거나 내용을 숨기는 문자. `&`도 포함한다 — escape하지 않으면
// `a &amp; b`가 `a & b`로 디코딩돼 LLM이 쓰지 않은 문자열이 진단에 남는다.
const MARKDOWN_INLINE_SPECIALS = /[\\`*[\]()<>|~&]/g;

// `_`는 단어 안에서는 강조가 되지 않는다(CommonMark는 intraword `_`를 강조로 열지 않는다).
// 그래서 양옆이 모두 문자/숫자인 `_`만 남기고, 그 밖의 `_`는 escape한다. 이러면
// `editorial_plan_reference_only`는 그대로 읽히면서 `demoted _because_ of cap` 같은 산문에서
// 밑줄이 사라지는 재해석은 막는다.
const MARKDOWN_FLANKING_UNDERSCORE = /(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu;

// 값은 `- ` / `    - ` 바로 뒤에 놓여 목록 항목 본문으로 파싱된다. 그래서 값의 첫 문자는
// 줄머리 블록 마커가 될 수 있다: `# 1/3 media: ...`는 heading, `- v2 patch`는 한 단계 더 깊은
// 중첩 목록, `1. intro`는 번호 목록이 된다.
//
// 오늘의 프로덕션 writer로는 이 모양이 나오지 않는다. candidate_key는 url_hash || url || title
// 인데(coverage-reconciliation.js) newsroom-selection.js가 url_hash에 normalizedUrlHash를
// 넣고 그 값은 빈 URL에도 sha256 hex 64자라(selection-normalizers.js) 항상 truthy다. 즉 제목
// 폴백까지 내려가지 않고, 키는 hex 64자뿐이라 `#`도 `-`도 앞자리 숫자도 없다. 이 규칙은 손으로
// 만든 diagnostics 객체와 예전 형식의 status를 위한 방어다 —
// write-generation-status-output.js:187은 이미 기록된 status 파일의 내용을 그대로 렌더한다.
//
// `#`는 줄머리에서만 escape한다. ATX heading은 블록 요소라 줄 중간의 `#`는 아무 의미가 없다.
// 그리고 실제 데이터에서 `#`가 나오는 자리는 candidate_key가 아니라 article_group_key다:
// fallbackGroupKey가 `article:${normalizeUrl(url)}`를 만들고 그 normalizeUrl은 anchor를
// 보존하는 normalizeSourceUrlPreserveAnchor다(article-groups.js). 최근 8주 수집분에도
// `article:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02`
// 같은 키가 남아 있다. 이 `#`는 언제나 `article:` 접두사 뒤라 0번째 자리가 아니므로 줄머리
// 규칙이 건드리지 않는다. 무조건 escape하면 안전 이득 없이 매 줄에 `\#`만 늘어난다.
const MARKDOWN_LEADING_BLOCK_MARKER = /^[#+-]/;
// `)`는 MARKDOWN_INLINE_SPECIALS가 이미 escape하므로(전역 pass 뒤에는 `1\)`) 여기서는
// `.`만 남는다. 숫자 자체에는 backslash를 붙일 수 없어 구분자를 escape한다.
const MARKDOWN_LEADING_ORDERED_MARKER = /^(\d{1,9})\./;

function markdownSafeInline(value) {
  if (value === null || value === undefined) return 'unknown';
  const collapsed = String(value).replace(/\s+/g, ' ').trim();
  if (!collapsed) return 'none';
  const escaped = collapsed
    .replace(MARKDOWN_INLINE_SPECIALS, '\\$&')
    .replace(MARKDOWN_FLANKING_UNDERSCORE, '\\$&');
  if (MARKDOWN_LEADING_BLOCK_MARKER.test(escaped)) return `\\${escaped}`;
  return escaped.replace(MARKDOWN_LEADING_ORDERED_MARKER, '$1\\.');
}

// #914: 재조정 강등은 editor가 선언한 강등과 원인이 다르다(전자는 결정론 재조정의 cap clamp나
// 편집 계획 등급, 후자는 editor 산출물의 선언). 같은 줄로 접으면 리뷰가 "editor 강등 0건"만
// 읽고 재조정이 내린 그룹을 통째로 놓친다 — 2026-08-17이 정확히 그 실행이었다.
function reconciliationDemotionLines(diagnostics) {
  const demotedGroupKeys = ensureArray(diagnostics.reconciliation_demoted_group_keys);
  const demotedGroups = ensureArray(diagnostics.reconciliation_demoted_groups);
  // 관측하지 않은 실행(unknown)과 강등이 없던 실행(0)은 서로 다른 사실이다.
  const observed = diagnostics.reconciliation_demoted_group_keys !== undefined ||
    diagnostics.reconciliation_demoted_groups !== undefined;
  // 적재와 조회가 같은 정규화를 써야 한다. 한쪽만 `|| ''`를 쓰면 falsy 키가 `''`로 적재되고
  // `'null'`로 조회돼, 기록된 사유가 있는데도 "no per-candidate reason recorded"가 찍힌다 —
  // 이 이슈가 없애려는 바로 그 실패다.
  // `|| ''`로 접지도 않는다. 그러면 `null`과 `''`가 같은 칸을 쓰게 되어, 서로 다른 두 그룹이
  // 한쪽 사유로 덮여 남의 사유가 찍힌다. 사유를 잃는 것보다 나쁘다.
  const lookupGroupKey = (value) => String(value);
  const candidatesByGroupKey = new Map(demotedGroups.map(group => [
    lookupGroupKey(group?.article_group_key),
    ensureArray(group?.demoted_candidates)
  ]));
  // 키 목록이 개수를 가진 정본이다. #909 이전 실행은 키만 남겼으므로 그때도 그룹을 세야 한다.
  const orderedGroupKeys = demotedGroupKeys.length > 0
    ? demotedGroupKeys
    : demotedGroups.map(group => group?.article_group_key);
  const lines = [`- Reconciliation-demoted groups: ${observed ? orderedGroupKeys.length : 'unknown'}`];
  for (const groupKey of orderedGroupKeys) {
    lines.push(`  - ${markdownSafeInline(groupKey)}`);
    const demotedCandidates = candidatesByGroupKey.get(lookupGroupKey(groupKey)) || [];
    if (demotedCandidates.length === 0) {
      // 사유가 기록되지 않은 것을 빈 줄로 두면 markdown이 다시 "강등 없음"으로 읽힌다.
      lines.push('    - no per-candidate reason recorded');
      continue;
    }
    for (const demoted of demotedCandidates) {
      lines.push([
        `    - ${markdownSafeInline(demoted?.candidate_key)}:`,
        `coverage_decision=${markdownSafeInline(demoted?.coverage_decision)},`,
        `reason_code=${markdownSafeInline(demoted?.reason_code)}`
      ].join(' '));
    }
  }
  return lines;
}

function renderCandidateSelectionDiagnostics(diagnostics = {}) {
  const composition = diagnostics.composition_summary || {};
  const headline = diagnostics.headline_decision || {};
  const headlineInclusion = diagnostics.headline_latest_inclusion || {};
  const headlinePublicRender = diagnostics.headline_public_render_reconciliation || {};
  const headlineRemoved = ensureArray(diagnostics.removed_due_to_headline_inclusion);
  const releaseClassCatchUp = diagnostics.release_class_catch_up || {};
  const releaseClassCatchUpAfterReconciliation = diagnostics.release_class_catch_up_after_reconciliation || {};
  const hints = ensureArray(diagnostics.selection_shortage_hints)
    .map(item => `- ${item}`)
    .join('\n') || '- none';
  const reasons = ensureArray(diagnostics.final_exclusion_reason_summary)
    .slice(0, 5)
    .map(item => `- ${item.reason} (${item.count})`)
    .join('\n') || '- none';
  return [
    '## 후보 선택 진단',
    '',
    `- Reporter candidates: ${formatCount(diagnostics.reporter_candidate_count)}`,
    `- Reporter-selected candidates: ${formatCount(diagnostics.reporter_selected_count)}`,
    `- Final input candidates: ${formatCount(diagnostics.final_input_candidate_count ?? diagnostics.input_candidate_count)}`,
    `- Final eligible candidates: ${formatCount(diagnostics.final_eligible_candidate_count ?? diagnostics.eligible_candidate_count)}`,
    `- Final selected articles: ${formatCount(diagnostics.final_selected_article_count ?? diagnostics.selected_article_count)}`,
    `- Deterministic primary articles: ${formatCount(diagnostics.primary_selected_article_count ?? diagnostics.deterministic_selected_count)}`,
    `- Selected representative groups: ${formatCount(diagnostics.selected_group_count)}`,
    `- Rendered groups: ${formatCount(diagnostics.rendered_group_count)}`,
    `- Explicitly demoted groups (editor): ${formatCount(diagnostics.explicitly_demoted_group_count)}`,
    ...reconciliationDemotionLines(diagnostics),
    `- Reserve candidates: ${formatCount(diagnostics.reserve_candidate_count)}`,
    `- Demoted candidates: ${formatCount(diagnostics.demoted_candidate_count)}`,
    `- Composition mode: ${formatCount(diagnostics.composition_mode)}`,
    `- Editor review required: ${diagnostics.editor_review_required === true ? 'true' : 'false'}`,
    `- Reporter-selected but final-excluded: ${formatCount(diagnostics.reporter_selected_but_final_excluded_count)}`,
    `- direct_aosp_camera: ${formatCount(diagnostics.direct_aosp_camera_count ?? composition.direct_aosp_camera_count)}`,
    `- android_platform_camera_adjacent: ${formatCount(diagnostics.android_platform_camera_adjacent_count ?? composition.android_platform_camera_adjacent_count)}`,
    `- camera_driver_image_pipeline: ${formatCount(diagnostics.camera_driver_image_pipeline_count ?? composition.camera_driver_image_pipeline_count)}`,
    `- android_multimedia_camera_output: ${formatCount(diagnostics.android_multimedia_camera_output_count ?? composition.android_multimedia_camera_output_count)}`,
    `- soc_platform_signal: ${formatCount(diagnostics.soc_platform_signal_count ?? composition.soc_platform_signal_count)}`,
    `- cpp_ai_tooling_fallback: ${formatCount(diagnostics.cpp_ai_tooling_fallback_count ?? composition.cpp_ai_tooling_fallback_count)}`,
    `- Primary Camera Stack: ${formatCount(diagnostics.primary_camera_stack_topic_count ?? composition.primary_camera_stack_topic_count)}`,
    `- Supporting main articles: ${formatCount(diagnostics.supporting_main_article_count ?? composition.supporting_main_article_count)}`,
    `- Forbidden main articles: ${formatCount(diagnostics.forbidden_main_article_count ?? composition.forbidden_main_article_count)}`,
    `- Non-fallback reviewable: ${formatCount(diagnostics.non_fallback_reviewable_article_count ?? composition.non_fallback_reviewable_article_count)}`,
    `- release_class_pool_size: ${formatCount(releaseClassCatchUp.pool_size)}`,
    `- release_class_admitted: ${formatCount(releaseClassCatchUp.admitted)}`,
    // 값이 없는 주(unknown)와 레인이 막히지 않은 주(none)는 서로 다른 사실이다.
    // 둘을 같은 문자열로 접으면 관측 누락이 정상 출력처럼 보인다.
    `- release_class_blocked_reason: ${releaseClassCatchUp.blocked_reason === '' ? 'none' : formatCount(releaseClassCatchUp.blocked_reason)}`,
    // #879: 2차 pass(coverage 재조정 뒤). 1차가 lineup_at_max인데 2차가 승급했다면, 그 주에는
    // 재조정 강등으로 자리가 실제로 비어 있었다는 뜻이다.
    `- release_class_after_reconciliation_pool_size: ${formatCount(releaseClassCatchUpAfterReconciliation.pool_size)}`,
    `- release_class_after_reconciliation_admitted: ${formatCount(releaseClassCatchUpAfterReconciliation.admitted)}`,
    `- release_class_after_reconciliation_blocked_reason: ${releaseClassCatchUpAfterReconciliation.blocked_reason === '' ? 'none' : formatCount(releaseClassCatchUpAfterReconciliation.blocked_reason)}`,
    '',
    'Source/parser recovery hint:',
    hints,
    '',
    '주요 final exclusion reason:',
    reasons,
    '',
    'Homepage Headline:',
    `- decision: ${formatCount(headline.reason || headline.decision)}`,
    `- current_headline_key: ${formatCount(headline.current_headline_key)}`,
    `- replacement_headline_key: ${formatCount(headline.replacement_headline_key)}`,
    `- public_render_reconciled: ${headline.public_render_reconciled === true || headlinePublicRender.applied === true ? 'true' : 'false'}`,
    `- public_rendered_headline_key: ${formatCount(headline.public_rendered_headline_key || headlinePublicRender.rendered_headline_key)}`,
    `- public_render_reconciliation_reason: ${formatCount(headline.public_render_reconciliation_reason || headlinePublicRender.reason)}`,
    `- runtime_decayed_score: ${formatCount(headline.runtime_decayed_score)}`,
    `- previous_stored_current_score: ${formatCount(headline.previous_stored_current_score)}`,
    `- last_scored_at: ${formatCount(headline.last_scored_at)}`,
    `- scored_at: ${formatCount(headline.scored_at)}`,
    `- included_as_latest: ${headlineInclusion.included === true ? 'true' : 'false'}`,
    `- latest_inclusion_mode: ${formatCount(headlineInclusion.mode)}`,
    `- injected_from_snapshot: ${headlineInclusion.injected_from_snapshot === true ? 'true' : 'false'}`,
    `- removed_due_to_headline_inclusion_count: ${headlineRemoved.length}`,
    ...(headlineRemoved.length > 0
      ? headlineRemoved.slice(0, 5).map(item =>
        `  - ${formatCount(item.title)} (${formatCount(item.article_identity_key)}): ${formatCount(item.reason)}`
      )
      : []),
    '',
    diagnostics.note || REPORTER_SELECTION_NOTE
  ].join('\n');
}

module.exports = {
  REPORTER_SELECTED_ALIAS_NOTE,
  REPORTER_SELECTION_NOTE,
  ensureArray,
  isFinalSelected,
  isReporterSelected,
  normalizeReporterReport,
  normalizeShortlistCandidate,
  normalizeShortlistReport,
  renderCandidateSelectionDiagnostics,
  selectionDiagnosticsFromReports,
  summarizeFinalExclusionReasons
};
