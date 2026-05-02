const fs = require('fs');
const path = require('path');
const {
  MIN_CONTENT_LENGTH,
  validateImageUrl
} = require('./lib/image-candidates');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function htmlAttr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const match = tag.match(pattern);
  return match ? decodeHtml(match[1].replace(/^["']|["']$/g, '')) : '';
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
    newsletters = JSON.parse(read(dataPath));
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

function articleImages(relPath, content) {
  const tags = [];
  const pattern = /<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)[^>]*>/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const src = htmlAttr(match[0], 'src');
    if (!isHttpsUrl(src)) continue;
    tags.push({
      relPath,
      src,
      heading: nearbyHeading(content, match.index)
    });
  }
  return tags;
}

function formatResult(result) {
  const status = result.status || 'n/a';
  const contentType = result.contentType || 'n/a';
  const contentLength = result.contentLength || 'n/a';
  return `status=${status}; content-type=${contentType}; content-length=${contentLength}; reason=${result.reason}`;
}

async function main() {
  const images = [];
  for (const item of newsletterItems()) {
    if (!item.html) continue;
    const relPath = item.html;
    const absPath = path.resolve(root, relPath);
    if (!absPath.startsWith(root)) {
      fail(`Newsletter ${item.date} html path escapes repository: ${relPath}`);
      continue;
    }
    if (!fs.existsSync(absPath)) {
      fail(`Newsletter ${item.date} html file does not exist: ${relPath}`);
      continue;
    }
    images.push(...articleImages(relPath, read(absPath)));
  }

  for (const image of images) {
    const result = await validateImageUrl(image.src, {
      timeoutMs: 8000,
      attempts: 2,
      backoffMs: 500
    });
    if (!result.ok) {
      fail([
        `External article image failed live validation: ${image.relPath}`,
        `  heading: ${image.heading}`,
        `  url: ${image.src}`,
        `  ${formatResult(result)}`
      ].join('\n'));
    } else if (result.contentLength > 0 && result.contentLength < MIN_CONTENT_LENGTH) {
      fail([
        `External article image is suspiciously small: ${image.relPath}`,
        `  heading: ${image.heading}`,
        `  url: ${image.src}`,
        `  ${formatResult(result)}`
      ].join('\n'));
    }
  }

  if (errors.length > 0) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }

  console.log(`Validated ${images.length} external article images.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
