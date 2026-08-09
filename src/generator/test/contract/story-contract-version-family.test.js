// Story Contract v2 계약 코어(T2) — 세 마커가 한 버전 패밀리로 움직이는지 본다.
//
// public_contract_version 'story-vN' / generation_contract_version N /
// story_contract_version N은 항상 같은 N이어야 한다. 셋이 섞이면 그 아티팩트가
// 어느 계약인지 판정할 수 없으므로 fail-closed로 막는다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  storyContractMarkers
} = require('../../reporter/public-article-contract');

function sectionWithStoryVersion(version) {
  return {
    headline: 'Himax HM1246 이미지 센서용 V4L2 서브디바이스 드라이버',
    public_article: {
      story_contract_version: version,
      source_subtitle: 'linux-media',
      editorial_story: {},
      decision_metadata: {}
    }
  };
}

test('story contract markers accept a complete v1 version family', () => {
  const markers = storyContractMarkers(
    { public_contract_version: 'story-v1', generation_contract_version: 1 },
    sectionWithStoryVersion(1)
  );
  assert.deepEqual(markers.unsupported, []);
  assert.equal(markers.markerCount, 3);
  assert.equal(markers.complete, true);
  assert.equal(markers.mismatch, false);
});

test('story contract markers accept a complete v2 version family', () => {
  const markers = storyContractMarkers(
    { public_contract_version: 'story-v2', generation_contract_version: 2 },
    sectionWithStoryVersion(2)
  );
  assert.deepEqual(markers.unsupported, []);
  assert.equal(markers.markerCount, 3);
  assert.equal(markers.complete, true);
  assert.equal(markers.mismatch, false);
});

test('story contract markers reject a mixed version family', () => {
  const markers = storyContractMarkers(
    { public_contract_version: 'story-v1', generation_contract_version: 1 },
    sectionWithStoryVersion(2)
  );
  assert.deepEqual(
    markers.unsupported.map(issue => issue.type),
    ['story_contract_version_family_mismatch']
  );
  assert.equal(markers.complete, false);
  assert.equal(markers.hasUnsupportedMarker, true);
});

test('story contract markers report the version each marker declared on a family mismatch', () => {
  const markers = storyContractMarkers(
    { public_contract_version: 'story-v2', generation_contract_version: 2 },
    sectionWithStoryVersion(1)
  );
  const [issue] = markers.unsupported;
  assert.equal(issue.type, 'story_contract_version_family_mismatch');
  assert.equal(issue.public_contract_version, 2);
  assert.equal(issue.generation_contract_version, 2);
  assert.equal(issue.story_contract_version, 1);
});

test('story contract markers still reject a version outside the supported set', () => {
  const markers = storyContractMarkers(
    { public_contract_version: 'story-v3', generation_contract_version: 3 },
    sectionWithStoryVersion(3)
  );
  assert.deepEqual(markers.unsupported.map(issue => issue.type), [
    'unsupported_public_contract_version',
    'unsupported_generation_contract_version',
    'unsupported_story_contract_version'
  ]);
});

test('story contract markers still report an incomplete marker count', () => {
  const markers = storyContractMarkers(
    { public_contract_version: 'story-v1' },
    sectionWithStoryVersion(1)
  );
  assert.deepEqual(markers.unsupported, []);
  assert.equal(markers.markerCount, 2);
  assert.equal(markers.complete, false);
  assert.equal(markers.mismatch, true);
});
