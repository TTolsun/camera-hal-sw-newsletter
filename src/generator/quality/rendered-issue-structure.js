const fs = require('fs');
const path = require('path');

const {
  htmlAttr,
  readJson,
  repoPath
} = require('../../shared/common/common');
const { isSafeExternalImageUrl, isFallbackImagePath, REJECT_PATH_PATTERN } = require('../../shared/render/image-candidates');
const { repoLocalPath } = require('../render/article-image-resolver');
const { ensureArray } = require('../render/newsletter-renderer');
const {
  toLegacyEditorIssue
} = require('../../shared/domain/newsletter-domain-normalize');

const {
  PUBLIC_CONTRACT_VERSIONS,
  STORY_CONTRACT_VERSIONS,
  storyContractVersionFromPublicContractVersion
} = require('../../shared/common/story-contract-version');

const REQUIRED_NEWSLETTER_FIELDS = ['date', 'title', 'summary', 'html', 'md', 'tags'];
// 필수 목록에는 넣지 않는다. 그 목록은 `field in item` 존재 검사라, 넣는 순간 기존
// 발행분 전부가 실패한다. 대신 값이 있을 때만 지원 여부를 본다.
const DEFAULT_STORY_CONTRACT_VERSION = STORY_CONTRACT_VERSIONS[0];

