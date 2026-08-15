// 문서 유형별 섹션 추출 dispatcher. 새 문서 유형은 여기 한 곳에만 추가한다.
const { cameraItsReleaseNoteExtract, cameraItsReleaseNoteFingerprint } = require('./camera-its-release-note-evidence');
const { devsiteFeaturePageExtract } = require('./devsite-feature-page-evidence');

function documentSectionExtract(html, pageUrl) {
  return cameraItsReleaseNoteExtract(html, pageUrl) || devsiteFeaturePageExtract(html, pageUrl);
}

// 지문 형태({ heading, hash })는 문서 유형과 무관하게 동일하다.
function documentSectionFingerprint(extract) {
  return cameraItsReleaseNoteFingerprint(extract);
}

module.exports = { documentSectionExtract, documentSectionFingerprint };
