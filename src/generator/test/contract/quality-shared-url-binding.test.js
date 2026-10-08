'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { candidateBindingIndex } = require('../../quality/candidate-claim-matching');
const { bindCandidateForSection, isSharedWatchOrReleaseNoteUrl } = require('../../quality/quality-section-binding');
const {
  reportFor,
  scopedCandidate,
  section,
  validSections,
  reporterCandidatesFor
} = require('../../../shared/test/helpers/quality-builders');

// 2026-10-05 실행의 libcamera AWB 시리즈 기사 모양: patchwork 조각 하나가 선정되고, 원문 읽기가
// 그 패치와 커버레터를 source-body 근거로 붙인다. 후보에는 버전이 없고, 본문은 제출일을 쓰지 않는다.
const patchUrl = 'https://patchwork.libcamera.org/patch/28387/';
const coverUrl = 'https://patchwork.libcamera.org/cover/28386/';

function patchCandidate(overrides = {}) {
  return scopedCandidate(patchUrl, 'camera_driver_image_pipeline', {
    title: '[1/5] libcamera: controls: Expand AWB controls',
    source_id: 'patchwork-libcamera-patches',
    published_date: '2026-09-28',
    version_or_release: '',
    source_extraction: {
      evidence_blocks: [
        { evidence_id: 'source-body:patch28387', url: patchUrl, text: 'Add the AwbState metadata and the AwbTrigger control.' },
        { evidence_id: 'source-body:cover28386', url: coverUrl, text: 'This series adds AwbState metadata and an AwbTrigger control.' }
      ]
    },
    ...overrides
  });
}

function awbSection(claims = []) {
  return section({
    headline: 'libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기',
    url: patchUrl,
    what_changed: 'AwbState 메타데이터와 AwbTrigger 컨트롤을 추가하는 패치 시리즈가 리뷰 중이다.',
    confirmed_facts: ['AwbState 메타데이터와 AwbTrigger 컨트롤을 추가한다.'],
    evidence_summary: 'API/component: libcamera AWB controls; behavior change: AwbState metadata, AwbTrigger control.',
    specificity_checks: ['AwbState metadata', 'AwbTrigger control'],
    claims
  });
}

test('one candidate carried by both shortlist and reporter is not a shared URL', () => {
  const candidate = patchCandidate();
  // reporter 병합은 version_or_release/api_or_component를 LLM 값으로 덮는다.
  const reporterCopy = { ...candidate, api_or_component: 'libcamera controls' };
  const index = candidateBindingIndex(
    { candidates: [reporterCopy] },
    { selected_articles: [candidate], shortlisted_candidates: [candidate] }
  );

  const binding = bindCandidateForSection(awbSection(), index);

  assert.equal(binding.status, 'bound');
  assert.equal(binding.candidate, candidate);
});

test('two different candidates on one URL still need matching date or version evidence', () => {
  const first = patchCandidate();
  const second = patchCandidate({ title: '[2/5] ipa: awb: Freeze gains on manual mode' });
  const index = candidateBindingIndex(
    { candidates: [] },
    { selected_articles: [first], shortlisted_candidates: [first, second] }
  );

  const binding = bindCandidateForSection(awbSection(), index);

  assert.equal(binding.status, 'evidence_mismatch');
  assert.match(binding.reason, /Shared watch\/release-note URL requires matching/);
});

test('candidates whose titles differ only in non-Korean, non-ASCII text stay distinct', () => {
  const entries = [
    { candidate: patchCandidate({ title: '相机驱动更新' }) },
    { candidate: patchCandidate({ title: 'カメラドライバ更新' }) }
  ];

  assert.equal(isSharedWatchOrReleaseNoteUrl(entries[0], entries), true);
});

test('a release-note item carried by both shortlist and reporter still needs date or version evidence', () => {
  const releaseUrl = 'https://developer.android.com/jetpack/androidx/releases/camera';
  const candidate = scopedCandidate(releaseUrl, 'android', {
    title: 'CameraX - 1.6.0',
    collectionMode: 'release-note-item',
    version_or_release: '1.6.0',
    published_date: '2026-09-24'
  });
  const index = candidateBindingIndex(
    { candidates: [{ ...candidate }] },
    { selected_articles: [candidate], shortlisted_candidates: [candidate] }
  );

  const binding = bindCandidateForSection(section({ headline: 'CameraX 업데이트', url: releaseUrl }), index);

  assert.equal(binding.status, 'evidence_mismatch');
});

test('series evidence read from the cover letter binds when shortlist and reporter share the candidate', () => {
  const candidate = patchCandidate();
  const article = awbSection([{
    claim_id: 'awb-cover',
    text: 'AwbState 메타데이터와 AwbTrigger 컨트롤을 추가한다.',
    claim_type: 'fact',
    evidence_ids: ['source-body:cover28386'],
    source_urls: [coverUrl],
    impact_level: 'driver_image_pipeline',
    overclaim_risk: 'low'
  }]);
  const others = validSections().slice(1);
  const report = reportFor(
    [article, ...others],
    [{ ...candidate, api_or_component: 'libcamera controls' }, ...reporterCandidatesFor(others)],
    {
      strictClaimValidation: true,
      shortlistReport: { selected_articles: [candidate], shortlisted_candidates: [candidate] }
    }
  );

  const claim = report.claim_results.find(item => item.claim_id === 'awb-cover');
  assert.equal(claim.status, 'bound');
  assert.deepEqual(claim.invalid_evidence_ids, []);
  assert.ok(!report.deductions.some(item =>
    ['unknown_evidence_id', 'source_url_mismatch'].includes(item.reason_code) && item.location === article.headline
  ));
});
