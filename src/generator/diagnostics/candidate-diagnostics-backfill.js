'use strict';

const fs = require('fs');
const path = require('path');

const { ensureArray } = require('../../shared/common/value-coercion');
const { mergedCandidatesPath, collectedCandidatesPath } = require('../../shared/common/artifact-paths');
const { buildShortlistReport } = require('../select/newsroom-selection');
const { buildCandidateDiagnostics } = require('../select/selection-candidate-projection');
const { readExposureHistory } = require('../reporter/article-exposure-history');

// 과거 날짜의 후보별 선정 진단을 커밋된 아티팩트에서 다시 만든다.
//
// 왜: selection-report.json의 candidate_diagnostics는 앞으로의 run에만 생긴다. 과거 주를
// 분석하려면 주에 하나씩 쌓기를 기다려야 하는데, 판정 가능한 표본이 모이는 데 몇 달이 걸린다.
// 선정은 결정론이고 입력이 전부 커밋돼 있으므로 지금 다시 계산할 수 있다.
//
// 무엇을 만들지 않는가: 발행 아티팩트를 고치지 않는다. 과거 selection-report.json을 덮어쓰면
// 그때 파이프라인이 실제로 기록한 값이 사라진다. 출력은 호출부가 지정한 경로에만 쓴다.

// 재구성은 '그 주에 선정이 내린 판단'이 아니라 '지금 선정 로직이 내릴 판단'이다.
// 그 사이 선정 코드가 바뀌었으면 결과가 다르다. 읽는 쪽이 둘을 혼동하지 않게 출력에 명시한다.
const BACKFILL_NOTE =
  '커밋된 후보 풀에 현재 선정 로직을 다시 돌린 결과다. 그 주에 파이프라인이 실제로 기록한 '
  + '판단이 아니므로 과거 발행 이력과 직접 비교하지 말 것.';

// 재심 프롬프트가 쓰는 필드만 싣는다. merged-candidates.json은 주당 1MB라 통째로 실으면
// 백필 산출물이 원본만큼 커진다.
const CANDIDATE_BODY_FIELDS = Object.freeze([
  'title',
  'summary',
  'api_or_component',
  'version_or_release',
  'behavior_change',
  'source_name'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function candidateUrl(candidate = {}) {
  return text(candidate.normalized_url) || text(candidate.url) || text(candidate.article_url);
}

/**
 * 노출 이력을 기준 날짜 시점으로 자른다.
 *
 * 자르지 않으면 그 주보다 **나중에** 발행된 기사가 '이미 다뤘음'으로 걸러져, 과거 주
 * 재구성이 그때 있지도 않았던 이력에 막힌다(재게재 쿨다운의 cooldown_until은 미래 레코드일수록
 * 더 늦어서 asOf 검사를 그대로 통과한다). 백필에서만 필요한 보정이다 — 정상 run은 언제나
 * 현재가 기준이라 잘라 낼 미래가 없다.
 */
function asOfExposureHistory(history, anchorDate) {
  const asOf = text(anchorDate);
  if (!history || !asOf) return history;
  return {
    ...history,
    articles: ensureArray(history.articles).filter(record => {
      const recordDate = text(record?.newsletter_date);
      // 날짜를 모르는 레코드는 남긴다. 지우면 실제로 있던 차단을 없애는 쪽으로 틀린다.
      return recordDate === '' || recordDate <= asOf;
    })
  };
}

function weeklyKeyForDate(root, date) {
  const dir = path.join(root, 'articles', 'newsletters');
  if (!fs.existsSync(dir)) return '';
  for (const name of fs.readdirSync(dir)) {
    if (!/^\d{4}-W\d{2}$/.test(name)) continue;
    const issuePath = path.join(dir, name, 'issue.json');
    if (!fs.existsSync(issuePath)) continue;
    const issue = readJson(issuePath);
    if (text(issue.week_start_date) === date || text(issue.generation_anchor_date) === date) return name;
  }
  return '';
}

function compactBodies(candidates) {
  const bodies = [];
  for (const candidate of ensureArray(candidates)) {
    const url = candidateUrl(candidate);
    if (!url) continue;
    const body = { url };
    for (const field of CANDIDATE_BODY_FIELDS) {
      const value = text(candidate[field]);
      if (value) body[field] = value;
    }
    bodies.push(body);
  }
  return bodies;
}

function poolPathFor(root, date) {
  for (const resolve of [mergedCandidatesPath, collectedCandidatesPath]) {
    const candidatePath = resolve(root, date);
    if (fs.existsSync(candidatePath)) return candidatePath;
  }
  return '';
}

/**
 * @param {object} params
 * @param {string} params.root 저장소 루트
 * @param {string} params.date YYYY-MM-DD
 * @returns {object} shadow 재심 입력 계약 형태
 */
function backfillCandidateDiagnostics({ root, date }) {
  const poolPath = poolPathFor(root, date);
  if (!poolPath) throw new Error(`후보 풀 아티팩트가 없음: ${date}`);

  const pool = readJson(poolPath);
  const exposureHistory = asOfExposureHistory(readExposureHistory(root, date), date);
  const shortlistReport = buildShortlistReport(date, pool.candidates, {
    root,
    exposureHistory,
    coverageWeekKeyOverride: text(pool.coverage?.coverage_week_key)
  });
  const diagnostics = buildCandidateDiagnostics(shortlistReport);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    anchor_date: date,
    weekly_key: weeklyKeyForDate(root, date),
    backfill: {
      note: BACKFILL_NOTE,
      pool_artifact: path.relative(root, poolPath).split(path.sep).join('/'),
      exposure_history_as_of: date,
      exposure_records_used: ensureArray(exposureHistory?.articles).length
    },
    candidate_score_threshold: diagnostics.score_threshold,
    candidate_diagnostics: diagnostics.rows,
    candidate_diagnostics_count: diagnostics.count,
    candidate_diagnostics_not_evaluated: diagnostics.not_evaluated,
    candidates: compactBodies(pool.candidates)
  };
}

function backfillDates(root) {
  const dir = path.join(root, 'articles', 'content', 'collected-news');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .filter(name => poolPathFor(root, name) !== '')
    .sort();
}

module.exports = {
  backfillCandidateDiagnostics,
  backfillDates,
  asOfExposureHistory,
  BACKFILL_NOTE,
  CANDIDATE_BODY_FIELDS
};
