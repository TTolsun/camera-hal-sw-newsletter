const fs = require('fs');
const {
  resolvePublishStatus
} = require('../reporter/publish-status');
const {
  EDITORIAL_DECISION_HEADINGS,
  EDITORIAL_DECISION_LABELS,
  EDITORIAL_DECISION_TABLE_COLUMNS,
  PIPELINE_STATUS_LABELS
} = require('../reporter/editorial-decision-summary');

const FORBIDDEN_ENGLISH_HEADINGS = [
  '## Generation Status',
  '## Composition Summary',
  '## Deterministic Final Selection Status',
  '## Editor Action Guidance',
  '## Generated Artifacts'
];
const LEGACY_GENERATED_ARTIFACTS_HEADING = '\u003f\uc579\uaf66\u0020\u003f\uacd7\ud167\u81fe\u003f';
const EVIDENCE_PACK_SUMMARY_HEADING = 'Evidence Pack 요약';
const EVIDENCE_PACK_CLAIM_HAL_HEADING = 'Claim / HAL Impact 요약';
const EVIDENCE_PACK_SELECTED_HEADING = '선택된 Main Article 근거';
const EVIDENCE_PACK_EXCLUDED_HEADING = '제외 후보 근거';
const EVIDENCE_PACK_DIAGNOSTICS_HEADING = 'Needs-fix / Review-only 진단';
const EVIDENCE_PACK_CHECKLIST_HEADING = '사람 검토 체크리스트';
const REQUESTED_TYPES = new Set(['auto', 'newsletter', 'code-docs']);
const BODY_KIND_HEADINGS = [
  ['generated-newsletter', '생성 상태'],
  ['newsletter-template', '뉴스레터 발행 PR'],
  ['code-docs-template', '코드 / 문서 / 리팩토링 PR'],
  ['root-selector', 'PR 유형 선택']
];
const BODY_KIND_LABELS = {
  'generated-newsletter': '자동 생성 뉴스레터 PR body(generated-newsletter)',
  'newsletter-template': '수동 뉴스레터 발행 template body(newsletter-template)',
  'code-docs-template': '코드/문서/리팩토링 template body(code-docs-template)',
  'root-selector': '루트 선택 안내 template(root-selector)',
  unknown: '알 수 없는 PR body(unknown)',
  ambiguous: '여러 유형 heading이 섞인 PR body(ambiguous)',
  'type-mismatch': '요청 type과 body kind가 맞지 않는 PR body(type-mismatch)',
  'invalid-type': '허용되지 않는 --type 값(invalid-type)'
};

function toText(value) {
  return String(value ?? '');
}

function countMatches(text, pattern) {
  return [...toText(text).matchAll(pattern)].length;
}

function boolFromMatch(match) {
  if (!match) return null;
  return match[1] === 'true';
}

function firstMatch(text, pattern) {
  const match = toText(text).match(pattern);
  return match ? match[1].trim() : '';
}

