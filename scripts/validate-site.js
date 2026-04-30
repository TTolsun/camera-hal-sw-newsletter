const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const requiredFields = ['date', 'title', 'summary', 'html', 'md', 'tags'];
const requiredSections = [
  '## 1. 이번 주 3줄 브리핑',
  '## 2. AOSP Camera Watch',
  '## 3. Tech Trend Radar',
  '## 4. 이번 주 C++ / AI 실전 팁',
  '## References'
];
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sectionText(content, heading, nextHeadingPattern = /^## /m) {
  const start = content.indexOf(heading);
  if (start === -1) return '';
  const afterHeading = content.slice(start + heading.length);
  const next = afterHeading.search(nextHeadingPattern);
  return next === -1 ? afterHeading : afterHeading.slice(0, next);
}

function hasSourceEntry(section) {
  const sourceHeading = section.match(/\*\*(Sources|출처)\*\*([\s\S]*)/);
  if (!sourceHeading) return false;
  return /-\s+(?:\[.+?\]\(https?:\/\/|.+?:\s+https?:\/\/)/.test(sourceHeading[2]);
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
      for (const heading of requiredSections) {
        if (!md.includes(heading)) {
          fail(`Newsletter ${item.date} markdown missing required section: ${heading}`);
        }
      }

      const briefing = sectionText(md, '## 1. 이번 주 3줄 브리핑');
      const briefingBullets = briefing
        .split('\n')
        .filter(line => /^- /.test(line.trim()));
      if (briefingBullets.length !== 3) {
        fail(`Newsletter ${item.date} must have exactly 3 briefing bullets, found ${briefingBullets.length}`);
      }

      for (const heading of [
        '## 2. AOSP Camera Watch',
        '## 3. Tech Trend Radar',
        '## 4. 이번 주 C++ / AI 실전 팁'
      ]) {
        const section = sectionText(md, heading);
        if (!section.includes('배경지식')) {
          fail(`Newsletter ${item.date} section missing 배경지식: ${heading}`);
        }
        if (!section.includes('Camera HAL에서 확인해볼 아이템')) {
          fail(`Newsletter ${item.date} section missing Camera HAL checks: ${heading}`);
        }
        if (!section.includes('출처') && !section.includes('Sources')) {
          fail(`Newsletter ${item.date} section missing sources: ${heading}`);
        }
        if (!hasSourceEntry(section)) {
          fail(`Newsletter ${item.date} section has no source entries: ${heading}`);
        }
      }
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
    if (!content.includes('Archive로 돌아가기')) {
      fail(`Newsletter HTML missing archive link text: ${relPath}`);
    }
    if (!content.includes('MD 원본 보기')) {
      fail(`Newsletter HTML missing markdown source link text: ${relPath}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${newsletters.length} newsletter entries.`);
