'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  syncWeeklyArticleImages,
  writeWeeklyNewsletterArtifacts
} = require('../../../render/weekly-newsletter-output');
const { buildWeeklyNewsletterPage } = require('../../../render/weekly-newsletter-page');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-output-'));
}

// A renderer-valid main-article section keyed by a distinct source URL.
function section(id, url, score = 1) {
  return {
    category: 'Android Camera',
    headline: `CameraX ${id}`,
    what_changed: `CameraX ${id} 변경 사항입니다.`,
    evidence_summary: 'Android Developers 릴리스 노트를 출처로 사용합니다.',
    confirmed_facts: [`${id} 릴리스 노트가 존재합니다.`, '날짜가 있습니다.'],
    specificity_checks: [`version=${id}`],
    source_verification_notes: ['공식 URL'],
    camera_hal_checks: ['stream 확인', 'metadata 확인'],
    action_items: ['ITS smoke', '호환성 확인'],
    score,
    source_candidate_url: url,
    article_sections: {
      verified_facts: [`${id} 릴리스 노트가 존재합니다.`],
      background_context: 'CameraX는 Android 카메라 애플리케이션 계층의 일부입니다.',
      hal_driver_impact: 'Camera HAL 팀 확인',
      action_items: ['ITS smoke'],
      team_share_points: 'Camera 팀 검토'
    },
    public_article: {
      headline: `CameraX ${id}`,
      lead: `CameraX ${id}는 호환성 확인 신호를 제공합니다.`,
      body_paragraphs: ['공식 근거입니다.', '검증 범위로 제한합니다.'],
      camera_hal_takeaway: '검증 트리거로 다룹니다.',
      reader_checkpoints: ['ITS smoke', '호환성 확인'],
      source_links: [{ title: 'Android', url, source_role: 'primary' }]
    },
    sources: [{ title: 'Android', url }]
  };
}

function draft(sections, summary = '요약') {
  return { date: '2026-06-04', title: 'Daily', summary, briefing: ['하나', '둘', '셋'], sections, action_items: ['a'], references: [] };
}

function readIssue(root, weeklyKey) {
  return JSON.parse(fs.readFileSync(path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json'), 'utf8'));
}

test('a single publish-ready run writes the weekly page, issue.json, and a weekly index entry', async () => {
  const root = tempRoot();
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0';
  const result = await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.7.0', url)]) });

  assert.equal(result.weeklyKey, '2026-W23');
  assert.ok(result.files.includes('articles/newsletters/2026-W23/index.html'));
  assert.ok(result.files.includes('articles/newsletters/2026-W23/newsletter.md'));
  assert.ok(result.files.includes('articles/newsletters/2026-W23/issue.json'));
  assert.ok(result.files.includes('articles/data/newsletters-weekly.json'));
  assert.equal(readIssue(root, '2026-W23').sections.length, 1);
});

test('weekly tags derive archive topics and kicker from article relevance buckets', async () => {
  const root = tempRoot();
  const driver = { ...section('driver', 'https://example.com/driver'), relevance_bucket: 'camera_driver_image_pipeline' };
  const ai = { ...section('ai', 'https://example.com/ai'), relevance_bucket: 'cpp_ai_tooling_fallback' };
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([driver, ai]) });

  // 위클리 tags 는 이슈 기본값이 아니라 그 주 기사 버킷에서 나온다: lead(camera_driver) topic 이
  // 맨 앞이라 카드 kicker 가 되고, AI 도 채워지며 baseline(Camera HAL/Android)이 뒤에 붙는다.
  const issue = readIssue(root, '2026-W23');
  assert.deepEqual(issue.tags, ['Driver', 'Image Processing', 'AI', 'Camera HAL', 'Android']);
  assert.equal(issue.tags[0], 'Driver');
});

