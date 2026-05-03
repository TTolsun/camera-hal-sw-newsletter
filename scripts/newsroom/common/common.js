const fs = require('fs');
const path = require('path');

function kstDate(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function htmlAttr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const match = tag.match(pattern);
  return match ? decodeHtml(match[1].replace(/^["']|["']$/g, '')) : '';
}

function repoPath(root, relPath) {
  const rootPath = path.resolve(root);
  const absPath = path.resolve(rootPath, relPath || '');
  if (absPath !== rootPath && !absPath.startsWith(`${rootPath}${path.sep}`)) {
    return '';
  }
  return absPath;
}

module.exports = {
  decodeHtml,
  htmlAttr,
  kstDate,
  readJson,
  readTextIfExists,
  repoPath,
  writeJson
};
