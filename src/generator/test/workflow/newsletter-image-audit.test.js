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
} = require('../../../shared/test/helpers/newsroom-builders');
const {
  retentionCommitAllowlist
} = require('../../publish/review-artifact-inventory');

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
  await writeWeeklyNewsletterArtifacts({ root, date, editor: fixture });

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
  await writeWeeklyNewsletterArtifacts({ root, date, editor: staleFixture });
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

function writeReviewDraft(root, value) {
  const dir = path.join(root, 'articles', 'content', 'newsroom', value.date);
  writeJson(path.join(dir, 'editor-draft.json'), value);
  writeText(path.join(dir, 'editor-draft.md'), buildMarkdown(value));
}

function snapshotFiles(root, relPaths) {
  return relPaths.map(relPath => [relPath, fs.readFileSync(path.join(root, relPath), 'utf8')]);
}

// #1183: FAILED_REPAIR_REVIEWABLE처럼 공개 출력이 없는 실행에서 이미지 수리가 공개 경로를 새로 만들면
// 그 파일이 진단 전용 PR에 실린다. 수리 결과는 검토용 초안에만 반영되어야 한다.
test('repair does not write public daily or weekly pages when the run expects no public output', async () => {
  const root = tempRoot('newsletter-image-repair-diagnostics-');
  const date = '2026-05-30';
  const fixture = issue(date, { imageCandidates: [validImage()] });
  // 같은 주의 주간 페이지는 앞선 발행으로 이미 디스크에 있다.
  await writeWeeklyNewsletterArtifacts({ root, date, editor: fixture });
  writeReviewDraft(root, fixture);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    public_output_expected: false
  });
  const weeklyKey = fs.readdirSync(path.join(root, 'articles', 'newsletters')).find(name => /^\d{4}-W\d{2}$/.test(name));
  const publishedWeekly = snapshotFiles(root, [
    `articles/newsletters/${weeklyKey}/index.html`,
    `articles/newsletters/${weeklyKey}/newsletter.md`,
    `articles/newsletters/${weeklyKey}/issue.json`,
    'articles/data/newsletters-weekly.json'
  ]);

  const repairs = await repairNewsletterImages({ root, date });

  assert.equal(repairs[0].repairedArticleCount, 1);
  const editor = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), 'utf8'));
  assert.equal(editor.sections[0].selectedImage, 'https://publisher.example.com/images/camera-card.png');
  assert.match(
    fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.md'), 'utf8'),
    /camera-card\.png/
  );
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date)), false);
  for (const [relPath, before] of publishedWeekly) {
    assert.equal(fs.readFileSync(path.join(root, relPath), 'utf8'), before, relPath);
  }
  const allowlist = retentionCommitAllowlist({ root, date });
  assert.deepEqual(allowlist.filter(relPath => relPath.startsWith(`articles/newsletters/${date}/`)), []);
});

test('repair with zero repairable articles leaves the published weekly page alone when the run expects no public output', async () => {
  const root = tempRoot('newsletter-image-repair-diagnostics-stale-');
  const date = '2026-05-30';
  const selectedImage = 'https://publisher.example.com/images/camera-card.png';
  await writeWeeklyNewsletterArtifacts({ root, date, editor: issue(date, { imageCandidates: [validImage()] }) });
  writeReviewDraft(root, issue(date, {
    imageCandidates: [validImage()],
    selectedImage,
    imageSource: 'https://publisher.example.com',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Camera update card',
    imageLicenseStatus: 'unknown',
    resolvedImage: { url: selectedImage, src: selectedImage, originalUrl: '', originalSrc: '', usedFallback: false, reason: 'selected image candidate' }
  }));
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    public_output_expected: false
  });
  const weeklyKey = fs.readdirSync(path.join(root, 'articles', 'newsletters')).find(name => /^\d{4}-W\d{2}$/.test(name));
  const publishedWeekly = snapshotFiles(root, [
    `articles/newsletters/${weeklyKey}/issue.json`,
    'articles/data/newsletters-weekly.json'
  ]);

  const repairs = await repairNewsletterImages({ root, date });

  assert.equal(repairs[0].repairedArticleCount, 0);
  assert.equal(repairs[0].weeklySync.synced, false);
  assert.equal(repairs[0].weeklySync.reason, 'public_output_not_expected');
  for (const [relPath, before] of publishedWeekly) {
    assert.equal(fs.readFileSync(path.join(root, relPath), 'utf8'), before, relPath);
  }
});