test('written index.html carries the merged weekly tags and re-renders byte-identically from issue.json', async () => {
  const root = tempRoot();
  const driver = { ...section('driver', 'https://example.com/driver'), relevance_bucket: 'camera_driver_image_pipeline' };
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([driver]) });

  const issue = readIssue(root, '2026-W23');
  const html = fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W23', 'index.html'), 'utf8');
  // html 히어로 tag row 는 issue.json 의 병합된 위클리 tags 와 같아야 한다. (병합 전 editor tags 로
  // 렌더된 html 을 쓰면 같은 실행이 만든 두 산출물이 서로 다른 tag 집합을 갖는다.) 이 동등식은
  // 일반 발행 기준이다 — fallback_public 모드는 issueTags 가 렌더 시 tag 를 변환하므로 성립하지
  // 않고, 그 모드까지 지키는 불변식은 아래 byte 동일 재렌더 검사다.
  const tagRowMatch = html.match(/<div class="tag-row issue-tags">(.*?)<\/div>/);
  assert.ok(tagRowMatch, 'index.html 에 issue-tags tag row 가 없습니다');
  const htmlTags = [...tagRowMatch[1].matchAll(/<span class="tag">([^<]*)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(htmlTags, issue.tags);
  // issue.json 은 발행 페이지의 정본이다: 재렌더가 커밋된 html 을 바이트 동일하게 재현해야 한다.
  const rerendered = buildWeeklyNewsletterPage(issue, { weeklyKey: '2026-W23' });
  assert.equal(rerendered.html, html);
});

test('publishing a weekly issue regenerates sitemap.xml with the issue URL', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.7.0', 'https://example.com/a')]) });

  const sitemap = fs.readFileSync(path.join(root, 'articles', 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes('https://ttolsun.github.io/camera-hal-sw-newsletter/'));
  assert.ok(sitemap.includes('https://ttolsun.github.io/camera-hal-sw-newsletter/archive.html'));
  assert.ok(sitemap.includes('newsletters/2026-W23/index.html'));
});

test('multiple runs in the same ISO week accumulate distinct articles into one weekly issue', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-01', editor: draft([section('1.6.0', 'https://example.com/a')]) });
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.7.0', 'https://example.com/b')]) });

  const issue = readIssue(root, '2026-W23');
  assert.equal(issue.sections.length, 2);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.equal(index.length, 1);
  assert.equal(index[0].weeklyKey, '2026-W23');
  assert.equal(index[0].article_count, 2);
});

test('a duplicate article in the same week is not added twice', async () => {
  const root = tempRoot();
  const url = 'https://example.com/same';
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-01', editor: draft([section('1.6.0', url)]) });
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.6.0-again', url)]) });

  assert.equal(readIssue(root, '2026-W23').sections.length, 1);
});

// 같은 release-note 페이지의 다른 버전(fragment만 다름) 쌍: findWeeklyDuplicate가
// same_source_page near-duplicate로 잡는 관계가 아래 두 테스트의 공통 전제다.
const NEAR_DUPLICATE_SEED_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0';
const NEAR_DUPLICATE_APPEND_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0';

// seed(1.6.0)를 발행한 뒤 near-duplicate(1.7.0)를 LLM append("서로 다른 별개 기사이면
// 둘 다 유지") 결정으로 넣는다. 두 번째 실행의 결과를 반환한다.
async function seedAppendedNearDuplicate(root) {
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-01', editor: draft([section('1.6.0', NEAR_DUPLICATE_SEED_URL)]), tags: [] });
  return writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-02',
    editor: draft([section('1.7.0', NEAR_DUPLICATE_APPEND_URL)]),
    tags: [],
    mergeDuplicate: async () => ({ decision: 'append', reason: 'different versions' })
  });
}

test('an LLM append decision for a near-duplicate persists to the page, index, and returned articles', async () => {
  const root = tempRoot();
  const result = await seedAppendedNearDuplicate(root);

  // append 결정은 발행 페이지·인덱스·반환 목록 세 곳 모두에 같은 기사 집합으로 나타나야 한다.
  const issue = readIssue(root, '2026-W23');
  assert.equal(issue.sections.length, 2);
  assert.equal(result.articles.length, 2);
  assert.equal(readWeeklyIndexFile(root)[0].article_count, issue.sections.length);
});

