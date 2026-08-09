const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const { resolveArticleImage, resolveIssueArticleImages } = require('../../render/article-image-resolver');
const { buildHtml, buildMarkdown } = require('../../render/newsletter-renderer');

function tempRoot() {
  fs.mkdirSync(path.join(process.cwd(), '.tmp'), { recursive: true });
  const root = fs.mkdtempSync(path.join(process.cwd(), '.tmp', 'article-image-fallback-'));
  fs.mkdirSync(path.join(root, 'articles', 'assets', 'images', 'fallback'), { recursive: true });
  fs.writeFileSync(path.join(root, 'articles', 'assets', 'images', 'fallback', 'ai.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
  fs.writeFileSync(path.join(root, 'articles', 'assets', 'images', 'fallback', 'android.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
  fs.writeFileSync(path.join(root, 'articles', 'assets', 'images', 'fallback', 'cpp.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
  fs.writeFileSync(path.join(root, 'articles', 'assets', 'images', 'fallback', 'newsletter-default.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
  return root;
}

function section(overrides = {}) {
  return {
    category: 'Android Camera / AI Watch',
    headline: 'Android hybrid inference and Gemini model support',
    what_changed: 'Android camera workflows gained hybrid AI inference support.',
    confirmed_facts: ['Android camera workflow update was published.'],
    evidence_summary: 'The source names Android camera workflow and AI inference changes.',
    specificity_checks: ['Names Android camera workflow.'],
    source_verification_notes: ['Checked source article URL.'],
    camera_hal_checks: ['Check stream latency with AI enabled.'],
    action_items: ['Run a frame latency smoke test.', 'Check memory pressure logs.'],
    article_sections: {
      verified_facts: ['Android camera workflow update was published.'],
      background_context: 'Camera apps use frame streams that can feed AI inference.',
      hal_driver_impact: 'Camera HAL stream buffers and metadata timing can be affected.',
      action_items: ['Run a frame latency smoke test.', 'Check memory pressure logs.'],
      team_share_points: 'Review AI inference impact on camera paths.'
    },
    is_ai_related: true,
    article_type: 'ai',
    imageCandidates: [
      {
        url: 'https://blogger.googleusercontent.com/broken.png',
        sourceUrl: 'https://android-developers.googleblog.com/post',
        articleUrl: 'https://android-developers.googleblog.com/post',
        sourceKind: 'og:image',
        licenseStatus: 'unknown',
        attribution: 'Android Developers Blog',
        validationStatus: 'ok'
      }
    ],
    selectedImage: 'https://blogger.googleusercontent.com/broken.png',
    imageSource: 'https://android-developers.googleblog.com/post',
    imageAttribution: 'Android Developers Blog',
    imageAlt: 'Android camera AI illustration',
    imageLicenseStatus: 'unknown',
    imageUsageDecisionReason: 'Editor-selected image with HTTPS source attribution.',
    sources: [
      {
        title: 'Android Developers Blog',
        url: 'https://android-developers.googleblog.com/post'
      }
    ],
    ...overrides
  };
}

test('broken external selectedImage is replaced with local fallback in final issue fields', async () => {
  const root = tempRoot();
  try {
    const issue = {
      date: '2026-05-04',
      title: 'Camera HAL / SW Newsletter - 2026-05-04',
      summary: 'Image fallback contract test.',
      briefing: ['One', 'Two', 'Three'],
      sections: [section()],
      references: [{ title: 'Android Developers Blog', url: 'https://android-developers.googleblog.com/post' }]
    };

    await resolveIssueArticleImages(issue, {
      root,
      validateImageUrl: async () => ({
        ok: false,
        status: 404,
        contentType: 'text/html',
        contentLength: 1234,
        reason: 'HTTP 404'
      })
    });

    const resolved = issue.sections[0].resolvedImage;
    assert.equal(issue.sections[0].selectedImage, '../../assets/images/fallback/ai.svg');
    assert.equal(issue.sections[0].originalImage, 'https://blogger.googleusercontent.com/broken.png');
    assert.equal(resolved.url, '../../assets/images/fallback/ai.svg');
    assert.equal(resolved.src, '../../assets/images/fallback/ai.svg');
    assert.equal(resolved.originalUrl, 'https://blogger.googleusercontent.com/broken.png');
    assert.equal(resolved.originalSrc, 'https://blogger.googleusercontent.com/broken.png');
    assert.equal(resolved.usedFallback, true);
    assert.match(resolved.reason, /status=404/);

    const markdown = buildMarkdown(issue);
    const html = buildHtml(issue);
    assert.match(markdown, /!\[Android camera AI illustration\]\(\.\.\/\.\.\/assets\/images\/fallback\/ai\.svg\)/);
    assert.match(html, /<img class="article-image" src="\.\.\/\.\.\/assets\/images\/fallback\/ai\.svg"/);
    assert.doesNotMatch(markdown, /!\[[^\]]*\]\(https:\/\/blogger\.googleusercontent\.com\/broken\.png\)/);
    assert.doesNotMatch(html, /<img class="article-image" src="https:\/\/blogger\.googleusercontent\.com\/broken\.png"/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fallback image renders without a source attribution caption', async () => {
  const root = tempRoot();
  try {
    const issue = {
      date: '2026-05-04',
      title: 'Camera HAL / SW Newsletter - 2026-05-04',
      summary: 'Fallback caption contract test.',
      briefing: ['One', 'Two', 'Three'],
      sections: [section()],
      references: [{ title: 'Android Developers Blog', url: 'https://android-developers.googleblog.com/post' }]
    };

    await resolveIssueArticleImages(issue, {
      root,
      validateImageUrl: async () => ({ ok: false, status: 404, contentType: 'text/html', contentLength: 1234, reason: 'HTTP 404' })
    });

    assert.equal(issue.sections[0].resolvedImage.usedFallback, true);

    const markdown = buildMarkdown(issue);
    const html = buildHtml(issue);

    // 이미지 자체는 그대로 렌더된다.
    assert.match(markdown, /!\[Android camera AI illustration\]\(\.\.\/\.\.\/assets\/images\/fallback\/ai\.svg\)/);
    assert.match(html, /<img class="article-image" src="\.\.\/\.\.\/assets\/images\/fallback\/ai\.svg"/);

    // 그러나 그 이미지는 출처 기사에서 온 것이 아니므로 출처 캡션을 붙이지 않는다.
    assert.doesNotMatch(markdown, /_이미지: \[/);
    assert.doesNotMatch(html, /article-image-caption/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('image kept from the article source still renders its attribution caption', () => {
  const issue = {
    date: '2026-05-04',
    title: 'Camera HAL / SW Newsletter - 2026-05-04',
    summary: 'Non-fallback caption contract test.',
    briefing: ['One', 'Two', 'Three'],
    sections: [section({
      selectedImage: 'https://android-developers.googleblog.com/hero.png',
      resolvedImage: {
        url: 'https://android-developers.googleblog.com/hero.png',
        src: 'https://android-developers.googleblog.com/hero.png',
        usedFallback: false
      }
    })],
    references: [{ title: 'Android Developers Blog', url: 'https://android-developers.googleblog.com/post' }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(markdown, /_이미지: \[Android Developers Blog\]\(https:\/\/android-developers\.googleblog\.com\/post\)_/);
  assert.match(html, /<figcaption class="article-image-caption">.*Android Developers Blog<\/a><\/figcaption>/);
});

test('selectedImage pointing at a fallback asset renders without a caption even when usedFallback is false', () => {
  // 발행물에 실재하는 형태입니다. selectedImage와 resolvedImage가 모두 fallback 경로를
  // 가리키는데 usedFallback만 false라, 플래그로 판정하면 가짜 출처를 놓칩니다.
  const fallbackPath = '../../assets/images/fallback/newsletter-default.svg';
  const issue = {
    date: '2026-05-04',
    title: 'Camera HAL / SW Newsletter - 2026-05-04',
    summary: 'Legacy fallback shape contract test.',
    briefing: ['One', 'Two', 'Three'],
    sections: [section({
      selectedImage: fallbackPath,
      imageSource: '',
      imageAttribution: '',
      resolvedImage: { url: fallbackPath, src: fallbackPath, usedFallback: false }
    })],
    references: [{ title: 'Android Developers Blog', url: 'https://android-developers.googleblog.com/post' }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(html, /<img class="article-image" src="\.\.\/\.\.\/assets\/images\/fallback\/newsletter-default\.svg"/);
  assert.doesNotMatch(markdown, /_이미지: \[/);
  assert.doesNotMatch(html, /article-image-caption/);
});

test('usedFallback alone does not drop the caption when the rendered path is not a fallback asset', () => {
  // 캡션 여부는 렌더되는 경로로만 정합니다. 렌더 결과만 보는 게이트가 같은 판정을 내릴 수
  // 있어야 하기 때문입니다. 플래그를 함께 보면 이 입력에서 렌더러는 캡션을 빼고 게이트는
  // 캡션을 요구해 서로 반대가 됩니다.
  const issue = {
    date: '2026-05-04',
    title: 'Camera HAL / SW Newsletter - 2026-05-04',
    summary: 'Flag and path disagreement contract test.',
    briefing: ['One', 'Two', 'Three'],
    sections: [section({
      selectedImage: 'https://android-developers.googleblog.com/hero.png',
      resolvedImage: {
        url: 'https://android-developers.googleblog.com/hero.png',
        src: 'https://android-developers.googleblog.com/hero.png',
        usedFallback: true
      }
    })],
    references: [{ title: 'Android Developers Blog', url: 'https://android-developers.googleblog.com/post' }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(markdown, /_이미지: \[Android Developers Blog\]\(https:\/\/android-developers\.googleblog\.com\/post\)_/);
  assert.match(html, /article-image-caption/);
});

test('broken external selectedImage remains failing when fallback asset is missing', async () => {
  fs.mkdirSync(path.join(process.cwd(), '.tmp'), { recursive: true });
  const root = fs.mkdtempSync(path.join(process.cwd(), '.tmp', 'article-image-missing-fallback-'));
  try {
    const resolved = await resolveArticleImage(section(), {
      root,
      validateImageUrl: async () => ({
        ok: false,
        status: 404,
        contentType: 'text/html',
        contentLength: 1234,
        reason: 'HTTP 404'
      })
    });

    assert.equal(resolved.url, 'https://blogger.googleusercontent.com/broken.png');
    assert.equal(resolved.usedFallback, false);
    assert.match(resolved.reason, /fallback missing: assets\/images\/fallback\/ai\.svg/);
    assert.match(resolved.reason, /status=404/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
