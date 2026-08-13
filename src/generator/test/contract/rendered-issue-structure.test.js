const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  validateRenderedIssueStructure
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

  // 이 규칙이 생기기 전에 발행된 호는 검사 대상이 아니다. 전체에 적용하면 내용과 무관한
  // PR까지 전부 막힌다. 형제 validator들이 쓰는 정책과 같다.
  const historical = validateRenderedIssueStructure({
    root,
    date,
    editor,
    markdown: buildMarkdown(editor),
    html: fabricatedCaptionHtml,
    strictArtifactValidation: false
  });
  assert.equal(historical.ok, true, historical.text);
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