test('a persisted LLM append is not re-asked on the next run for the same article', async () => {
  const root = tempRoot();
  await seedAppendedNearDuplicate(root);

  // append된 기사가 issue.json에 남아 있으면 재실행은 exact duplicate로 결정론 거부된다.
  // (영속되지 않으면 같은 near-duplicate를 매 실행 LLM에 재질의하는 결정 flapping이 된다.)
  let llmCalls = 0;
  const rerun = await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-03',
    editor: draft([section('1.7.0', NEAR_DUPLICATE_APPEND_URL)]),
    tags: [],
    mergeDuplicate: async () => { llmCalls += 1; return { decision: 'append', reason: 'again' }; }
  });

  assert.equal(llmCalls, 0);
  assert.deepEqual(rerun.mergeDecisions, [{ decision: 'reject', reason: 'exact_duplicate' }]);
  assert.equal(readIssue(root, '2026-W23').sections.length, 2);
});

test('a run in a new ISO week creates a separate weekly issue', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('w23', 'https://example.com/a')]) });
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-11', editor: draft([section('w24', 'https://example.com/b')]) });

  assert.equal(readIssue(root, '2026-W23').sections.length, 1);
  assert.equal(readIssue(root, '2026-W24').sections.length, 1);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.deepEqual(index.map(i => i.weeklyKey), ['2026-W24', '2026-W23']);
});

test('coverage 필드는 upsert를 통과해 issue.json과 index entry에 남는다', async () => {
  const root = tempRoot();
  const url = 'https://example.com/coverage';
  const editorDraft = {
    ...draft([section('coverage', url)]),
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16',
    coverage_mode: 'iso_week',
    generation_anchor_date: '2026-08-17'
  };

  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: editorDraft, tags: [] });

  const issue = readIssue(root, '2026-W23');
  assert.equal(issue.coverage_week_key, '2026-W33');
  assert.equal(issue.coverage_start_date, '2026-08-10');
  assert.equal(issue.coverage_end_date, '2026-08-16');
  assert.equal(issue.coverage_mode, 'iso_week');
  assert.equal(issue.generation_anchor_date, '2026-08-17');

  const indexEntry = readWeeklyIndexFile(root)[0];
  assert.equal(indexEntry.coverage_week_key, '2026-W33');
  assert.equal(indexEntry.coverage_start_date, '2026-08-10');
  assert.equal(indexEntry.coverage_end_date, '2026-08-16');
  assert.equal(indexEntry.coverage_mode, 'iso_week');
  assert.equal(indexEntry.generation_anchor_date, '2026-08-17');
});

test('coverage 필드가 없는 draft로 같은 주에 재실행해도 기존 이슈의 coverage 값이 보존된다', async () => {
  const root = tempRoot();
  // 2026-06-04와 2026-06-01은 같은 identity 주(2026-W23)이면서 coverageForAnchorDate가
  // 계산하는 대상 주(2026-W22)도 같다 — 두 번째 실행에서 hard-fail 불일치 검사에 걸리지
  // 않으면서 "editor가 명시한 값이 계산값과 같아도 그대로 보존된다"를 증명한다.
  const editorDraft = {
    ...draft([section('coverage-first', 'https://example.com/coverage-first')]),
    coverage_week_key: '2026-W22',
    coverage_start_date: '2026-05-25',
    coverage_end_date: '2026-05-31',
    coverage_mode: 'iso_week',
    generation_anchor_date: '2026-06-04'
  };
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: editorDraft, tags: [] });

  // 두 번째 실행의 draft에는 coverage 필드가 전혀 없다(예: 과거호 재-upsert). 기존 이슈에
  // 이미 실린 coverage 값이 지워지지 않고 그대로 남아야 한다.
  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-01',
    editor: draft([section('coverage-second', 'https://example.com/coverage-second')]),
    tags: []
  });

  const issue = readIssue(root, '2026-W23');
  assert.equal(issue.coverage_week_key, '2026-W22');
  // generation_anchor_date는 hard-fail 비교 대상이 아니라 순수 pass-through다 — 두 번째
  // 실행의 draft가 값을 안 줬으므로 첫 실행이 남긴 값이 그대로 보존된다.
  assert.equal(issue.generation_anchor_date, '2026-06-04');
  const indexEntry = readWeeklyIndexFile(root)[0];
  assert.equal(indexEntry.coverage_week_key, '2026-W22');
});

