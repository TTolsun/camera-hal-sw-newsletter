const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES,
  RAW_EXCERPT_MAX_LENGTH,
  resolveLinkedEvidence
} = require('../../..');
const { readTextFixture } = require('../../../../core/test/helpers/fixture-loader');

function fakeFetch(sequence) {
  const calls = [];
  const fetchClient = async (url, request = {}) => {
    calls.push({ url, request });
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    if (next === 'never') return new Promise(() => {});
    const response = next || {};
    const status = response.status || 200;
    const headers = response.headers || {};
    return {
      ok: response.ok ?? (status >= 200 && status < 300),
      status,
      statusText: response.statusText || 'OK',
      url: response.url || url,
      headers: {
        get(name) {
          const key = String(name || '').toLowerCase();
          if (key === 'location' && response.location) return response.location;
          const match = Object.entries(headers).find(([header]) => header.toLowerCase() === key);
          return match ? match[1] : null;
        }
      },
      text: async () => {
        if (typeof response.onText === 'function') response.onText();
        if (response.textError) throw response.textError;
        return response.body || '';
      }
    };
  };
  fetchClient.calls = calls;
  return fetchClient;
}

function githubEvidence(overrides = {}) {
  return {
    type: LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST,
    url: 'https://github.com/androidx/androidx/pull/1234',
    identifier: 'androidx/androidx#1234',
    fetch_status: FETCH_STATUSES.NOT_FETCHED,
    ...overrides
  };
}

function genericEvidence(overrides = {}) {
  return {
    type: LINKED_EVIDENCE_TYPES.GENERIC_URL,
    url: 'https://example.com/linked-evidence',
    identifier: 'https://example.com/linked-evidence',
    fetch_status: FETCH_STATUSES.NOT_FETCHED,
    ...overrides
  };
}

function assertEmptyResolved(resolved) {
  assert.deepEqual(resolved, {
    title: '',
    summary: '',
    changed_files: [],
    bug_ids: [],
    cve_ids: [],
    test_info: '',
    labels: [],
    component: ''
  });
}

test('resolver skips fetch by default and does not call injected fetch client', async () => {
  const fetchClient = fakeFetch([{ body: '<title>Should not fetch</title>' }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], { fetchClient });
  const [missingClient] = await resolveLinkedEvidence([githubEvidence()], { enableNetwork: true });

  assert.equal(fetchClient.calls.length, 0);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.resolver, 'github');
  assert.ok(resolved.warnings.some(item => item.includes('enableNetwork')));
  assertEmptyResolved(resolved.resolved);
  assert.equal(missingClient.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.ok(missingClient.warnings.some(item => item.includes('fetchClient')));
  assertEmptyResolved(missingClient.resolved);
});

test('resolver enforces https-only before network fetch', async () => {
  const fetchClient = fakeFetch([{ body: '<title>Should not fetch http</title>' }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence({
    url: 'http://github.com/androidx/androidx/pull/1234'
  })], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 0);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'non_https_url');
  assert.ok(resolved.warnings.some(item => item.includes('non-https')));
  assertEmptyResolved(resolved.resolved);
});

test('resolver rejects non-https redirect targets before reading body', async () => {
  let textCalled = false;
  const fetchClient = fakeFetch([{
    status: 302,
    location: 'http://github.com/androidx/androidx/pull/1234',
    body: '<title>Redirect body must not be read</title>',
    onText: () => {
      textCalled = true;
    }
  }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].request.redirect, 'manual');
  assert.equal(textCalled, false);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'redirect_non_https_url');
  assertEmptyResolved(resolved.resolved);
});

