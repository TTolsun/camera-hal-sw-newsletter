const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  missingIssueClasses,
  validateRenderedIssueStructure,
  validateArticleImages
} = require('../../quality/rendered-issue-structure');
const {
  buildMarkdown,
  buildHtml
} = require('../../render/newsletter-renderer');
const {
  validSections
} = require('../../../shared/test/helpers/quality-builders');
const {
  tempRoot,
  writeJson,
  writeText
} = require('../../../shared/test/helpers/fs');

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const validateSitePath = path.join(repoRoot, 'src', 'generator', 'validate', 'validate-site.js');
const LEGACY_SOURCE_LABEL = '\u7570\uc496\ucfc2';

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 발행된 저장소에는 인덱스가 둘 다 있다: 품질 재계산이 읽는 daily와 홈·아카이브가 fetch하는
// weekly. 구조 검증이 둘 다 스캔하므로 fixture도 둘 다 써야 실제 저장소 모양이 된다.
function writeNewsletterIndex(root, date = '2026-05-09') {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date: '2026-05-08',
    title: 'Existing published issue',
    summary: 'Existing issue entry',
    html: 'newsletters/2026-05-08/index.html',
    md: 'newsletters/2026-05-08/newsletter.md',
    tags: ['camera-hal']
  }]);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey: '2026-W19',
    weekStartDate: '2026-05-04',
    weekEndDate: '2026-05-10',
    date: '2026-05-04',
    title: '2026 W19',
    summary: 'Existing weekly issue entry',
    html: 'newsletters/2026-W19/index.html',
    md: 'newsletters/2026-W19/newsletter.md',
    tags: ['camera-hal']
  }]);
  return date;
}

// coverage 필드 검증 전용 fixture: daily 인덱스는 그대로 두고 weekly 인덱스 entry에만
// coverage 값을 얹는다(validateNewsletterIndex는 두 인덱스를 모두 스캔한다).
function writeWeeklyIndexWithCoverage(root, coverageOverrides = {}) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date: '2026-05-08',
    title: 'Existing published issue',
    summary: 'Existing issue entry',
    html: 'newsletters/2026-05-08/index.html',
    md: 'newsletters/2026-05-08/newsletter.md',
    tags: ['camera-hal']
  }]);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey: '2026-W19',
    weekStartDate: '2026-05-04',
    weekEndDate: '2026-05-10',
    date: '2026-05-04',
    title: '2026 W19',
    summary: 'Existing weekly issue entry',
    html: 'newsletters/2026-W19/index.html',
    md: 'newsletters/2026-W19/newsletter.md',
    tags: ['camera-hal'],
    ...coverageOverrides
  }]);
}

function issue(overrides = {}) {
  const date = overrides.date || '2026-05-09';
  return {
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Weekly Camera HAL software update.',
    briefing: overrides.briefing || [
      'CameraX release gives HAL teams a validation signal.',
      'libcamera update keeps image pipeline checks visible.',
      'Native tooling changes stay review-only unless directly relevant.'
    ],
    sections: overrides.sections || validSections(3),
    action_items: ['Check request/result metadata and stream behavior.'],
    references: [{ title: 'Reference', url: 'https://example.com/reference' }],
    ...overrides
  };
}

function renderedFixture(overrides = {}) {
  const root = tempRoot('rendered-issue-structure-');
  const date = writeNewsletterIndex(root, overrides.date);
  const editor = issue({ ...overrides, date });
  const markdown = overrides.markdown || buildMarkdown(editor);
  const html = overrides.html || buildHtml(editor);
  return { root, date, editor, markdown, html };
}

function validateFixture(overrides = {}) {
  const fixture = renderedFixture(overrides);
  return {
    ...fixture,
    result: validateRenderedIssueStructure(fixture)
  };
}

function withImageSection(root, overrides = {}) {
  const selectedImage = overrides.selectedImage || '../../assets/images/fallback/android.svg';
  if (overrides.writeFallback !== false) {
    writeText(path.join(root, 'articles', 'assets', 'images', 'fallback', 'android.svg'), '<svg></svg>\n');
  }
  return validSections(3).map((section, index) => index === 0
    ? {
        ...section,
        selectedImage,
        imageSource: 'https://example.com/image-source',
        imageAttribution: 'Example image source',
        imageAlt: 'Example Camera HAL image',
        imageUsageDecisionReason: 'Fallback image used for structural validation.',
        imageLicenseStatus: 'unknown',
        resolvedImage: {
          url: selectedImage,
          src: selectedImage,
          usedFallback: true
        },
        ...overrides.section
      }
    : section);
}

