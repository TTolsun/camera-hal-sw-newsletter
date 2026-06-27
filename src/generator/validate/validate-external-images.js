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
