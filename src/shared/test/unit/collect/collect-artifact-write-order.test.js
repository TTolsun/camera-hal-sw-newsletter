// collect(01) 산출물 기록과 심층(deep-dive) 적립의 순서 계약.
//
// 적립은 선택 부가 기능이지만 큐 파일이 손상되면 throw한다(불변식 3: 구현 오류를 콘텐츠
// 실패로 위장하지 않는다). 예전 배선은 적립을 후보 artifact 기록 **앞에** 두어서, 손상된
// 큐 하나로 그날의 후보·매니페스트·markdown이 통째로 디스크에 남지 않았다. 이 테스트는
// 두 가지를 함께 고정한다: (1) 산출물은 먼저 기록되어 살아남는다, (2) 그래도 오류는
// 그대로 전파된다(조용한 skip으로 바꾸지 않는다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  writeCollectArtifactsThenAccrueDeepDiveTopics
} = require('../../../cli/collect-news-candidates');
const {
  CANDIDATE_SCHEMA_VERSION
} = require('../../../common/candidate-artifacts');
const {
  collectedCandidatesPath,
  manualCandidatesPath,
  newsroomDir,
  rawCandidateManifestPath
} = require('../../../common/artifact-paths');
const {
  DEEP_DIVE_QUEUE_REL_PATH,
  loadDeepDiveTopicQueue
} = require('../../../collect/deep-dive-topic-queue');
const { tempRoot } = require('../../helpers/fs');

const DATE = '2026-08-17';

// 강등된 direct_aosp_camera 후보 — 적립원 1번이라 정상 경로에서는 큐에 실제로 쌓인다
// (적립이 아무것도 안 해서 우연히 통과하는 거짓 통과를 막는다).
function demotedCameraCandidate() {
  return {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    title: 'Camera ITS 릴리스 노트 갱신',
    source: 'AOSP Camera ITS',
    source_url: 'https://source.android.com/docs/compatibility/cts/camera-its-box',
    url: 'https://source.android.com/docs/compatibility/cts/its-release-notes-17',
    section: 'Android / AOSP / Camera',
    summary: 'Camera ITS 릴리스 노트가 갱신됐습니다.',
    publishedAt: '2026-08-14',
    relevance_bucket: 'direct_aosp_camera',
    finalSelectionEligibility: 'watchlist',
    hasDatedEvidence: true
  };
}

function candidatePayload(candidates) {
  return {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    date: DATE,
    newsletter_date: DATE,
    audience: 'AOSP Camera / Camera Driver / SoC Platform / C++ engineer',
    lookback_days: 35,
    generated_at: `${DATE}T00:00:00.000Z`,
    sources_path: 'src/shared/data/news-sources.json',
    section_map: { 'camera-hal': 'Android / AOSP / Camera' },
    candidates,
    failures: []
  };
}

function writeArtifacts(root) {
  return writeCollectArtifactsThenAccrueDeepDiveTopics({
    root,
    date: DATE,
    candidatePayload: candidatePayload([demotedCameraCandidate()]),
    failures: [],
    lookbackDays: 35,
    sourceCount: 1,
    generatedAt: `${DATE}T00:00:00.000Z`,
    sourceMonitorResult: null
  });
}

function collectArtifactPaths(root) {
  return [
    manualCandidatesPath(root, DATE),
    collectedCandidatesPath(root, DATE),
    rawCandidateManifestPath(root, DATE),
    path.join(newsroomDir(root, DATE), 'news-candidates.md'),
    path.join(root, '.tmp', 'news-candidate-date.txt')
  ];
}

test('collect가 후보 산출물을 먼저 기록하고 그 다음에 심층 주제를 적립한다', () => {
  const root = tempRoot('collect-artifact-order-healthy-');

  const accrual = writeArtifacts(root);

  for (const filePath of collectArtifactPaths(root)) {
    assert.equal(fs.existsSync(filePath), true, filePath);
  }
  const payload = JSON.parse(fs.readFileSync(manualCandidatesPath(root, DATE), 'utf8'));
  assert.equal(payload.candidates.length, 1);
  // 적립도 실제로 일어났다 — 아래 손상 테스트가 "적립이 원래 아무것도 안 한다"로 통과하지 않는다.
  assert.equal(accrual.accruedFingerprintCount, 1);
  assert.equal(loadDeepDiveTopicQueue(root).topics.length, 1);
});

test('큐 파일이 손상돼도 후보 산출물은 디스크에 남고 오류는 그대로 전파된다', () => {
  const root = tempRoot('collect-artifact-order-corrupt-');
  const queuePath = path.join(root, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  // 01 workflow가 이 state 파일을 매주 `git pull --rebase --autostash`로 커밋한다 —
  // 충돌 마커가 JSON state 파일에 남는 현실적인 손상 경로다.
  fs.writeFileSync(queuePath, '<<<<<<< HEAD\n{ "schemaVersion": 1, "topics": [] }\n', 'utf8');

  // 구현 오류는 시끄러워야 한다 — 삼키거나 skip으로 바꾸지 않는다.
  assert.throws(() => writeArtifacts(root), /deep-dive-topic-queue/);

  // 그리고 그 throw가 그날의 수집 결과를 데려가지 않는다.
  for (const filePath of collectArtifactPaths(root)) {
    assert.equal(fs.existsSync(filePath), true, filePath);
  }
  const payload = JSON.parse(fs.readFileSync(manualCandidatesPath(root, DATE), 'utf8'));
  assert.equal(payload.candidates.length, 1);
  assert.equal(payload.newsletter_date, DATE);
  const manifest = JSON.parse(fs.readFileSync(rawCandidateManifestPath(root, DATE), 'utf8'));
  assert.equal(manifest.candidate_count, 1);
});
