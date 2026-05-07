const fs = require('fs');
const path = require('path');
const { isSafeExternalImageUrl, REJECT_PATH_PATTERN } = require('../render/image-candidates');
const { repoLocalPath } = require('../render/article-image-resolver');
const {
  htmlAttr,
  readJson,
  repoPath
} = require('../common/common');
const {
  newsroomDir
} = require('../common/artifact-paths');
const {
  articlePolicy,
  articleCountRangeText
} = require('../common/newsletter-policy');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../common/validation-targets');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const requiredFields = ['date', 'title', 'summary', 'html', 'md', 'tags'];
const briefingHeadings = [
  '## 1. 이번 주 3줄 브리핑'
];
const legacySectionHeadings = [
  '## 2. AOSP Camera Watch',
  '## 3. Tech Trend Radar',
  '## 4. 이번 주 C++ / AI 실전 팁'
];
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return readJson(filePath);
  } catch (error) {
    warn(`Could not parse ${path.relative(root, filePath)} for quality warnings: ${error.message}`);
    return null;
  }
}

function sectionText(content, heading, nextHeadingPattern = /^## /m) {
  const start = content.indexOf(heading);
  if (start === -1) return '';
  const afterHeading = content.slice(start + heading.length);
  const next = afterHeading.search(nextHeadingPattern);
  return next === -1 ? afterHeading : afterHeading.slice(0, next);
}

function hasAny(content, values) {
  return values.some(value => content.includes(value));
}

function sourceTail(section) {
  const match = section.match(/\*\*(Sources|출처)[^\n]*\*\*([\s\S]*)/);
  return match ? match[2] : section;
}

