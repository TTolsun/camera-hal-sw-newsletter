'use strict';

// 직전 주 scheduled coverage run이 남긴 not_yet_eligible 후보(Task 8, coverage 경계 밖이라 이번
// 호 대상이 아니었던 원시 후보)를 이번 수집 풀에 합류시키기 위한 lineage 선택 + status 판정.
//
// 여기서 만든 후보 목록은 그대로 최종 candidates가 아니다 — 원시(raw) 상태 그대로이므로,
// main()이 live 후보 뒤에 append한 뒤 기존 필터 체인(dedupe → coverage 분리 → withinLookback →
// relevance → rank → cap)을 다시 통과시켜야 한다. dedupe가 배열 앞쪽을 우선하므로(first-win),
// live 후보 뒤에 carry를 붙이면 같은 URL/제목이 있을 때 항상 live가 이긴다.
//
// status 계약(payload에 기록만 한다 — review-only 게이트 연결은 별도 태스크 소관):
//   not_applicable  — 직전 주 coverage의 merged-candidates가 없다(첫 실행·도입 이전·결번 등
//                      "애초에 그 주가 존재한 적이 없다"는 뜻). 스캔 도중 파싱 실패도 없었다.
//   missing_expected — merged-candidates는 없지만 직전 주 run 흔적(newsroom generation-status.json의
//                      coverage_week_key)은 있다. 실행은 됐는데 산출물이 없다는 뜻이라 더 심각하다.
//   invalid         — lineage 매치가 성사된 뒤 not_yet_eligible 스키마가 깨졌거나, override
//                      대상 파일이 파싱 안 되거나, **자동 스캔에서 매치는 없었는데 파싱 실패한
//                      파일이 하나라도 있었던 경우**(fix round 1 — 그 파일이 실제 직전 주
//                      원천이었을 가능성을 배제할 수 없어 not_applicable로 침묵시키지 않는다).
//                      마지막 경우는 carry_source.scan_parse_failures에 실패 경로를 남긴다.
//   loaded          — 정상 로드(빈 목록도 loaded다 — "직전 주에 넘길 후보가 없었다"는 정상
//                      결과다). 스캔 도중 다른 날짜에서 파싱 실패가 있었더라도 매치를 찾았다면
//                      loaded이고, carry_source.scan_parse_failures에 그 실패 경로들을
//                      diagnostics로만 남긴다(선택에는 영향 없음).
//
// 정상 원천은 committed merged-candidates.json뿐이다 — 상한 초과 시에만 남는 진단용 overflow
// 파일(.tmp/not-yet-eligible-full-<date>.json)은 여기서 절대 읽지 않는다.

const nodeFs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { previousCoverageWeekKey } = require('../common/coverage-week');

const COLLECTED_NEWS_REL_DIR = path.join('articles', 'content', 'collected-news');
const NEWSROOM_REL_DIR = path.join('articles', 'content', 'newsroom');
const MERGED_CANDIDATES_FILENAME = 'merged-candidates.json';
const GENERATION_STATUS_FILENAME = 'generation-status.json';

function toPosixRelPath(root, absPath) {
  return path.relative(root, absPath).split(path.sep).join('/');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function listSubDirNames(fs, dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

// 존재하지 않음/읽기 실패/파싱 실패를 구분해서 돌려준다 — 세 경우가 status 판정에서 서로 다른
// 의미를 갖는다(없음=lineage 후보 아님, 파싱 실패=invalid).
function readJsonSafe(fs, filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, missing: true };
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return { ok: true, value: JSON.parse(raw), raw };
  } catch (error) {
    return { ok: false, missing: false, raw, error };
  }
}

// not_yet_eligible 목록의 최소 계약: 배열이어야 하고, 각 원소는 url·title을 가진 객체여야 한다
// (normalizeCandidate 산출물 원형을 Task 8이 그대로 기록한 값). 캡·랭킹·selection 파생 필드는
// 여기서 검사하지 않는다 — main()의 기존 필터 체인이 그 값들을 처음부터 다시 계산하므로,
// 여기서 강제하면 재평가 취지에 어긋나는 이중 검증이 된다.
function isValidNotYetEligibleList(list) {
  if (!Array.isArray(list)) return false;
  return list.every(item => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
    const url = item.url || item.articleUrl || item.article_url || '';
    return String(url).trim() !== '' && String(item.title || '').trim() !== '';
  });
}

function isValidCarryPayload(payload) {
  return payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    isValidNotYetEligibleList(payload.not_yet_eligible);
}

function carrySourceFrom(root, absPath, raw, runMode) {
  return {
    path: toPosixRelPath(root, absPath),
    sha256: sha256(raw),
    run_mode: runMode || ''
  };
}

// override 경로(저장소 상대 또는 절대 경로)를 단일 원천으로 강제 사용한다. run_mode/
// coverage_week_key 일치 여부는 보지 않는다 — 운영자가 명시적으로 고른 경로이므로 자동 lineage
// 규칙이 끼어들 이유가 없다(Task 6 carrySourcePathOverride 계약).
function loadFromOverride(fs, root, overridePath) {
  const absPath = path.isAbsolute(overridePath) ? overridePath : path.join(root, overridePath);
  const read = readJsonSafe(fs, absPath);
  if (!read.ok) {
    if (read.missing) return { status: 'not_applicable', candidates: [], carrySource: null };
    return { status: 'invalid', candidates: [], carrySource: null };
  }
  const runMode = read.value && typeof read.value === 'object' ? read.value.run_mode : '';
  if (!isValidCarryPayload(read.value)) {
    return { status: 'invalid', candidates: [], carrySource: carrySourceFrom(root, absPath, read.raw, runMode) };
  }
  return {
    status: 'loaded',
    candidates: read.value.not_yet_eligible,
    carrySource: carrySourceFrom(root, absPath, read.raw, runMode)
  };
}