test('resolver rejects unsafe final response URLs before reading body', async () => {
  let textCalled = false;
  const fetchClient = fakeFetch([{
    url: 'http://github.com/androidx/androidx/pull/1234',
    body: '<title>Final response body must not be read</title>',
    onText: () => {
      textCalled = true;
    }
  }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(textCalled, false);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'redirect_non_https_url');
  assertEmptyResolved(resolved.resolved);
});

test('resolver rejects disallowed redirect final URLs through validator', async () => {
  const fetchClient = fakeFetch([{
    status: 302,
    location: 'https://example.com/not-allowed'
  }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient,
    validateFinalUrl(finalUrl) {
      return new URL(finalUrl).hostname === 'github.com'
        ? { ok: true }
        : {
            ok: false,
            skippedReason: 'redirect_domain_not_allowed',
            warning: 'redirect final URL rejected by test policy'
          };
    }
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'redirect_domain_not_allowed');
  assert.ok(resolved.warnings.includes('redirect final URL rejected by test policy'));
  assertEmptyResolved(resolved.resolved);
});

test('resolver treats missing redirect location as non-fatal skipped diagnostics', async () => {
  const fetchClient = fakeFetch([{ status: 302 }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'redirect_invalid_location');
  assertEmptyResolved(resolved.resolved);
});

test('resolver follows allowed https redirects and keeps final response safe', async () => {
  const fetchClient = fakeFetch([
    {
      status: 302,
      location: 'https://github.com/androidx/androidx/pull/1234'
    },
    {
      body: readTextFixture('linked-evidence/github-pr-resolved.html'),
      url: 'https://github.com/androidx/androidx/pull/1234'
    }
  ]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence({
    url: 'https://github.com/androidx/androidx/pull/redirect'
  })], {
    enableNetwork: true,
    fetchClient,
    validateFinalUrl(finalUrl) {
      return new URL(finalUrl).hostname === 'github.com'
        ? { ok: true }
        : { ok: false, skippedReason: 'redirect_domain_not_allowed' };
    }
  });

  assert.equal(fetchClient.calls.length, 2);
  assert.equal(fetchClient.calls[0].request.redirect, 'manual');
  assert.equal(resolved.fetch_status, FETCH_STATUSES.RESOLVED);
  assert.match(resolved.resolved.title, /Fix CameraX video capture metadata/);
});

test('resolver stops redirect loops at the fixed redirect limit', async () => {
  const fetchClient = fakeFetch([
    { status: 302, location: 'https://github.com/androidx/androidx/pull/loop-1' },
    { status: 302, location: 'https://github.com/androidx/androidx/pull/loop-2' },
    { status: 302, location: 'https://github.com/androidx/androidx/pull/loop-3' },
    { status: 302, location: 'https://github.com/androidx/androidx/pull/loop-4' }
  ]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 4);
  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'redirect_limit_exceeded');
  assertEmptyResolved(resolved.resolved);
});

test('resolver resolves GitHub evidence with structured fields and keeps resolved payload', async () => {
  const fetchClient = fakeFetch([{ body: readTextFixture('linked-evidence/github-pr-resolved.html') }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].url, 'https://github.com/androidx/androidx/pull/1234');
  assert.equal(resolved.fetch_status, FETCH_STATUSES.RESOLVED);
  assert.equal(resolved.resolver, 'github');
  assert.ok(resolved.raw_excerpt.length <= RAW_EXCERPT_MAX_LENGTH);
  assert.match(resolved.resolved.title, /Fix CameraX video capture metadata/);
  assert.ok(resolved.resolved.summary.includes('CameraPipe request metadata'));
  assert.ok(resolved.resolved.changed_files.includes('camera/core/src/main/java/androidx/camera/core/VideoCapture.java'));
  assert.ok(resolved.resolved.changed_files.includes('camera/camera2/src/test/java/androidx/camera/camera2/CameraPipeTest.kt'));
  assert.deepEqual(resolved.resolved.labels, ['camera', 'CameraX']);
  assert.deepEqual(resolved.resolved.bug_ids, ['345678901']);
  assert.equal(resolved.resolved.test_info, 'CameraPipeTest, VideoCaptureDeviceTest');
  assert.equal(resolved.resolved.component, 'CameraX VideoCapture');
});

test('resolver caps raw_excerpt by maxExcerptChars and RAW_EXCERPT_MAX_LENGTH', async () => {
  const body = readTextFixture('linked-evidence/long-evidence.html');
  const smallCapFetch = fakeFetch([{ body }]);
  const rawMaxFetch = fakeFetch([{ body }]);

  const [smallCap] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: smallCapFetch,
    maxExcerptChars: 120
  });
  const [rawMax] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: rawMaxFetch,
    maxExcerptChars: RAW_EXCERPT_MAX_LENGTH + 200
  });

  assert.equal(smallCap.raw_excerpt.length, 120);
  assert.equal(rawMax.raw_excerpt.length, RAW_EXCERPT_MAX_LENGTH);
  assert.ok(smallCap.warnings.includes('excerpt_truncated'));
  assert.ok(rawMax.warnings.includes('excerpt_truncated'));
  assert.equal(JSON.stringify(rawMax).includes('LONG_BODY_SENTINEL_END'), false);
});

