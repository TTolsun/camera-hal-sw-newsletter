const fs = require('fs');
const path = require('path');
const {
  MIN_CONTENT_LENGTH,
  validateImageUrl
} = require('../../shared/render/image-candidates');
const { repoLocalPath } = require('../render/article-image-resolver');
const {
  decodeHtml,
  htmlAttr,
  readJson,
  repoPath
} = require('../../shared/common/common');
const {
  newsroomDir,
  newsroomRelPath,
  publicAssetPath
} = require('../../shared/common/artifact-paths');
const {
  toLegacyEditorIssue
} = require('../../shared/domain/newsletter-domain-normalize');
const { ensureArray } = require('../../shared/common/value-coercion');
const { strictTargetDates } = require('../reporter/validation-targets');

const root = process.cwd();
const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

// 외부 이미지의 live 네트워크 검증은 "지금 발행/변경되는 newsletter"(strict target)에만 적용한다.
// 외부 호스트의 link rot(소멸·hotlink 403)은 시간이 지나면 필연이라, 불변의 과거 발행물을 매 run
// 다시 live fetch하면 무관한 PR의 CI가 외부 사정으로 막히거나 느려진다. 그래서 과거 발행물의 외부
// 이미지는 live 검증을 건너뛴다(발행 시점에 이미 검증됨). 결정론적 local 검사(파일 존재·URL scheme)는
// repo 무결성 문제라 date와 무관하게 그대로 차단한다. 형제 validator와 동일한 validation-targets 스코핑.
function shouldLiveValidate(date, strictDates) {
  return strictDates.has(date);
}

