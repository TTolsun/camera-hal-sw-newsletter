// 발행 orchestrator의 date review package writer(#655).
// writeDateReviewPackage는 00-review-guide.md / release-qa-report.md / artifact-manifest.json을
// 한 묶음으로 쓰는 near-pure writer다. rootDir/date/files 등 모든 입력을 인자로 받고, 의존성은
// 전부 module-level import라 god-file-local 함수 주입이 없다(god-file을 import하지 않아 순환 없음).
// rootDir 기본값으로 쓰는 root는 god-file의 process.cwd()와 동일 시점에 같은 값으로 파생한다.
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
  const changedArtifacts = [...new Set([
    ...files.filter(Boolean),
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
