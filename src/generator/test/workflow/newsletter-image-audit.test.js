const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  analyzeSectionImages,
  buildNewsletterImageAuditReport,
  repairNewsletterImages,
  writeNewsletterImageAuditAggregate
} = require('../../render/newsletter-image-audit');
const {
  buildHtml,
  buildMarkdown
} = require('../../render/newsletter-renderer');
const {
  writeWeeklyNewsletterArtifacts
} = require('../../render/weekly-newsletter-output');
const {
  assertKnownImageReasonCode
} = require('../../render/newsletter-image-audit-labels.ko');
const {
  retrySection
} = require('../../../core/test/helpers/newsroom-builders');

function tempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function validImage(url = 'https://publisher.example.com/images/camera-card.png') {
  return {
    url,
    sourceUrl: 'https://publisher.example.com',
    articleUrl: 'https://publisher.example.com/camera-update',
    sourceKind: 'og',
    width: 1200,
    height: 630,
    alt: 'Camera update card',
    contentType: 'image/png',
    licenseStatus: 'unknown',
    attribution: 'Example Publisher',
    validationStatus: 'ok',
    contentLength: 120000
  };
}

function issue(date, sectionOverrides = {}) {
  const section = retrySection('Camera HAL image audit fixture', 'https://publisher.example.com/camera-update');
  Object.assign(section, sectionOverrides);
  return {
    date,
    title: `Fixture ${date}`,
    summary: 'Synthetic issue for newsletter image audit.',
    briefing: ['Camera HAL image audit fixture.'],
    tags: ['Camera HAL'],
    references: [{ title: 'Camera HAL image audit fixture', url: 'https://publisher.example.com/camera-update' }],
    sections: [section]
  };
}

function writeIssue(root, value) {
  const date = value.date;
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), value);
  writeText(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.md'), buildMarkdown(value));
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), buildMarkdown(value));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), buildHtml(value));
}

test('image audit selects valid raster OG image and excludes unsafe candidates without network', async () => {
  const section = retrySection('Camera HAL image candidate selection', 'https://publisher.example.com/camera-update');
  section.imageCandidates = [
    { ...validImage(), url: 'http://publisher.example.com/insecure.png' },
    { ...validImage(), url: 'https://publisher.example.com/logo.svg', contentType: 'image/svg+xml', sourceKind: 'article-img' },
    validImage('https://publisher.example.com/images/camera-card.png')
  ];

  const report = await analyzeSectionImages(section, 0);

  assert.equal(report.valid_image_candidate_count, 1);
  assert.equal(report.repairable, true);
  assert.equal(report.selectedCandidate.url, 'https://publisher.example.com/images/camera-card.png');
  assert.equal(report.candidateEvidence.some(item => item.reasonCode === 'non_https_url'), true);
  assert.equal(report.candidateEvidence.some(item => item.reasonCode === 'logo_only' || item.reasonCode === 'svg_rejected'), true);
});

test('image audit rejects candidates whose extraction source does not match the article source', async () => {
  const section = retrySection('Camera HAL mismatched image candidate', 'https://isocpp.org/blog/2026/05/cpp26-assert');
  section.imageCandidates = [{
    ...validImage('https://gitlab.freedesktop.org/assets/twitter_card.jpg'),
    sourceUrl: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
    articleUrl: 'https://gitlab.freedesktop.org/camera/libcamera/-/issues/300',
    sourceKind: 'release_note_item',
    alt: 'libcamera logo'
  }];

  const report = await analyzeSectionImages(section, 0);

  assert.equal(report.valid_image_candidate_count, 0);
  assert.equal(report.repairable, false);
  assert.equal(report.candidateEvidence.some(item => item.reasonCode === 'missing_extraction_source'), true);
});

test('repair command rewrites editor draft and regenerates public Markdown and HTML idempotently', async () => {
  const root = tempRoot('newsletter-image-repair-');
  const date = '2026-05-30';
  writeIssue(root, issue(date, { imageCandidates: [validImage()] }));

  const first = await repairNewsletterImages({ root, allRepairable: true });
  assert.equal(first.reduce((sum, item) => sum + item.repairedArticleCount, 0), 1);

  const editorPath = path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json');
  const markdownPath = path.join(root, 'articles', 'newsletters', date, 'newsletter.md');
  const htmlPath = path.join(root, 'articles', 'newsletters', date, 'index.html');
  const editor = JSON.parse(fs.readFileSync(editorPath, 'utf8'));
  assert.equal(editor.sections[0].selectedImage, 'https://publisher.example.com/images/camera-card.png');
  assert.equal(editor.sections[0].imageSelection.reasonCode, 'selected');
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /https:\/\/publisher\.example\.com\/images\/camera-card\.png/);
  assert.match(fs.readFileSync(htmlPath, 'utf8'), /class="article-image"/);

  const snapshot = [editorPath, markdownPath, htmlPath]
    .map(filePath => [filePath, fs.readFileSync(filePath, 'utf8')]);
  const second = await repairNewsletterImages({ root, allRepairable: true });
  assert.equal(second.length, 0);
  for (const [filePath, before] of snapshot) {
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
  }
});