function numberFromMatch(match) {
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractStatusSection(text) {
  text = toText(text);
  const startMatch = /^## 생성 상태\s*$/m.exec(text);
  if (!startMatch) return '';
  const bodyStart = startMatch.index + startMatch[0].length;
  const rest = text.slice(bodyStart);
  const nextMatch = /^##\s+/m.exec(rest);
  return nextMatch ? rest.slice(0, nextMatch.index) : rest;
}

function extractEditorPrSummaryText(text) {
  const source = toText(text);
  const startMatch = /^## 최종 판단\s*$/m.exec(source);
  if (!startMatch) return '';
  const rest = source.slice(startMatch.index);
  const endMatch = /^## 상세 report\s*$/m.exec(rest);
  return endMatch ? rest.slice(0, endMatch.index) : rest;
}

function extractSections(text) {
  const source = toText(text);
  const headings = [...source.matchAll(/^##\s+(.+?)\s*$/gm)];
  const sections = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index][1].trim();
    const bodyStart = headings[index].index + headings[index][0].length;
    const bodyEnd = headings[index + 1]?.index ?? source.length;
    sections.set(heading, source.slice(bodyStart, bodyEnd));
  }
  return sections;
}

function concretePublicationStateText(text) {
  const sections = extractSections(text);
  const chunks = [];
  for (const heading of ['Diagnostics-only Status', '발행 상태 요약', 'Public Newsletter Readiness']) {
    if (!sections.has(heading)) continue;
    chunks.push(`## ${heading}`);
    chunks.push(sections.get(heading));
  }
  return chunks.join('\n');
}

function sectionByHeading(sections, headings) {
  for (const heading of headings) {
    if (sections.has(heading)) return sections.get(heading);
  }
  for (const [heading, body] of sections.entries()) {
    if (headings.some(expected => heading.includes(expected))) return body;
  }
  return '';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicArtifactPatterns(date = '') {
  const datePattern = date ? escapeRegExp(date) : '\\d{4}-\\d{2}-\\d{2}';
  return {
    newsletterMd: new RegExp(`^-\\s+newsletters/${datePattern}/newsletter\\.md\\b.*$`, 'm'),
    newsletterHtml: new RegExp(`^-\\s+newsletters/${datePattern}/index\\.html\\b.*$`, 'm'),
    dataIndex: /^-\s+data\/newsletters\.json\b.*$/m
  };
}

function datePatternForValidation(date = '') {
  return date ? escapeRegExp(date) : '\\d{4}-\\d{2}-\\d{2}';
}

function exactHeadingCount(text, level, heading) {
  return countMatches(text, new RegExp(`^${'#'.repeat(level)} ${escapeRegExp(heading)}$`, 'gm'));
}

function hasHeading(text, level, heading) {
  return new RegExp(`^${'#'.repeat(level)}\\s+${escapeRegExp(heading)}\\s*$`, 'm').test(toText(text));
}

function hasSubheading(section, heading) {
  return new RegExp(`^###\\s+${escapeRegExp(heading)}\\s*$`, 'm').test(toText(section));
}

function extractSubsection(section, heading) {
  const source = toText(section);
  const pattern = new RegExp(`^### ${escapeRegExp(heading)}\\s*$`, 'm');
  const match = pattern.exec(source);
  if (!match) return '';
  const bodyStart = match.index + match[0].length;
  const rest = source.slice(bodyStart);
  const next = /^###\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function firstNumberAfterLabel(section, label) {
  const match = toText(section).match(new RegExp(`${escapeRegExp(label)}:\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function markdownHeaderColumns(section) {
  const lines = toText(section).split(/\r?\n/);
  const header = lines.find((line, index) =>
    line.trim().startsWith('|') &&
    lines[index + 1] &&
    /^\s*\|\s*:?-{3,}/.test(lines[index + 1])
  );
  if (!header) return [];
  return splitMarkdownTableLine(header)
    .map(column => column.trim())
    .filter(Boolean);
}

function splitMarkdownTableLine(line) {
  const cells = [];
  let current = '';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '|' && line[index - 1] !== '\\') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function validateMarkdownTableColumns(section, label, requiredColumns, errors) {
  const columns = markdownHeaderColumns(section);
  const missing = requiredColumns.filter(column => !columns.includes(column));
  if (missing.length > 0) {
    errors.push(`${label} table is missing required columns: ${missing.join(', ')}.`);
  }
}

function markdownTableRows(section) {
  const lines = toText(section).split(/\r?\n/);
  const headerIndex = lines.findIndex((line, index) =>
    line.trim().startsWith('|') &&
    lines[index + 1] &&
    /^\s*\|\s*:?-{3,}/.test(lines[index + 1])
  );
  if (headerIndex === -1) return { columns: [], rows: [] };
  const columns = splitMarkdownTableLine(lines[headerIndex])
    .map(column => column.trim())
    .filter(Boolean);
  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith('|')) break;
    const cells = splitMarkdownTableLine(line)
      .map(column => column.trim())
      .filter((_, index, list) => index > 0 && index < list.length - 1);
    rows.push(cells);
  }
  return { columns, rows };
}

function validateEditorialDecisionSummarySection(text, sections, errors) {
  const headings = EDITORIAL_DECISION_HEADINGS;
  const summaryCount = exactHeadingCount(text, 2, headings.summary);
  const verdictCount = exactHeadingCount(text, 2, headings.verdict);
  const legendCount = exactHeadingCount(text, 2, headings.legend);
  const hasAny = summaryCount > 0 || verdictCount > 0 || legendCount > 0;
  if (!hasAny) return;

  if (summaryCount !== 1) {
    errors.push(`PR body must contain exactly one "## ${headings.summary}" heading when editorial decision summary is present, found ${summaryCount}.`);
  }
  if (verdictCount !== 1) {
    errors.push(`PR body must contain exactly one "## ${headings.verdict}" heading when editorial decision summary is present, found ${verdictCount}.`);
  }
  if (legendCount !== 1) {
    errors.push(`PR body must contain exactly one "## ${headings.legend}" heading when editorial decision summary is present, found ${legendCount}.`);
  }
  if (summaryCount !== 1) return;

  const summarySection = sectionByHeading(sections, [headings.summary]);
  validateMarkdownTableColumns(summarySection, 'Editorial decision summary', EDITORIAL_DECISION_TABLE_COLUMNS, errors);
  const { columns, rows } = markdownTableRows(summarySection);
  const decisionIndex = columns.indexOf('편집 판단');
  const pipelineIndex = columns.indexOf('Pipeline 상태');
  const allowedPipelineLabels = new Set(Object.values(PIPELINE_STATUS_LABELS));
  for (const row of rows) {
    const decisionLabel = row[decisionIndex] || '';
    if (decisionLabel && !EDITORIAL_DECISION_LABELS.has(decisionLabel)) {
      errors.push(`Editorial decision summary contains unknown decision label: ${decisionLabel}.`);
    }
    const pipelineLabel = row[pipelineIndex] || '';
    if (pipelineLabel && !allowedPipelineLabels.has(pipelineLabel)) {
      errors.push(`Editorial decision summary contains unknown Pipeline 상태: ${pipelineLabel}.`);
    }
  }
}

function diagnosticLineHasValue(section, label) {
  const match = toText(section).match(new RegExp(`^- ${escapeRegExp(label)}:\\s*(.+)$`, 'm'));
  return Boolean(match && match[1].trim() && match[1].trim() !== 'none');
}

function hasCompleteMarkdownLink(value) {
  const text = toText(value);
  const angleWrappedLink = /\[[^\]\n]+\]\(<[^>\n]+>\)/;
  const plainLink = /\[[^\]\n]+\]\([^)>\n]+\)/;
  return angleWrappedLink.test(text) || plainLink.test(text);
}

function isDiagnosticsOnlyBody(text) {
  const source = concretePublicationStateText(text);
  return /(?:^|\n)\s*-?\s*diagnostics_only\s*[:=]\s*true\b/i.test(source) ||
    /\bdiagnostics[- ]only\b/i.test(source) ||
    (
    /\breview[- ]only\b/i.test(source) ||
    /검토 전용/.test(source)
    ) && /public_newsletter_ready\s*[:=]\s*false\b/i.test(source);
}

function isReviewPublicationBody(text) {
  const source = concretePublicationStateText(text);
  return /(?:^|\n)\s*-?\s*review_publication_ready\s*[:=]\s*true\b/i.test(source) ||
    (
      /public_newsletter_ready\s*[:=]\s*true\b/i.test(source) &&
      /editor_review_required[=:]\s*true\b/i.test(source) &&
      /(편집장|편집자|review[- ]only|review publication)/i.test(source)
    );
}

function isCandidateShortageBody(text) {
  const source = toText(text);
  return /failure_kind[=:]\s*candidate_shortage_reviewable\b/i.test(source) ||
    /^## Candidate Pool Preflight\s*$/m.test(source);
}

function hasReviewOnlyPublicFilesNotReadyText(text) {
  const source = toText(text);
  return /public newsletter files(?:가)?\s*(?:are\s+)?not\s+ready/i.test(source) ||
    /public files\s*(?:are\s*)?not\s+ready/i.test(source) ||
    /public newsletter files(?:가)?\s*준비되지 않았/.test(source);
}

function hasReviewOnlyNegativePublishText(text) {
  const source = toText(text);
  return /not publish-ready/i.test(source) ||
    /cannot be publish-ready/i.test(source) ||
    /publish-ready label must not be applied/i.test(source) ||
    /publish-ready[^.\n]*(?:must not|금지|제거)/i.test(source) ||
    /발행 가능 상태가 아닙니다/.test(source) ||
    /발행 가능한 PR이 아닙니다/.test(source);
}

function reviewOnlyPositivePublishReadyLines(text) {
  return toText(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      if (/this pr is publish-ready/i.test(line)) return true;
      if (/\bready to publish\b/i.test(line)) return true;
      if (/final publish ready:\s*true/i.test(line)) return true;
      if (/final_publish_ready\s*[:=]\s*true\b/i.test(line)) return true;
      if (/public newsletter generated successfully/i.test(line)) return true;
      if (!/publish-ready/i.test(line)) return false;
      if (/publish-ready gate\b/i.test(line)) return false;
      return !/\bnot publish-ready\b|cannot be publish-ready|must not|not applied|label must not be applied|reserved for|has_ai_publish_ready=true|AI 자동 발행 기준 통과|금지|제거|붙이지|미적용|아닙니다/i.test(line);
    });
}

function hasHomepageHiddenText(text) {
  const source = toText(text);
  return /merge해도[^.\n]*(?:홈페이지|Newsletter)[^.\n]*(?:표시되지|게시되지)/i.test(source) ||
    /homepage[^.\n]*(?:not\s+visible|not\s+shown|will\s+not\s+show)/i.test(source) ||
    /Merge 후 홈페이지 표시 여부\s*\|\s*표시되지 않음/.test(source);
}

function hasHomepageVisibleText(text) {
  const source = toText(text);
  return /Merge 후 홈페이지 표시 여부\s*\|\s*표시됨/.test(source) ||
    /(?:이 PR|편집장|편집자)[^.\n]*merge하면[^.\n]*(?:Newsletter|홈페이지|사이트)[^.\n]*(?:게시|표시)/i.test(source) ||
    /homepage\s+(?:is\s+)?(?:visible|shown)/i.test(source) ||
    /homepage[^.\n]*(?:will\s+show|will\s+be\s+visible)/i.test(source);
}

function hasPublishReadyLabelBlockedText(text) {
  const source = toText(text);
  return /publish-ready label(?:은| must)?[^.\n]*(?:붙이지|금지|must not|not applied|제거)/i.test(source) ||
    /publish-ready는?[^.\n]*AI 자동 발행 기준 통과/i.test(source);
}

function topSummaryHasBool(summary, key, expected) {
  return new RegExp(`${escapeRegExp(key)}[^\\n]*(?:[:=]|\\|)[^\\n]*${expected}\\b`, 'i').test(toText(summary));
}

function hasTopHomepageVisibleText(summary) {
  const source = toText(summary);
  return topSummaryHasBool(source, 'homepage_visible_after_merge', 'true') ||
    /merge 시 홈페이지 표시 가능/.test(source) ||
    /홈페이지 표시 가능/.test(source);
}

function hasTopHomepageHiddenText(summary) {
  const source = toText(summary);
  return topSummaryHasBool(source, 'homepage_visible_after_merge', 'false') ||
    /merge해도[^.\n]*(?:홈페이지|Newsletter)[^.\n]*(?:표시되지|게시되지)/i.test(source);
}

function validateEditorPrSummaryContract(text, parsed, errors) {
  const finalJudgmentCount = exactHeadingCount(text, 2, '최종 판단');
  if (finalJudgmentCount !== 1) {
    errors.push(`PR body must contain exactly one "## 최종 판단" heading, found ${finalJudgmentCount}.`);
    return;
  }
  const finalJudgmentIndex = toText(text).indexOf('## 최종 판단');
  const generationStatusIndex = toText(text).indexOf('## 생성 상태');
  if (generationStatusIndex !== -1 && finalJudgmentIndex > generationStatusIndex) {
    errors.push('PR body must place "## 최종 판단" before "## 생성 상태".');
  }

  const summary = extractEditorPrSummaryText(text);
  if (!summary) {
    errors.push('PR body is missing editor-facing top summary content.');
    return;
  }

  if (parsed.finalPublishReady === true) {
    if (!topSummaryHasBool(summary, 'final_publish_ready', 'true') && !/AI 자동 발행 가능/.test(summary)) {
      errors.push('publish-ready top summary must include final_publish_ready=true or AI automatic publish-ready wording.');
    }
    if (
      topSummaryHasBool(summary, 'diagnostics_only', 'true') ||
      /진단 전용/.test(summary) ||
      /편집장 승인 시 공개 가능|publish-ready 아님|publish-ready label 금지/.test(summary)
    ) {
      errors.push('publish-ready top summary must not include diagnostics-only or review-publication negative wording.');
    }
  }

  const reviewPublication = isReviewPublicationBody(text);
  if (reviewPublication) {
    if (!topSummaryHasBool(summary, 'final_publish_ready', 'false')) {
      errors.push('review-publication top summary must include final_publish_ready=false.');
    }
    if (!topSummaryHasBool(summary, 'review_publication_ready', 'true')) {
      errors.push('review-publication top summary must include review_publication_ready=true.');
    }
    if (!hasPublishReadyLabelBlockedText(summary)) {
      errors.push('review-publication top summary must state that the publish-ready label is blocked.');
    }
    if (!hasTopHomepageVisibleText(summary)) {
      errors.push('review-publication top summary must state that merge can show the newsletter on the homepage.');
    }
    if (/AI 자동 발행 가능/.test(summary)) {
      errors.push('review-publication top summary must not describe the PR as AI automatic publish-ready.');
    }
  }

  const diagnosticsOnly = isDiagnosticsOnlyBody(text);
  if (diagnosticsOnly) {
    if (!topSummaryHasBool(summary, 'diagnostics_only', 'true')) {
      errors.push('diagnostics-only top summary must include diagnostics_only=true.');
    }
    if (!topSummaryHasBool(summary, 'public_newsletter_ready', 'false')) {
      errors.push('diagnostics-only top summary must include public_newsletter_ready=false.');
    }
    if (!hasTopHomepageHiddenText(summary)) {
      errors.push('diagnostics-only top summary must state that merging will not show the newsletter on the homepage.');
    }
    if (topSummaryHasBool(summary, 'public_newsletter_ready', 'true') || /public newsletter files는 생성되었습니다/.test(summary)) {
      errors.push('diagnostics-only top summary must not state that public newsletter files are ready.');
    }
  }
}

function validateDiagnosticsOnlyContract(text, parsed, errors) {
  const concreteState = concretePublicationStateText(text);
  if (!/(?:^|\n)\s*-?\s*diagnostics_only\s*[:=]\s*true\b/i.test(concreteState) && !/\bdiagnostics[- ]only\b/i.test(concreteState)) {
    errors.push('diagnostics-only PR body must include diagnostics_only=true or a diagnostics-only marker.');
  }
  if (!/public_newsletter_ready\s*[:=]\s*false\b/i.test(concreteState)) {
    errors.push('diagnostics-only PR body must include public_newsletter_ready=false.');
  }
  if (!/final_publish_ready\s*[:=]\s*false\b/i.test(text)) {
    errors.push('diagnostics-only PR body must include final_publish_ready=false.');
  }
  if (!hasReviewOnlyNegativePublishText(text)) {
    errors.push('diagnostics-only PR body must state that it is not publish-ready.');
  }
  if (!hasReviewOnlyPublicFilesNotReadyText(text)) {
    errors.push('diagnostics-only PR body must state that public newsletter files are not ready.');
  }
  if (!hasHomepageHiddenText(text)) {
    errors.push('diagnostics-only PR body must state that merging will not show the newsletter on the homepage.');
  }
  if (hasHomepageVisibleText(text)) {
    errors.push('diagnostics-only PR body must not state that the newsletter will be visible on the homepage.');
  }
  if (parsed.finalPublishReady === true) {
    errors.push('diagnostics-only PR body must not set final_publish_ready=true.');
  }
  const positiveLines = reviewOnlyPositivePublishReadyLines(text);
  if (positiveLines.length > 0) {
    errors.push(`diagnostics-only PR body contains misleading publish-ready wording: ${positiveLines.slice(0, 3).join('; ')}`);
  }
}

function validateReviewPublicationContract(text, parsed, errors) {
  const concreteState = concretePublicationStateText(text);
  if (!/(?:^|\n)\s*-?\s*review_publication_ready\s*[:=]\s*true\b/i.test(concreteState)) {
    errors.push('review publication PR body must include review_publication_ready=true.');
  }
  if (!/public_newsletter_ready\s*[:=]\s*true\b/i.test(concreteState)) {
    errors.push('review publication PR body must include public_newsletter_ready=true.');
  }
  if (!/final_publish_ready\s*[:=]\s*false\b/i.test(text)) {
    errors.push('review publication PR body must include final_publish_ready=false.');
  }
  if (!/editor_review_required[=:]\s*true\b/i.test(text)) {
    errors.push('review publication PR body must include editor_review_required=true.');
  }
  if (!hasHomepageVisibleText(text)) {
    errors.push('review publication PR body must state that editor merge will show the newsletter on the homepage.');
  }
  if (!hasPublishReadyLabelBlockedText(text)) {
    errors.push('review publication PR body must state that the publish-ready label must not be applied.');
  }
  if (hasReviewOnlyPublicFilesNotReadyText(text) || /생성하지 않은 public 산출물|not generated|not updated/.test(text)) {
    errors.push('review publication PR body must not describe public newsletter files as not ready, not generated, or not updated.');
  }
  if (/(?:^|\n)\s*-?\s*publication_mode\s*[:=]\s*fallback_public\b/i.test(concreteState)) {
    if (!/(?:^|\n)\s*-?\s*homepage_visibility\s*[:=]\s*visible_with_fallback_badge\b/i.test(concreteState)) {
      errors.push('fallback public PR body must include homepage_visibility=visible_with_fallback_badge.');
    }
    if (!/(?:^|\n)\s*-?\s*fallback_only\s*[:=]\s*true\b/i.test(concreteState)) {
      errors.push('fallback public PR body must include fallback_only=true.');
    }
    if (!/(?:^|\n)\s*-?\s*camera_anchor_count\s*[:=]\s*0\b/i.test(concreteState)) {
      errors.push('fallback public PR body must include camera_anchor_count=0.');
    }
    if (!/(?:^|\n)\s*-?\s*fallback_public_ready\s*[:=]\s*true\b/i.test(concreteState)) {
      errors.push('fallback public PR body must include fallback_public_ready=true.');
    }
    if (!/(?:^|\n)\s*-?\s*homepage_badge\s*[:=]\s*Tooling Watch Edition\b/i.test(concreteState)) {
      errors.push('fallback public PR body must include homepage_badge=Tooling Watch Edition.');
    }
  }
}

function validateCandidateTraceSection(text, sections, options, errors) {
  const traceCount = exactHeadingCount(text, 2, '후보 기사 추적');
  if (traceCount !== 1) {
    errors.push(`PR body must contain exactly one "## 후보 기사 추적" heading, found ${traceCount}.`);
    return;
  }

  const traceSection = sectionByHeading(sections, ['후보 기사 추적']);
  if (!traceSection) {
    errors.push('PR body is missing 후보 기사 추적 section.');
    return;
  }

  for (const heading of [
    '한눈에 보는 후보 판단',
    '최종 선택 기사',
    'Reserve 후보',
    '제외/강등/거절된 주요 후보',
    '품질/팩트체크 연결',
    '상세 artifact'
  ]) {
    if (!new RegExp(`^### ${escapeRegExp(heading)}\\s*$`, 'm').test(traceSection)) {
      errors.push(`후보 기사 추적 section is missing "### ${heading}" subsection.`);
    }
  }

  const datePattern = datePatternForValidation(options.date);
  const requiredPaths = [
    options.allowMissingReporterCandidates ? '' : `content/newsroom/${datePattern}/reporter-candidates\\.json`,
    `content/collected-news/${datePattern}/candidates\\.json`
  ].filter(Boolean);
  for (const requiredPath of requiredPaths) {
    if (!new RegExp(requiredPath).test(traceSection)) {
      errors.push(`후보 기사 추적 section must list artifact path matching ${requiredPath}.`);
    }
  }

  if (traceSection.includes('후보 기사 artifact를 찾을 수 없어 추적 섹션을 생성하지 못했습니다.')) {
    if (!/읽기\/형식 요약:\s*\n-\s+/m.test(traceSection)) {
      errors.push('후보 기사 추적 fallback must include missing/read/shape summary.');
    }
  }

  const brokenLinkRows = traceSection
    .split(/\r?\n/)
    .filter(line => line.trim().startsWith('|') && line.includes('](') && !hasCompleteMarkdownLink(line));
  if (brokenLinkRows.length > 0) {
    errors.push('후보 기사 추적 table contains an incomplete Markdown source link.');
  }

  const finalSelectedCount = firstNumberAfterLabel(traceSection, '최종 선택 기사');
  if (finalSelectedCount > 0) {
    const finalSection = extractSubsection(traceSection, '최종 선택 기사');
    if (!hasCompleteMarkdownLink(finalSection)) {
      errors.push('최종 선택 기사 table must include at least one Markdown source link.');
    }
    if (!/cand_\d{3}/.test(finalSection)) {
      errors.push('최종 선택 기사 table must include at least one Candidate ID.');
    }
    if (!/\b(?:final_selected|primary_selected)\b/.test(finalSection)) {
      errors.push('최종 선택 기사 table must include final_selected or primary_selected status.');
    }
  }
}

function validateEvidencePackSections(text, sections, parsed, errors) {
  const summaryCount = exactHeadingCount(text, 2, EVIDENCE_PACK_SUMMARY_HEADING);
  if (summaryCount === 0) return;
  if (summaryCount !== 1) {
    errors.push(`PR body must contain at most one "## ${EVIDENCE_PACK_SUMMARY_HEADING}" heading, found ${summaryCount}.`);
    return;
  }

  const summarySection = sectionByHeading(sections, [EVIDENCE_PACK_SUMMARY_HEADING]);
  if (!summarySection) {
    errors.push(`PR body is missing ${EVIDENCE_PACK_SUMMARY_HEADING} section body.`);
    return;
  }

  if (/Evidence Pack summary:\s*unavailable/i.test(summarySection)) {
    if (!/Reason:\s*content\/newsroom\/\d{4}-\d{2}-\d{2}\/evidence-pack-summary\.json\b/.test(summarySection)) {
      errors.push('Unavailable Evidence Pack summary must include the expected artifact path reason.');
    }
    return;
  }

  for (const label of [
    'Raw candidates',
    'Eligible candidates',
    'Selected main articles',
    'Reserve candidates',
    'Excluded candidates',
    'Primary camera stack count',
    'Supporting bucket count',
    'Fallback window used',
    'Fallback window consulted',
    'Fallback window reason',
    'Fallback promoted candidates',
    'Fallback bucket used'
  ]) {
    if (!new RegExp(`^- ${escapeRegExp(label)}:\\s+`, 'm').test(summarySection)) {
      errors.push(`Evidence Pack summary is missing "${label}" row.`);
    }
  }

  const claimHalSection = sectionByHeading(sections, [EVIDENCE_PACK_CLAIM_HAL_HEADING]);
  const selectedSection = sectionByHeading(sections, [EVIDENCE_PACK_SELECTED_HEADING]);
  const excludedSection = sectionByHeading(sections, [EVIDENCE_PACK_EXCLUDED_HEADING]);
  const diagnosticsSection = sectionByHeading(sections, [EVIDENCE_PACK_DIAGNOSTICS_HEADING]);
  const checklistSection = sectionByHeading(sections, [EVIDENCE_PACK_CHECKLIST_HEADING]);

  if (!claimHalSection) errors.push(`PR body is missing ${EVIDENCE_PACK_CLAIM_HAL_HEADING} section.`);
  if (!selectedSection) errors.push(`PR body is missing ${EVIDENCE_PACK_SELECTED_HEADING} section.`);
  if (!excludedSection) errors.push(`PR body is missing ${EVIDENCE_PACK_EXCLUDED_HEADING} section.`);
  if (!diagnosticsSection) errors.push(`PR body is missing ${EVIDENCE_PACK_DIAGNOSTICS_HEADING} section.`);
  if (!checklistSection) errors.push(`PR body is missing ${EVIDENCE_PACK_CHECKLIST_HEADING} section.`);

  if (claimHalSection) {
    for (const label of [
      'Claim validation status',
      'Claim coverage',
      'Claim validation availability',
      'Overclaim risk',
      'HAL impact axes',
      'Articles without HAL impact axes'
    ]) {
      if (!new RegExp(`^- ${escapeRegExp(label)}:\\s+`, 'm').test(claimHalSection)) {
        errors.push(`Evidence Pack claim/HAL summary is missing "${label}" row.`);
      }
    }
    if (!/^- Claim coverage:\s*bound_claims=.+;\s*total_claims=.+$/m.test(claimHalSection)) {
      errors.push('Evidence Pack claim/HAL summary must include bound_claims and total_claims.');
    }
    const selectedCount = firstNumberAfterLabel(summarySection, 'Selected main articles');
    if (selectedCount > 0 && /^\s*-\s+none\s*$/m.test(claimHalSection)) {
      errors.push('Evidence Pack selected article count is positive but claim/HAL table is empty.');
    }
    if (!/^\s*-\s+none\s*$/m.test(claimHalSection)) {
      validateMarkdownTableColumns(
        claimHalSection,
        'Evidence Pack claim/HAL',
        ['Article', 'HAL axes', 'Claim validation', 'Overclaim risk'],
        errors
      );
    }
  }

  if (selectedSection) {
    const selectedCount = firstNumberAfterLabel(summarySection, 'Selected main articles');
    if (selectedCount > 0 && /^\s*-\s+none\s*$/m.test(selectedSection)) {
      errors.push('Evidence Pack selected article count is positive but selected table is empty.');
    }
    if (!/^\s*-\s+none\s*$/m.test(selectedSection)) {
      validateMarkdownTableColumns(
        selectedSection,
        'Evidence Pack selected article',
        ['#', 'Title', 'Source', 'URL', 'Source tier', 'Source role', 'URL quality', 'Bucket', 'Freshness', 'Reason'],
        errors
      );
    }
  }

  if (excludedSection && !/^\s*-\s+none\s*$/m.test(excludedSection)) {
    validateMarkdownTableColumns(
      excludedSection,
      'Evidence Pack excluded candidate',
      ['Title', 'Source', 'Bucket', 'Reason'],
      errors
    );
  }

  if (diagnosticsSection) {
    const requiredDiagnosticLabels = [
      'Quality hard failures',
      'Fact-check must-fix',
      'Repair failure',
      'Candidate shortage hints'
    ];
    for (const label of requiredDiagnosticLabels) {
      if (!new RegExp(`^- ${escapeRegExp(label)}:\\s+`, 'm').test(diagnosticsSection)) {
        errors.push(`Evidence Pack diagnostics is missing "${label}" row.`);
      }
    }
    const needsFixOrReviewable = parsed.overallStatus !== 'PASS' ||
      parsed.finalPublishReady === false ||
      isDiagnosticsOnlyBody(text) ||
      isReviewPublicationBody(text);
    if (
      needsFixOrReviewable &&
      !requiredDiagnosticLabels.some(label => diagnosticLineHasValue(diagnosticsSection, label))
    ) {
      errors.push('Needs-fix, diagnostics-only, or review publication Evidence Pack diagnostics must include at least one actionable diagnostic.');
    }
  }

  if (checklistSection && countMatches(checklistSection, /^- \[ \]\s+/gm) < 5) {
    errors.push('Evidence Pack human review checklist must include at least five unchecked items.');
  }
}

function validateHomepageHeadlineDesignReview(text, sections, errors, options = {}) {
  const heading = 'Homepage Headline Design Review';
  const count = exactHeadingCount(text, 2, heading);
  if (count === 0) {
    if (options.required === true) {
      errors.push(`PR body must contain "## ${heading}".`);
    }
    return;
  }
  if (count !== 1) {
    errors.push(`PR body must contain at most one "## ${heading}" heading, found ${count}.`);
    return;
  }
  const section = sectionByHeading(sections, [heading]);
  if (!section) {
    errors.push('Homepage Headline Design Review section body is missing.');
    return;
  }
  const lineValue = label => {
    const match = section.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'im'));
    return match ? match[1].trim() : '';
  };
  const figmaUrl = lineValue('Figma URL');
  const artifactPath = lineValue('Artifact path');
  const hasFigmaUrl = /^https:\/\/(?:www\.)?figma\.com\//i.test(figmaUrl);
  const hasArtifactPath = /^(?:content\/newsroom\/|docs\/design\/|[^/\s][^\n]*\.(?:png|jpg|jpeg|webp)$)/i.test(artifactPath) &&
    !/YYYY-MM-DD|unknown|missing/i.test(artifactPath);
  if (!hasFigmaUrl && !hasArtifactPath) {
    errors.push('Homepage Headline Design Review must include an actual Figma URL or screenshot artifact path string.');
  }
  const coveragePattern = /^(covered|checked|reviewed)(?:\b|:|-)/i;
  if (!coveragePattern.test(lineValue('Desktop coverage'))) {
    errors.push('Homepage Headline Design Review must include explicit desktop coverage marker.');
  }
  if (!coveragePattern.test(lineValue('Mobile coverage'))) {
    errors.push('Homepage Headline Design Review must include explicit mobile coverage marker.');
  }
  const deviation = lineValue('Implementation deviation');
  if (!deviation || /^(unknown|missing)$/i.test(deviation)) {
    errors.push('Homepage Headline Design Review must include implementation deviation field.');
  }
}

