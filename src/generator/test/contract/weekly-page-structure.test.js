'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  publicNewsletterStructureStatus,
  weeklyNewsletterStructureStatus
} = require('../../publish/public-structure');
const { tempRoot, writeJson, writeText } = require('../../../shared/test/helpers/fs');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const WEEKLY_KEY = '2026-W37';

// 발행된 주간호를 그대로 옮겨 담는다. 손으로 조립한 최소 픽스처는 이 검사가 실제로 무엇을
// 보는지(이미지 태그가 있는 페이지인지)를 감춰서, 검사가 헛돌아도 통과한다.
function readPublished(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function stageWeeklyIssue(root, overrides = {}) {
  const weeklyKey = overrides.weeklyKey ?? WEEKLY_KEY;
  const issueDir = path.join(root, 'articles', 'newsletters', weeklyKey);
  fs.mkdirSync(issueDir, { recursive: true });
  writeText(
    path.join(issueDir, 'newsletter.md'),
    overrides.markdown ?? readPublished(`articles/newsletters/${weeklyKey}/newsletter.md`)
  );
  writeText(
    path.join(issueDir, 'index.html'),
    overrides.html ?? readPublished(`articles/newsletters/${weeklyKey}/index.html`)
  );
  writeText(
    path.join(issueDir, 'issue.json'),
    overrides.issue ?? readPublished(`articles/newsletters/${weeklyKey}/issue.json`)
  );

  // fallback 이미지 계약은 파일이 실제로 있는지까지 본다.
  const fallbackRelative = 'articles/assets/images/fallback/newsletter-default.svg';
  const fallbackTarget = path.join(root, fallbackRelative);
  fs.mkdirSync(path.dirname(fallbackTarget), { recursive: true });
  writeText(fallbackTarget, readPublished(fallbackRelative));

  const weeklyIndex = JSON.parse(readPublished('articles/data/newsletters-weekly.json'))
    .filter(item => item.weeklyKey === weeklyKey);
  assert.equal(weeklyIndex.length, 1, `${weeklyKey} 항목이 주간 인덱스에 있어야 이 픽스처가 성립한다.`);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), weeklyIndex);
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), []);
}

test('the weekly lane accepts a published weekly issue as it stands (#905)', () => {
  const root = tempRoot('weekly-structure-ok');
  stageWeeklyIssue(root);

  const result = weeklyNewsletterStructureStatus(root, WEEKLY_KEY);

  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

// 주간 레인이 editor 소스로 issue.json을 읽는다는 것이 이 변경의 배선이고, 그 배선이 끊기면
// validateSelectedImageContract가 sections를 못 찾아 조용히 아무것도 검사하지 않는다. 그때
// 나오는 값은 오류가 아니라 ok라서, 관측을 몇 주 쌓아 차단 여부를 정하려는 계획이 "실패가
// 없었다"는 잘못된 결론에 이른다.
test('the weekly lane reads the image contract out of issue.json (#905)', () => {
  const root = tempRoot('weekly-structure-issue-json');
  const issue = JSON.parse(readPublished(`articles/newsletters/${WEEKLY_KEY}/issue.json`));
  const [section] = issue.sections;
  assert.ok(Array.isArray(section.imageCandidates), '이 픽스처는 이미지 후보를 가진 주간호를 전제로 한다.');
  section.selectedImage = 'https://example.com/not-a-candidate.png';
  stageWeeklyIssue(root, { issue: JSON.stringify(issue, null, 2) });

  const result = weeklyNewsletterStructureStatus(root, WEEKLY_KEY);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(error => /selectedImage is not in imageCandidates/.test(error)),
    `issue.json의 이미지 계약 위반이 잡혀야 한다. 실제 오류: ${JSON.stringify(result.errors)}`
  );
});

// 이 이슈의 주 동기다. #863이 센 가짜 출처 캡션 중 주간호분이 발행 게이트에 한 번도 걸리지
// 않았다. 그 규칙(#855)이 이제 주간 레인에서도 돈다는 것을 잠근다.
test('the weekly lane rejects a source caption on a fallback image (#905)', () => {
  const root = tempRoot('weekly-structure-fallback-caption');
  const published = readPublished(`articles/newsletters/${WEEKLY_KEY}/index.html`);
  const fallbackImage = published.match(/<img[^>]*class="article-image"[^>]*fallback[^>]*>/);
  assert.ok(fallbackImage, '이 픽스처는 fallback 이미지를 쓰는 발행본을 전제로 한다.');
  const withFakeCaption = published.replace(
    fallbackImage[0],
    `${fallbackImage[0]}<p class="article-image-caption">출처: <a href="https://example.com/">Example</a></p>`
  );
  stageWeeklyIssue(root, { html: withFakeCaption });

  const result = weeklyNewsletterStructureStatus(root, WEEKLY_KEY);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(error => /fallback article image must not carry a source attribution caption/.test(error)),
    `가짜 출처 캡션이 잡혀야 한다. 실제 오류: ${JSON.stringify(result.errors)}`
  );
});