test('rendered issue structure accepts normal rendered markdown and HTML', () => {
  const { result } = validateFixture();

  assert.equal(result.ok, true, result.text);
});

test('rendered issue structure rejects markdown structural failures', () => {
  const base = renderedFixture();
  const cases = [
    ['TODO content', `${base.markdown}\nTODO: remove me`, /TODO/],
    ['missing briefing', base.markdown.replace(/^##\s+1\..+$/m, '## Briefing removed'), /briefing section/],
    ['two briefing bullets', buildMarkdown(issue({ date: base.date, briefing: ['one', 'two'] })), /exactly 3 briefing bullets/],
    ['missing references', base.markdown.replace(/\n## [^\n]+\n\n- \[Reference\]\(https:\/\/example\.com\/reference\)\n?$/m, ''), /References/],
    ['missing source heading', base.markdown.replace(new RegExp(`\\*\\*(Sources|출처|${escapeRegExp(LEGACY_SOURCE_LABEL)})[^\\n]*\\*\\*`), '**Source heading removed**'), /sources heading/],
    ['missing source URL', base.markdown.replace('https://example.com/a', 'ftp://example.com/a'), /no source entries/]
  ];

  for (const [name, markdown, pattern] of cases) {
    const result = validateRenderedIssueStructure({
      root: base.root,
      date: base.date,
      editor: base.editor,
      markdown,
      html: base.html
    });
    assert.equal(result.ok, false, `${name} unexpectedly passed`);
    assert.match(result.text, pattern, name);
  }
});

// 기사가 1건인 호에서만 "이번 주 핵심" 상자(issue-briefing)를 요구하지 않는다(#1278 소유자 결정).
// 기사가 2건 이상이면 상자가 없을 때 계속 실패해야 한다.
test('issue-briefing is optional only for single-article issues', () => {
  const page = sections => `<section class="section issue-briefing"></section>${sections}` +
    '<div class="source-list"></div><div class="reference-list"></div>';
  const article = '<section class="section issue-story issue-section article-card"></section>';
  const withoutBriefing = html => html.replace('<section class="section issue-briefing"></section>', '');

  assert.deepEqual(missingIssueClasses(page(article)), []);
  assert.deepEqual(missingIssueClasses(withoutBriefing(page(article))), []);
  assert.deepEqual(missingIssueClasses(page(article + article)), []);
  assert.deepEqual(missingIssueClasses(withoutBriefing(page(article + article))), ['issue-briefing']);
  assert.deepEqual(missingIssueClasses(withoutBriefing(page(''))), ['issue-briefing', 'issue-section']);
});

test('rendered issue structure rejects HTML structural failures', () => {
  const base = renderedFixture();
  const sourceListWithoutLink = base.html.replace(
    /<div class="source-list">[\s\S]*?<\/div>/,
    '<div class="source-list"><strong>Sources</strong><ul><li>No link</li></ul></div>'
  );
  const cases = [
    ['malformed skeleton', base.html.replace('</html>', ''), /structurally invalid/],
    ['anchor mismatch', `${base.html}\n<a href="https://example.com">broken`, /Anchor tag mismatch/],
    ['missing issue class', base.html.replace('issue-briefing', 'briefing-missing'), /issue-briefing/],
    ['source-list without links', sourceListWithoutLink, /source-list has no source links/]
  ];

  for (const [name, html, pattern] of cases) {
    const result = validateRenderedIssueStructure({
      root: base.root,
      date: base.date,
      editor: base.editor,
      markdown: base.markdown,
      html
    });
    assert.equal(result.ok, false, `${name} unexpectedly passed`);
    assert.match(result.text, pattern, name);
  }
});

test('rendered issue structure rejects article image HTML contract failures', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = writeNewsletterIndex(root);
  const editor = issue({ date, sections: withImageSection(root) });
  const markdown = buildMarkdown(editor);
  const html = buildHtml(editor);
  const cases = [
    ['disallowed scheme', html.replace('src="../../assets/images/fallback/android.svg"', 'src="http://example.com/image.jpg"'), /disallowed URL scheme/],
    ['missing alt', html.replace(/(<img class="article-image"[^>]*\balt=")[^"]+"/, '$1"'), /missing alt text/],
    ['missing lazy loading', html.replace('loading="lazy"', 'loading="eager"'), /loading="lazy"/],
    ['invalid fallback path', html.replace('../../assets/images/fallback/android.svg', '../assets/images/not-fallback/android.svg'), /repo-local fallback/]
  ];

  for (const [name, badHtml, pattern] of cases) {
    const result = validateRenderedIssueStructure({ root, date, editor, markdown, html: badHtml });
    assert.equal(result.ok, false, `${name} unexpectedly passed`);
    assert.match(result.text, pattern, name);
  }
});

test('article image caption attribution is required only for images that came from a source', () => {
  // fallback 이미지에는 캡션 출처 링크를 요구하지 않는다. 어느 출처에서도 오지 않았기 때문이다.
  const fallbackRoot = tempRoot('rendered-issue-structure-');
  const fallbackDate = writeNewsletterIndex(fallbackRoot);
  const fallbackEditor = issue({ date: fallbackDate, sections: withImageSection(fallbackRoot) });
  const fallbackHtml = buildHtml(fallbackEditor);
  assert.doesNotMatch(fallbackHtml, /article-image-caption/, 'renderer should not caption a fallback image');
  const fallbackResult = validateRenderedIssueStructure({
    root: fallbackRoot,
    date: fallbackDate,
    editor: fallbackEditor,
    markdown: buildMarkdown(fallbackEditor),
    html: fallbackHtml
  });
  assert.equal(fallbackResult.ok, true, fallbackResult.text);

  // 반대로 실제 출처에서 가져온 이미지는 캡션 출처 링크가 계속 강제된다.
  const sourcedImage = 'https://developer.android.com/static/images/social/android-developers.png';
  const sourcedRoot = tempRoot('rendered-issue-structure-');
  const sourcedDate = writeNewsletterIndex(sourcedRoot);
  const sourcedEditor = issue({
    date: sourcedDate,
    sections: withImageSection(sourcedRoot, {
      selectedImage: sourcedImage,
      section: {
        imageCandidates: [{ url: sourcedImage }],
        resolvedImage: { url: sourcedImage, src: sourcedImage, usedFallback: false }
      }
    })
  });
  const sourcedHtml = buildHtml(sourcedEditor);
  assert.match(sourcedHtml, /article-image-caption/, 'sourced image should render a caption');
  const sourcedBaseline = validateRenderedIssueStructure({
    root: sourcedRoot,
    date: sourcedDate,
    editor: sourcedEditor,
    markdown: buildMarkdown(sourcedEditor),
    html: sourcedHtml
  });
  assert.equal(sourcedBaseline.ok, true, sourcedBaseline.text);

  const sourcedFailures = [
    ['caption removed', sourcedHtml.replace(/<figcaption class="article-image-caption">[\s\S]*?<\/figcaption>/, '')],
    ['caption without source link', sourcedHtml.replace(/<figcaption class="article-image-caption">[\s\S]*?<\/figcaption>/, '<figcaption class="article-image-caption">Image source</figcaption>')]
  ];
  for (const [name, badHtml] of sourcedFailures) {
    const sourcedResult = validateRenderedIssueStructure({
      root: sourcedRoot,
      date: sourcedDate,
      editor: sourcedEditor,
      markdown: buildMarkdown(sourcedEditor),
      html: badHtml
    });
    assert.equal(sourcedResult.ok, false, `${name} unexpectedly passed`);
    assert.match(sourcedResult.text, /caption attribution/, name);
  }
});

// 캡션 출처 링크는 그 그림의 <figure> 안에서만 찾는다. 본문 재배치로 출처 목록이 그림 바로 뒤에
// 오면(PR #1291), 고정 글자 수 창으로는 출처 목록 링크를 캡션 링크로 오인해 게이트가 꺼진다.
test('caption attribution ignores https links outside the image figure', () => {
  const sourcedImage = 'https://developer.android.com/static/images/social/android-developers.png';
  const root = tempRoot('rendered-issue-structure-');
  const date = writeNewsletterIndex(root);
  const editor = issue({
    date,
    sections: withImageSection(root, {
      selectedImage: sourcedImage,
      section: {
        imageCandidates: [{ url: sourcedImage }],
        resolvedImage: { url: sourcedImage, src: sourcedImage, usedFallback: false }
      }
    })
  });
  const html = buildHtml(editor);
  const sourceListRightAfterFigure = '</figure>\n<ul class="source-list"><li><a href="https://example.com/source">Example source</a></li></ul>';
  const badHtml = html
    .replace(/<figcaption class="article-image-caption">[\s\S]*?<\/figcaption>/, '<figcaption class="article-image-caption">Image source</figcaption>')
    .replace(/<\/figure>/, sourceListRightAfterFigure);
  assert.match(badHtml, /Image source<\/figcaption>\s*<\/figure>\s*<ul class="source-list"><li><a href="https:/);

  const result = validateRenderedIssueStructure({ root, date, editor, markdown: buildMarkdown(editor), html: badHtml });

  assert.equal(result.ok, false, 'a caption without its own source link must fail even when a source list follows the figure');
  assert.match(result.text, /caption attribution/);
});

// 각 그림은 자기를 감싼 <figure>의 캡션만 쓴다. 같은 태그가 두 번 나오거나 figure 밖에 있으면
// 앞이나 뒤의 다른 figure 캡션을 빌려 쓰면 안 된다. 캡션은 class 토큰으로만 인정한다.
test('caption attribution is checked per image occurrence and per caption class token', () => {
  const sourcedImage = 'https://developer.android.com/static/images/social/android-developers.png';
  const sourcedRoot = tempRoot('rendered-issue-structure-');
  const sourcedDate = writeNewsletterIndex(sourcedRoot);
  const sourcedEditor = issue({
    date: sourcedDate,
    sections: withImageSection(sourcedRoot, {
      selectedImage: sourcedImage,
      section: {
        imageCandidates: [{ url: sourcedImage }],
        resolvedImage: { url: sourcedImage, src: sourcedImage, usedFallback: false }
      }
    })
  });
  const sourcedHtml = buildHtml(sourcedEditor);
  const imgTag = sourcedHtml.match(/<img class="article-image"[^>]*>/)[0];
  const validate = (html, root = sourcedRoot, date = sourcedDate, editor = sourcedEditor) =>
    validateRenderedIssueStructure({ root, date, editor, markdown: buildMarkdown(editor), html });

  const sourcedFailures = [
    ['same image again in a figure without caption',
      sourcedHtml.replace('</figure>', `</figure>\n<figure class="article-media">${imgTag}</figure>`)],
    ['image outside any figure before a captioned figure',
      sourcedHtml.replace('<figure class="article-media">', `${imgTag}\n<figure class="article-media">`)],
    ['caption class only in a non-class attribute',
      sourcedHtml.replace(/<figcaption class="article-image-caption">[\s\S]*?<\/figcaption>/,
        '<div data-role="article-image-caption"><a href="https://example.com/source">Example</a></div>')]
  ];
  for (const [name, badHtml] of sourcedFailures) {
    const result = validate(badHtml);
    assert.equal(result.ok, false, `${name} unexpectedly passed`);
    assert.match(result.text, /caption attribution/, name);
  }

  const fallbackRoot = tempRoot('rendered-issue-structure-');
  const fallbackDate = writeNewsletterIndex(fallbackRoot);
  const fallbackEditor = issue({ date: fallbackDate, sections: withImageSection(fallbackRoot) });
  const twoCaptions = buildHtml(fallbackEditor).replace(
    /(<img class="article-image"[^>]*>)/,
    '$1\n<p class="article-image-caption">이미지</p><p class="article-image-caption"><a href="https://example.com/source">Example</a></p>'
  );
  const fallbackResult = validate(twoCaptions, fallbackRoot, fallbackDate, fallbackEditor);
  assert.equal(fallbackResult.ok, false, 'a later linked caption on a fallback image unexpectedly passed');
  assert.match(fallbackResult.text, /fallback article image must not carry a source attribution caption/);
});

test('article image attribution belongs to its own figure caption, not nearby article links', () => {
  const root = tempRoot('image-caption-scope-');
  const image = '<img class="article-image" src="https://developer.android.com/static/images/social/android-developers.png" alt="Android" loading="lazy">';
  const link = '<a href="https://developer.android.com/camera">Source</a>';
  const caption = `<figcaption class="article-image-caption">${link}</figcaption>`;
  const sourceList = `<ul class="source-list"><li>${link}</li></ul>`;
  withImageSection(root);
  const fallbackImage = image.replace('https://developer.android.com/static/images/social/android-developers.png', '../../assets/images/fallback/android.svg');
  const cases = [
    ['article sources cannot replace caption attribution', `<figure>${image}<figcaption class="article-image-caption">Image source</figcaption></figure>${sourceList}`, 1],
    ['a link outside the caption cannot provide attribution', `<figure>${image}${link}<figcaption class="article-image-caption">Image source</figcaption></figure>`, 1],
    ['a link after the caption cannot provide attribution', `<figure>${image}<figcaption class="article-image-caption">Image source</figcaption>${link}</figure>`, 1],
    ['an adjacent figure cannot provide attribution', `<figure>${image}</figure><figure>${caption}</figure>`, 1],
    ['an image outside a figure cannot borrow a caption', `${image}<figure>${caption}</figure>`, 1],
    ['identical image tags retain separate caption requirements', `<figure>${image}${caption}</figure><figure>${image}</figure>`, 1],
    ['a long caption is not limited by an arbitrary character window', `<figure>${image}<figcaption class="article-image-caption">${'description '.repeat(100)}${link}</figcaption></figure>`, 0],
    ['a caption class on another element is not a figcaption', `<figure>${image}<div class="article-image-caption">${link}</div></figure>`, 1],
    ['a data attribute cannot masquerade as a caption class', `<figure>${image}<figcaption data-class="article-image-caption">${link}</figcaption></figure>`, 1],
    ['a data attribute cannot masquerade as an attribution href', `<figure>${image}<figcaption class="article-image-caption"><a data-href="https://example.com">Source</a></figcaption></figure>`, 1],
    ['an unclosed figcaption cannot provide valid attribution', `<figure>${image}<figcaption class="article-image-caption">${link}</figure>`, 1],
    ['nested fallback captions cannot hide a later source link', `<figure>${fallbackImage}<div class="article-image-caption"><div>Illustration</div>${link}</div></figure>`, 1],
    ['a later fallback caption cannot hide behind an unlinked caption', `<figure>${fallbackImage}<figcaption class="article-image-caption">Illustration</figcaption>${caption}</figure>`, 1],
    ['a fallback figure cannot inherit attribution from the next figure', `<figure>${fallbackImage}</figure><figure>${image}${caption}</figure>`, 0],
    ['nearby article sources are not a fabricated fallback attribution', `<figure>${fallbackImage}<figcaption class="article-image-caption">Illustration</figcaption></figure>${sourceList}`, 0]
  ];
  for (const [name, html, expectedErrors] of cases) {
    const errors = [];
    validateArticleImages('caption-scope.html', html, root, errors);
    assert.equal(errors.length, expectedErrors, `${name}: ${errors.join('; ')}`);
    if (expectedErrors) assert.match(errors[0], /caption attribution|source attribution caption/);
  }
});

test('fallback article image carrying a source attribution caption is rejected', () => {
  // 캡션 규칙은 fallback 쪽에서 방향이 반대다 — 요구가 아니라 금지다. 이 검사가 없으면
  // 가짜 출처 캡션이 다시 생겨도 게이트가 통과시킨다.
  const root = tempRoot('rendered-issue-structure-');
  const date = writeNewsletterIndex(root);
  const editor = issue({ date, sections: withImageSection(root) });
  const fabricatedCaptionHtml = buildHtml(editor).replace(
    /(<img class="article-image"[^>]*>)/,
    '$1\n<figcaption class="article-image-caption">이미지: <a href="https://example.com/source">Example source article</a></figcaption>'
  );

  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: fabricatedCaptionHtml
  });

  assert.equal(result.ok, false, 'fabricated fallback caption unexpectedly passed');
  assert.match(result.text, /must not carry a source attribution caption/);

  // 이 금지는 발행 대상 호만이 아니라 모든 호에 적용된다(#863). 예전에는 규칙보다 먼저
  // 발행된 호 53건 때문에 발행 대상 호로 한정했는데, 그 53건을 지웠으므로 예외가 사라졌다.
  // 여기서 옛 예외 스위치를 그대로 넘겨도 여전히 걸려야 한다 — 통과하면 예외가 되살아난 것이다.
  const historical = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: fabricatedCaptionHtml,
    strictArtifactValidation: false
  });
  assert.equal(historical.ok, false, '과거 호 예외가 되살아났다');
  assert.match(historical.text, /must not carry a source attribution caption/);
});

test('rendered issue structure rejects selectedImage and newsletter index contract failures', () => {
  const missingFallback = validateFixture({
    sections: withImageSection(tempRoot('rendered-issue-structure-'), { writeFallback: false })
  }).result;
  assert.equal(missingFallback.ok, false);
  assert.match(missingFallback.text, /selectedImage fallback file is missing|article image fallback file is missing/);

  const root = tempRoot('rendered-issue-structure-');
  const date = writeNewsletterIndex(root);
  writeText(path.join(root, 'articles', 'data', 'newsletters.json'), '{ invalid json');
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, false);
  assert.match(result.text, /Invalid JSON in articles\/data\/newsletters\.json/);
});

test('newsletter index accepts an entry with all optional coverage fields valid', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  writeWeeklyIndexWithCoverage(root, {
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16',
    coverage_mode: 'iso_week',
    generation_anchor_date: '2026-08-17'
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, true, result.text);
});

test('newsletter index rejects an entry with a partial coverage display field set', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  // coverage_end_date만 빠졌다 — 표시 계층이 셋 다 유효할 때만 원자적으로 보여주므로,
  // 검증도 하나만 있고 나머지가 없는 상태를 오류로 잡아야 한다.
  writeWeeklyIndexWithCoverage(root, {
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10'
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, false);
  assert.match(result.text, /partial coverage display fields/);
});

test('newsletter index rejects malformed optional coverage field values', () => {
  const cases = [
    [{ coverage_week_key: '2026-33', coverage_start_date: '2026-08-10', coverage_end_date: '2026-08-16' }, /invalid coverage_week_key/],
    [{ coverage_week_key: '2026-W33', coverage_start_date: '2026/08/10', coverage_end_date: '2026-08-16' }, /invalid coverage_start_date/],
    [{ coverage_week_key: '2026-W33', coverage_start_date: '2026-08-10', coverage_end_date: '16-08-2026' }, /invalid coverage_end_date/],
    [{ coverage_mode: 'weekly' }, /invalid coverage_mode/],
    [{ generation_anchor_date: 'not-a-date' }, /invalid generation_anchor_date/]
  ];

  for (const [coverageOverrides, pattern] of cases) {
    const root = tempRoot('rendered-issue-structure-');
    const date = '2026-05-09';
    writeWeeklyIndexWithCoverage(root, coverageOverrides);
    const editor = issue({ date });
    const result = validateRenderedIssueStructure({
      root,
      date,
      editor,
      markdown: buildMarkdown(editor),
      html: buildHtml(editor)
    });
    assert.equal(result.ok, false, JSON.stringify(coverageOverrides));
    assert.match(result.text, pattern, JSON.stringify(coverageOverrides));
  }
});

// 리뷰 fix 3: coverage_mode는 discriminated union이다. legacy_rolling은 ISO 주 라벨을 붙일
// 근거가 없어(실제 rolling 조회 범위일 뿐) coverage_week_key가 있으면 안 되고, 대신 날짜
// 2개(coverage_start_date/coverage_end_date)는 반드시 있어야 한다. 그 외(iso_week 또는
// coverage_mode 부재)는 기존 3필드 원자 규칙을 그대로 유지한다.
test('newsletter index accepts a legacy_rolling entry with only the rolling date range (no coverage_week_key)', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  writeWeeklyIndexWithCoverage(root, {
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-17',
    coverage_mode: 'legacy_rolling',
    generation_anchor_date: '2026-08-17'
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, true, result.text);
});

test('newsletter index rejects a legacy_rolling entry that also carries coverage_week_key', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  writeWeeklyIndexWithCoverage(root, {
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-17',
    coverage_mode: 'legacy_rolling'
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, false);
  assert.match(result.text, /legacy_rolling must not include coverage_week_key/);
});

test('newsletter index rejects a legacy_rolling entry missing the rolling date range', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  writeWeeklyIndexWithCoverage(root, {
    coverage_start_date: '2026-08-10',
    coverage_mode: 'legacy_rolling'
    // coverage_end_date 누락 — legacy_rolling도 날짜 2개는 필수다.
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, false);
  assert.match(result.text, /legacy_rolling requires coverage_start_date and coverage_end_date/);
});

test('newsletter index still enforces the atomic 3-field rule when coverage_mode is iso_week', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  writeWeeklyIndexWithCoverage(root, {
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_mode: 'iso_week'
    // coverage_end_date 누락 — iso_week(또는 mode 부재)은 3필드 원자 규칙 그대로다.
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, false);
  assert.match(result.text, /partial coverage display fields/);
});

// 표시 계약 v2: coverage_mode는 unverified variant를 추가한다. "대상 기간을 모른다"는 것 자체가
// 값이므로 coverage_week_key/날짜 3필드를 하나라도 실으면(대상 기간을 안다는 뜻이 되어) 모순이다.
test('newsletter index accepts a coverage_mode=unverified entry with no coverage display fields', () => {
  const root = tempRoot('rendered-issue-structure-');
  const date = '2026-05-09';
  writeWeeklyIndexWithCoverage(root, {
    coverage_mode: 'unverified'
  });
  const editor = issue({ date });
  const result = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: buildHtml(editor)
  });
  assert.equal(result.ok, true, result.text);
});