function parseStatusSection(section) {
  section = toText(section);
  return {
    overallStatus: firstMatch(section, /^전체 상태:\s*([A-Z_]+)/m),
    failureKind: firstMatch(section, /^failure_kind[=:]\s*([a-z_]+)/m),
    finalPublishReady: boolFromMatch(section.match(/final_publish_ready:\s*(true|false)/)),
    validateOk: boolFromMatch(section.match(/validate_ok[=:]\s*(true|false)/)),
    editorReviewRequired: boolFromMatch(section.match(/editor_review_required[=:]\s*(true|false)/)),
    qualityStatus: firstMatch(section, /^품질 상태:\s*([A-Z_]+)/m),
    factCheckStatus: firstMatch(section, /^팩트체크 상태:\s*([A-Z_]+)/m),
    mustFixCount: numberFromMatch(section.match(/must_fix_count[:=]\s*(\d+)/)),
    sourceGapCount: numberFromMatch(section.match(/source_gap_count[:=]\s*(\d+)/)),
    staleClaimStatus: firstMatch(section, /^Stale claim 상태:\s*([A-Z_]+)/m),
    staleClaimHardFailureCount: numberFromMatch(section.match(/hard_failures=(\d+)/)),
    validateOutcome: firstMatch(section, /^검증 결과:\s*([^\n]+)/m),
    consistencyErrors: firstMatch(section, /consistency_errors:\s*([^\)\n]+)/m)
  };
}

