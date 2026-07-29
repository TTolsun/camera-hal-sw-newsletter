'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { collapseSeriesRepresentatives } = require('../../../cli/collect-news-candidates');

// 2026-W31 갭 감사 A2(#824): 시리즈 re-roll(v1 -> v2 재제출)은 patchwork series id도
// lore message-id도 새로 발급받아 (source, seriesId) collapse를 그대로 통과한다.
// 실측: 2026-07-27 수집분 patchwork 8슬롯 중 4개가 같은 신호의 v1/v2 중복이었다.
// 브래킷 접두부를 뗀 제목이 정확히 같은 시리즈 대표는 최신 버전 하나로 병합한다.

function patchworkItem({ title, seriesId, patchId }) {
  return {
    source_id: 'patchwork-libcamera-patches',
    title,
    url: `https://patchwork.libcamera.org/patch/${patchId}/`,
    seriesId
  };
}

test('re-rolled patchwork series collapse to the newest version in the first-seen slot (2026-W31 shape)', () => {
  // 실데이터: seriesId 6082(v2, 07-25)가 최신순 피드에서 먼저, 6076(v1, 07-23)이 뒤에 온다.
  const collapsed = collapseSeriesRepresentatives([
    patchworkItem({
      title: '[v2,2/2] libcamera: Harden control serializer size and input validation',
      seriesId: 6082,
      patchId: 27502
    }),
    patchworkItem({ title: 'libcamera: egl: Cache probed EGLDisplay to avoid redundant init/teardown', seriesId: 6077, patchId: 27460 }),
    patchworkItem({
      title: '[2/2] libcamera: Harden control serializer size and input validation',
      seriesId: 6076,
      patchId: 27455
    })
  ]);
  assert.deepEqual(collapsed.map(item => item.seriesId), [6082, 6077], 'v1 재제출 전 시리즈는 v2 대표에 흡수돼야 한다');
});

test('the newest version wins regardless of arrival order', () => {
  // v1이 먼저 오는 순서(오래된 순 피드)에서도 자리는 first-seen, 내용은 최신 버전이어야 한다.
  const collapsed = collapseSeriesRepresentatives([
    patchworkItem({ title: '[RFC,v7,5/6] libcamera: software_isp: Pass LSC availability to debayering', seriesId: 6049, patchId: 27301 }),
    patchworkItem({ title: '[1/1] package/libcamera: update source URL', seriesId: 6052, patchId: 27310 }),
    patchworkItem({ title: '[RFC,v8,5/6] libcamera: software_isp: Pass LSC availability to debayering', seriesId: 6060, patchId: 27390 })
  ]);
  assert.equal(collapsed.length, 2);
  assert.equal(collapsed[0].seriesId, 6060, '슬롯 자리는 first-seen이되 내용은 v8이어야 한다');
  assert.equal(collapsed[1].seriesId, 6052);
});

test('a re-roll that reworded its subject is intentionally NOT merged (Tegra VI shape)', () => {
  // 실측 한계 사례: v2가 subject에 "tegra:" prefix를 추가해 제목이 달라졌다.
  // 퍼지 매칭의 오병합 위험이 슬롯 중복보다 나쁘므로 정확 일치만 병합한다.
  const collapsed = collapseSeriesRepresentatives([
    patchworkItem({ title: '[v2,RFC,v2,1/1] pipeline: tegra: Add NVIDIA Tegra VI pipeline handler', seriesId: 6083, patchId: 27510 }),
    patchworkItem({ title: '[RFC,1/1] pipeline: Add NVIDIA Tegra VI pipeline handler', seriesId: 6080, patchId: 27480 })
  ]);
  assert.equal(collapsed.length, 2, '제목이 바뀐 re-roll은 병합하지 않는다');
});

test('version tokens are read from the bracket prefix only, not the subject body', () => {
  // 제목 본문의 "IPA format v3"가 re-roll 버전으로 오인되면 v2 브래킷이 밀린다.
  const collapsed = collapseSeriesRepresentatives([
    patchworkItem({ title: '[1/1] libcamera: Serialize local control names in IPA format v3', seriesId: 6070, patchId: 27400 }),
    patchworkItem({ title: '[v2,1/1] libcamera: Serialize local control names in IPA format v3', seriesId: 6081, patchId: 27500 })
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].seriesId, 6081, '브래킷 v2가 본문 v3 표기를 이기고 대표가 돼야 한다');
});

test('lore re-rolls with a changed patch count still collapse (v5 0/6 -> v6 0/7)', () => {
  const loreItem = (title, seriesId) => ({
    source_id: 'lore-linux-media-list',
    title,
    url: 'https://lore.kernel.org/linux-media/example/',
    seriesId
  });
  const collapsed = collapseSeriesRepresentatives([
    loreItem('[PATCH v6 0/7] media: qcom: camss: Shikra EVK CAMSS and IMX577 support', 'lore-series:b'),
    loreItem('[PATCH v5 0/6] media: qcom: camss: Shikra EVK CAMSS and IMX577 support', 'lore-series:a')
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].seriesId, 'lore-series:b');
});

test('candidates without a series id are never merged by subject', () => {
  // re-roll 병합은 시리즈 후보끼리만이다 — 일반 소스의 같은 제목은 하류 dedupe 소관.
  const plain = title => ({ source_id: 'some-blog', title, url: 'https://example.com/a' });
  const collapsed = collapseSeriesRepresentatives([
    plain('Camera HAL updates roundup'),
    plain('Camera HAL updates roundup')
  ]);
  assert.equal(collapsed.length, 2);
});

test('identical subjects from different sources stay separate', () => {
  const collapsed = collapseSeriesRepresentatives([
    patchworkItem({ title: '[2/2] libcamera: Harden control serializer size and input validation', seriesId: 6076, patchId: 27455 }),
    {
      source_id: 'lore-linux-media-list',
      title: '[v2,2/2] libcamera: Harden control serializer size and input validation',
      url: 'https://lore.kernel.org/linux-media/other/',
      seriesId: 'lore-series:x'
    }
  ]);
  assert.equal(collapsed.length, 2, 're-roll 병합은 같은 소스 안에서만 일어난다');
});