test('newsletter index rejects a coverage_mode=unverified entry that also carries any coverage display field', () => {
  const cases = [
    { coverage_mode: 'unverified', coverage_week_key: '2026-W33' },
    { coverage_mode: 'unverified', coverage_start_date: '2026-08-10' },
    { coverage_mode: 'unverified', coverage_end_date: '2026-08-16' }
  ];

  for (const coverageOverrides of cases) {
    const root = tempRoot('rendered-issue-structure-');
    const date = '2026-05-09';
    writeWeeklyIndexWithCoverage(root, coverageOverrides);
    const editor = issue({ date });
    const result = validateRenderedIssueStructure({
      root,
      date,
      editor,
      markdown: buildMarkdown(editor),
      html: buildHtml(editor)
    });
    assert.equal(result.ok, false, JSON.stringify(coverageOverrides));
    assert.match(result.text, /coverage_mode=unverified must not include/, JSON.stringify(coverageOverrides));
  }
});

test('rendered issue structure does not enforce non-structural quality gates', () => {
  const { result } = validateFixture({
    sections: validSections(1).map(section => ({
      ...section,
      article_sections: {
        ...section.article_sections,
        hal_driver_impact: 'Weak.'
      },
      action_items: ['Do something.']
    }))
  });

  assert.equal(result.ok, true, result.text);
});

