// data/newsletters-weekly.json(라이브 사이트가 fetch하는 주간 발행 목록)으로부터
// sitemap.xml을 생성한다 (#51 후속). 주간 발행물이 추가될 때마다 같은 흐름에서 재생성하고,
// 생성물은 publish PR commit allowlist에 포함되어 main으로 반영된다.

const fs = require('fs');
const path = require('path');
const { buildSitemap } = require('./seo-metadata');

function weeklyDataPath(root) {
  return path.join(root, 'articles', 'data', 'newsletters-weekly.json');
}

function sitemapPath(root) {
  return path.join(root, 'articles', 'sitemap.xml');
}

function readWeeklyIssues(root) {
  const file = weeklyDataPath(root);
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : (parsed.newsletters || []);
}

function renderSitemap(root = process.cwd()) {
  return buildSitemap(readWeeklyIssues(root));
}

function writeSitemap(root = process.cwd()) {
  const xml = renderSitemap(root);
  fs.writeFileSync(sitemapPath(root), xml, 'utf8');
  return xml;
}

if (require.main === module) {
  const xml = writeSitemap(process.cwd());
  const count = (xml.match(/<url>/g) || []).length;
  console.log(`Generated sitemap.xml with ${count} URLs.`);
}

module.exports = {
  weeklyDataPath,
  sitemapPath,
  readWeeklyIssues,
  renderSitemap,
  writeSitemap
};
