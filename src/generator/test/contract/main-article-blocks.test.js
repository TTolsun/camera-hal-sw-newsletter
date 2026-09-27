const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  mainArticleBlocks,
  validateRenderedIssueStructure
} = require('../../quality/rendered-issue-structure');
const { validatePublicMarkdown } = require('../../quality/public-newsletter');
const { publishedArticleUrlsFromMarkdown } = require('../../reporter/published-article-urls');
const { buildMarkdown, buildHtml } = require('../../render/newsletter-renderer');
const { validSections } = require('../../../shared/test/helpers/quality-builders');
const { tempRoot, writeJson, writeText } = require('../../../shared/test/helpers/fs');

// #1185: 렌더된 markdown에서 "어느 `## N.` 블록이 본문 기사인가"를 검사마다 따로 판정하던 탓에,
// 제목에 "Action"·"실행"·"요약"이 든 기사가 일부 검사를 건너뛰었다(실측: 2026-09-21호 4번 기사).
// 이 파일은 그런 제목의 기사가 모든 검사에서 본문 기사로 세어진다는 것을 잠근다.

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const validateSitePath = path.join(repoRoot, 'src', 'generator', 'validate', 'validate-site.js');

const TRICKY_TITLES = [
  'GitHub Actions 러너 이미지 갱신',
  'Camera HAL 테스트 실행 경로 변경',
  'Codex 릴리스, 세션 추론 요약 기본 비활성화'
];

function blockSummary(blocks) {
  return blocks.map(block => ({ number: block.number, title: block.title }));
}

test('main article blocks count articles whose titles contain Action, 실행 or 요약', () => {
  const markdown = [
    '## 1. 이번 주 3줄 브리핑',
    '',
    '- a',
    '',
    ...TRICKY_TITLES.flatMap((title, index) => [`## ${index + 2}. ${title}`, '', '본문.', '']),
    '## 참고 / 더 읽을거리',
    '',
    '## 참고자료',
    ''
  ].join('\n');

  assert.deepEqual(blockSummary(mainArticleBlocks(markdown)), [
    { number: 2, title: TRICKY_TITLES[0] },
    { number: 3, title: TRICKY_TITLES[1] },
    { number: 4, title: TRICKY_TITLES[2] }
  ]);
});

test('main article blocks skip the English briefing heading and keep English article titles', () => {
  const markdown = [
    '## 1. This week’s articles',
    '',
    '- a',
    '',
    '## 2. GitHub Actions runner summary for camera CI',
    '',
    'Body.',
    '',
    '## Further reading',
    '',
    '## References',
    ''
  ].join('\n');

  assert.deepEqual(blockSummary(mainArticleBlocks(markdown)), [
    { number: 2, title: 'GitHub Actions runner summary for camera CI' }
  ]);
});

test('main article blocks exclude legacy numbered non-article sections by exact title only', () => {
  const markdown = [
    '## 1. 이번 주 3줄 브리핑',
    '',
    '## 2. 참고자료 정리 도구 릴리스',
    '',
    '## 3. Action Items',
    '',
    '## 4. 실행 항목',
    '',
    '## 5. 참고자료',
    '',
    '## 6. References',
    ''
  ].join('\n');

  assert.deepEqual(blockSummary(mainArticleBlocks(markdown)), [
    { number: 2, title: '참고자료 정리 도구 릴리스' }
  ]);
});

test('public markdown validator checks articles whose titles contain Action, 실행 or 요약', () => {
  for (const title of TRICKY_TITLES) {
    const markdown = [
      '## 1. 이번 주 3줄 브리핑',
      '',
      '- a',
      '',
      `## 3. ${title}`,
      '',
      '리드 한 문단뿐입니다.',
      '',
      '## 참고자료',
      ''
    ].join('\n');

    const errors = validatePublicMarkdown(markdown);
    assert.ok(
      errors.some(error => /article 3 must include lead plus at least 2 body paragraphs/.test(error)),
      `${title}: ${JSON.stringify(errors)}`
    );
  }
});

test('public markdown validator does not treat the English briefing as an article', () => {
  const markdown = [
    '## 1. This week’s articles',
    '',
    '- a',
    '',
    '## References',
    ''
  ].join('\n');

  assert.deepEqual(validatePublicMarkdown(markdown).filter(error => /article 1\b/.test(error)), []);
});

function trickyRenderedFixture(title) {
  const root = tempRoot('main-article-blocks-');
  const date = '2026-05-09';
  const editor = {
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Weekly Camera HAL software update.',
    briefing: ['one', 'two', 'three'],
    sections: validSections(3),
    references: [{ title: 'Reference', url: 'https://example.com/reference' }]
  };
  const html = buildHtml(editor);
  // 3번 기사의 제목을 까다로운 제목으로 바꾸고 출처 URL을 없앤다.
  const markdown = buildMarkdown(editor)
    .replace('## 3. AOSP Camera change B', `## 3. ${title}`)
    .replace('https://example.com/b', 'ftp://example.com/b');
  assert.ok(markdown.includes(`## 3. ${title}`));
  return { root, date, editor, markdown, html };
}

test('terminal contract catches a missing source on articles whose titles contain Action, 실행 or 요약', () => {
  for (const title of TRICKY_TITLES) {
    const fixture = trickyRenderedFixture(title);
    const result = validateRenderedIssueStructure({ ...fixture, validateDataIndex: false });
    assert.equal(result.ok, false, title);
    assert.match(result.text, new RegExp(`no source entries: ## 3\\. ${title}`), title);
  }
});

test('validate-site catches a missing source on articles whose titles contain Action, 실행 or 요약', () => {
  for (const title of TRICKY_TITLES) {
    const fixture = trickyRenderedFixture(title);
    writeJson(path.join(fixture.root, 'articles', 'data', 'newsletters.json'), [{
      date: fixture.date,
      title: fixture.editor.title,
      summary: fixture.editor.summary,
      html: `newsletters/${fixture.date}/index.html`,
      md: `newsletters/${fixture.date}/newsletter.md`,
      tags: ['camera-hal']
    }]);
    writeJson(path.join(fixture.root, 'articles', 'content', 'newsroom', fixture.date, 'editor-draft.json'), fixture.editor);
    writeText(path.join(fixture.root, 'articles', 'newsletters', fixture.date, 'newsletter.md'), fixture.markdown);
    writeText(path.join(fixture.root, 'articles', 'newsletters', fixture.date, 'index.html'), fixture.html);
    writeText(path.join(fixture.root, 'index.html'), '<!doctype html><html><body><a href="newsletters/2026-05-09/">Archive</a></body></html>');

    const result = spawnSync(process.execPath, [validateSitePath], {
      cwd: fixture.root,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '' }
    });

    assert.match(result.stderr, new RegExp(`article has no source entries: ## 3\\. ${title}`), title);
  }
});

test('published article URLs include sources of articles whose titles contain Action, 실행 or 요약', () => {
  for (const [index, title] of TRICKY_TITLES.entries()) {
    const url = `https://example.com/tricky-${index}`;
    const markdown = [
      '## 1. 이번 주 3줄 브리핑',
      '',
      `## 2. ${title}`,
      '',
      '**출처**',
      '',
      `- [source](${url})`,
      '',
      '## 참고자료',
      ''
    ].join('\n');

    assert.deepEqual(publishedArticleUrlsFromMarkdown(markdown), [url], title);
  }
});
