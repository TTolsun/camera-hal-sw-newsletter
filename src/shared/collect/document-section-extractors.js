// 문서 유형별 섹션 추출 dispatcher. 새 문서 유형은 여기 한 곳에만 추가한다.
// 지문·증거는 문서 유형과 무관한 공용 구현을 쓴다 — 특정 유형(ITS)의 모듈을 거쳐 가면
// 그 유형의 이름표가 다른 문서의 변화에까지 붙는다.
const { changedSectionEvidence, headingSectionFingerprint } = require('./document-section-parsing');
const { cameraItsReleaseNoteExtract } = require('./camera-its-release-note-evidence');
const { devsiteFeaturePageExtract } = require('./devsite-feature-page-evidence');

function documentSectionExtract(html, pageUrl) {
  return cameraItsReleaseNoteExtract(html, pageUrl) || devsiteFeaturePageExtract(html, pageUrl);
}

// 지문 형태({ heading, hash })는 문서 유형과 무관하게 동일하다.
function documentSectionFingerprint(extract) {
  return headingSectionFingerprint(extract);
}

// 증거의 이름표(version_or_release·api_or_component)는 extract를 만든 adapter가 들고 온다.
function documentSectionEvidence(extract, previousSections) {
  return changedSectionEvidence(extract, previousSections);
}

module.exports = { documentSectionEvidence, documentSectionExtract, documentSectionFingerprint };