// 위 fallback 테스트의 대조군이다. W37은 기사 전부가 fallback 이미지라, 캡션을 무조건 거부하는
// 검사기도 위 테스트를 통과한다. 출처 이미지에 출처 캡션이 붙은 발행본(W34)이 그대로 통과해야
// 검사가 "캡션 금지"가 아니라 "출처에 맞는 캡션"을 보고 있다고 말할 수 있다.
const SOURCE_IMAGE_WEEKLY_KEY = '2026-W34';

function sourceImageFixture() {
  const issue = JSON.parse(readPublished(`articles/newsletters/${SOURCE_IMAGE_WEEKLY_KEY}/issue.json`));
  const sourceSection = issue.sections.find(
    section => /^https:\/\//.test(section.selectedImage) && section.resolvedImage?.usedFallback === false
  );
  assert.ok(sourceSection, '이 픽스처는 출처 이미지를 쓰는 기사가 있는 주간호를 전제로 한다.');
  const html = readPublished(`articles/newsletters/${SOURCE_IMAGE_WEEKLY_KEY}/index.html`);
  const caption = html.match(
    /<figcaption class="article-image-caption">[^<]*<a href="https:\/\/[^"]+">[^<]*<\/a>[^<]*<\/figcaption>/
  );
  assert.ok(caption, '이 픽스처는 https 출처 링크를 가진 이미지 캡션이 있는 발행본을 전제로 한다.');
  return { html, caption: caption[0] };
}

test('the weekly lane accepts a source caption on a source image (#905)', () => {
  const root = tempRoot('weekly-structure-source-caption-ok');
  sourceImageFixture();
  stageWeeklyIssue(root, { weeklyKey: SOURCE_IMAGE_WEEKLY_KEY });

  const result = weeklyNewsletterStructureStatus(root, SOURCE_IMAGE_WEEKLY_KEY);

  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

// 같은 픽스처에서 캡션만 빼면 실패해야 위 양성 테스트가 "검사가 헛돌아서 통과"한 것이 아님이
// 증명된다. 출처 이미지 쪽 규칙(캡션의 https 출처 링크 필수)이 주간 레인에서 도는지를 잠근다.
test('the weekly lane rejects a source image without a caption attribution link (#905)', () => {
  const root = tempRoot('weekly-structure-source-caption-missing');
  const { html, caption } = sourceImageFixture();
  stageWeeklyIssue(root, { weeklyKey: SOURCE_IMAGE_WEEKLY_KEY, html: html.replace(caption, '') });

  const result = weeklyNewsletterStructureStatus(root, SOURCE_IMAGE_WEEKLY_KEY);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(error => /missing caption attribution link/.test(error)),
    `출처 이미지의 캡션 누락이 잡혀야 한다. 실제 오류: ${JSON.stringify(result.errors)}`
  );
});

// 이슈가 경고한 오탐이다. 주간호는 그 주 기사 수만큼 브리핑 줄을 갖는데, 일간의 "정확히 3"
// 규칙을 그대로 겨누면 정상 호가 실패한다. 발행 경로에 그 규칙이 들어가면 발행 가능한 호를
// 막는다 — 이 저장소가 반복해서 데인 유형이다.
test('the weekly lane does not apply the daily briefing bullet count (#905)', () => {
  const root = tempRoot('weekly-structure-briefing');
  stageWeeklyIssue(root);
  const bullets = readPublished(`articles/newsletters/${WEEKLY_KEY}/newsletter.md`)
    .split('\n')
    .filter(line => /^- /.test(line.trim()));
  assert.ok(bullets.length > 3, '이 픽스처는 브리핑 줄이 3개를 넘는 주간호를 전제로 한다.');

  const result = weeklyNewsletterStructureStatus(root, WEEKLY_KEY);

  assert.equal(
    result.errors.some(error => /briefing bullets/.test(error)),
    false,
    `브리핑 개수 규칙은 주간 레인에서 돌면 안 된다. 실제 오류: ${JSON.stringify(result.errors)}`
  );
});

// 주간 규칙을 넣으면서 일간 판정이 함께 움직이면 안 된다. 일간 레인은 여전히 정확히 3을
// 요구한다.
test('the daily lane still requires exactly three briefing bullets (#905)', () => {
  const root = tempRoot('daily-structure-briefing');
  const date = '2026-09-07';
  const issueDir = path.join(root, 'articles', 'newsletters', date);
  fs.mkdirSync(issueDir, { recursive: true });
  writeText(
    path.join(issueDir, 'newsletter.md'),
    readPublished(`articles/newsletters/${WEEKLY_KEY}/newsletter.md`)
  );
  writeText(path.join(issueDir, 'index.html'), '<html><body></body></html>');
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), []);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), []);

  const result = publicNewsletterStructureStatus(root, date);

  assert.ok(
    result.errors.some(error => /must have exactly 3 briefing bullets/.test(error)),
    `일간 레인은 브리핑 3줄 규칙을 유지해야 한다. 실제 오류: ${JSON.stringify(result.errors)}`
  );
});
