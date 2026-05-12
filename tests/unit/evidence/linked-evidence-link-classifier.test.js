const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EVIDENCE_ROLES,
  classifyOutgoingLink,
  classifyOutgoingLinks
} = require('../../../scripts/newsroom/evidence');

const androidPolicy = {
  enabled: true,
  allowedDomains: [
    'developer.android.com',
    'android-review.googlesource.com',
    'issuetracker.google.com',
    'github.com'
  ],
  importantAnchorKeywords: ['release notes', 'documentation', 'issue', 'gerrit', 'pull request', 'details'],
  ignoreAnchorKeywords: ['privacy', 'subscribe', 'share', 'rss', 'profile', 'terms']
};

test('classifier keeps invalid URLs unsupported and policy-disabled links deferred', () => {
  assert.equal(
    classifyOutgoingLink({ url: 'not-a-url', text: 'release notes' }, androidPolicy).evidence_role,
    EVIDENCE_ROLES.UNSUPPORTED
  );
  assert.equal(
    classifyOutgoingLink({
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      text: 'release notes'
    }, { enabled: false }).evidence_role,
    EVIDENCE_ROLES.BLOCKED_OR_DEFERRED
  );
});

test('classifier treats privacy share subscribe rss and profile links as noise before allow checks', () => {
  const links = classifyOutgoingLinks([
    { url: 'https://developer.android.com/privacy', text: 'Privacy' },
    { url: 'https://android-developers.googleblog.com/feeds/posts/default?alt=rss', text: 'RSS' },
    { url: 'https://github.com/androidx/androidx/profile', text: 'profile' },
    { url: 'https://example.com/share?url=https://developer.android.com', text: 'Share' }
  ], androidPolicy);

  assert.deepEqual(
    links.map(link => link.evidence_role),
    [
      EVIDENCE_ROLES.NOISE,
      EVIDENCE_ROLES.NOISE,
      EVIDENCE_ROLES.NOISE,
      EVIDENCE_ROLES.NOISE
    ]
  );
});

test('classifier marks allowed official evidence links as primary evidence', () => {
  const links = classifyOutgoingLinks([
    {
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      text: 'CameraX release notes',
      source_field: 'rss.description',
      extraction_method: 'html_anchor'
    },
    {
      url: 'https://android-review.googlesource.com/c/platform/frameworks/support/+/3456789',
      text: 'Gerrit change'
    },
    {
      url: 'https://issuetracker.google.com/issues/345678901',
      text: 'IssueTracker bug'
    },
    {
      url: 'https://github.com/androidx/androidx/pull/1234',
      text: 'pull request'
    }
  ], androidPolicy);

  assert.deepEqual(
    links.map(link => link.evidence_role),
    [
      EVIDENCE_ROLES.PRIMARY_EVIDENCE,
      EVIDENCE_ROLES.PRIMARY_EVIDENCE,
      EVIDENCE_ROLES.PRIMARY_EVIDENCE,
      EVIDENCE_ROLES.PRIMARY_EVIDENCE
    ]
  );
  assert.equal(links[0].source_field, 'rss.description');
  assert.equal(links[0].extraction_method, 'html_anchor');
});

test('classifier separates unsupported domains from allowed secondary context', () => {
  assert.equal(
    classifyOutgoingLink({
      url: 'https://example.com/camera-details',
      text: 'release notes'
    }, androidPolicy).evidence_role,
    EVIDENCE_ROLES.UNSUPPORTED
  );
  assert.equal(
    classifyOutgoingLink({
      url: 'https://developer.android.com/about',
      text: 'details'
    }, androidPolicy).evidence_role,
    EVIDENCE_ROLES.SECONDARY_CONTEXT
  );
  assert.equal(
    classifyOutgoingLink({
      url: 'https://developer.android.com/about',
      text: 'details'
    }, androidPolicy).classification_reason,
    'important_allowed_context_link'
  );
});

test('classifier does not mutate preservation input roles', () => {
  const link = {
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    text: 'CameraX release notes',
    source_field: 'rss.description',
    extraction_method: 'html_anchor',
    evidence_role: 'unclassified'
  };
  const [classified] = classifyOutgoingLinks([link], androidPolicy);

  assert.equal(link.evidence_role, 'unclassified');
  assert.equal(classified.evidence_role, EVIDENCE_ROLES.PRIMARY_EVIDENCE);
});
