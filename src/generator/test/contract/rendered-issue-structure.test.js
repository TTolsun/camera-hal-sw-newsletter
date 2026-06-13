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

function writeNewsletterIndex(root, date = '2026-05-09') {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date: '2026-05-08',
    title: 'Existing published issue',
    summary: 'Existing issue entry',
    html: 'newsletters/2026-05-08/index.html',
    md: 'newsletters/2026-05-08/newsletter.md',
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
    ['missing caption attribution', html.replace(/<figcaption class="article-image-caption">[\s\S]*?<\/figcaption>/, '<figcaption class="article-image-caption">Image source</figcaption>'), /caption attribution/],
    ['invalid fallback path', html.replace('../../assets/images/fallback/android.svg', '../assets/images/not-fallback/android.svg'), /repo-local fallback/]
  ];

  for (const [name, badHtml, pattern] of cases) {
    const result = validateRenderedIssueStructure({ root, date, editor, markdown, html: badHtml });
    assert.equal(result.ok, false, `${name} unexpectedly passed`);
    assert.match(result.text, pattern, name);
  }
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