function hasSourceEntry(section) {
  return /-\s+(?:\[.+?\]\(https?:\/\/|.+?:\s+https?:\/\/)/.test(sourceTail(section));
}

function getBriefingHeading(md) {
  return briefingHeadings.find(heading => md.includes(heading)) || '';
}

function mainArticleBlocks(md) {
  const matches = [...md.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const index = Number(matches[i][1]);
    const title = matches[i][2].trim();
    if (index <= 1) continue;
    if (/Action Items/i.test(title) || title.includes('Action') || title.includes('실행 항목')) continue;
    if (/^References$/i.test(title) || title === '참고자료') continue;

    const start = matches[i].index + matches[i][0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : md.length;
    blocks.push({ heading: matches[i][0], title, text: md.slice(start, end) });
  }
  return blocks;
}

function hasEngineeringPerspective(text) {
  return /Camera HAL|HAL|Android Camera|CameraX|AOSP Camera|stream|buffer|metadata|request|result|CTS|VTS|CDD|NPU|GPU|ISP|thermal|latency|성능|검증|호환/.test(text);
}

function isNewFormat(md) {
  return md.includes('## 1. 이번 주 3줄 브리핑') &&
    !legacySectionHeadings.some(heading => md.includes(heading));
}

function validateArticleQuality(item, md, newFormat, strictArtifactValidation) {
  const articles = mainArticleBlocks(md);
  const articleCountOutOfRange = articles.length < articlePolicy.mainArticleCount.min ||
    articles.length > articlePolicy.mainArticleCount.max;
  if (articleCountOutOfRange) {
    const message = `Newsletter ${item.date} main article count is ${articles.length}; expected Newsletter Policy range ${articleCountRangeText()}.`;
    if (strictArtifactValidation) {
      fail(message);
    } else {
      warn(`${message} ${historicalPolicyWarningReason()}.`);
    }
  }

  if (newFormat) {
    if (!/AI|Gemini|agent|on-device|NPU|LLM|인공지능/i.test(md)) {
      warn(`Newsletter ${item.date} has no AI-related article or AI Corner signal.`);
    }
  }

  for (const article of articles) {
    if (!hasAny(article.text, ['Sources', '출처'])) {
      fail(`Newsletter ${item.date} section missing sources heading: ${article.heading}`);
    }
    if (!hasSourceEntry(article.text)) {
      fail(`Newsletter ${item.date} article has no source entries: ${article.heading}`);
    }
    if (newFormat && !hasAny(article.text, ['Action Item', 'Action Items', '확인할 Action Item', '확인해볼 아이템', '실행 항목'])) {
      warn(`Newsletter ${item.date} article may be missing Action Item content: ${article.heading}`);
    }
    if (newFormat && !hasAny(article.text, ['Camera HAL 관점', 'Camera HAL에서']) && !hasEngineeringPerspective(article.text)) {
      warn(`Newsletter ${item.date} article may be missing Camera HAL perspective: ${article.heading}`);
    }
  }
}

function validateSourceGapArtifact(date, strictArtifactValidation) {
  const factCheck = readJsonIfExists(path.join(newsroomDir(root, date), 'fact-check-report.json'));
  if (!factCheck) return;
  const sourceGapCount = Number.isFinite(Number(factCheck.source_gap_count))
    ? Number(factCheck.source_gap_count)
    : Array.isArray(factCheck.source_gaps)
      ? factCheck.source_gaps.length
      : 0;
  if (sourceGapCount >= 3) {
    warn(`Newsletter ${date} fact-check source_gap_count is ${sourceGapCount}.`);
  }
  if (factCheck.status === 'NEEDS_FIX' && Array.isArray(factCheck.must_fix) && factCheck.must_fix.length > 0) {
    const message = `Newsletter ${date} has unresolved fact-check must_fix items.`;
    if (strictArtifactValidation) {
      fail(message);
    } else {
      warn(`${message} Not enforcing because this run is not publishing that issue.`);
    }
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function isFallbackImagePath(value) {
  return /^(?:(?:\.\.\/){1,3})?assets\/images\/fallback\//.test(String(value || '').replace(/\\/g, '/'));
}

function validateLocalFallbackSelectedImage(date, section, label, selectedImage) {
  if (!isFallbackImagePath(selectedImage)) {
    fail(`Newsletter ${date} selectedImage must be an allowed HTTPS article image or repo-local fallback: ${label}`);
    return;
  }

  const localPath = repoLocalPath(root, selectedImage);
  if (!localPath || !fs.existsSync(localPath)) {
    fail(`Newsletter ${date} selectedImage fallback file is missing: ${label} (${selectedImage})`);
    return;
  }

  const resolved = section.resolvedImage || {};
  const resolvedUrl = resolved.url || resolved.src || '';
  if (resolved.usedFallback !== true) {
    fail(`Newsletter ${date} fallback selectedImage missing resolvedImage.usedFallback=true: ${label}`);
  }
  if (resolvedUrl !== selectedImage) {
    fail(`Newsletter ${date} fallback selectedImage does not match resolvedImage.url: ${label}`);
  }
}

function validateEditorImageArtifact(date, strictArtifactValidation) {
  const editor = readJsonIfExists(path.join(newsroomDir(root, date), 'editor-draft.json'));
  if (!editor || !Array.isArray(editor.sections)) return;

  for (const [index, section] of editor.sections.entries()) {
    const label = section.category || `section ${index + 1}`;
    const selectedImage = section.selectedImage || '';
    if (!selectedImage) continue;

    const resolved = section.resolvedImage || {};
    if (!isHttpsUrl(selectedImage)) {
      validateLocalFallbackSelectedImage(date, section, label, selectedImage);
      continue;
    }

    if (resolved.usedFallback === true) {
      const message = `Newsletter ${date} selectedImage still points to an external URL after fallback: ${label}`;
      if (strictArtifactValidation) {
        fail(message);
      } else {
        warn(`${message}. Not enforcing because this run is not publishing that issue.`);
      }
      continue;
    }

    const imageCandidates = Array.isArray(section.imageCandidates) ? section.imageCandidates : [];
    if (!imageCandidates.some(image => image && image.url === selectedImage)) {
      fail(`Newsletter ${date} selectedImage is not in imageCandidates: ${label}`);
    }
    if (!isSafeExternalImageUrl(selectedImage) || REJECT_PATH_PATTERN.test(selectedImage)) {
      fail(`Newsletter ${date} selectedImage is not an allowed HTTPS article image: ${label}`);
    }
    for (const field of ['imageSource', 'imageAttribution', 'imageAlt', 'imageUsageDecisionReason']) {
      if (!String(section[field] || '').trim()) {
        fail(`Newsletter ${date} selectedImage missing ${field}: ${label}`);
      }
    }
    if (!/^https:\/\//i.test(String(section.imageSource || '').trim())) {
      fail(`Newsletter ${date} selectedImage imageSource must be an HTTPS URL: ${label}`);
    }
    if (!['unknown', 'allowed'].includes(section.imageLicenseStatus || '')) {
      fail(`Newsletter ${date} selectedImage has invalid imageLicenseStatus: ${label}`);
    }
  }
}

function validateArticleImages(relPath, content) {
  const imageTags = content.match(/<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)[^>]*>/gi) || [];
  for (const tag of imageTags) {
    const src = htmlAttr(tag, 'src');
    const alt = htmlAttr(tag, 'alt');
    const loading = htmlAttr(tag, 'loading');
    if (!src) {
      fail(`Newsletter article image missing src: ${relPath}`);
      continue;
    }
    if (/^data:/i.test(src) || /^http:/i.test(src)) {
      fail(`Newsletter article image uses disallowed URL scheme: ${relPath}`);
    }
    if (/^https:\/\//i.test(src)) {
      if (!isSafeExternalImageUrl(src) || REJECT_PATH_PATTERN.test(src)) {
        fail(`Newsletter article image uses rejected external URL: ${relPath}`);
      }
    } else if (!/^(?:\.\.?\/|assets\/|\/?assets\/)/.test(src)) {
      fail(`Newsletter article image must be HTTPS or repo-local fallback: ${relPath}`);
    }
    if (!alt.trim()) {
      fail(`Newsletter article image missing alt text: ${relPath}`);
    }
    if (loading !== 'lazy') {
      fail(`Newsletter article image missing loading="lazy": ${relPath}`);
    }

    const start = content.indexOf(tag);
    const nearby = start >= 0 ? content.slice(start, start + 900) : '';
    if (!/article-image-caption/.test(nearby) || !/<a\s+[^>]*href=["']https:\/\//i.test(nearby)) {
      fail(`Newsletter article image missing caption attribution link: ${relPath}`);
    }
  }
}

if (!fs.existsSync(dataPath)) {
  fail('Missing data/newsletters.json');
}

if (process.env.REQUIRE_NEWSLETTER_DATE_FILE === '1' && !fs.existsSync(newsletterDatePath)) {
  fail('Missing .tmp/newsletter-date.txt. The newsletter generate step likely failed before or during Gemini generation.');
}

let newsletters = [];
try {
  newsletters = readJson(dataPath);
} catch (error) {
  fail(`Invalid JSON in data/newsletters.json: ${error.message}`);
}

if (!Array.isArray(newsletters)) {
  fail('data/newsletters.json must contain an array');
  newsletters = [];
}

const seenDates = new Set();
const strictDates = strictTargetDates({ root, newsletterDatePath });
for (const [index, item] of newsletters.entries()) {
  for (const field of requiredFields) {
    if (!(field in item)) {
      fail(`Newsletter entry ${index} is missing "${field}"`);
    }
  }

  if (!datePattern.test(item.date || '')) {
    fail(`Newsletter entry ${index} has invalid date: ${item.date}`);
  }

  if (seenDates.has(item.date)) {
    fail(`Duplicate newsletter date: ${item.date}`);
  }
  seenDates.add(item.date);

  if (!Array.isArray(item.tags)) {
    fail(`Newsletter ${item.date} tags must be an array`);
  }

  for (const key of ['html', 'md']) {
    const relPath = item[key];
    const absPath = repoPath(root, relPath || '');
    if (!absPath) {
      fail(`Newsletter ${item.date} ${key} path escapes repository: ${relPath}`);
      continue;
    }
    if (!fs.existsSync(absPath)) {
      fail(`Newsletter ${item.date} ${key} file does not exist: ${relPath}`);
      continue;
    }

    const content = read(absPath);
    if (/\bTODO\b/.test(content)) {
      fail(`Published newsletter contains TODO: ${relPath}`);
    }
  }

  if (item.md) {
    const mdPath = repoPath(root, item.md);
    if (mdPath && fs.existsSync(mdPath)) {
      const md = read(mdPath);
      const briefingHeading = getBriefingHeading(md);
      if (!briefingHeading) {
        fail(`Newsletter ${item.date} markdown missing briefing section`);
      } else {
        const briefing = sectionText(md, briefingHeading);
        const briefingBullets = briefing
          .split('\n')
          .filter(line => /^- /.test(line.trim()));
        if (briefingBullets.length !== 3) {
          fail(`Newsletter ${item.date} must have exactly 3 briefing bullets, found ${briefingBullets.length}`);
        }
      }

      if (!hasAny(md, ['## References', '## 참고자료'])) {
        fail(`Newsletter ${item.date} markdown missing References/참고자료 section`);
      }

      const strictArtifactValidation = strictDates.has(item.date);
      validateArticleQuality(item, md, isNewFormat(md), strictArtifactValidation);
      validateSourceGapArtifact(item.date, strictArtifactValidation);
      validateEditorImageArtifact(item.date, strictArtifactValidation);
    }
  }
}

const htmlFiles = ['index.html'];
for (const item of newsletters) {
  if (item.html) htmlFiles.push(item.html);
}

for (const relPath of htmlFiles) {
  const absPath = repoPath(root, relPath);
  if (!absPath || !fs.existsSync(absPath)) continue;
  const content = read(absPath);
  const openAnchors = content.match(/<a\b/gi)?.length || 0;
  const closeAnchors = content.match(/<\/a>/gi)?.length || 0;
  if (openAnchors !== closeAnchors) {
    fail(`Anchor tag mismatch in ${relPath}`);
  }
  if (/\bTODO\b/.test(content)) {
    fail(`Published HTML contains TODO: ${relPath}`);
  }

  if (relPath.startsWith('newsletters/')) {
    for (const className of ['issue-briefing', 'issue-section', 'source-list', 'reference-list']) {
      if (!content.includes(className)) {
        fail(`Newsletter HTML missing ${className}: ${relPath}`);
      }
    }
    const sourceBlocks = [];
    const sourceClassPattern = /class=["'][^"']*source-list[^"']*["']/gi;
    let sourceMatch;
    while ((sourceMatch = sourceClassPattern.exec(content)) !== null) {
      sourceBlocks.push(content.slice(sourceMatch.index, sourceMatch.index + 1200));
    }
    if (sourceBlocks.length === 0) {
      fail(`Newsletter HTML has no source-list blocks: ${relPath}`);
    }
    for (const block of sourceBlocks) {
      if (!/<a\s+[^>]*href=["']https?:\/\//i.test(block)) {
        fail(`Newsletter HTML source-list has no source links: ${relPath}`);
      }
    }
    validateArticleImages(relPath, content);
    if (!hasAny(content, ['Archive로 돌아가기', '아카이브로 돌아가기', 'Archive'])) {
      fail(`Newsletter HTML missing archive link text: ${relPath}`);
    }
    if (!hasAny(content, ['MD 원본 보기', 'MD'])) {
      fail(`Newsletter HTML missing markdown source link text: ${relPath}`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(warnings.map(warning => `Warning: ${warning}`).join('\n'));
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${newsletters.length} newsletter entries.`);