test('validate-site and rendered issue structure agree on structural TODO failure', () => {
  const fixture = renderedFixture();
  const markdown = `${fixture.markdown}\nTODO: remove me`;
  const helperResult = validateRenderedIssueStructure({
    root: fixture.root,
    date: fixture.date,
    editor: fixture.editor,
    markdown,
    html: fixture.html
  });

  writeJson(path.join(fixture.root, 'articles', 'data', 'newsletters.json'), [{
    date: fixture.date,
    title: fixture.editor.title,
    summary: fixture.editor.summary,
    html: `newsletters/${fixture.date}/index.html`,
    md: `newsletters/${fixture.date}/newsletter.md`,
    tags: ['camera-hal']
  }]);
  writeJson(path.join(fixture.root, 'articles', 'content', 'newsroom', fixture.date, 'editor-draft.json'), fixture.editor);
  writeText(path.join(fixture.root, 'articles', 'newsletters', fixture.date, 'newsletter.md'), markdown);
  writeText(path.join(fixture.root, 'articles', 'newsletters', fixture.date, 'index.html'), fixture.html);
  writeText(path.join(fixture.root, 'index.html'), '<!doctype html><html><body><a href="newsletters/2026-05-09/">Archive</a></body></html>');

  const scriptResult = spawnSync(process.execPath, [validateSitePath], {
    cwd: fixture.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: '',
      GITHUB_BASE_REF: ''
    }
  });

  assert.equal(helperResult.ok, false);
  assert.notEqual(scriptResult.status, 0);
  assert.match(scriptResult.stderr, /TODO/);
});
