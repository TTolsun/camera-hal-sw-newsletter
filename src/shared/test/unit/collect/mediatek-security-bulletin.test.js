const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveMediatekSecurityBulletinItems
} = require('../../../collect/mediatek-security-bulletin');
const { readTextFixture } = require('../../helpers/fixture-loader');

// 로케일 파라미터(?hsLang=en)는 리졸버가 떼어낸다 — fetch도 후보 URL도 파라미터 없는 형태다.
const AUGUST_URL = 'https://www.mediatek.com/product-security-bulletin/august-2026';

function source(overrides = {}) {
  return {
    id: 'mediatek-security-bulletin',
    name: 'MediaTek Security Bulletin',
    url: 'https://www.mediatek.com/product-security-bulletin',
    sourceUrl: 'https://www.mediatek.com/product-security-bulletin',
    ...overrides
  };
}

function indexHtml() {
  return readTextFixture('source-html/mediatek-security-bulletin-index.html');
}

function monthlyFetch(fetched = []) {
  const monthly = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html');
  return async (url) => {
    fetched.push(url);
    if (url === AUGUST_URL) return monthly;
    throw new Error(`unexpected fetch: ${url}`);
  };
}

test('follows the newest monthly bulletin from the index', async () => {
  const fetched = [];
  await resolveMediatekSecurityBulletinItems(indexHtml(), source(), { fetchTextImpl: monthlyFetch(fetched) });

  assert.deepEqual(fetched, [AUGUST_URL], '인덱스 링크 순서가 아니라 연/월이 가장 최신인 게시판을 따라간다');
});

test('emits one candidate per camera CVE, ordered by severity', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  // imgsys(High)가 imgsensor(Medium)보다 앞선다 — 심각도 내림차순 계약.
  assert.deepEqual(items.map(item => item.cve_id), ['CVE-2026-20487', 'CVE-2026-20486']);
  // imgsys 토큰이 카메라 어휘에 실제로 들어 있어야 이 항목이 나온다(심각도 하한과 무관하게).
  assert.equal(items[0].api_or_component, 'MediaTek Security Bulletin / imgsys');
});

test('emits concrete dated evidence for each camera CVE', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const item = items.find(entry => entry.cve_id === 'CVE-2026-20486');
  assert.equal(item.publishedAt, '2026-08-03', '게시판 본문의 Published 날짜를 쓴다');
  assert.equal(item.sourceKind, 'release_note_item');
  assert.equal(item.version_or_release, 'CVE-2026-20486');
  assert.equal(item.api_or_component, 'MediaTek Security Bulletin / imgsensor');
  assert.equal(item.relevanceBucketHint, 'camera_driver_image_pipeline');
  assert.equal(item.url, `${AUGUST_URL}#CVE_2026_20486`);
  assert.match(item.title, /August 2026 MediaTek Security Bulletin: CVE-2026-20486 — imgsensor/);
  assert.match(item.behavior_change, /incorrect error handling/);
  assert.match(item.behavior_change, /CWE-754/);
  assert.match(item.behavior_change, /MT8910/, '영향 칩셋 목록이 증거에 남는다');
});

test('excludes non-camera subcomponents even at higher severity', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const components = items.map(item => item.api_or_component).join(' ');
  assert.doesNotMatch(components, /TFA|hevc decoder|display/);
});

test('excludes camera CVEs below the Moderate severity floor', async () => {
  // 'camera raw' 행은 카메라 어휘에는 맞지만 Low라 하한에 걸린다.
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.doesNotMatch(items.map(item => item.cve_id).join(' '), /CVE-2026-20489/);
});

// MediaTek은 2월 링크를 'feb-2026'처럼 줄여 쓴다. 약어 매핑이 빠지면 그 달을 통째로 못 본다.
test('resolves abbreviated month links such as feb-2026', async () => {
  const FEB_URL = 'https://www.mediatek.com/product-security-bulletin/feb-2026';
  const fetched = [];
  const monthly = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html');

  await resolveMediatekSecurityBulletinItems([
    '<html><body>',
    '<a href="https://www.mediatek.com/product-security-bulletin/january-2026?hsLang=en"></a>',
    `<a href="${FEB_URL}?hsLang=en"></a>`,
    '</body></html>'
  ].join(''), source(), {
    fetchTextImpl: async (url) => {
      fetched.push(url);
      return monthly;
    }
  });

  assert.deepEqual(fetched, [FEB_URL]);
});

