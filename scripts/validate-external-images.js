const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const MIN_CONTENT_LENGTH = 1024;
const REQUEST_TIMEOUT_MS = Number(process.env.IMAGE_VALIDATION_TIMEOUT_MS || 8000);
const MAX_RETRIES = Number(process.env.IMAGE_VALIDATION_RETRIES || 2);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function htmlAttr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const match = tag.match(pattern);
  return match ? match[1].replace(/^["']|["']$/g, '') : '';
}

function articleImageTags(content) {
  return content.match(/<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)[^>]*>/gi) || [];
}

function selectedNewsletterDates(newsletters) {
  if (fs.existsSync(newsletterDatePath)) {
    const date = read(newsletterDatePath).trim();
    return new Set(date ? [date] : []);
  }
  return new Set(newsletters.map(item => item.date).filter(Boolean));
}

function responseLooksLikeImage(response) {
  const contentType = response.headers.get('content-type') || '';
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (!response.ok) return false;
  if (!/^image\//i.test(contentType)) return false;
  return !contentLength || contentLength >= MIN_CONTENT_LENGTH;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkImageUrl(url) {
  const headers = {
    'user-agent': 'camera-hal-sw-newsletter/1.0',
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      let response = await fetchWithTimeout(url, { method: 'HEAD', headers });
      if (!responseLooksLikeImage(response)) {
        response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: { ...headers, range: 'bytes=0-2047' }
        });
      }
      if (responseLooksLikeImage(response)) return { ok: true };
      lastError = `${response.status} ${response.statusText || ''} ${response.headers.get('content-type') || ''}`.trim();
    } catch (error) {
      lastError = error.message;
    }
    if (attempt < MAX_RETRIES) await sleep(400 * attempt);
  }

  return { ok: false, reason: lastError || 'not an image response' };
}

async function main() {
  if (!fs.existsSync(dataPath)) {
    throw new Error('Missing data/newsletters.json');
  }

  const newsletters = JSON.parse(read(dataPath));
  const targetDates = selectedNewsletterDates(newsletters);
  const targets = newsletters.filter(item => targetDates.has(item.date));
  const errors = [];
  let checked = 0;

  for (const item of targets) {
    const relPath = item.html;
    if (!relPath) continue;
    const absPath = path.resolve(root, relPath);
    if (!fs.existsSync(absPath)) continue;
    const content = read(absPath);
    for (const tag of articleImageTags(content)) {
      const src = htmlAttr(tag, 'src');
      if (!/^https:\/\//i.test(src)) continue;
      checked += 1;
      const result = await checkImageUrl(src);
      if (!result.ok) {
        errors.push(`${relPath}: external article image is not reachable as an image: ${src} (${result.reason})`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }

  console.log(`Validated ${checked} external article image URL(s).`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