test('a single run cannot add more than the daily intake limit of new articles', async () => {
  const root = tempRoot();
  const sections = [1, 2, 3, 4, 5, 6, 7].map(n => section(`v${n}`, `https://example.com/${n}`, n));
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft(sections) });
  // dailyNewArticleLimit default is 5
  assert.equal(readIssue(root, '2026-W23').sections.length, 5);
});

// 로컬 fallback visual 상태의 섹션 (renderer가 fallback SVG로 해석한 daily 결과 그대로).
function fallbackImageSection(id, url) {
  return {
    ...section(id, url),
    selectedImage: '',
    resolvedImage: {
      url: '../../assets/images/fallback/android.svg',
      src: '../../assets/images/fallback/android.svg',
      originalUrl: '',
      originalSrc: '',
      usedFallback: true,
      reason: 'no selected image; local fallback visual used'
    }
  };
}

// repair(applySelectedCandidate)가 daily editor-draft에 기록하는 이미지 필드 집합을 그대로 갖는 섹션.
function repairedImageSection(id, url, imageUrl) {
  return {
    ...section(id, url),
    selectedImage: imageUrl,
    imageSource: 'https://publisher.example.com',
    imageAttribution: 'Example Publisher',
    imageAlt: `CameraX ${id}`,
    imageLicenseStatus: 'unknown',
    imageUsageDecisionReason: '대표 이미지 선택됨',
    imageSelection: { reasonCode: 'selected', candidateUrl: imageUrl },
    resolvedImage: {
      url: imageUrl,
      src: imageUrl,
      originalUrl: '',
      originalSrc: '',
      usedFallback: false,
      reason: 'selected image candidate'
    }
  };
}

function readWeeklyIndexFile(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
}

function weeklyArtifactPaths(root, weeklyKey) {
  return [
    path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'),
    path.join(root, 'articles', 'newsletters', weeklyKey, 'newsletter.md'),
    path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json'),
    path.join(root, 'articles', 'data', 'newsletters-weekly.json')
  ];
}

function snapshotFiles(paths) {
  return paths.map(filePath => [filePath, fs.readFileSync(filePath, 'utf8')]);
}

test('article_images falls back to one site-root-relative fallback path when no https image exists', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-04',
    editor: draft([fallbackImageSection('1.7.0', 'https://example.com/a')])
  });

  assert.deepEqual(readWeeklyIndexFile(root)[0].article_images, ['assets/images/fallback/android.svg']);
});

test('article_images stays empty when sections have neither https nor fallback-asset images', async () => {
  const root = tempRoot();
  const local = {
    ...section('1.7.0', 'https://example.com/a'),
    selectedImage: '',
    resolvedImage: { url: '../../some/other/local.png', src: '../../some/other/local.png', usedFallback: true }
  };
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([local]) });

  assert.deepEqual(readWeeklyIndexFile(root)[0].article_images, []);
});

