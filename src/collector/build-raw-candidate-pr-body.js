const fs = require('fs');

const {
  kstDate,
  readJson
} = require('../shared/common/common');
const {
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath
} = require('../shared/common/artifact-paths');
const {
  BUCKETS
} = require('../shared/domain/aosp-camera-scope');
const {
  readRuntimeConfig
} = require('../shared/common/runtime-config');
const {
  renderEditorPrSummary
} = require('../shared/common/editor-pr-summary');

const DIRECT_CAMERA_BUCKETS = new Set([
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
  BUCKETS.ANDROID
]);

function candidateItems(payload = {}) {
  return Array.isArray(payload?.candidates) ? payload.candidates : [];
}

function firstText(values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function candidateBucket(candidate = {}) {
  return firstText([
    candidate.relevance_bucket,
    candidate.relevanceBucket,
    candidate.bucket
  ]);
}

function hasCameraXSignal(candidate = {}) {
  const text = [
    candidate.title,
    candidate.summary,
    candidate.url,
    candidate.articleUrl,
    candidate.article_url,
    candidate.api_or_component,
    candidate.version_or_release
  ].join(' ').toLowerCase();
  return text.includes('camerax') || text.includes('androidx.camera');
}

function summarizeRawCandidates(payload = {}, manifest = null) {
  const candidates = candidateItems(payload);
  const officialCount = candidates.filter(candidate => {
    const reliability = firstText([candidate.source_reliability, candidate.reliability]).toLowerCase();
    return ['official', 'project-official', 'official-community'].includes(reliability);
  }).length;
  const genericNoiseCount = candidates.filter(candidate => {
    const bucket = candidateBucket(candidate);
    return bucket === BUCKETS.GENERIC_TECH_WATCHLIST || candidate.finalSelectionEligibility === 'watchlist';
  }).length;
  const directCameraBucketCount = candidates.filter(candidate =>
    DIRECT_CAMERA_BUCKETS.has(candidateBucket(candidate))
  ).length;
  const cameraXCount = candidates.filter(hasCameraXSignal).length;
  const socPlatformCount = candidates.filter(candidate =>
    candidate.counts_as_soc_topic === true
  ).length;
  const officialRatio = candidates.length > 0 ? officialCount / candidates.length : 0;

  return {
    candidateCount: candidates.length,
    sourceCount: manifest?.source_count ?? null,
    officialCount,
    officialRatio,
    genericNoiseCount,
    directCameraBucketCount,
    cameraXCount,
    socPlatformCount
  };
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function rawCandidateHandoff(summary = {}, artifactExists = false) {
  if (!artifactExists || summary.candidateCount === 0) {
    return {
      nextStep: 'blocked',
      label: '진행 불가',
      reason: 'RAW artifact가 없거나 후보 수가 0개입니다.'
    };
  }
  if (summary.directCameraBucketCount === 0) {
    return {
      nextStep: 'strengthen_candidates',
      label: '후보 보강 권장',
      reason: '후보는 있지만 direct Camera/HAL 후보가 부족합니다.'
    };
  }
  return {
    nextStep: 'run_02',
    label: '02 진행 가능',
    reason: 'RAW artifact와 Camera HAL 직접 후보가 확인되었습니다.'
  };
}

function rawCandidateVerdict(summary = {}, handoff = {}) {
  if (handoff.nextStep === 'blocked') {
    return {
      label: '실패',
      action: 'RAW 후보를 보강한 뒤 01을 다시 실행하세요.',
      firstLook: 'RAW artifact 존재 여부와 후보 수를 먼저 확인하세요.'
    };
  }
  if (handoff.nextStep === 'strengthen_candidates') {
    return {
      label: '검토 필요',
      action: 'Camera HAL 직접 후보를 보강한 뒤 다음 단계 진행 여부를 판단하세요.',
      firstLook: 'direct Camera/HAL 후보 수가 부족합니다.'
    };
  }
  return {
    label: '검토 가능',
    action: 'RAW 후보를 확인한 뒤 02 Gemini source discovery로 진행할 수 있습니다.',
    firstLook: `${summary.candidateCount}개 후보 중 direct Camera/HAL 후보 ${summary.directCameraBucketCount}개가 있습니다.`
  };
}

function loadRawCandidatePayload(root, date) {
  const manualPath = manualCandidatesPath(root, date);
  if (fs.existsSync(manualPath)) {
    return {
      path: manualPath,
      relPath: manualCandidatesRelPath(date),
      payload: readJson(manualPath)
    };
  }
  const legacyPath = collectedCandidatesPath(root, date);
  return {
    path: legacyPath,
    relPath: collectedCandidatesRelPath(date),
    payload: readJson(legacyPath)
  };
}

function buildRawCandidatePrBody({
  root = process.cwd(),
  date
} = {}) {
  const input = loadRawCandidatePayload(root, date);
  const manifestPath = rawCandidateManifestPath(root, date);
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const summary = summarizeRawCandidates(input.payload, manifest);
  const branchName = `newsroom-raw/${date}`;
  const rawArtifactExists = fs.existsSync(input.path);
  const handoff = rawCandidateHandoff(summary, rawArtifactExists);
  const verdict = rawCandidateVerdict(summary, handoff);
  const compatibilityArtifact = collectedCandidatesRelPath(date);

  return [
    `# RAW Candidate Collection - ${date}`,
    '',
    renderEditorPrSummary({
      stage: 'manual_source_collect',
      verdict,
      handoff,
      summaryRows: [
        ['생성 단계', 'RAW 후보 수집'],
        ['기준 날짜', date],
        ['RAW candidate artifact', input.relPath],
        ['compatibility artifact', compatibilityArtifact],
        ['branch', branchName]
      ],
      checklistItems: [
        { label: '후보 수집 artifact가 정상 생성됨', checked: rawArtifactExists },
        { label: '확인 필요: private/internal URL fetch 없음', checked: false },
        { label: '확인 필요: source_gap_risk 우회 없음', checked: false },
        { label: '확인 필요: quality threshold 변경 없음', checked: false },
        { label: '확인 필요: 03 re-crawl 없음', checked: false },
        { label: '확인 필요: Gemini proposal이 deterministic validation 없이 승격되지 않음', checked: false }
      ],
      resultRows: [
        ['후보 수', summary.candidateCount, summary.candidateCount > 0 ? '있음' : '없음'],
        ['source 수', summary.sourceCount ?? 'unknown', summary.sourceCount ? '확인 필요' : '알 수 없음'],
        ['direct Camera/HAL 후보', summary.directCameraBucketCount, summary.directCameraBucketCount > 0 ? '있음' : '부족'],
        ['generic/watch 후보', summary.genericNoiseCount, summary.genericNoiseCount > 0 ? '검토 필요' : '낮음'],
        ['official ratio', `${percent(summary.officialRatio)} (${summary.officialCount}/${summary.candidateCount})`, summary.officialCount > 0 ? '확인됨' : '부족']
      ]
    }),
    '- 원본 후보는 위 `RAW candidate artifact`에서 확인하세요.',
    `- source change event report: articles/content/source-events/${date}/source-change-events.json`,
    '- PR body에는 편집장 1차 판단에 필요한 요약만 남깁니다.',
    ''
  ].join('\n');
}

function main() {
  const runtimeConfig = readRuntimeConfig(process.env);
  const args = process.argv.slice(2);
  const dateArgIndex = args.indexOf('--date');
  const date = dateArgIndex >= 0 ? args[dateArgIndex + 1] : runtimeConfig.newsletterDate || kstDate();
  process.stdout.write(`${buildRawCandidatePrBody({ date })}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRawCandidatePrBody,
  hasCameraXSignal,
  rawCandidateHandoff,
  rawCandidateVerdict,
  summarizeRawCandidates
};