test('repair binds the selected image into the date\'s weekly issue and weekly index', async () => {
  const root = tempRoot('newsletter-image-repair-weekly-');
  const date = '2026-05-30';
  const fixture = issue(date, { imageCandidates: [validImage()] });
  writeIssue(root, fixture);
  await writeWeeklyNewsletterArtifacts({ root, date, editor: fixture, tags: [] });

  const repairs = await repairNewsletterImages({ root, date });

  assert.equal(repairs[0].repairedArticleCount, 1);
  assert.equal(repairs[0].weeklySync.synced, true);
  assert.equal(repairs[0].weeklySync.patchedSectionCount, 1);
  const weeklyKey = repairs[0].weeklySync.weeklyKey;
  const weeklyIssue = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json'), 'utf8'));
  assert.equal(weeklyIssue.sections[0].selectedImage, 'https://publisher.example.com/images/camera-card.png');
  assert.equal(weeklyIssue.sections[0].resolvedImage.usedFallback, false);
  assert.match(fs.readFileSync(path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'), 'utf8'), /camera-card\.png/);
  const weeklyIndex = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.deepEqual(
    weeklyIndex.find(entry => entry.weeklyKey === weeklyKey).article_images,
    ['https://publisher.example.com/images/camera-card.png']
  );
});

test('repair with zero repairable articles still converges a stale weekly issue', async () => {
  const root = tempRoot('newsletter-image-repair-weekly-stale-');
  const date = '2026-05-30';
  const selectedImage = 'https://publisher.example.com/images/camera-card.png';
  // Weekly는 repair 이전(이미지 미바인딩) 상태로 작성되었고,
  const staleFixture = issue(date, { imageCandidates: [validImage()] });
  await writeWeeklyNewsletterArtifacts({ root, date, editor: staleFixture, tags: [] });
  // daily editor-draft는 이미 바인딩 완료(repairable 0) 상태인 시나리오: 재실행으로 weekly만 수렴해야 한다.
  writeIssue(root, issue(date, {
    imageCandidates: [validImage()],
    selectedImage,
    imageSource: 'https://publisher.example.com',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Camera update card',
    imageLicenseStatus: 'unknown',
    resolvedImage: {
      url: selectedImage,
      src: selectedImage,
      originalUrl: '',
      originalSrc: '',
      usedFallback: false,
      reason: 'selected image candidate'
    }
  }));

  const repairs = await repairNewsletterImages({ root, date });

  assert.equal(repairs[0].repairedArticleCount, 0);
  assert.equal(repairs[0].weeklySync.synced, true);
  assert.equal(repairs[0].weeklySync.patchedSectionCount, 1);
  const weeklyKey = repairs[0].weeklySync.weeklyKey;
  const weeklyIssue = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json'), 'utf8'));
  assert.equal(weeklyIssue.sections[0].selectedImage, selectedImage);
  const weeklyIndex = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.deepEqual(weeklyIndex.find(entry => entry.weeklyKey === weeklyKey).article_images, [selectedImage]);
});

test('audit flags selectedImage without a valid provenance candidate for publish target', async () => {
  const root = tempRoot('newsletter-image-selected-provenance-');
  const date = '2026-05-29';
  const selectedImage = 'https://cdn.example.com/cards/camera-card.png';
  const fixture = issue(date, {
    selectedImage,
    imageSource: 'https://publisher.example.com/camera-update',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Selected image without valid provenance',
    imageLicenseStatus: 'unknown',
    imageCandidates: [{
      ...validImage(selectedImage),
      sourceUrl: 'https://unrelated.example.com/article',
      articleUrl: 'https://unrelated.example.com/article',
      sourceKind: 'release_note_item'
    }]
  });
  fixture.publication_mode = 'public';
  writeIssue(root, fixture);

  const report = await buildNewsletterImageAuditReport({ root, date });

  assert.equal(report.summary.selected_image_without_valid_candidate_count, 1);
  assert.equal(report.summary.selected_image_not_in_candidates_count, 0);
  assert.equal(report.summary.publish_blocking_issue_count, 1);
  assert.equal(report.errors.some(item => item.reasonCode === 'selected_image_without_valid_candidate'), true);
});

test('audit flags selectedImage that is not present in imageCandidates', async () => {
  const root = tempRoot('newsletter-image-selected-missing-candidate-');
  const date = '2026-05-28';
  const fixture = issue(date, {
    selectedImage: 'https://cdn.example.com/cards/not-in-candidates.png',
    imageSource: 'https://publisher.example.com/camera-update',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Selected image not in candidates',
    imageLicenseStatus: 'unknown',
    imageCandidates: [validImage()]
  });
  fixture.publication_mode = 'public';
  writeIssue(root, fixture);

  const report = await buildNewsletterImageAuditReport({ root, date });

  assert.equal(report.summary.valid_image_candidate_count, 1);
  assert.equal(report.summary.selected_image_without_valid_candidate_count, 1);
  assert.equal(report.summary.selected_image_not_in_candidates_count, 1);
  assert.equal(report.summary.publish_blocking_issue_count, 1);
  assert.equal(report.errors.some(item => item.reasonCode === 'selected_image_not_in_candidates'), true);
});

test('audit keeps publish-target render mismatch blocking for normal public issues', async () => {
  const root = tempRoot('newsletter-image-public-render-mismatch-');
  const date = '2026-05-27';
  const selectedImage = 'https://publisher.example.com/images/public-card.png';
  const fixture = issue(date, {
    selectedImage,
    imageSource: 'https://publisher.example.com/camera-update',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Selected image missing from rendered output',
    imageLicenseStatus: 'unknown',
    imageCandidates: [validImage(selectedImage)]
  });
  fixture.publication_mode = 'public';
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), fixture);
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), '# Missing image\n');
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), '<html><body>Missing image</body></html>');

  const report = await buildNewsletterImageAuditReport({ root, date });

  assert.equal(report.render_consistency_scope, 'editor_draft');
  assert.equal(report.summary.selected_image_render_mismatch_count, 1);
  assert.equal(report.summary.publish_blocking_issue_count, 1);
});

