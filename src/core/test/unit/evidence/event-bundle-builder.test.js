const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EVENT_BUNDLE_DEDUPE_REASONS,
  EVENT_TYPES,
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES,
  buildEventBundles
} = require('../../../../../scripts/newsroom/evidence');
const { buildShortlistReport } = require('../../../../../scripts/newsroom/generate/newsroom-selection');
const { candidate } = require('../../helpers/newsroom-builders');

function releaseCandidate(overrides = {}) {
  return candidate({
    title: 'CameraX 1.6.1 release notes',
    source_id: 'camerax-release-notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera?hl=ko#1.6.1',
    version_or_release: 'CameraX 1.6.1',
    published_date: '2026-05-06',
    api_or_component: 'CameraX / androidx.camera',
    source_extraction: {
      release: {
        version: 'CameraX 1.6.1',
        date: '2026-05-06',
        component: 'CameraX / androidx.camera'
      }
    },
    ...overrides
  });
}

test('event bundle builder dedupes by canonical release note URL first', () => {
  const bundles = buildEventBundles([
    releaseCandidate({
      canonical_release_note_url: 'https://developer.android.com/jetpack/androidx/releases/camera?hl=ko#1.6.1',
      outgoing_links: [{
        url: 'https://github.com/androidx/androidx/pull/1234',
        text: 'pull request',
        evidence_role: 'primary_evidence'
      }]
    }),
    releaseCandidate({
      title: 'CameraX patch duplicate',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      canonicalReleaseNoteUrl: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
    })
  ]);

  assert.equal(bundles.length, 1);
  assert.match(bundles[0].event_id, /^event_[a-f0-9]{12}$/);
  assert.equal(bundles[0].event_type, EVENT_TYPES.RELEASE_NOTE);
  assert.equal(bundles[0].dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.CANONICAL_RELEASE_NOTE_URL);
  assert.equal(
    bundles[0].event_key,
    'release_note_url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  );
  assert.deepEqual(bundles[0].release, {
    version: 'CameraX 1.6.1',
    date: '2026-05-06'
  });
  assert.equal(bundles[0].component, 'CameraX / androidx.camera');
  assert.ok(bundles[0].evidence_urls.includes('https://github.com/androidx/androidx/pull/1234'));
});

test('event bundle builder prefers source id and release version over date component fallback', () => {
  const [bundle] = buildEventBundles([
    releaseCandidate({
      canonical_release_note_url: '',
      canonicalReleaseNoteUrl: ''
    })
  ]);

  assert.equal(bundle.dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.SOURCE_RELEASE_VERSION);
  assert.equal(bundle.event_key, 'source:camerax-release-notes:release:camerax 1.6.1');
  assert.equal(bundle.confidence, 'high');
});

test('event bundle builder falls back to source id with release date and component', () => {
  const [bundle] = buildEventBundles([
    releaseCandidate({
      canonical_release_note_url: '',
      version_or_release: '',
      source_extraction: {
        release: {
          version: '',
          date: '2026-05-06T00:00:00Z',
          component: 'CameraX / androidx.camera'
        }
      }
    })
  ]);

  assert.equal(bundle.dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.SOURCE_RELEASE_DATE_COMPONENT);
  assert.equal(
    bundle.event_key,
    'source:camerax-release-notes:date:2026-05-06:component:camerax / androidx.camera'
  );
  assert.equal(bundle.release.date, '2026-05-06');
});

test('event bundle builder falls back to Android Gerrit change id', () => {
  const [bundle] = buildEventBundles([
    candidate({
      title: 'Camera provider Gerrit change',
      url: 'https://example.com/camera-provider-change',
      version_or_release: '',
      linked_evidence: [{
        type: LINKED_EVIDENCE_TYPES.ANDROID_GERRIT,
        url: 'https://android-review.googlesource.com/c/platform/frameworks/av/+/123456',
        identifier: '123456',
        fetch_status: FETCH_STATUSES.NOT_FETCHED
      }]
    })
  ]);

  assert.equal(bundle.event_type, EVENT_TYPES.ANDROID_GERRIT_CHANGE);
  assert.equal(bundle.dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.ANDROID_GERRIT_CHANGE_ID);
  assert.equal(bundle.event_key, 'android_gerrit:123456');
});

test('event bundle builder falls back to GitHub release before issue or pull request', () => {
  const [bundle] = buildEventBundles([
    candidate({
      title: 'CameraX GitHub linked release',
      url: 'https://example.com/github-release',
      version_or_release: '',
      linked_evidence: [
        {
          type: LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST,
          url: 'https://github.com/androidx/androidx/pull/1234',
          identifier: 'androidx/androidx#1234',
          fetch_status: FETCH_STATUSES.NOT_FETCHED
        },
        {
          type: LINKED_EVIDENCE_TYPES.GITHUB_RELEASE,
          url: 'https://github.com/androidx/androidx/releases/tag/camera-1.6.1',
          identifier: 'androidx/androidx@camera-1.6.1',
          fetch_status: FETCH_STATUSES.NOT_FETCHED
        }
      ]
    })
  ]);

  assert.equal(bundle.event_type, EVENT_TYPES.GITHUB_RELEASE);
  assert.equal(bundle.dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.GITHUB_RELEASE);
  assert.equal(bundle.event_key, 'github:androidx/androidx:release:camera-1.6.1');
});

test('event bundle builder ignores unclassified and noise preservation links as evidence URLs', () => {
  const [bundle] = buildEventBundles([
    releaseCandidate({
      canonical_release_note_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      outgoing_links: [
        {
          url: 'https://github.com/androidx/androidx/pull/1234',
          text: 'preserved but not classified',
          evidence_role: 'unclassified'
        },
        {
          url: 'https://developer.android.com/privacy',
          text: 'Privacy',
          evidence_role: 'noise'
        },
        {
          url: 'https://github.com/androidx/androidx/pull/5678',
          text: 'classified primary evidence',
          evidence_role: 'primary_evidence'
        }
      ]
    })
  ]);

  assert.deepEqual(bundle.evidence_urls, ['https://github.com/androidx/androidx/pull/5678']);
});

test('event bundle builder falls back to CVE id before normalized primary URL', () => {
  const [bundle] = buildEventBundles([
    candidate({
      title: 'Camera component security note CVE-2026-12345',
      url: 'https://example.com/security-note?utm_source=rss',
      version_or_release: '',
      summary: 'Camera security bulletin references CVE-2026-12345.'
    })
  ]);

  assert.equal(bundle.event_type, EVENT_TYPES.CVE);
  assert.equal(bundle.dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.CVE);
  assert.equal(bundle.event_key, 'cve:CVE-2026-12345');
});

test('event bundle builder final fallback is normalized primary URL', () => {
  const [bundle] = buildEventBundles([
    candidate({
      title: 'Generic camera note',
      url: 'https://Example.com/camera-note?utm_source=rss#section',
      version_or_release: '',
      published_date: '',
      api_or_component: ''
    })
  ]);

  assert.equal(bundle.event_type, EVENT_TYPES.PRIMARY_URL);
  assert.equal(bundle.dedupe_reason, EVENT_BUNDLE_DEDUPE_REASONS.NORMALIZED_PRIMARY_URL);
  assert.equal(bundle.event_key, 'url:https://example.com/camera-note');
  assert.equal(bundle.primary_url, 'https://example.com/camera-note');
});

test('event bundles are not wired into deterministic selection scoring in PR5', () => {
  const baseCandidates = [
    candidate({
      title: 'Generic camera linked note A',
      url: 'https://example.com/a',
      version_or_release: '',
      camera_hal_relevance_score: 40
    }),
    candidate({
      title: 'Generic camera linked note B',
      url: 'https://example.com/b',
      version_or_release: '',
      camera_hal_relevance_score: 80
    })
  ];
  const withBundles = baseCandidates.map(item => ({
    ...item,
    event_bundles: buildEventBundles([item])
  }));
  const baseReport = buildShortlistReport('2026-05-10', baseCandidates, { minArticles: 1 });
  const enrichedReport = buildShortlistReport('2026-05-10', withBundles, { minArticles: 1 });

  assert.deepEqual(
    enrichedReport.shortlisted_candidates.map(item => item.url),
    baseReport.shortlisted_candidates.map(item => item.url)
  );
  assert.deepEqual(
    enrichedReport.shortlisted_candidates.map(item => item.deterministic_score),
    baseReport.shortlisted_candidates.map(item => item.deterministic_score)
  );
});