test('repair still rewrites public pages when the run expects public output', async () => {
  const root = tempRoot('newsletter-image-repair-public-');
  const date = '2026-05-30';
  writeIssue(root, issue(date, { imageCandidates: [validImage()] }));
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'PASS',
    public_output_expected: true
  });

  const repairs = await repairNewsletterImages({ root, date });

  assert.equal(repairs[0].repairedArticleCount, 1);
  assert.match(fs.readFileSync(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), 'utf8'), /camera-card\.png/);
  assert.match(fs.readFileSync(path.join(root, 'articles', 'newsletters', date, 'index.html'), 'utf8'), /class="article-image"/);
});

// #1188: 공개 출력이 없는 실행에는 공개 페이지가 없다. 그 부재를 선택 이미지의 render_mismatch로 세면
// 진단 전용 PR의 보고서가 이미지 문제로 발행이 막힌 것처럼 보인다.
function selectedImageDraft(date) {
  const selectedImage = 'https://publisher.example.com/images/camera-card.png';
  return issue(date, {
    imageCandidates: [validImage(selectedImage)],
    selectedImage,
    imageSource: 'https://publisher.example.com',
    imageAttribution: 'Example Publisher',
    imageAlt: 'Camera update card',
    imageLicenseStatus: 'unknown'
  });
}

test('audit skips render consistency when the run expects no public output', async () => {
  const root = tempRoot('newsletter-image-audit-no-public-output-');
  const date = '2026-05-30';
  writeReviewDraft(root, selectedImageDraft(date));
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    public_output_expected: false
  });

  const report = await buildNewsletterImageAuditReport({ root, date });

  assert.equal(report.render_consistency_scope, 'not_applicable_no_public_output');
  assert.equal(report.summary.selected_image_count, 1);
  assert.equal(report.summary.selected_image_render_mismatch_count, 0);
  assert.equal(report.summary.publish_blocking_issue_count, 0);
  assert.equal(report.errors.some(item => item.type === 'selected_image_render_mismatch'), false);
});

test('audit still counts missing public pages when public output is expected or unrecorded', async () => {
  for (const statusExtra of [{ public_output_expected: true }, {}]) {
    const root = tempRoot('newsletter-image-audit-public-output-');
    const date = '2026-05-30';
    writeReviewDraft(root, selectedImageDraft(date));
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
      date,
      status: 'PASS',
      ...statusExtra
    });

    const report = await buildNewsletterImageAuditReport({ root, date });

    assert.equal(report.render_consistency_scope, 'editor_draft', JSON.stringify(statusExtra));
    assert.equal(report.summary.selected_image_render_mismatch_count, 1, JSON.stringify(statusExtra));
    assert.equal(report.summary.publish_blocking_issue_count, 1, JSON.stringify(statusExtra));
  }
});

test('audit keeps render mismatch blocking for a publish target even if the status says no public output', async () => {
  const root = tempRoot('newsletter-image-audit-publish-target-no-public-');
  const date = '2026-05-30';
  const fixture = selectedImageDraft(date);
  fixture.publication_mode = 'public';
  writeReviewDraft(root, fixture);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'PASS',
    public_output_expected: false
  });

  const report = await buildNewsletterImageAuditReport({ root, date });

  assert.equal(report.render_consistency_scope, 'editor_draft');
  assert.equal(report.summary.selected_image_render_mismatch_count, 1);
  assert.equal(report.summary.publish_blocking_issue_count, 1);
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
