const fs = require('node:fs');
const path = require('node:path');
const { publicAssetPath } = require('../../shared/common/artifact-paths');
const { visibleHtmlText } = require('../quality/public-newsletter');
const { validateRenderedIssueStructure } = require('../quality/rendered-issue-structure');
const { applyTranslation } = require('../render/apply-translation');
const { hasKoreanText } = require('../../shared/common/korean-text');

function hasLongKoreanProse(value) {
  return String(value || '').split(/[.!?\n]/).some(sentence => (sentence.match(/[가-힣]/g) || []).length >= 20);
}

// A weekly English edition is managed as the committed render input (issue.json) plus a translation
// overlay bound to its bytes. An English page registered without that pair, or whose Korean source
// changed after translation, cannot be regenerated and is rejected.
function translationSourceErrors(root, key) {
  const dir = path.join(root, 'articles', 'newsletters', key);
  const overlayPath = path.join(dir, 'translation.en.json');
  if (!fs.existsSync(overlayPath)) return [`Missing translation overlay: articles/newsletters/${key}/translation.en.json`];
  try {
    const sourceText = fs.readFileSync(path.join(dir, 'issue.json'), 'utf8');
    applyTranslation(JSON.parse(sourceText), JSON.parse(fs.readFileSync(overlayPath, 'utf8')), { sourceText });
    return [];
  } catch (error) {
    return [`Translation overlay does not apply to issue.json for ${key}: ${error.message}`];
  }
}

function validateEnglishEntry(item, root, { structure = true } = {}) {
  if (!Object.hasOwn(item, 'en')) return [];
  const errors = [];
  const entry = item.en;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['Invalid en entry'];
  // The dated index points to the same translation as its weekly counterpart.
  const weeklyIndexPath = path.join(root, 'articles', 'data', 'newsletters-weekly.json');
  const weeklyEntries = fs.existsSync(weeklyIndexPath) ? JSON.parse(fs.readFileSync(weeklyIndexPath, 'utf8')) : [];
  const matchingWeek = Array.isArray(weeklyEntries) ? weeklyEntries.find(week => week.date === item.date) : null;
  const key = item.weeklyKey || matchingWeek?.weeklyKey || item.date;
  if (!/^(?:\d{4}-W\d{2}|\d{4}-\d{2}-\d{2})$/.test(key || '')) return ['Invalid English issue key'];
  for (const field of ['title', 'summary']) {
    if (typeof entry[field] !== 'string' || !entry[field].trim() || hasLongKoreanProse(entry[field])) errors.push(`en.${field}: missing English display value for ${key}`);
  }
  const contents = {};
  for (const [field, filename] of [['html', 'index.html'], ['md', 'newsletter.md']]) {
    const expected = `en/newsletters/${key}/${filename}`;
    if (entry[field] !== expected) { errors.push(`en.${field}: expected ${expected}`); continue; }
    const file = publicAssetPath(root, expected);
    if (!file || !fs.existsSync(file)) { errors.push(`Missing English artifact: ${expected}`); continue; }
    contents[field] = fs.readFileSync(file, 'utf8');
    const visible = field === 'html' ? visibleHtmlText(contents[field]) : contents[field];
    if (hasLongKoreanProse(visible)) errors.push(`Korean prose remains in ${expected}`);
  }
  if (contents.html && !/<html\b[^>]*\blang="en"/.test(contents.html)) errors.push(`English page missing lang=en: ${key}`);
  if (/^\d{4}-W\d{2}$/.test(key)) errors.push(...translationSourceErrors(root, key));
  if (structure && contents.html && contents.md) {
    errors.push(...validateRenderedIssueStructure({ date: key, html: contents.html, markdown: contents.md, root, validateDataIndex: false, briefingBulletCount: /^\d{4}-W\d{2}$/.test(key) ? null : 3 }).errors);
  }
  return errors;
}

module.exports = { hasKoreanText, hasLongKoreanProse, validateEnglishEntry };
