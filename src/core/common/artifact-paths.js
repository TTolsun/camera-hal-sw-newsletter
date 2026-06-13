const path = require('path');

// 공개 출력물은 모두 저장소 루트의 articles/ 아래에 위치한다(#262 phase 6).
// 루트에는 index.html만 남고, articles/ 의 내용은 Pages Actions 배포 시
// _site/ 루트로 복사되어 서빙 URL(/newsletters/..., /content/..., /data/... 등)이 보존된다.
const ARTICLES_ROOT = 'articles';
const CONTENT_ROOT = `${ARTICLES_ROOT}/content`;
const COLLECTED_NEWS_ROOT = `${CONTENT_ROOT}/collected-news`;
const NEWSROOM_ROOT = `${CONTENT_ROOT}/newsroom`;
// newsletters/ 디스크 루트(서빙 URL은 /newsletters/...로 보존됨).
const NEWSLETTERS_ROOT = `${ARTICLES_ROOT}/newsletters`;

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

// 클라이언트(브라우저)가 보는 서빙-상대 경로를 디스크상의 실제 위치로 매핑한다.
// 서빙 루트(_site/)는 루트 index.html + articles/ 내용으로 조립되므로,
// index.html은 저장소 루트에, 그 외 모든 공개 자원은 articles/ 아래에 있다.
// 예: 'newsletters/2026-06-11/index.html' -> <root>/articles/newsletters/2026-06-11/index.html
//     'data/newsletters.json'             -> <root>/articles/data/newsletters.json
//     'index.html'                        -> <root>/index.html
function publicAssetPath(root, servedRelPath) {
  const normalized = toPosix(servedRelPath).replace(/^\/+/, '');
  const target = (normalized === '' || normalized === 'index.html')
    ? path.join(root, 'index.html')
    : path.join(root, ARTICLES_ROOT, normalized);
  // repoPath와 동일한 escape 가드: 결과가 root 밖이면 ''을 반환한다.
  const rootPath = path.resolve(root);
  const absPath = path.resolve(target);
  if (absPath !== rootPath && !absPath.startsWith(`${rootPath}${path.sep}`)) {
    return '';
  }
  return target;
}

function newslettersDir(root, date) {
  return path.join(root, ARTICLES_ROOT, 'newsletters', date);
}

function collectedNewsDir(root, date) {
  return path.join(root, CONTENT_ROOT, 'collected-news', date);
}

function collectedCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'candidates.json');
}

function collectedCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/candidates.json`;
}

function manualCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'manual-candidates.json');
}

function manualCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/manual-candidates.json`;
}

function collectionIntentPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'collection-intent.json');
}

function collectionIntentRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/collection-intent.json`;
}

function mergedCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'merged-candidates.json');
}

function mergedCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/merged-candidates.json`;
}

function geminiCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'gemini-candidates.json');
}

function geminiCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/gemini-candidates.json`;
}

function seedCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'seed-candidates.json');
}

function seedCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/seed-candidates.json`;
}

function seedEvidencePackPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'seed-evidence-pack.json');
}

function seedEvidencePackRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/seed-evidence-pack.json`;
}

function newsroomArtifactPath(root, date, filename) {
  return path.join(newsroomDir(root, date), filename);
}

function geminiSourceProposalsPath(root, date) {
  return newsroomArtifactPath(root, date, 'gemini-source-proposals.json');
}

function geminiSourceProposalsRelPath(date) {
  return newsroomRelPath(date, 'gemini-source-proposals.json');
}

function geminiSourceProposalValidationReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'gemini-source-proposal-validation-report.json');
}

function geminiSourceProposalValidationReportRelPath(date) {
  return newsroomRelPath(date, 'gemini-source-proposal-validation-report.json');
}

function geminiUsageReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'gemini-usage-report.json');
}

function geminiUsageReportRelPath(date) {
  return newsroomRelPath(date, 'gemini-usage-report.json');
}

function extractedSourceFactsPath(root, date) {
  return newsroomArtifactPath(root, date, 'extracted-source-facts.json');
}

function extractedSourceFactsRelPath(date) {
  return newsroomRelPath(date, 'extracted-source-facts.json');
}

function sourceQualityReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'source-quality-report.json');
}

function sourceQualityReportRelPath(date) {
  return newsroomRelPath(date, 'source-quality-report.json');
}

function sourceQualityReportMarkdownPath(root, date) {
  return newsroomArtifactPath(root, date, 'source-quality-report.md');
}

function sourceQualityReportMarkdownRelPath(date) {
  return newsroomRelPath(date, 'source-quality-report.md');
}

function sourceClustersPath(root, date) {
  return newsroomArtifactPath(root, date, 'source-clusters.json');
}

function sourceClustersRelPath(date) {
  return newsroomRelPath(date, 'source-clusters.json');
}

function evidenceValidationReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'evidence-validation-report.json');
}

function evidenceValidationReportRelPath(date) {
  return newsroomRelPath(date, 'evidence-validation-report.json');
}

function sourceDiscoveryFeedbackReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'source-discovery-feedback-report.json');
}

function sourceDiscoveryFeedbackReportRelPath(date) {
  return newsroomRelPath(date, 'source-discovery-feedback-report.json');
}

function sourceDiscoveryFeedbackReportMarkdownPath(root, date) {
  return newsroomArtifactPath(root, date, 'source-discovery-feedback-report.md');
}

function sourceDiscoveryFeedbackReportMarkdownRelPath(date) {
  return newsroomRelPath(date, 'source-discovery-feedback-report.md');
}

function seedFetchReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'seed-fetch-report.json');
}

function seedFetchReportRelPath(date) {
  return newsroomRelPath(date, 'seed-fetch-report.json');
}

function seedFetchReportMarkdownPath(root, date) {
  return newsroomArtifactPath(root, date, 'seed-fetch-report.md');
}

function seedFetchReportMarkdownRelPath(date) {
  return newsroomRelPath(date, 'seed-fetch-report.md');
}

function seedEvidencePackMarkdownPath(root, date) {
  return newsroomArtifactPath(root, date, 'seed-evidence-pack.md');
}

function seedEvidencePackMarkdownRelPath(date) {
  return newsroomRelPath(date, 'seed-evidence-pack.md');
}

function seedMergeReportPath(root, date) {
  return newsroomArtifactPath(root, date, 'seed-merge-report.json');
}

function seedMergeReportRelPath(date) {
  return newsroomRelPath(date, 'seed-merge-report.json');
}

function seedMergeReportMarkdownPath(root, date) {
  return newsroomArtifactPath(root, date, 'seed-merge-report.md');
}

function seedMergeReportMarkdownRelPath(date) {
  return newsroomRelPath(date, 'seed-merge-report.md');
}

function rawCandidateManifestPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'raw-candidate-manifest.json');
}

function rawCandidateManifestRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/raw-candidate-manifest.json`;
}

function mergedCandidateManifestPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'merged-candidate-manifest.json');
}

function mergedCandidateManifestRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/merged-candidate-manifest.json`;
}

function newsroomDir(root, date) {
  return path.join(root, CONTENT_ROOT, 'newsroom', date);
}

function newsroomRelPath(date, filename = '') {
  return filename ? `${NEWSROOM_ROOT}/${date}/${filename}` : `${NEWSROOM_ROOT}/${date}`;
}

function changedArtifactDate(relPath) {
  const normalized = toPosix(relPath);
  const match = normalized.match(/^articles\/(?:newsletters|content\/newsroom|content\/collected-news|content\/source-events)\/(\d{4}-\d{2}-\d{2})(?:\/|$)/);
  return match ? match[1] : '';
}

module.exports = {
  ARTICLES_ROOT,
  COLLECTED_NEWS_ROOT,
  CONTENT_ROOT,
  NEWSLETTERS_ROOT,
  NEWSROOM_ROOT,
  changedArtifactDate,
  newslettersDir,
  publicAssetPath,
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  collectedNewsDir,
  collectionIntentPath,
  collectionIntentRelPath,
  evidenceValidationReportPath,
  evidenceValidationReportRelPath,
  extractedSourceFactsPath,
  extractedSourceFactsRelPath,
  geminiCandidatesPath,
  geminiCandidatesRelPath,
  geminiSourceProposalValidationReportPath,
  geminiSourceProposalValidationReportRelPath,
  geminiSourceProposalsPath,
  geminiSourceProposalsRelPath,
  geminiUsageReportPath,
  geminiUsageReportRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  newsroomArtifactPath,
  newsroomDir,
  newsroomRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath,
  sourceDiscoveryFeedbackReportMarkdownPath,
  sourceDiscoveryFeedbackReportMarkdownRelPath,
  sourceDiscoveryFeedbackReportPath,
  sourceDiscoveryFeedbackReportRelPath,
  seedCandidatesPath,
  seedCandidatesRelPath,
  seedEvidencePackMarkdownPath,
  seedEvidencePackMarkdownRelPath,
  seedEvidencePackPath,
  seedEvidencePackRelPath,
  seedFetchReportMarkdownPath,
  seedFetchReportMarkdownRelPath,
  seedFetchReportPath,
  seedFetchReportRelPath,
  seedMergeReportMarkdownPath,
  seedMergeReportMarkdownRelPath,
  seedMergeReportPath,
  seedMergeReportRelPath,
  sourceClustersPath,
  sourceClustersRelPath,
  sourceQualityReportMarkdownPath,
  sourceQualityReportMarkdownRelPath,
  sourceQualityReportPath,
  sourceQualityReportRelPath,
  toPosix
};