// 이미지 계보 감사(newsroom:audit-images)의 publish 차단 판정을 머지 경로에서 강제하는 지점이다(#886).
// 워크플로 03의 감사 스텝은 실패해도 그 주 뉴스레터 PR이 남도록 강등됐는데, 강등만 하면 머지 전에
// 이 조건을 강제하는 지점이 하나도 남지 않는다. 그래서 PR에 함께 커밋되는 image-audit-report.json의
// publish 차단 카운트를 여기서 읽어 같은 조건을 차단한다.
// 차단 조건은 워크플로가 쓰는 --fail-on-publish-blocking과 같은 식이어야 한다. 그쪽은
// publish_blocking_issue_count > 0만 보고 mode는 보지 않는다(newsletter-image-audit.js:878).
// 여기서 mode === 'publish-target'을 한 번 더 요구하면 안 되는 이유는 두 가지다.
//  1) 카운트는 이미 감사 모듈에서 mode별로 좁혀져 있다. review-or-draft일 때의 카운트는
//     selected_image_render_mismatch(에디터가 고른 이미지가 공개 산출물에 없음)만 세므로,
//     소비자가 mode로 다시 걸러 내면 남은 진짜 차단 신호가 통째로 지워진다.
//  2) 감사 스텝이 무장되는 조건(public_newsletter_ready)은 구조 조건(공개 파일 존재·비어있지 않음·
//     인덱스 등재·변경)이라 mode를 정하는 publishTarget(issue, status)와 갈린다. 실제로 커밋된
//     2026-05-11·05-22·05-27은 status가 NEEDS_FIX(=publishTarget false → mode review-or-draft)인데도
//     공개 파일이 인덱스에 올라 발행됐다. 즉 mode 절은 감사가 여전히 무장되는 주 부류를 정확히 못 본다.
// 스코핑은 strict target 날짜 하나로 충분하다(위 shouldLiveValidate와 같은 규약). 과거 발행물의
// 잔존 카운트가 무관한 PR을 막지 못하는 이유는 validation-targets가 image-audit-report 경로를
// strict target 산정에서 제외하기 때문이다.
function failOnPublishBlockingImageAudit(date, strictDates) {
  if (!strictDates.has(date)) return;

  const relPath = newsroomRelPath(date, 'image-audit-report.json');
  const auditPath = path.join(newsroomDir(root, date), 'image-audit-report.json');
  // 리포트가 없으면 건너뛴다. 워크플로 03에서 validate:images는 감사 스텝보다 먼저 돌기 때문에
  // 정상적인 첫 실행에는 파일이 아직 존재하지 않는다. 존재를 요구하면 매 첫 실행이 붉어진다.
  if (!fs.existsSync(auditPath)) return;

  let report;
  try {
    report = readJson(auditPath);
  } catch (error) {
    fail(`Could not parse ${relPath}: ${error.message}`);
    return;
  }

  // 카운트는 감사 모듈이 쓰는 것과 같은 모양(0 이상의 정수)일 때만 신뢰한다. 그 밖의 값은
  // 손상으로 보고 실패시킨다. `Number(...) || 0`처럼 0으로 강제하면 손상된 리포트가 이 게이트를
  // 조용히 꺼 버린다 — 이 값 하나가 머지 경로의 유일한 강제 지점이라 fail-closed여야 한다.
  // 음수·소수까지 그냥 숫자로 받으면 워크플로의 `--fail-on-publish-blocking`(> 0만 본다)과
  // 판정이 갈려, 한쪽만 막는 리포트가 생긴다.
  const blockingCount = report?.summary?.publish_blocking_issue_count;
  if (!Number.isInteger(blockingCount) || blockingCount < 0) {
    fail(
      `Corrupt ${relPath}: summary.publish_blocking_issue_count must be a non-negative integer, ` +
      `got ${JSON.stringify(blockingCount)}`
    );
    return;
  }
  if (blockingCount === 0) return;

  fail([
    `Newsletter image lineage audit reports ${blockingCount} publish-blocking issue(s): newsletter ${date}`,
    `  report: ${relPath}`,
    ...ensureArray(report.errors).map(entry =>
      `  ${entry.type}: ${entry.headline || `article ${entry.index}`}`)
  ].join('\n'));
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function newsletterItems() {
  if (!fs.existsSync(dataPath)) {
    fail('Missing data/newsletters.json');
    return [];
  }

  let newsletters;
  try {
    newsletters = readJson(dataPath);
  } catch (error) {
    fail(`Invalid JSON in data/newsletters.json: ${error.message}`);
    return [];
  }
  if (!Array.isArray(newsletters)) {
    fail('data/newsletters.json must contain an array');
    return [];
  }

  if (fs.existsSync(newsletterDatePath)) {
    const date = read(newsletterDatePath).trim();
    const matches = newsletters.filter(item => item.date === date);
    if (matches.length === 0) fail(`No newsletter entry found for .tmp/newsletter-date.txt date: ${date}`);
    return matches;
  }
  return newsletters;
}

function nearbyHeading(content, imageIndex) {
  const before = content.slice(0, imageIndex);
  const matches = [...before.matchAll(/<h[2-3]\b[^>]*>[\s\S]*?<\/h[2-3]>/gi)];
  if (matches.length === 0) return '(no nearby heading)';
  return stripTags(matches[matches.length - 1][0]) || '(no nearby heading)';
}

function nearbyMarkdownHeading(content, imageIndex) {
  const before = content.slice(0, imageIndex);
  const matches = [...before.matchAll(/^#{2,3}\s+(.+)$/gm)];
  if (matches.length === 0) return '(no nearby heading)';
  return matches[matches.length - 1][1].trim() || '(no nearby heading)';
}

function isLocalImageSrc(value) {
  const src = String(value || '').trim();
  return src && !/^https?:\/\//i.test(src) && !/^data:/i.test(src);
}

function resolveLocalImage(relPath, src) {
  // relPath는 서빙 URL(newsletters/<date>/...)이며 디스크상으로는 articles/ 아래에 있다.
  // path.resolve(root, relPath)는 articles/ prefix를 빠뜨려 ../../assets/ fallback 경로가
  // root/assets/로 잘못 풀리고, 실제로 articles/assets/에 존재하는 fallback 이미지를 missing으로
  // 오판해 발행을 막았다(콘텐츠는 publishable인데 fallback 경로 버그로 차단). publicAssetPath로
  // articles/ 기준 해석해 위 newsletter.md/html 경로 해석(publicAssetPath)과 동일 base를 쓴다.
  const fromFile = publicAssetPath(root, relPath);
  if (!fromFile) return null;
  const absPath = path.resolve(path.dirname(fromFile), src);
  const rootPath = path.resolve(root);
  if (absPath === rootPath || absPath.startsWith(`${rootPath}${path.sep}`)) return absPath;
  return repoLocalPath(root, src);
}

function articleImages(relPath, content) {
  const tags = [];
  const pattern = /<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)[^>]*>/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const src = htmlAttr(match[0], 'src');
    if (!src) continue;
    tags.push({
      relPath,
      src,
      sourceKind: 'html',
      heading: nearbyHeading(content, match.index)
    });
  }
  return tags;
}

function markdownImages(relPath, content) {
  const images = [];
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    images.push({
      relPath,
      src: decodeHtml(match[2]),
      sourceKind: 'markdown',
      heading: nearbyMarkdownHeading(content, match.index)
    });
  }
  return images;
}

function formatResult(result) {
  const status = result.status || 'n/a';
  const contentType = result.contentType || 'n/a';
  const contentLength = result.contentLength || 'n/a';
  return `status=${status}; content-type=${contentType}; content-length=${contentLength}; reason=${result.reason}`;
}

function readEditor(date) {
  const editorPath = path.join(newsroomDir(root, date), 'editor-draft.json');
  if (!fs.existsSync(editorPath)) return null;
  try {
    return toLegacyEditorIssue(readJson(editorPath), { date });
  } catch (error) {
    fail(`Could not parse ${newsroomRelPath(date, 'editor-draft.json')}: ${error.message}`);
    return null;
  }
}