function detectedBodyKinds(text) {
  return BODY_KIND_HEADINGS
    .filter(([, heading]) => hasHeading(text, 2, heading))
    .map(([kind]) => kind);
}

function detectBodyKind(text) {
  const detected = detectedBodyKinds(text);
  if (detected.length > 1) return 'ambiguous';
  return detected[0] || 'unknown';
}

function normalizeRequestedType(value) {
  return String(value || 'auto').trim() || 'auto';
}

function resolveBodyKind(text, requestedType = 'auto') {
  const normalizedType = normalizeRequestedType(requestedType);
  const detectedKinds = detectedBodyKinds(text);
  const detectedKind = detectedKinds.length > 1 ? 'ambiguous' : (detectedKinds[0] || 'unknown');
  if (!REQUESTED_TYPES.has(normalizedType)) {
    return {
      bodyKind: 'invalid-type',
      requestedType: normalizedType,
      detectedKind,
      detectedKinds
    };
  }
  if (normalizedType === 'auto') {
    return {
      bodyKind: detectedKind,
      requestedType: normalizedType,
      detectedKind,
      detectedKinds
    };
  }
  if (
    normalizedType === 'newsletter' &&
    (detectedKind === 'generated-newsletter' || detectedKind === 'newsletter-template')
  ) {
    return {
      bodyKind: detectedKind,
      requestedType: normalizedType,
      detectedKind,
      detectedKinds
    };
  }
  if (normalizedType === 'code-docs' && detectedKind === 'code-docs-template') {
    return {
      bodyKind: detectedKind,
      requestedType: normalizedType,
      detectedKind,
      detectedKinds
    };
  }
  return {
    bodyKind: 'type-mismatch',
    requestedType: normalizedType,
    detectedKind,
    detectedKinds
  };
}

