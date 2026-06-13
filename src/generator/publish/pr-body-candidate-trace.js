const fs = require('fs');
const path = require('path');

const {
  ensureArray
} = require('./publish-status');
const {
  loadNewsroomJson
} = require('./pr-body-artifacts');
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

const TRACE_ARTIFACT_DEFS = [
  { key: 'reporter', path: date => `articles/content/newsroom/${date}/reporter-candidates.json` },
  { key: 'shortlist', path: date => `articles/content/newsroom/${date}/shortlisted-candidates.json` },
  { key: 'collected', path: date => `articles/content/collected-news/${date}/candidates.json` },
  { key: 'quality', path: date => `articles/content/newsroom/${date}/quality-report.json` },
  { key: 'factCheck', path: date => `articles/content/newsroom/${date}/fact-check-report.json` }
];

const REPORT_ONLY_STATUSES = new Set(['quality_fail', 'factcheck_fail']);

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

function normalizeEventBundleTraceUrlKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    const preserveHash = parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera' &&
      /^#(?:camera-[a-z0-9-]+-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(parsed.hash);
    if (!preserveHash) parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch (_) {
    return text.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function extractCandidateDate(candidate) {
  return firstText([candidate?.published_date, candidate?.publishedAt, candidate?.date, candidate?.source_date]);
}

function extractCandidateScore(candidate) {
  const value = candidate?.deterministic_score ??
    candidate?.score_breakdown?.total ??
    candidate?.relevance_score ??
    candidate?.score;
  return value === null || value === undefined || value === '' ? 'n/a' : value;
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

function traceStatusRank(status) {
  return TRACE_STATUS_RANK[status] || 99;
}

function shouldReplaceTraceStatus(target, incoming) {
  const incomingStatus = incoming.status || 'unknown';
  const targetStatus = target.status || 'unknown';

  if (incomingStatus === 'final_selected') return true;
  if (targetStatus === 'final_selected') return false;

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

function buildTraceIndex(artifacts, issues) {
  const index = { candidates: [], keyToCandidate: new Map() };
  const shortlist = artifacts.shortlist.value;
  const reporter = artifacts.reporter.value;
  const collected = artifacts.collected.value;

  pushArtifactCandidates(index, shortlist, 'primary_selected_articles', 'primary_selected', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'selected_articles', 'final_selected', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'shortlisted_candidates', '', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'reserve_candidates', 'reserve', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'demoted_candidates', 'demoted', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, shortlist, 'excluded_candidates', 'excluded', 'shortlist', issues, artifacts.shortlist.relPath);
  pushArtifactCandidates(index, reporter, 'candidates', '', 'reporter', issues, artifacts.reporter.relPath);
  pushArtifactCandidates(index, collected, 'candidates', '', 'collected', issues, artifacts.collected.relPath);

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
  const reason = firstText([
    item?.reason,
    item?.problem,
    item?.message,
    ensureArray(item?.hard_fail_reasons).join('; '),
    ensureArray(item?.soft_deductions).map(entry => entry.reason || entry.category).join('; ')
  ]) || 'no explicit reason';
  const reasonCode = firstText([item?.reason_code, item?.reasonCode]);
  return reasonCode ? `${reasonCode}: ${reason}` : reason;
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

function eventBundleArtifact(root, date) {
  return loadNewsroomJson(root, date, 'event-bundles.json');
}

function eventBundleRowsForFinalCandidates(root, date, finalCandidates = []) {
  const artifact = eventBundleArtifact(root, date);
  const bundles = ensureArray(artifact?.event_bundles);
  if (bundles.length === 0 || finalCandidates.length === 0) return null;

  const candidateByUrl = new Map();
  for (const candidate of finalCandidates) {
    const candidateUrls = ensureArray(candidate.urls);
    for (const url of candidateUrls.length > 0 ? candidateUrls : [candidate.url]) {
      for (const key of [normalizeUrlKey(url), normalizeEventBundleTraceUrlKey(url)].filter(Boolean)) {
        candidateByUrl.set(key, candidate);
      }
    }
  }

  const rows = [];
  for (const bundle of bundles) {
    const candidate = candidateByUrl.get(normalizeUrlKey(bundle.primary_url)) ||
      candidateByUrl.get(normalizeEventBundleTraceUrlKey(bundle.primary_url));
    if (!candidate) continue;
    const evidenceUrls = ensureArray(bundle.evidence_urls);
    const evidenceSummary = evidenceUrls.length > 0
      ? evidenceUrls.slice(0, 3).join('; ')
      : 'none';
    const omittedEvidence = evidenceUrls.length > 3 ? `; +${evidenceUrls.length - 3} more` : '';
    rows.push([
      String(rows.length + 1),
      formatCandidateLink(candidate),
      `${evidenceSummary}${omittedEvidence}`,
      `${bundle.event_id || 'event_unknown'} / ${bundle.event_type || 'unknown'} / ${bundle.dedupe_reason || 'unknown'} / confidence=${bundle.confidence || 'unknown'}`
    ]);
  }
  return rows;
}

function renderEventBundleTrace(root, date, finalCandidates = []) {
  const artifact = eventBundleArtifact(root, date);
  if (!artifact) return '';
  const rows = eventBundleRowsForFinalCandidates(root, date, finalCandidates) || [];
  return [
    '### Event Bundle 추적',
    '',
    rows.length > 0
      ? renderMarkdownTable(
        ['#', 'Primary article', 'Followed evidence', 'Event Bundle'],
        rows
      )
      : '- none',
    '',
    '상세 artifact:',
    `- \`articles/content/newsroom/${date}/event-bundles.json\``,
    `- \`articles/content/newsroom/${date}/event-bundle-diagnostics.md\``,
    ''
  ].join('\n');
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
  const eventBundleTrace = renderEventBundleTrace(root, date, finalCandidates);

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
    eventBundleTrace,
    '### 상세 artifact',
    '',
    ...detailPaths.map(relPath => `- \`${relPath}\``),
    ''
  );

  return lines.join('\n');
}

module.exports = {
  TRACE_ARTIFACT_DEFS,
  REPORT_ONLY_STATUSES,
  normalizeUrlKey,
  normalizeEventBundleTraceUrlKey,
  extractCandidateDate,
  extractCandidateScore,
  candidateKeys,
  normalizeTraceCandidate,
  traceStatusRank,
  shouldReplaceTraceStatus,
  mergeTraceCandidate,
  addTraceCandidate,
  readTraceJson,
  loadCandidateTraceArtifacts,
  pushArtifactCandidates,
  buildTraceIndex,
  assignCandidateIds,
  matchCandidateForReport,
  promoteReportOnlyStatus,
  reportItemTitle,
  reportItemReason,
  addReportLink,
  buildQualityFactcheckLinks,
  candidateReasonCells,
  renderCandidateRows,
  eventBundleArtifact,
  eventBundleRowsForFinalCandidates,
  renderEventBundleTrace,
  renderCandidateTraceability
};
