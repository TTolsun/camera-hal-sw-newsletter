'use strict';

// 주간호 영문판을 쓴다. 입력은 커밋된 렌더 입력 articles/newsletters/<key>/issue.json과 그 옆의
// 번역 overlay translation.en.json이다. overlay의 source_hash는 issue.json 바이트에 묶이므로,
// 한국어 호가 바뀌면 applyTranslation이 거부하고 재번역이 필요하다.
//
// 쓰는 것: articles/en/newsletters/<key>/{index.html,newsletter.md}, newsletters-weekly.json
// 해당 항목의 en 필드, 같은 날짜 newsletters.json 항목의 en 필드(같은 주간 영문 경로), sitemap.xml. 한국어 산출물(issue.json·index.html·newsletter.md)은 읽기만 한다.
//
// 사용법: node src/generator/render/english-edition.js [weeklyKey ...]
// 인자가 없으면 translation.en.json이 있는 모든 주간호를 쓴다.

const fs = require('fs');
const path = require('path');

const { applyTranslation } = require('./apply-translation');
const { buildHtml, buildMarkdown } = require('./newsletter-renderer');
const { writeSitemap } = require('./generate-sitemap');

const TRANSLATION_FILE = 'translation.en.json';

function weeklyDir(root, weeklyKey) {
  return path.join(root, 'articles', 'newsletters', weeklyKey);
}

function buildEnglishEdition(root, weeklyKey) {
  const dir = weeklyDir(root, weeklyKey);
  const sourceText = fs.readFileSync(path.join(dir, 'issue.json'), 'utf8');
  const translation = JSON.parse(fs.readFileSync(path.join(dir, TRANSLATION_FILE), 'utf8'));
  const issue = applyTranslation(JSON.parse(sourceText), translation, { sourceText });
  return {
    issue,
    html: buildHtml(issue, { locale: 'en' }),
    markdown: buildMarkdown(issue, { locale: 'en' }),
    // 한국어 항목과 같은 규칙이다: 제목은 주 라벨, 요약은 기사 제목을 줄마다 하나씩.
    entry: {
      title: String(weeklyKey).replace('-W', ' W'),
      summary: issue.briefing.join('\n'),
      html: `en/newsletters/${weeklyKey}/index.html`,
      md: `en/newsletters/${weeklyKey}/newsletter.md`
    }
  };
}

function readIndex(indexPath) {
  return fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : null;
}

function writeIndex(indexPath, index) {
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

function writeEnglishEditions(root, weeklyKeys) {
  const indexPath = path.join(root, 'articles', 'data', 'newsletters-weekly.json');
  const datedIndexPath = path.join(root, 'articles', 'data', 'newsletters.json');
  const index = readIndex(indexPath);
  const datedIndex = readIndex(datedIndexPath);
  for (const weeklyKey of weeklyKeys) {
    const item = index.find(entry => entry.weeklyKey === weeklyKey);
    if (!item) throw new Error(`No weekly index entry: ${weeklyKey}`);
    const edition = buildEnglishEdition(root, weeklyKey);
    const outDir = path.join(root, 'articles', 'en', 'newsletters', weeklyKey);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), edition.html, 'utf8');
    fs.writeFileSync(path.join(outDir, 'newsletter.md'), edition.markdown, 'utf8');
    item.en = edition.entry;
    // 주간호와 같은 날짜의 항목은 같은 주간 영문판을 가리킨다(validateEnglishEntry 계약).
    const dated = datedIndex && datedIndex.find(entry => entry.date === item.date);
    if (dated) dated.en = { ...edition.entry };
  }
  writeIndex(indexPath, index);
  if (datedIndex) writeIndex(datedIndexPath, datedIndex);
  writeSitemap(root);
}

function translatedWeeklyKeys(root) {
  const dir = path.join(root, 'articles', 'newsletters');
  return fs.readdirSync(dir)
    .filter(name => /^\d{4}-W\d{2}$/.test(name) && fs.existsSync(path.join(dir, name, TRANSLATION_FILE)))
    .sort();
}

if (require.main === module) {
  const root = process.cwd();
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : translatedWeeklyKeys(root);
  writeEnglishEditions(root, keys);
  console.log(`Wrote English editions: ${keys.join(', ') || '(none)'}`);
}

module.exports = { TRANSLATION_FILE, buildEnglishEdition, writeEnglishEditions, translatedWeeklyKeys };