function fallbackWarningsFromEditor(date, editor) {
  if (!editor || !Array.isArray(editor.sections)) return;
  for (const [index, section] of editor.sections.entries()) {
    const resolved = section.resolvedImage || {};
    if (!resolved.usedFallback) continue;
    const fallbackSrc = resolved.url || resolved.src;
    const original = resolved.originalUrl || resolved.originalSrc || section.originalImage || 'n/a';
    const localPath = resolveLocalImage(`newsletters/${date}/index.html`, fallbackSrc);
    const fallbackExists = localPath && fs.existsSync(localPath);
    const label = section.category || `section ${index + 1}`;
    if (!fallbackExists) {
      fail([
        `Article image fallback is missing: newsletter ${date}`,
        `  section/article: ${label} / ${section.headline || 'unknown article'}`,
        `  original: ${original}`,
        `  fallback: ${fallbackSrc || 'n/a'}`,
        `  reason: ${resolved.reason || 'unknown'}`
      ].join('\n'));
      continue;
    }
    warn([
      `${original !== 'n/a' ? 'External article image was replaced with local fallback' : 'Local article image fallback was used'}: newsletter ${date}`,
      `  section/article: ${label} / ${section.headline || 'unknown article'}`,
      `  original: ${original}`,
      `  fallback: ${fallbackSrc}`,
      `  reason: ${resolved.reason || 'unknown'}`
    ].join('\n'));
  }
}

async function main() {
  const strictDates = strictTargetDates({ root, newsletterDatePath });
  const images = [];
  for (const item of newsletterItems()) {
    fallbackWarningsFromEditor(item.date, readEditor(item.date));
    failOnPublishBlockingImageAudit(item.date, strictDates);

    for (const key of ['html', 'md']) {
      if (!item[key]) continue;
      const relPath = item[key];
      // item.html/md는 서빙 URL이며 디스크상으로는 articles/ 아래에 있다.
      const absPath = publicAssetPath(root, relPath);
      if (!absPath) {
        fail(`Newsletter ${item.date} ${key} path escapes repository: ${relPath}`);
        continue;
      }
      if (!fs.existsSync(absPath)) {
        fail(`Newsletter ${item.date} ${key} file does not exist: ${relPath}`);
        continue;
      }
      const content = read(absPath);
      const built = key === 'html' ? articleImages(relPath, content) : markdownImages(relPath, content);
      for (const image of built) image.date = item.date;
      images.push(...built);
    }
  }

  for (const image of images) {
    if (isLocalImageSrc(image.src)) {
      const absPath = resolveLocalImage(image.relPath, image.src);
      if (!absPath || !fs.existsSync(absPath)) {
        fail([
          `Local article image is missing: ${image.relPath}`,
          `  source: ${image.sourceKind}`,
          `  heading: ${image.heading}`,
          `  path: ${image.src}`
        ].join('\n'));
      }
      continue;
    }

    if (!isHttpsUrl(image.src)) {
      fail([
        `Article image uses disallowed URL scheme: ${image.relPath}`,
        `  source: ${image.sourceKind}`,
        `  heading: ${image.heading}`,
        `  url: ${image.src}`
      ].join('\n'));
      continue;
    }

    // 과거 발행물(strict target 아님)의 외부 이미지는 live 검증을 건너뛴다. 발행/변경되는 newsletter의
    // 외부 이미지만 live fetch해, 외부 호스트 link rot이 무관한 PR을 막거나 느리게 하지 않게 한다.
    if (!shouldLiveValidate(image.date, strictDates)) continue;

    const result = await validateImageUrl(image.src, {
      timeoutMs: 8000,
      attempts: 2,
      backoffMs: 500
    });
    if (!result.ok) {
      fail([
        `External article image failed live validation: ${image.relPath}`,
        `  source: ${image.sourceKind}`,
        `  heading: ${image.heading}`,
        `  url: ${image.src}`,
        `  ${formatResult(result)}`
      ].join('\n'));
    } else if (result.contentLength > 0 && result.contentLength < MIN_CONTENT_LENGTH) {
      fail([
        `External article image is suspiciously small: ${image.relPath}`,
        `  source: ${image.sourceKind}`,
        `  heading: ${image.heading}`,
        `  url: ${image.src}`,
        `  ${formatResult(result)}`
      ].join('\n'));
    }
  }

  if (warnings.length > 0) {
    console.warn(warnings.map(warning => `Warning: ${warning}`).join('\n'));
  }

  if (errors.length > 0) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }

  console.log(`Validated ${images.length} article images.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { resolveLocalImage, shouldLiveValidate };
