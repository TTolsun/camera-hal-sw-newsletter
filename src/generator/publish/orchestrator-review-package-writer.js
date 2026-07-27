// 발행 orchestrator의 date review package writer(#655).
// writeDateReviewPackage는 00-review-guide.md / release-qa-report.md / artifact-manifest.json을
// 한 묶음으로 쓰는 near-pure writer다. rootDir/date/files 등 모든 입력을 인자로 받고, 의존성은
// 전부 module-level import라 god-file-local 함수 주입이 없다(god-file을 import하지 않아 순환 없음).
// rootDir 기본값으로 쓰는 root는 god-file의 process.cwd()와 동일 시점에 같은 값으로 파생한다.
// 인벤토리가 required(always)로 선언한 hal-signal-quality-report.{json,md}는 인벤토리 스캔 전에
// 이 writer가 직접 생성한다(생성 순서 불변식: 리뷰 패키지가 있으면 hal-signal 리포트도 있다).
const fs = require('fs');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const {
  newsroomDir: artifactNewsroomDir,
  newsroomRelPath
} = require('../../shared/common/artifact-paths');
const {
  buildDateReviewManifest,
  buildReviewArtifactInventory,
  renderReviewGuideMarkdown
} = require('./review-artifact-inventory');
const { buildReleaseQaReport } = require('../render/newsletter-renderer');
const { reviewPackageFactCheck } = require('./orchestrator-report-builders');
const {
  writeHalSignalQualityArtifacts
} = require('../diagnostics/hal-signal-quality-report');

const root = process.cwd();

function writeDateReviewPackage({
  rootDir = root,
  date,
  files = [],
  validateText = '',
  factCheck = null,
  todoFound = false,
  emptySourceSections = [],
  qualityReport = null,
  runContext = {}
}) {
  const newsroomDir = artifactNewsroomDir(rootDir, date);
  fs.mkdirSync(newsroomDir, { recursive: true });
  // 인벤토리가 required(always)로 선언한 hal-signal-quality-report는 리뷰 패키지보다 먼저
  // 생성돼야 한다. 나중에 별도 워크플로우 스텝이 만들면 같은 커밋에 리포트가 있는데도
  // 리뷰 패키지 3종이 required_artifact_missing으로 영구 기록된다. 리포트 생성기는 입력
  // 산출물이 없는 실패 경로에서도 INPUT_INCOMPLETE 리포트를 정직하게 쓴다.
  // 보조 안전망: 리포트 생성 실패가 진단용 리뷰 패키지 작성까지 막으면 안 되므로 경고로만
  // 남긴다. 이 경우 인벤토리는 실제 결측 상태를 그대로 기록한다.
  try {
    writeHalSignalQualityArtifacts({ root: rootDir, date });
  } catch (error) {
    console.warn(`hal-signal-quality-report generation failed: ${error.message}`);
  }
  const changedArtifacts = [...new Set([
    ...files.filter(Boolean),
    newsroomRelPath(date, 'hal-signal-quality-report.json'),
    newsroomRelPath(date, 'hal-signal-quality-report.md'),
    newsroomRelPath(date, '00-review-guide.md'),
    newsroomRelPath(date, 'release-qa-report.md'),
    newsroomRelPath(date, 'artifact-manifest.json')
  ])];
  const reviewGuidePath = path.join(newsroomDir, '00-review-guide.md');
  const releaseQaPath = path.join(newsroomDir, 'release-qa-report.md');
  const writeReviewGuide = inventory => {
    fs.writeFileSync(reviewGuidePath, renderReviewGuideMarkdown(inventory), 'utf8');
  };
  const writeReleaseQa = inventory => {
    fs.writeFileSync(releaseQaPath, buildReleaseQaReport(
      date,
      files,
      validateText,
      reviewPackageFactCheck(factCheck),
      todoFound,
      emptySourceSections,
      qualityReport,
      inventory
    ), 'utf8');
  };

  let inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReviewGuide(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReleaseQa(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReviewGuide(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReleaseQa(inventory);
  const manifestPath = path.join(newsroomDir, 'artifact-manifest.json');
  writeJson(manifestPath, buildDateReviewManifest({ root: rootDir, date, changedArtifacts, runContext }));
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReviewGuide(inventory);
  inventory = buildReviewArtifactInventory({ root: rootDir, date, changedArtifacts, runContext });
  writeReleaseQa(inventory);
  writeJson(manifestPath, buildDateReviewManifest({ root: rootDir, date, changedArtifacts, runContext }));
}

module.exports = {
  writeDateReviewPackage
};