test('resolver skips oversized responses without structured extraction', async () => {
  const fetchClient = fakeFetch([{
    body: `<title>Oversized evidence</title>${'x'.repeat(120)}`
  }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient,
    maxBytes: 40
  });

  assert.equal(resolved.fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(resolved.skipped_reason, 'response_too_large');
  assert.ok(resolved.raw_excerpt.length <= RAW_EXCERPT_MAX_LENGTH);
  assert.ok(resolved.warnings.some(item => item.includes('max bytes')));
  assertEmptyResolved(resolved.resolved);
});

test('resolver caps max links per candidate with skipped diagnostics', async () => {
  const fetchClient = fakeFetch([
    { body: readTextFixture('linked-evidence/github-pr-resolved.html') },
    { body: '<title>Should not fetch over limit</title>' }
  ]);

  const results = await resolveLinkedEvidence([
    githubEvidence({ identifier: 'androidx/androidx#1234' }),
    githubEvidence({
      url: 'https://github.com/androidx/androidx/pull/5678',
      identifier: 'androidx/androidx#5678'
    })
  ], {
    enableNetwork: true,
    fetchClient,
    maxLinksPerCandidate: 1
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(results[0].fetch_status, FETCH_STATUSES.RESOLVED);
  assert.equal(results[1].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(results[1].skipped_reason, 'max_links_per_candidate_exceeded');
});

test('resolver reports incomplete structured extraction for plain body snippets', async () => {
  const fetchClient = fakeFetch([{ body: 'Plain body is useful only as raw_excerpt context.' }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(resolved.fetch_status, FETCH_STATUSES.RESOLVED);
  assert.equal(resolved.resolved.summary, '');
  assert.ok(resolved.warnings.includes('structured_extraction_incomplete'));
  assert.ok(resolved.raw_excerpt.includes('Plain body'));
});

test('resolver fails malformed response-like objects without resolving content', async () => {
  const missingStatusFetch = async () => ({
    ok: true,
    text: async () => '<title>Missing status must not resolve</title>'
  });
  const nonNumericStatusFetch = async () => ({
    ok: true,
    status: 'OK',
    text: async () => '<title>Bad status must not resolve</title>'
  });
  const missingTextFetch = async () => ({
    ok: true,
    status: 200
  });

  const [missingStatus] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: missingStatusFetch
  });
  const [nonNumericStatus] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: nonNumericStatusFetch
  });
  const [missingText] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: missingTextFetch
  });

  assert.equal(missingStatus.fetch_status, FETCH_STATUSES.FAILED);
  assert.equal(nonNumericStatus.fetch_status, FETCH_STATUSES.FAILED);
  assert.equal(missingText.fetch_status, FETCH_STATUSES.FAILED);
  assert.ok(missingStatus.warnings.some(item => item.includes('status')));
  assert.ok(nonNumericStatus.warnings.some(item => item.includes('status')));
  assert.ok(missingText.warnings.some(item => item.includes('text()')));
  assertEmptyResolved(missingStatus.resolved);
  assertEmptyResolved(nonNumericStatus.resolved);
  assertEmptyResolved(missingText.resolved);
});