function bodyKindLabel(kind) {
  return BODY_KIND_LABELS[kind] || kind;
}

function hasValidationCommand(text, scriptName) {
  return new RegExp(`\\bnpm(?:\\.cmd)?\\s+run\\s+${escapeRegExp(scriptName)}\\b`).test(toText(text));
}

function validateRequiredSubheadings(section, headings, label, errors) {
  for (const heading of headings) {
    if (!hasSubheading(section, heading)) {
      errors.push(`${label} body에는 "### ${heading}" 섹션이 필요합니다.`);
    }
  }
}

function validateRequiredPatterns(section, items, label, errors) {
  const source = toText(section);
  for (const item of items) {
    if (!item.pattern.test(source)) {
      errors.push(`${label} body에는 "${item.label}" 항목이 필요합니다.`);
    }
  }
}

function validateValidationCommands(section, label, errors) {
  if (!hasValidationCommand(section, 'test')) {
    errors.push(`${label} body의 Validation 섹션에는 "npm run test" 또는 "npm.cmd run test"가 필요합니다.`);
  }
  if (!hasValidationCommand(section, 'validate')) {
    errors.push(`${label} body의 Validation 섹션에는 "npm run validate" 또는 "npm.cmd run validate"가 필요합니다.`);
  }
}

function validateNewsletterTemplateBodyText(text, options = {}) {
  text = toText(text);
  const errors = [];
  const sections = extractSections(text);
  const count = exactHeadingCount(text, 2, '뉴스레터 발행 PR');
  if (count !== 1) {
    errors.push(`뉴스레터 발행 PR body에는 "## 뉴스레터 발행 PR" heading이 정확히 하나 필요합니다. 현재 ${count}개입니다.`);
  }
  const body = sectionByHeading(sections, ['뉴스레터 발행 PR']);
  if (!body) {
    errors.push('뉴스레터 발행 PR body 내용을 찾을 수 없습니다.');
    return { ok: false, errors };
  }
  validateRequiredSubheadings(body, [
    'Public artifact',
    'Editorial quality',
    'Source / fact-check',
    'Validation'
  ], '뉴스레터 발행 PR', errors);
  validateRequiredPatterns(body, [
    { label: 'newsletters/YYYY-MM-DD/newsletter.md 또는 실제 날짜 newsletter.md', pattern: /newsletters\/(?:YYYY-MM-DD|\d{4}-\d{2}-\d{2})\/newsletter\.md/ },
    { label: 'newsletters/YYYY-MM-DD/index.html 또는 실제 날짜 index.html', pattern: /newsletters\/(?:YYYY-MM-DD|\d{4}-\d{2}-\d{2})\/index\.html/ },
    { label: 'data/newsletters.json', pattern: /data\/newsletters\.json/ },
    { label: '기사 품질 정책 src/core/config/newsletter-policy.json', pattern: /src\/core\/config\/newsletter-policy\.json/ },
    { label: '확인한 사실', pattern: /확인한 사실/ },
    { label: '배경지식', pattern: /배경지식/ },
    { label: 'Camera HAL 관점', pattern: /Camera HAL(?:\s*\/\s*Driver)? 관점|Camera HAL/i },
    { label: '실행 항목', pattern: /실행 항목/ },
    { label: '팀 공유 포인트', pattern: /팀 공유 포인트/ },
    { label: 'TODO 없음', pattern: /TODO/ },
    { label: 'Sources 또는 출처', pattern: /Sources|출처/ },
    { label: 'References 또는 참고자료', pattern: /References|참고자료/ },
    { label: 'source gap', pattern: /source gap/i },
    { label: 'fact-check must_fix', pattern: /fact-check must_fix|must_fix/i },
    { label: 'watch/reference page dated evidence', pattern: /watch\/reference page|dated evidence/i }
  ], '뉴스레터 발행 PR', errors);
  validateValidationCommands(extractSubsection(body, 'Validation'), '뉴스레터 발행 PR', errors);
  return {
    ok: errors.length === 0,
    errors,
    bodyKind: options.bodyKind || 'newsletter-template'
  };
}