test('fallback_public audit uses editor draft as public issue source of truth', async () => {
  const root = tempRoot('newsletter-image-fallback-public-scope-');
  const date = '2026-05-27';
  const renderedImage = 'https://publisher.example.com/images/rendered-card.png';
  const renderedSection = retrySection('Rendered tooling article', 'https://publisher.example.com/camera-update');
  Object.assign(renderedSection, {
    selectedImage: renderedImage,
    imageSource: 'https://publisher.example.com/camera-update',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Rendered image',
    imageLicenseStatus: 'unknown',
    imageCandidates: [validImage(renderedImage)]
  });
  const publicIssue = {
    ...issue(date),
    publication_mode: 'fallback_public',
    fallback_only: true,
    sections: [renderedSection]
  };
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), publicIssue);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    publication_mode: 'fallback_public',
    run_mode: 'review_only_public',
    public_state: 'REVIEW_ONLY_PUBLIC_CREATED'
  });
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), buildMarkdown(publicIssue));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), buildHtml(publicIssue));

  const report = await buildNewsletterImageAuditReport({ root, date });

  assert.equal(report.render_consistency_scope, 'rendered_public_issue');
  assert.equal(report.source_of_truth, `articles/content/newsroom/${date}/editor-draft.json`);
  assert.equal(report.summary.article_count, 1);
  assert.equal(report.summary.selected_image_count, 1);
  assert.equal(report.summary.rendered_image_count, 1);
  assert.equal(report.summary.selected_image_render_mismatch_count, 0);
  assert.equal(report.summary.publish_blocking_issue_count, 0);
  assert.equal(report.errors.length, 0);
});

test('known reason code validation rejects typos before reports can hide them', () => {
  assert.doesNotThrow(() => assertKnownImageReasonCode('missing_attribution'));
  assert.throws(
    () => assertKnownImageReasonCode('missing_attrbution'),
    /Unknown image audit reasonCode/
  );
});

test('renderer suppresses duplicate body paragraph already shown as perspective', () => {
  const date = '2026-05-27';
  const duplicate = 'Camera HAL owners should verify stream, buffer, metadata, Camera ITS, latency, and frame-drop behavior before treating this update as a device-wide signal.';
  const fixture = issue(date, {
    public_article: {
      headline: 'Duplicate perspective fixture',
      lead: 'The lead is distinct.',
      body_paragraphs: [
        duplicate,
        'This separate paragraph should remain in the rendered article body.'
      ],
      camera_hal_takeaway: duplicate,
      reader_checkpoints: ['Check stream and metadata logs.'],
      source_links: [{ title: 'Fixture', url: 'https://publisher.example.com/camera-update' }]
    }
  });

  const markdown = buildMarkdown(fixture);
  const html = buildHtml(fixture);

  assert.equal(markdown.split(duplicate).length - 1, 1);
  assert.equal(html.split(duplicate).length - 1, 1);
  assert.match(markdown, /This separate paragraph should remain/);
  assert.match(html, /This separate paragraph should remain/);
});

test('aggregate audit reports repairable dates and Korean Markdown labels', async () => {
  const root = tempRoot('newsletter-image-audit-');
  writeIssue(root, issue('2026-05-31', { imageCandidates: [validImage()] }));
  writeIssue(root, issue('2026-06-01', { imageCandidates: [] }));

  const result = await writeNewsletterImageAuditAggregate({ root });
  assert.deepEqual(result.aggregate.repairableDates, ['2026-05-31']);
  assert.equal(result.aggregate.summary.repairableArticleCount, 1);
  assert.equal(result.aggregate.summary.unrepairableNoCandidateCount, 1);

  const markdown = fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', '2026-05-31', 'image-audit-report.md'), 'utf8');
  assert.match(markdown, /대표 이미지 선택됨/);
  assert.match(markdown, /\(`selected`\)|\(selected\)/);
  assert.doesNotMatch(markdown, /Generated from|Artifacts|valid image candidate|selectedImage 수|publish blocking issue|^none$/m);
});