// 자동 lineage 선택: collected-news/*/merged-candidates.json 중 coverage.coverage_week_key가
// 직전 주와 같고 run_mode가 scheduled인 것만 후보로 본다. 복수면 generation_anchor_date
// 최신(YYYY-MM-DD 문자열이라 사전순 비교로 충분)을 고른다.
//
// 파싱 실패한 날짜 폴더는 스캔을 멈추지 않고 계속 진행하되, 경로를 parseFailures에 모아둔다
// (fix round 1). 그 폴더가 coverage_week_key/run_mode를 읽을 수조차 없어 이 스캔 안에서는
// "lineage 매치였는지" 판정할 수 없지만, 최종 판정을 조용히 not_applicable로 흘려보내면 실제
// 직전 주 원천이 손상된 경우를 영구히 침묵시킨다(03단계가 아직 안 도는 주라 generation-status
// 흔적조차 없는 경우가 특히 그렇다). 그래서 호출부(loadCarryForward)가 "매치가 없는데 파싱
// 실패가 하나라도 있었다"를 invalid로 승격한다 — 여기서는 사실(무엇이 실패했는지)만 모으고
// 판정은 호출부에 맡긴다.
function findLineageCandidates(fs, root, previousWeekKey) {
  const collectedNewsDir = path.join(root, COLLECTED_NEWS_REL_DIR);
  const dateDirs = listSubDirNames(fs, collectedNewsDir);
  const matches = [];
  const parseFailures = [];
  for (const dateDir of dateDirs) {
    const filePath = path.join(collectedNewsDir, dateDir, MERGED_CANDIDATES_FILENAME);
    const read = readJsonSafe(fs, filePath);
    if (!read.ok) {
      if (!read.missing) parseFailures.push(toPosixRelPath(root, filePath));
      continue;
    }
    const payload = read.value;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
    const weekKey = payload.coverage && payload.coverage.coverage_week_key;
    if (weekKey !== previousWeekKey || payload.run_mode !== 'scheduled') continue;
    matches.push({ filePath, payload, raw: read.raw, anchor: String(payload.generation_anchor_date || '') });
  }
  matches.sort((a, b) => a.anchor.localeCompare(b.anchor));
  return {
    match: matches.length > 0 ? matches[matches.length - 1] : null,
    parseFailures
  };
}

// 직전 주 run 흔적 탐지: newsroom/*/generation-status.json 중 coverage_week_key가 직전 주와
// 같은 것이 하나라도 있으면 "실행은 됐는데 merged-candidates 산출물이 없다"는 뜻이므로
// missing_expected로, 하나도 없으면 애초에 그 주가 존재한 적이 없다는 뜻이므로 not_applicable로
// 본다.
function hasGenerationStatusForWeek(fs, root, previousWeekKey) {
  const newsroomDir = path.join(root, NEWSROOM_REL_DIR);
  const dateDirs = listSubDirNames(fs, newsroomDir);
  for (const dateDir of dateDirs) {
    const filePath = path.join(newsroomDir, dateDir, GENERATION_STATUS_FILENAME);
    const read = readJsonSafe(fs, filePath);
    if (!read.ok) continue;
    if (read.value && read.value.coverage_week_key === previousWeekKey) return true;
  }
  return false;
}

// loadCarryForward({root, coverage, carrySourcePathOverride, fs}) -> {status, candidates, carrySource}
function loadCarryForward({ root, coverage, carrySourcePathOverride = '', fs = nodeFs } = {}) {
  const previousWeekKey = previousCoverageWeekKey(coverage.coverage_week_key);
  const override = String(carrySourcePathOverride || '').trim();

  if (override) return loadFromOverride(fs, root, override);

  const { match: lineage, parseFailures } = findLineageCandidates(fs, root, previousWeekKey);

  if (!lineage) {
    // 매치는 없는데 스캔 도중 파싱 실패가 하나라도 있었다면, 그 파일이 실제 직전 주 원천이었을
    // 가능성을 배제할 수 없다 — generation-status 흔적이 없는 주(03단계 미실행)라면
    // missing_expected로도 안 걸리므로, 조용히 not_applicable로 넘기지 않고 invalid로 승격해
    // 실패 경로를 diagnostics에 남긴다(fix round 1).
    if (parseFailures.length > 0) {
      return { status: 'invalid', candidates: [], carrySource: { scan_parse_failures: parseFailures } };
    }
    const status = hasGenerationStatusForWeek(fs, root, previousWeekKey) ? 'missing_expected' : 'not_applicable';
    return { status, candidates: [], carrySource: null };
  }

  const matchedCarrySource = {
    ...carrySourceFrom(root, lineage.filePath, lineage.raw, lineage.payload.run_mode),
    scan_parse_failures: parseFailures
  };

  if (!isValidCarryPayload(lineage.payload)) {
    return { status: 'invalid', candidates: [], carrySource: matchedCarrySource };
  }

  return {
    status: 'loaded',
    candidates: lineage.payload.not_yet_eligible,
    carrySource: matchedCarrySource
  };
}

// 이번 run 자체가 만든 not_yet_eligible_overflow(Task 8)가 켜져 있으면, 그것이 로드 상태보다
// 더 심각한 신호이므로 payload에 기록할 최종 carry_forward_status는 무조건 'overflow'다 —
// 로드가 정상(loaded)이었어도 이번 run이 다음 실행에 넘길 목록 자체가 상한을 넘겨 잘렸다면,
// 게이트가 봐야 할 것은 그 사실이다.
function resolveCarryForwardStatus({ status, overflow }) {
  return overflow ? 'overflow' : status;
}

module.exports = {
  loadCarryForward,
  resolveCarryForwardStatus
};