test('syncWeeklyArticleImages patches the matching weekly section, rewrites weekly artifacts, and updates article_images', async () => {
  const root = tempRoot();
  const url = 'https://example.com/camerax-release';
  const imageUrl = 'https://publisher.example.com/images/camera-card.png';
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([fallbackImageSection('1.7.0', url)]) });
  const sitemapBefore = fs.readFileSync(path.join(root, 'articles', 'sitemap.xml'), 'utf8');

  const result = syncWeeklyArticleImages({ root, date: '2026-06-04', sections: [repairedImageSection('1.7.0', url, imageUrl)] });

  assert.equal(result.synced, true);
  assert.equal(result.weeklyKey, '2026-W23');
  assert.equal(result.patchedSectionCount, 1);
  assert.equal(result.articleImagesUpdated, true);
  const issue = readIssue(root, '2026-W23');
  assert.equal(issue.sections[0].selectedImage, imageUrl);
  assert.equal(issue.sections[0].resolvedImage.usedFallback, false);
  assert.equal(issue.sections[0].imageSelection.reasonCode, 'selected');
  assert.match(fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W23', 'index.html'), 'utf8'), new RegExp(imageUrl.replace(/[.\/]/g, '\\$&')));
  assert.match(fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W23', 'newsletter.md'), 'utf8'), new RegExp(imageUrl.replace(/[.\/]/g, '\\$&')));
  assert.deepEqual(readWeeklyIndexFile(root)[0].article_images, [imageUrl]);
  // article_images만 갱신하며 sitemap은 재생성하지 않는다.
  assert.equal(fs.readFileSync(path.join(root, 'articles', 'sitemap.xml'), 'utf8'), sitemapBefore);
});

test('syncWeeklyArticleImages is a no-op when the weekly issue.json is missing', () => {
  const root = tempRoot();

  const result = syncWeeklyArticleImages({
    root,
    date: '2026-06-04',
    sections: [repairedImageSection('1.7.0', 'https://example.com/a', 'https://publisher.example.com/img.png')]
  });

  assert.equal(result.synced, false);
  assert.equal(result.reason, 'missing_weekly_issue');
  assert.equal(fs.existsSync(path.join(root, 'newsletters')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json')), false);
});

test('syncWeeklyArticleImages is a no-op for missing daily sections and non-matching identity', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([fallbackImageSection('1.7.0', 'https://example.com/a')]) });
  const snapshot = snapshotFiles(weeklyArtifactPaths(root, '2026-W23'));

  const emptyResult = syncWeeklyArticleImages({ root, date: '2026-06-04', sections: [] });
  assert.equal(emptyResult.synced, false);
  assert.equal(emptyResult.reason, 'missing_daily_sections');

  const unmatchedResult = syncWeeklyArticleImages({
    root,
    date: '2026-06-04',
    sections: [repairedImageSection('9.9.9', 'https://example.com/unrelated', 'https://publisher.example.com/img.png')]
  });
  assert.equal(unmatchedResult.synced, true);
  assert.equal(unmatchedResult.patchedSectionCount, 0);

  for (const [filePath, before] of snapshot) {
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
  }
});

test('syncWeeklyArticleImages does not downgrade a bound weekly image to a daily fallback state', async () => {
  const root = tempRoot();
  const url = 'https://example.com/camerax-release';
  const imageUrl = 'https://publisher.example.com/images/camera-card.png';
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([repairedImageSection('1.7.0', url, imageUrl)]) });
  const snapshot = snapshotFiles(weeklyArtifactPaths(root, '2026-W23'));

  const result = syncWeeklyArticleImages({ root, date: '2026-06-04', sections: [fallbackImageSection('1.7.0', url)] });

  assert.equal(result.synced, true);
  assert.equal(result.patchedSectionCount, 0);
  for (const [filePath, before] of snapshot) {
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
  }
});

test('syncWeeklyArticleImages is idempotent', async () => {
  const root = tempRoot();
  const url = 'https://example.com/camerax-release';
  const repaired = repairedImageSection('1.7.0', url, 'https://publisher.example.com/images/camera-card.png');
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([fallbackImageSection('1.7.0', url)]) });

  const first = syncWeeklyArticleImages({ root, date: '2026-06-04', sections: [repaired] });
  assert.equal(first.patchedSectionCount, 1);
  const snapshot = snapshotFiles(weeklyArtifactPaths(root, '2026-W23'));

  const second = syncWeeklyArticleImages({ root, date: '2026-06-04', sections: [repaired] });
  assert.equal(second.synced, true);
  assert.equal(second.patchedSectionCount, 0);
  assert.equal(second.articleImagesUpdated, false);
  for (const [filePath, before] of snapshot) {
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
  }
});