// 인덱스 엔트리가 선언한 계약 버전. 필드가 없으면 v1이다(발행분 전부가 그 상태이고
// backfill이 필요 없다). 값이 있는데 지원 목록 밖이면 0을 돌려준다 — "버전 없음"이
// 아니라 "판별 실패"라는 뜻이고, 인덱스 검증이 그것을 오류로 올린다.
function newsletterIndexContractVersion(entry = {}) {
  if (!Object.prototype.hasOwnProperty.call(entry || {}, 'public_contract_version')) {
    return DEFAULT_STORY_CONTRACT_VERSION;
  }
  return storyContractVersionFromPublicContractVersion(entry.public_contract_version);
}
const REQUIRED_ISSUE_CLASSES = ['issue-briefing', 'issue-section', 'source-list', 'reference-list'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_SOURCE_LABEL = '\u7570\uc496\ucfc2';
const LEGACY_REFERENCES_LABEL = '\uf9e1\uba78\ud02c\u003f\uba2e\uc9ba';
const LEGACY_REFERENCES_PREFIX = '\uf9e1\uba78\ud02c';
const LEGACY_ACTION_LABEL = '\u003f\u317d\ubefe';

function hasAny(content, values) {
  return values.some(value => content.includes(value));
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceTail(section) {
  const sourceLabelPattern = ['Sources', '출처', LEGACY_SOURCE_LABEL].map(escapeRegExp).join('|');
  const match = section.match(new RegExp(`\\*\\*(${sourceLabelPattern})[^\\n]*\\*\\*([\\s\\S]*)`));
  return match ? match[2] : section;
}

function hasSourceEntry(section) {
  return /-\s+(?:\[.+?\]\(https?:\/\/|.+?:\s+https?:\/\/)/.test(sourceTail(section));
}

function markdownSection(content, headingPattern, nextHeadingPattern = /^## /m) {
  const match = headingPattern.exec(content);
  if (!match) return '';
  const afterHeading = content.slice(match.index + match[0].length);
  const next = afterHeading.search(nextHeadingPattern);
  return next === -1 ? afterHeading : afterHeading.slice(0, next);
}

function briefingSection(markdown) {
  return markdownSection(markdown, /^##\s+1\.\s+.+$/m);
}

function hasReferencesSection(markdown) {
  const referencesLabelPattern = ['References', '참고자료', LEGACY_REFERENCES_LABEL].map(escapeRegExp).join('|');
  return new RegExp(`^##\\s+(${referencesLabelPattern})\\s*$`, 'm').test(markdown);
}

function mainArticleBlocks(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const index = Number(matches[i][1]);
    const title = matches[i][2].trim();
    if (index <= 1) continue;
    if (/Action Items/i.test(title) || title.includes('Action') || title.includes('실행') || title.includes(LEGACY_ACTION_LABEL)) continue;
    if (/^References$/i.test(title) || title.includes('참고자료') || title.includes(LEGACY_REFERENCES_PREFIX)) continue;

    const start = matches[i].index + matches[i][0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : markdown.length;
    blocks.push({ heading: matches[i][0], title, text: markdown.slice(start, end) });
  }
  return blocks;
}

function hasClassToken(content, className) {
  const classPattern = /class=["']([^"']*)["']/gi;
  let match;
  while ((match = classPattern.exec(String(content || ''))) !== null) {
    if (String(match[1] || '').split(/\s+/).includes(className)) return true;
  }
  return false;
}

function validateNewsletterIndex(root, errors) {
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  if (!fs.existsSync(dataPath)) {
    errors.push('Missing articles/data/newsletters.json');
    return;
  }

  let newsletters = [];
  try {
    newsletters = readJson(dataPath);
  } catch (error) {
    errors.push(`Invalid JSON in articles/data/newsletters.json: ${error.message}`);
    return;
  }

  if (!Array.isArray(newsletters)) {
    errors.push('articles/data/newsletters.json must contain an array');
    return;
  }

  const seenDates = new Set();
  for (const [index, item] of newsletters.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Newsletter entry ${index} must be an object.`);
      continue;
    }
    for (const field of REQUIRED_NEWSLETTER_FIELDS) {
      if (!(field in item)) {
        errors.push(`Newsletter entry ${index} is missing "${field}"`);
      }
    }
    if (newsletterIndexContractVersion(item) === 0) {
      errors.push(
        `Newsletter entry ${index} declares an unsupported public_contract_version ` +
        `"${item.public_contract_version}" (supported: ${PUBLIC_CONTRACT_VERSIONS.join(', ')})`
      );
    }
    if (!DATE_PATTERN.test(item.date || '')) {
      errors.push(`Newsletter entry ${index} has invalid date: ${item.date}`);
    }
    if (seenDates.has(item.date)) {
      errors.push(`Duplicate newsletter date: ${item.date}`);
    }
    seenDates.add(item.date);
    if (!Array.isArray(item.tags)) {
      errors.push(`Newsletter ${item.date} tags must be an array`);
    }
    for (const key of ['html', 'md']) {
      if (!repoPath(root, item[key] || '')) {
        errors.push(`Newsletter ${item.date} ${key} path escapes repository: ${item[key]}`);
      }
    }
  }
}

function validateMarkdownStructure(date, markdown, errors) {
  const content = String(markdown || '');
  if (/\bTODO\b/.test(content)) {
    errors.push(`Published newsletter contains TODO: newsletters/${date}/newsletter.md`);
  }

  const briefing = briefingSection(content);
  if (!briefing) {
    errors.push(`Newsletter ${date} markdown missing briefing section`);
  } else {
    const briefingBullets = briefing
      .split('\n')
      .filter(line => /^- /.test(line.trim()));
    if (briefingBullets.length !== 3) {
      errors.push(`Newsletter ${date} must have exactly 3 briefing bullets, found ${briefingBullets.length}`);
    }
  }

  if (!hasReferencesSection(content)) {
    errors.push(`Newsletter ${date} markdown missing References/참고자료 section`);
  }

  for (const article of mainArticleBlocks(content)) {
    if (!hasAny(article.text, ['Sources', '출처', LEGACY_SOURCE_LABEL])) {
      errors.push(`Newsletter ${date} section missing sources heading: ${article.heading}`);
    }
    if (!hasSourceEntry(article.text)) {
      errors.push(`Newsletter ${date} article has no source entries: ${article.heading}`);
    }
  }
}

function validateArticleImages(relPath, html, root, errors, strictArtifactValidation) {
  const imageTags = String(html || '').match(/<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)[^>]*>/gi) || [];
  for (const tag of imageTags) {
    const src = htmlAttr(tag, 'src');
    const alt = htmlAttr(tag, 'alt');
    const loading = htmlAttr(tag, 'loading');
    if (!src) {
      errors.push(`Newsletter article image missing src: ${relPath}`);
      continue;
    }
    if (/^data:/i.test(src) || /^http:/i.test(src)) {
      errors.push(`Newsletter article image uses disallowed URL scheme: ${relPath}`);
    }
    if (/^https:\/\//i.test(src)) {
      if (!isSafeExternalImageUrl(src) || REJECT_PATH_PATTERN.test(src)) {
        errors.push(`Newsletter article image uses rejected external URL: ${relPath}`);
      }
    } else {
      if (!isFallbackImagePath(src)) {
        errors.push(`Newsletter article image must be HTTPS or repo-local fallback: ${relPath}`);
      }
      const localPath = repoLocalPath(root, src);
      if (!localPath || !fs.existsSync(localPath)) {
        errors.push(`Newsletter article image fallback file is missing: ${relPath} (${src})`);
      }
    }
    if (!alt.trim()) {
      errors.push(`Newsletter article image missing alt text: ${relPath}`);
    }
    if (loading !== 'lazy') {
      errors.push(`Newsletter article image missing loading="lazy": ${relPath}`);
    }

    // 출처 캡션 규칙은 그림이 어디서 왔는지에 따라 방향이 반대입니다.
    //
    // - 기사 출처에서 가져온 그림: 출처 캡션을 반드시 붙인다.
    // - repo fallback 그림: 어느 출처에서도 오지 않았으므로 출처 캡션을 붙이면 안 된다.
    //
    // 두 방향을 다 검사해야 게이트가 닫힙니다. fallback 쪽을 검사에서 빼기만 하면, 가짜 출처
    // 캡션이 다시 생겨도 게이트가 통과시킵니다.
    const start = String(html || '').indexOf(tag);
    const nearby = start >= 0 ? String(html || '').slice(start, start + 900) : '';
    const hasCaption = /article-image-caption/.test(nearby);
    const hasCaptionSourceLink = /<a\s+[^>]*href=["']https:\/\//i.test(nearby);
    if (isFallbackImagePath(src)) {
      // 가짜 출처 캡션 금지는 발행 대상 호에만 적용합니다. 이 규칙이 생기기 전에 발행된 호에는
      // 이미 이 캡션이 들어 있어서, 전체에 적용하면 내용과 무관한 PR까지 전부 막힙니다.
      // 형제 validator들이 이미 쓰는 정책과 같습니다(과거 산출물은 검사 대상 밖).
      if (strictArtifactValidation && hasCaption && hasCaptionSourceLink) {
        errors.push(`Newsletter fallback article image must not carry a source attribution caption: ${relPath}`);
      }
    } else if (!hasCaption || !hasCaptionSourceLink) {
      errors.push(`Newsletter article image missing caption attribution link: ${relPath}`);
    }
  }
}

function validateHtmlStructure(date, html, root, errors, strictArtifactValidation) {
  const content = String(html || '');
  const relPath = `newsletters/${date}/index.html`;
  if (!/<!doctype html>/i.test(content) || !/<html\b/i.test(content) || !/<\/html>/i.test(content)) {
    errors.push(`Newsletter HTML is structurally invalid: ${relPath}`);
  }

  const openAnchors = content.match(/<a\b/gi)?.length || 0;
  const closeAnchors = content.match(/<\/a>/gi)?.length || 0;
  if (openAnchors !== closeAnchors) {
    errors.push(`Anchor tag mismatch in ${relPath}`);
  }
  if (/\bTODO\b/.test(content)) {
    errors.push(`Published HTML contains TODO: ${relPath}`);
  }

  for (const className of REQUIRED_ISSUE_CLASSES) {
    if (!hasClassToken(content, className)) {
      errors.push(`Newsletter HTML missing ${className}: ${relPath}`);
    }
  }

  const sourceBlocks = [];
  const sourceClassPattern = /class=["'][^"']*source-list[^"']*["']/gi;
  let sourceMatch;
  while ((sourceMatch = sourceClassPattern.exec(content)) !== null) {
    sourceBlocks.push(content.slice(sourceMatch.index, sourceMatch.index + 1200));
  }
  if (sourceBlocks.length === 0) {
    errors.push(`Newsletter HTML has no source-list blocks: ${relPath}`);
  }
  for (const block of sourceBlocks) {
    if (!/<a\s+[^>]*href=["']https?:\/\//i.test(block)) {
      errors.push(`Newsletter HTML source-list has no source links: ${relPath}`);
    }
  }

  validateArticleImages(relPath, content, root, errors, strictArtifactValidation);
}

function validateSelectedImageContract(date, editor, root, errors) {
  if (!editor || !Array.isArray(editor.sections)) return;

  for (const [index, section] of editor.sections.entries()) {
    const label = section.headline || section.category || `section ${index + 1}`;
    const selectedImage = String(section.selectedImage || '').trim();
    if (!selectedImage) continue;

    const normalizedImage = selectedImage.replace(/\\/g, '/');
    if (/^https:\/\//i.test(normalizedImage)) {
      if (section.resolvedImage?.usedFallback === true) {
        errors.push(`Newsletter ${date} selectedImage still points to an external URL after fallback: ${label}`);
      }
      const imageCandidates = ensureArray(section.imageCandidates);
      if (!imageCandidates.some(image => image && image.url === selectedImage)) {
        errors.push(`Newsletter ${date} selectedImage is not in imageCandidates: ${label}`);
      }
      if (!isSafeExternalImageUrl(normalizedImage) || REJECT_PATH_PATTERN.test(normalizedImage)) {
        errors.push(`Newsletter ${date} selectedImage is not an allowed HTTPS article image: ${label}`);
      }
      for (const field of ['imageSource', 'imageAttribution', 'imageAlt', 'imageUsageDecisionReason']) {
        if (!String(section[field] || '').trim()) {
          errors.push(`Newsletter ${date} selectedImage missing ${field}: ${label}`);
        }
      }
      if (!/^https:\/\//i.test(String(section.imageSource || '').trim())) {
        errors.push(`Newsletter ${date} selectedImage imageSource must be an HTTPS URL: ${label}`);
      }
      if (!['unknown', 'allowed'].includes(section.imageLicenseStatus || '')) {
        errors.push(`Newsletter ${date} selectedImage has invalid imageLicenseStatus: ${label}`);
      }
      continue;
    }

    if (!isFallbackImagePath(normalizedImage)) {
      errors.push(`Newsletter ${date} selectedImage must be HTTPS or repo-local fallback: ${label}`);
    }
    const localPath = repoLocalPath(root, selectedImage);
    if (!localPath || !fs.existsSync(localPath)) {
      errors.push(`Newsletter ${date} selectedImage fallback file is missing: ${label} (${selectedImage})`);
    }
    if (section.resolvedImage?.usedFallback !== true) {
      errors.push(`Newsletter ${date} fallback selectedImage missing resolvedImage.usedFallback=true: ${label}`);
    }
    const resolvedUrl = section.resolvedImage?.url || section.resolvedImage?.src || '';
    if (resolvedUrl !== selectedImage) {
      errors.push(`Newsletter ${date} fallback selectedImage does not match resolvedImage.url: ${label}`);
    }
  }
}

function validateRenderedIssueStructure({
  date,
  editor = null,
  markdown = '',
  html = '',
  root = process.cwd(),
  validateDataIndex = true,
  strictArtifactValidation = true
} = {}) {
  editor = toLegacyEditorIssue(editor, { date });
  const errors = [];
  const issueDate = date || editor?.date || 'unknown';

  if (validateDataIndex) {
    validateNewsletterIndex(root, errors);
  }
  validateMarkdownStructure(issueDate, markdown, errors);
  validateHtmlStructure(issueDate, html, root, errors, strictArtifactValidation);
  validateSelectedImageContract(issueDate, editor, root, errors);

  return {
    ok: errors.length === 0,
    errors,
    text: errors.length > 0 ? errors.map(error => `- ${error}`).join('\n') : 'Rendered issue structure validation passed.'
  };
}

module.exports = {
  hasAny,
  newsletterIndexContractVersion,
  mainArticleBlocks,
  validateRenderedIssueStructure
};