function validateCodeDocsTemplateBodyText(text, options = {}) {
  text = toText(text);
  const errors = [];
  const sections = extractSections(text);
  const count = exactHeadingCount(text, 2, '코드 / 문서 / 리팩토링 PR');
  if (count !== 1) {
    errors.push(`코드/문서/리팩토링 PR body에는 "## 코드 / 문서 / 리팩토링 PR" heading이 정확히 하나 필요합니다. 현재 ${count}개입니다.`);
  }
  const body = sectionByHeading(sections, ['코드 / 문서 / 리팩토링 PR']);
  if (!body) {
    errors.push('코드/문서/리팩토링 PR body 내용을 찾을 수 없습니다.');
    return { ok: false, errors };
  }
  validateRequiredSubheadings(body, [
    'Scope',
    'Code safety',
    'Docs',
    'Validation'
  ], '코드/문서/리팩토링 PR', errors);
  validateRequiredPatterns(body, [
    { label: '한 관심사만 담기', pattern: /한 관심사/ },
    { label: 'generated artifact 불필요 수정 금지', pattern: /generated artifact를 불필요하게 수정하지 않았다/ },
    { label: 'unrelated cleanup 금지', pattern: /unrelated cleanup/ },
    { label: 'quality gate, hard blocker, source binding 보호', pattern: /quality gate, hard blocker, source binding.+약화하지 않았다/ },
    { label: 'qualityGatePolicy.threshold 설명', pattern: /qualityGatePolicy\.threshold/ },
    { label: 'qualityGatePolicy.hardFailConditions regression test', pattern: /qualityGatePolicy\.hardFailConditions/ },
    { label: 'final_publish_ready 검증', pattern: /final_publish_ready/ },
    { label: 'artifact_final_publish_ready 검증', pattern: /artifact_final_publish_ready/ },
    { label: 'workflow 동작 변경 test', pattern: /workflow 동작 변경/ },
    { label: 'compatibility wrapper/shim 보호', pattern: /compatibility wrapper\/shim/ },
    { label: 'README / AGENTS / docs 충돌 확인', pattern: /README \/ AGENTS \/ docs/ },
    { label: 'archive 문서 주의', pattern: /archive 문서/ }
  ], '코드/문서/리팩토링 PR', errors);
  validateValidationCommands(extractSubsection(body, 'Validation'), '코드/문서/리팩토링 PR', errors);
  return {
    ok: errors.length === 0,
    errors,
    bodyKind: options.bodyKind || 'code-docs-template'
  };
}