// 이 리졸버가 만드는 후보 URL은 official_release_source 증거로 쓰인다. 인덱스에 섞인
// 제3자 host 링크를 따라가면 남의 페이지를 MediaTek 공식 증거로 싣게 된다.
// 정규식 자체가 깨져도 items가 비므로, "host 때문에 버렸다"는 사실을 경고로 확인한다.
test('never follows a monthly link on a different host', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  let items;
  try {
    items = await resolveMediatekSecurityBulletinItems(
      '<html><body><a href="https://attacker.example/product-security-bulletin/december-2026?hsLang=en"></a></body></html>',
      source(),
      {
        fetchTextImpl: async (url) => {
          throw new Error(`should not fetch a foreign host: ${url}`);
        }
      }
    );
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(items, []);
  assert.ok(
    warnings.some(line => line.includes('host differs from www.mediatek.com')),
    'host 불일치로 버렸다는 사유가 남아야 한다(정규식 미매치와 구분)'
  );
});

// 로케일 파라미터는 증거 URL의 일부가 아니다.
test('strips the locale query string from the emitted evidence URL', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: async () => readTextFixture('source-html/mediatek-security-bulletin-2026-08.html')
  });

  for (const item of items) {
    assert.doesNotMatch(item.url, /hsLang/);
    assert.match(item.url, /^https:\/\/www\.mediatek\.com\/product-security-bulletin\/august-2026#CVE_/);
  }
});

test('warns when the registered source URL is unreadable instead of blaming link hosts', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveMediatekSecurityBulletinItems(indexHtml(), source({ url: '', sourceUrl: 'not-a-url' }), {
      fetchTextImpl: async (url) => {
        throw new Error(`should not fetch: ${url}`);
      }
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('registered source URL is unreadable')));
  assert.ok(!warnings.some(line => line.includes('host differs from')), 'host 불일치로 잘못 보고하지 않는다');
});

test('warns when no monthly bulletin link matches on the index page', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveMediatekSecurityBulletinItems(
      '<html><body><a href="https://www.mediatek.com/product-security-bulletin">Security Bulletin</a></body></html>',
      source(),
      {
        fetchTextImpl: async (url) => {
          throw new Error(`should not fetch: ${url}`);
        }
      }
    );
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('no monthly bulletin link matched')));
});

test('warns when the monthly page returns an empty body', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveMediatekSecurityBulletinItems(indexHtml(), source(), { fetchTextImpl: async () => '' });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('returned an empty body')));
});

test('warns when the monthly page has no CVE table rows', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
      fetchTextImpl: async () => '<html><body><p>Published 2026-08-03</p></body></html>'
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('no CVE table rows')));
});

test('warns when the monthly fetch fails instead of looking like a quiet month', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
      fetchTextImpl: async () => {
        throw new Error('network down');
      }
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('failed to fetch') && line.includes('network down')));
});

test('warns when the monthly page has no Published date', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
      fetchTextImpl: async () => readTextFixture('source-html/mediatek-security-bulletin-2026-08.html')
        .replace('Published 2026-08-03', 'Coming soon')
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('no Published date')));
});

test('resolves relative monthly links against the registered source URL', async () => {
  const fetched = [];
  const monthly = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html');

  await resolveMediatekSecurityBulletinItems(
    '<html><body><a href="/product-security-bulletin/august-2026?hsLang=en"></a></body></html>',
    source(),
    {
      fetchTextImpl: async (url) => {
        fetched.push(url);
        return monthly;
      }
    }
  );

  assert.deepEqual(fetched, [AUGUST_URL]);
});

test('returns empty when the bulletin has no Published date', async () => {
  // 날짜를 추정해 채우면 선정 창이 실제와 어긋난다. 없으면 후보를 만들지 않는다.
  const undated = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html')
    .replace('Published 2026-08-03', 'Coming soon');

  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: async () => undated
  });

  assert.deepEqual(items, []);
});

test('returns empty when the monthly fetch fails', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: async () => {
      throw new Error('network down');
    }
  });

  assert.deepEqual(items, []);
});

test('returns empty when the index has no monthly bulletin link', async () => {
  const items = await resolveMediatekSecurityBulletinItems(
    '<html><body><a href="https://www.mediatek.com/product-security-bulletin">Security Bulletin</a></body></html>',
    source(),
    {
      fetchTextImpl: async (url) => {
        throw new Error(`should not fetch: ${url}`);
      }
    }
  );

  assert.deepEqual(items, []);
});

test('respects the per-bulletin item cap, keeping the most severe', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch(),
    maxItems: 1
  });

  assert.deepEqual(items.map(item => item.cve_id), ['CVE-2026-20487']);
});
