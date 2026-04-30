const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function kstDate(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureFile(filePath, message) {
  if (!fs.existsSync(filePath)) {
    fail(`${message}: ${filePath}`);
  }
}

function extractTitle(markdown, date) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : `Camera HAL SW Newsletter - ${date}`;
}

function extractSummary(markdown) {
  const lines = markdown
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const firstBodyLine = lines.find(line => !line.startsWith('#') && !line.startsWith('-'));

  return firstBodyLine || 'Camera HAL, Android Camera, C++, AI 관련 주요 소식을 정리한 주간 뉴스레터입니다.';
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();

  const newsletterDir = path.join(root, 'newsletters', date);
  const newsroomDir = path.join(root, 'newsroom', date);

  const markdownPath = path.join(newsletterDir, 'newsletter.md');
  const htmlPath = path.join(newsletterDir, 'index.html');

  ensureFile(markdownPath, 'Missing manual newsletter markdown');
  ensureFile(htmlPath, 'Missing manual newsletter html');

  fs.mkdirSync(newsroomDir, { recursive: true });

  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const title = extractTitle(markdown, date);
  const summary = extractSummary(markdown);

  writeIfMissing(
    path.join(newsroomDir, 'news-candidates.md'),
    `# News Candidates - ${date}

ChatGPT를 통해 수집한 뉴스 후보를 여기에 정리합니다.

## Checklist

- [ ] 출처 링크 확인
- [ ] 발행일 확인
- [ ] Camera HAL 관련성 확인
- [ ] 중복 뉴스 제거
`
  );

  writeIfMissing(
    path.join(newsroomDir, 'editor-draft.md'),
    markdown
  );

  writeIfMissing(
    path.join(newsroomDir, 'fact-check-report.md'),
    `# Fact Check Report - ${date}

## Status

MANUAL_REVIEW_REQUIRED

## Checklist

- [ ] 각 뉴스의 출처가 실제로 존재하는가?
- [ ] 출처가 본문 주장을 뒷받침하는가?
- [ ] 사실과 해석이 구분되어 있는가?
- [ ] 과장 표현이 없는가?
- [ ] Camera HAL 관점 해석이 충분한가?
`
  );

  writeIfMissing(
    path.join(newsroomDir, 'editor-in-chief-brief.md'),
    `# Editor-in-Chief Brief - ${date}

## Main Message

${summary}

## Editor-in-Chief Checklist

- [ ] 이번 호 핵심 메시지가 명확한가?
- [ ] Camera HAL 엔지니어가 읽을 이유가 있는가?
- [ ] 단순 요약이 아니라 HAL 관점 해석이 있는가?
- [ ] 출처와 검수 결과가 충분한가?
- [ ] 팀 공유용으로 발행해도 되는가?
`
  );

  writeIfMissing(
    path.join(newsroomDir, 'release-qa-report.md'),
    `# Release QA Report - ${date}

## Status

READY_FOR_VALIDATION

## Checked

- newsletter.md exists
- index.html exists
- data/newsletters.json will be updated
- validate-site.js should pass
`
  );

  let newsletters = readJsonIfExists(dataPath, []);

  const entry = {
    date,
    title,
    summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL', 'Android', 'C++', 'AI']
  };

  newsletters = newsletters.filter(item => item.date !== date);
  newsletters.unshift(entry);
  newsletters.sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(dataPath, `${JSON.stringify(newsletters, null, 2)}\n`, 'utf8');

  console.log(`Manual newsletter registered for ${date}`);
}

main();
