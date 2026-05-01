const fs = require('fs');
const path = require('path');
const { isSafeExternalImageUrl, REJECT_PATH_PATTERN } = require('./lib/image-candidates');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const requiredFields = ['date', 'title', 'summary', 'html', 'md', 'tags'];

const cleanBriefingHeading = '## 1. 이번 주 3줄 브리핑';
const legacyBriefingHeading = '## 1. ?대쾲 二?3以?釉뚮━??';
const legacySectionHeadings = [
  '## 2. AOSP Camera Watch',
  '## 3. Tech Trend Radar',
  '## 4. ?대쾲 二?C++ / AI ?ㅼ쟾 ??'
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
    return JSON.parse(read(filePath));
  } catch (error) {
    warn(`Could not parse ${path.relative(root, filePath)} for quality warnings: ${error.message}`);
    return null;
  }
}

function htmlAttr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const match = tag.match(pattern);
  return match ? match[1].replace(/^["']|["']$/g, '') : '';
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

function hasSourceEntry(section) {
  const sourceHeading = section.match(/\*\*(Sources|출처|異쒖쿂)\*\*([\s\S]*)/);
  if (!sourceHeading) return false;
  return /-\s+(?:\[.+?\]\(https?:\/\/|.+?:\s+https?:\/\/)/.test(sourceHeading[2]);
}

function getBriefingHeading(md) {
  if (md.includes(cleanBriefingHeading)) return cleanBriefingHeading;
  if (md.includes(legacyBriefingHeading)) return legacyBriefingHeading;
  return '';
}

function mainArticleBlocks(md) {
  const matches = [...md.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const index = Number(matches[i][1]);
    const title = matches[i][2].trim();
    if (index <= 1) continue;
    if (/Action Items/i.test(title) || title.includes('Action')) continue;

    const start = matches[i].index + matches[i][0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : md.length;
    const text = md.slice(start, end);
    if (/^##\s+References$/m.test(matches[i][0])) continue;
    blocks.push({ heading: matches[i][0], title, text });
  }
  return blocks.filter(block => !/^References$/i.test(block.title));
}

function hasEngineeringPerspective(text) {
  return /Camera HAL|HAL|Android Camera|CameraX|AOSP Camera|stream|buffer|metadata|request|result|CTS|VTS|CDD|NPU|GPU|ISP|thermal|latency|성능|검증|호환/.test(text);
}

function validateLegacySections(item, md) {
  const articles = mainArticleBlocks(md);
  if (articles.length < 3) {
    fail(`Newsletter ${item.date} legacy markdown must have at least 3 main sections, found ${articles.length}`);
  }
  for (const article of articles) {
    if (!hasAny(article.text, ['출처', 'Sources', '異쒖쿂'])) {
      fail(`Newsletter ${item.date} section missing sources: ${article.heading}`);
    }
    if (!hasSourceEntry(article.text)) {
      fail(`Newsletter ${item.date} section has no source entries: ${article.heading}`);
    }
  }
}

function validateArticleQuality(item, md, isNewFormat) {
  const articles = mainArticleBlocks(md);
  if (isNewFormat) {
    if (articles.length < 4 || articles.length > 6) {
      warn(`Newsletter ${item.date} main article count is ${articles.length}; expected 4-6 for the new format.`);
    }

    const hasAiArticle = /AI|Gemini|agent|on-device|NPU|LLM|인공지능/i.test(md);
    if (!hasAiArticle) {
      warn(`Newsletter ${item.date} has no AI-related article or AI Corner signal.`);
    }

    for (const article of articles) {
      if (!hasAny(article.text, ['우리 팀이 확인할 Action Item', 'Action Hints', '異붿쿇', '諛붾줈'])) {
        warn(`Newsletter ${item.date} article may be missing Action Item content: ${article.heading}`);
      }
      if (!hasAny(article.text, ['Camera HAL 관점 해석', 'Camera HAL?먯꽌 ?뺤씤?대낵 ?꾩씠??']) && !hasEngineeringPerspective(article.text)) {
        warn(`Newsletter ${item.date} article may be missing Camera HAL perspective: ${article.heading}`);
      }
    }
  }

  for (const article of articles) {
    if (!hasSourceEntry(article.text)) {
      fail(`Newsletter ${item.date} article has no source entries: ${article.heading}`);
    }
  }
}

function validateSourceGapArtifact(date) {
  const factCheck = readJsonIfExists(path.join(root, 'newsroom', date, 'fact-check-report.json'));
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
    fail(`Newsletter ${date} has unresolved fact-check must_fix items.`);
  }
}

function validateEditorImageArtifact(date) {
  const editor = readJsonIfExists(path.join(root, 'newsroom', date, 'editor-draft.json'));
  if (!editor || !Array.isArray(editor.sections)) return;

  for (const [index, section] of editor.sections.entries()) {
    const label = section.category || `section ${index + 1}`;
    const selectedImage = section.selectedImage || '';
    if (!selectedImage) continue;

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
  fail(
    'Missing .tmp/newsletter-date.txt. The newsletter generate step likely failed before or during Gemini generation, so validate cannot resolve the generated newsletter date.'
  );
}

let newsletters = [];
try {
  newsletters = JSON.parse(read(dataPath));
} catch (error) {
  fail(`Invalid JSON in data/newsletters.json: ${error.message}`);
}

if (!Array.isArray(newsletters)) {
  fail('data/newsletters.json must contain an array');
  newsletters = [];
}

const seenDates = new Set();
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
    const absPath = path.resolve(root, relPath || '');
    if (!absPath.startsWith(root)) {
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
    const mdPath = path.resolve(root, item.md);
    if (fs.existsSync(mdPath)) {
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

      if (!md.includes('## References')) {
        fail(`Newsletter ${item.date} markdown missing References section`);
      }

      const isLegacy = !md.includes(cleanBriefingHeading) || legacySectionHeadings.some(heading => md.includes(heading));
      if (isLegacy) {
        validateLegacySections(item, md);
      }
      validateArticleQuality(item, md, !isLegacy);
      validateSourceGapArtifact(item.date);
      validateEditorImageArtifact(item.date);
    }
  }
}

const htmlFiles = ['index.html'];
for (const item of newsletters) {
  if (item.html) htmlFiles.push(item.html);
}

for (const relPath of htmlFiles) {
  const absPath = path.resolve(root, relPath);
  if (!fs.existsSync(absPath)) continue;
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
    if (!hasAny(content, ['Archive로 돌아가기', 'Archive濡??뚯븘媛湲?'])) {
      fail(`Newsletter HTML missing archive link text: ${relPath}`);
    }
    if (!hasAny(content, ['MD 원본 보기', 'MD ?먮낯 蹂닿린'])) {
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