function parseArgs(argv) {
  const options = {};
  let filePath = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--root') {
      options.root = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--type') {
      options.type = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--require-publish-status-consistency') {
      options.requirePublishStatusConsistency = true;
    } else if (!filePath) {
      filePath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { filePath, options };
}

function validateGeneratedNewsletterBodyText(text, options = {}) {
  text = toText(text);
  const errors = [];
  const sections = extractSections(text);
  const generationStatusCount = countMatches(text, /^## 생성 상태$/gm);
  if (generationStatusCount !== 1) {
    errors.push(`PR body must contain exactly one "## 생성 상태" heading, found ${generationStatusCount}.`);
  }

  for (const heading of FORBIDDEN_ENGLISH_HEADINGS) {
    if (text.includes(heading)) {
      errors.push(`PR body must not contain English heading: ${heading}`);
    }
  }

  const statusSection = extractStatusSection(text);
  if (!statusSection) {
    errors.push('PR body is missing 생성 상태 section.');
    return { ok: false, errors };
  }

  const parsed = parseStatusSection(statusSection);
  validateEditorPrSummaryContract(text, parsed, errors);
  const diagnosticsOnly = isDiagnosticsOnlyBody(text);
  const reviewPublication = isReviewPublicationBody(text);
  const candidateShortage = isCandidateShortageBody(text);
  const fallbackPublicPublication = /(?:^|\n)\s*-?\s*publication_mode\s*[:=]\s*fallback_public\b/i.test(concretePublicationStateText(text));
  if (diagnosticsOnly && reviewPublication) {
    errors.push('PR body must not be both diagnostics_only and review_publication_ready.');
  }
  if (diagnosticsOnly) {
    validateDiagnosticsOnlyContract(text, parsed, errors);
  }
  if (reviewPublication) {
    validateReviewPublicationContract(text, parsed, errors);
  }
  if (candidateShortage) {
    if (!/^## Candidate Pool Preflight\s*$/m.test(text)) {
      errors.push('candidate_shortage_reviewable PR body must include Candidate Pool Preflight section.');
    }
    if (!/LLM editor generation was skipped because candidate pool was insufficient\./.test(text)) {
      errors.push('candidate_shortage_reviewable PR body must state that LLM editor generation was skipped.');
    }
  }
  if (parsed.consistencyErrors !== 'none') {
    errors.push(`PR body has consistency_errors: ${parsed.consistencyErrors || 'missing'}`);
  }
  if (parsed.overallStatus === 'PASS' && parsed.finalPublishReady === false) {
    errors.push('전체 상태 is PASS while final_publish_ready is false.');
  }
  if (
    (parsed.overallStatus === 'PASS' || parsed.finalPublishReady === true) &&
    /\b(?:FAILED|NEEDS_FIX)\b/.test(statusSection)
  ) {
    errors.push('생성 상태 summary mixes PASS with FAILED/NEEDS_FIX.');
  }

  const patterns = publicArtifactPatterns(options.date);
  const generatedArtifactsSection = sectionByHeading(sections, ['생성 산출물', LEGACY_GENERATED_ARTIFACTS_HEADING]);
  if (!generatedArtifactsSection) {
    errors.push('PR body must contain generated artifacts section.');
  }
  validateEditorialDecisionSummarySection(text, sections, errors);
  validateCandidateTraceSection(text, sections, {
    ...options,
    allowMissingReporterCandidates: candidateShortage
  }, errors);
  validateHomepageHeadlineDesignReview(text, sections, errors, {
    required: options.requireHomepageHeadlineDesignReview === true
  });
  validateEvidencePackSections(text, sections, parsed, errors);
  if (!diagnosticsOnly && /생성하지 않은 public 산출물|not generated|not updated/.test(text)) {
    errors.push('Newsletter PR body must not describe public newsletter files as not generated or not updated.');
  }
  if (!diagnosticsOnly && !fallbackPublicPublication && parsed.finalPublishReady === false && !/public newsletter files는 생성되었습니다/.test(text)) {
    errors.push('final_publish_ready=false PR body must state that public newsletter files were generated for editor-approved merge.');
  }

  if (parsed.finalPublishReady === true) {
    if (parsed.qualityStatus !== 'PASS') {
      errors.push(`final_publish_ready is true but 품질 상태 is ${parsed.qualityStatus || 'missing'}.`);
    }
    if (parsed.factCheckStatus !== 'PASS') {
      errors.push(`final_publish_ready is true but 팩트체크 상태 is ${parsed.factCheckStatus || 'missing'}.`);
    }
    if (parsed.mustFixCount !== 0) {
      errors.push(`final_publish_ready is true but must_fix_count is ${parsed.mustFixCount ?? 'missing'}.`);
    }
    if (parsed.sourceGapCount !== 0) {
      errors.push(`final_publish_ready is true but source_gap_count is ${parsed.sourceGapCount ?? 'missing'}.`);
    }
    if (parsed.staleClaimStatus === 'NEEDS_FIX') {
      errors.push('final_publish_ready is true but Stale claim 상태 is NEEDS_FIX.');
    }
    if (parsed.staleClaimHardFailureCount !== 0) {
      errors.push(`final_publish_ready is true but stale hard failure count is ${parsed.staleClaimHardFailureCount ?? 'missing'}.`);
    }
    if (parsed.validateOutcome !== 'success') {
      errors.push(`final_publish_ready is true but 검증 결과 is ${parsed.validateOutcome || 'missing'}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    bodyKind: options.bodyKind || 'generated-newsletter'
  };
}

function validatePrBodyText(text, options = {}) {
  text = toText(text);
  const resolved = resolveBodyKind(text, options.type);
  const common = {
    bodyKind: resolved.bodyKind,
    detectedKind: resolved.detectedKind,
    requestedType: resolved.requestedType
  };

  if (resolved.bodyKind === 'invalid-type') {
    return {
      ok: false,
      errors: [`PR body --type 값이 올바르지 않습니다: ${resolved.requestedType}. 허용값: ${[...REQUESTED_TYPES].join(', ')}.`],
      ...common
    };
  }
  if (resolved.bodyKind === 'type-mismatch') {
    return {
      ok: false,
      errors: [`PR body type 불일치: --type ${resolved.requestedType} 요청은 현재 body kind ${bodyKindLabel(resolved.detectedKind)}와 맞지 않습니다.`],
      ...common
    };
  }
  if (resolved.bodyKind === 'ambiguous') {
    return {
      ok: false,
      errors: [`PR body 유형이 모호합니다. 여러 유형 heading이 함께 있습니다: ${resolved.detectedKinds.map(bodyKindLabel).join(', ')}.`],
      ...common
    };
  }
  if (resolved.bodyKind === 'root-selector') {
    return {
      ok: false,
      errors: ['PR body가 루트 선택 안내 template입니다. 뉴스레터 발행 또는 코드/문서/리팩토링 template을 선택해 한글 PR body를 작성해야 합니다.'],
      ...common
    };
  }
  if (resolved.bodyKind === 'unknown') {
    return {
      ok: false,
      errors: ['PR body 유형을 판정할 수 없습니다. "## 생성 상태", "## 뉴스레터 발행 PR", "## 코드 / 문서 / 리팩토링 PR" 중 하나가 필요합니다.'],
      ...common
    };
  }
  if (resolved.bodyKind === 'generated-newsletter') {
    return {
      ...validateGeneratedNewsletterBodyText(text, {
        ...options,
        bodyKind: resolved.bodyKind
      }),
      ...common
    };
  }
  if (resolved.bodyKind === 'newsletter-template') {
    return {
      ...validateNewsletterTemplateBodyText(text, {
        ...options,
        bodyKind: resolved.bodyKind
      }),
      ...common
    };
  }
  if (resolved.bodyKind === 'code-docs-template') {
    return {
      ...validateCodeDocsTemplateBodyText(text, {
        ...options,
        bodyKind: resolved.bodyKind
      }),
      ...common
    };
  }
  return {
    ok: false,
    errors: [`지원하지 않는 PR body kind입니다: ${bodyKindLabel(resolved.bodyKind)}.`],
    ...common
  };
}

function validatePrBodyFile(filePath, options = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  const result = validatePrBodyText(text, {
    requireHomepageHeadlineDesignReview: true,
    ...options
  });
  if (options.requirePublishStatusConsistency === true && result.bodyKind !== 'generated-newsletter') {
    result.errors.push('--require-publish-status-consistency는 자동 생성 뉴스레터 PR body(generated-newsletter)에서만 사용할 수 있습니다.');
    result.ok = false;
    return result;
  }
  const shouldValidatePublishStatus = result.bodyKind === 'generated-newsletter' &&
    (options.date || options.requirePublishStatusConsistency === true);
  if (shouldValidatePublishStatus) {
    const resolved = resolvePublishStatus(options);
    if (resolved.consistencyErrors.length > 0) {
      result.errors.push(`Artifact consistency errors: ${resolved.consistencyErrors.join('; ')}`);
      result.ok = false;
    }
  }
  return result;
}

function main() {
  const { filePath, options } = parseArgs(process.argv.slice(2));
  if (!filePath) {
    console.error('Usage: node src/generator/publish/validate-pr-body.js <pr-body.md> [--type auto|newsletter|code-docs] [--date YYYY-MM-DD] [--root <repo-root>] [--require-publish-status-consistency]');
    process.exit(1);
  }
  const result = validatePrBodyFile(filePath, options);
  if (!result.ok) {
    console.error(result.errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log('Validated PR body.');
}

if (require.main === module) {
  main();
}

module.exports = {
  detectBodyKind,
  extractSections,
  extractStatusSection,
  hasHeading,
  parseStatusSection,
  resolveBodyKind,
  validatePrBodyFile,
  validateGeneratedNewsletterBodyText,
  validatePrBodyText
};