test('generic URL resolver keeps source-specific changed files and labels empty', async () => {
  const fetchClient = fakeFetch([{
    body: [
      '<title>Generic camera evidence page</title>',
      '<meta name="description" content="Generic page with camera context.">',
      '<span data-name="camera"></span>',
      '<div data-path="camera/core/src/main/java/androidx/camera/core/VideoCapture.java"></div>',
      '<p>Component: Generic Camera Page</p>'
    ].join('\n')
  }]);

  const [resolved] = await resolveLinkedEvidence([genericEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(resolved.fetch_status, FETCH_STATUSES.RESOLVED);
  assert.equal(resolved.resolver, 'generic_url');
  assert.equal(resolved.resolved.title, 'Generic camera evidence page');
  assert.equal(resolved.resolved.summary, 'Generic page with camera context.');
  assert.equal(resolved.resolved.component, 'Generic Camera Page');
  assert.deepEqual(resolved.resolved.changed_files, []);
  assert.deepEqual(resolved.resolved.labels, []);
});

test('resolver marks blocked HTTP status without reading or inferring body', async () => {
  let textCalled = false;
  const fetchClient = fakeFetch([{
    ok: false,
    status: 403,
    body: '<title>Blocked title must not be parsed</title>',
    onText: () => {
      textCalled = true;
    }
  }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.equal(resolved.fetch_status, FETCH_STATUSES.BLOCKED);
  assert.equal(textCalled, false);
  assertEmptyResolved(resolved.resolved);
});

test('resolver failures are non-fatal for thrown, timeout, and non-blocked HTTP failures', async () => {
  const thrownFetch = fakeFetch([new Error('network denied')]);
  const timeoutFetch = fakeFetch(['never']);
  const serverFetch = fakeFetch([{ ok: false, status: 500, body: '<title>Not parsed</title>' }]);

  const [thrown] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: thrownFetch
  });
  const [timeout] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: timeoutFetch,
    timeoutMs: 5
  });
  const [server] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient: serverFetch
  });

  assert.equal(thrown.fetch_status, FETCH_STATUSES.FAILED);
  assert.equal(timeout.fetch_status, FETCH_STATUSES.FAILED);
  assert.equal(server.fetch_status, FETCH_STATUSES.FAILED);
  assertEmptyResolved(thrown.resolved);
  assertEmptyResolved(timeout.resolved);
  assertEmptyResolved(server.resolved);
});

test('unsupported and malformed inputs do not throw', async () => {
  assert.deepEqual(await resolveLinkedEvidence(null), []);

  const results = await resolveLinkedEvidence([
    { type: LINKED_EVIDENCE_TYPES.CVE, identifier: 'CVE-2026-12345', fetch_status: FETCH_STATUSES.NOT_FETCHED },
    { type: LINKED_EVIDENCE_TYPES.DOCS_ANCHOR, identifier: '#camera', fetch_status: FETCH_STATUSES.NOT_FETCHED },
    { type: LINKED_EVIDENCE_TYPES.UNKNOWN, fetch_status: FETCH_STATUSES.NOT_FETCHED },
    { type: LINKED_EVIDENCE_TYPES.ANDROID_GERRIT, identifier: 'I1234567890abcdef', fetch_status: FETCH_STATUSES.NOT_FETCHED },
    { type: LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER, identifier: '345678901', fetch_status: FETCH_STATUSES.NOT_FETCHED }
  ]);

  assert.equal(results.length, 5);
  for (const item of results) {
    assert.equal(item.fetch_status, FETCH_STATUSES.UNSUPPORTED);
    assertEmptyResolved(item.resolved);
  }
});

test('resolved structured fields are not dropped by PR1 normalizer shape', async () => {
  const fetchClient = fakeFetch([{ body: readTextFixture('linked-evidence/github-pr-resolved.html') }]);

  const [resolved] = await resolveLinkedEvidence([githubEvidence()], {
    enableNetwork: true,
    fetchClient
  });

  assert.deepEqual(Object.keys(resolved.resolved), [
    'title',
    'summary',
    'changed_files',
    'bug_ids',
    'cve_ids',
    'test_info',
    'labels',
    'component'
  ]);
  assert.notEqual(resolved.resolved.title, '');
  assert.notDeepEqual(resolved.resolved.labels, []);
  assert.notDeepEqual(resolved.resolved.changed_files, []);
  assert.notEqual(resolved.resolved.test_info, '');
});
