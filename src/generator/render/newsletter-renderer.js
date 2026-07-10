const { ensureArray } = require('../../shared/common/value-coercion');
const { loreThreadUrl } = require('../../shared/common/article-groups');
const {
  PUBLICATION_MODES,
  FALLBACK_TAGS,
  fallbackEditionNoticeLines
} = require('../../shared/common/publication-mode');
const {
  renderCandidateSelectionDiagnostics
} = require('../select/selection-diagnostics');
const {
  articleSectionContractRows: buildArticleSectionContractRows,
  articleSectionContractRowValues
} = require('../reporter/article-structure-summary');
const {
  STORY_CONTRACT_VERSION,
  publicArticleForSection
} = require('../reporter/public-article-contract');
const {
  uniqueArticleAnchorId
} = require('../reporter/article-anchor');
const {
  renderReleaseQaInventorySection
} = require('../publish/review-artifact-inventory');
const {
  SITE_BASE_URL,
  DEFAULT_OG_IMAGE
} = require('./seo-metadata');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownLink(source) {
  const title = source.title || source.url || '출처';
  const thread = loreThreadUrl(source.url);
  const suffix = thread ? ` — [전체 패치 시리즈](${thread})` : '';
  return `- [${title}](${source.url})${suffix}`;
}

function sourceListMarkdown(sources) {
  return ensureArray(sources).filter(source => source && source.url).map(markdownLink).join('\n');
}

function sourceListHtml(sources) {
  return ensureArray(sources)
    .filter(source => source && source.url)
    .map(source => {
      const thread = loreThreadUrl(source.url);
      const suffix = thread ? ` — <a href="${escapeHtml(thread)}">전체 패치 시리즈</a>` : '';
      return `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title || source.url)}</a>${suffix}</li>`;
    })
    .join('');
}

function bulletsMarkdown(items) {
  return ensureArray(items).map(item => `- ${item}`).join('\n');
}

function bulletsHtml(items) {
  return ensureArray(items).map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function paragraphHtml(value) {
  return `<p>${escapeHtml(value || '')}</p>`;
}

function slugClass(value) {
  return String(value || 'generic')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'generic';
}

function publicVisualLabel(value) {
  return String(value || 'Article visual')
    .replace(/\bFallback\b/gi, 'Tooling Watch')
    .replace(/cpp_ai_tooling_fallback/gi, 'Tooling Watch')
    .replace(/\s*\/\s*Tooling Watch\s*$/i, ' / Tooling Watch')
    .trim() || 'Article visual';
}

function httpsUrlOrFallback(value, fallback) {
  return /^https:\/\//i.test(String(value || '').trim()) ? String(value).trim() : fallback;
}

function resolvedArticleImage(section) {
  const resolved = section.resolvedImage && (section.resolvedImage.url || section.resolvedImage.src) ? section.resolvedImage : null;
  if (resolved) {
    return {
      ...resolved,
      src: resolved.url || resolved.src
    };
  }
  if (!section.selectedImage) return null;
  return {
    src: section.selectedImage,
    usedFallback: false
  };
}

function articleImageSource(section) {
  return httpsUrlOrFallback(
    section.imageSource ||
      section.sources?.[0]?.url ||
      section.originalImage ||
      section.resolvedImage?.originalUrl ||
      section.resolvedImage?.originalSrc,
    section.imageSource || section.sources?.[0]?.url || ''
  );
}

function articleImageMarkdown(section, publicArticle = null) {
  const image = resolvedArticleImage(section);
  if (!image || !image.src) return '';
  const attribution = section.imageAttribution || section.sources?.[0]?.title || '출처 기사';
  const source = articleImageSource(section);
  const alt = section.imageAlt || `${publicArticle?.headline || section.headline || 'Article'} image`;
  return `\n![${alt}](${image.src})\n\n_이미지: [${attribution}](${source})_\n`;
}

function articleMediaHtml(section, publicArticle = null) {
  const image = resolvedArticleImage(section);
  if (image && image.src) {
    const imageSource = articleImageSource(section);
    const attribution = section.imageAttribution || section.sources?.[0]?.title || '출처 기사';
    const alt = section.imageAlt || `${publicArticle?.headline || section.headline || 'Article'} image`;
    return `<figure class="article-media">
            <img class="article-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
            <figcaption class="article-image-caption">이미지: <a href="${escapeHtml(imageSource)}">${escapeHtml(attribution)}</a></figcaption>
          </figure>`;
  }

  const variant = slugClass(publicVisualLabel(section.article_type || section.category || 'generic'));
  return `<div class="article-media article-placeholder-visual article-placeholder-${escapeHtml(variant)}" role="img" aria-label="${escapeHtml(publicVisualLabel(section.category))}">
            <span></span>
          </div>`;
}

function issueCameraAnchorCount(issue) {
  const parsed = Number(issue?.camera_anchor_count);
  return Number.isFinite(parsed) ? parsed : null;
}

function sectionRelevanceBucket(section = {}) {
  return String(
    section.final_relevance_bucket ||
    section.bound_candidate?.relevance_bucket ||
    section.public_article?.bound_candidate?.relevance_bucket ||
    section.final_candidate?.relevance_bucket ||
    section.relevance_bucket ||
    section.aosp_camera_stack_bucket ||
    section.aospCameraStackBucket ||
    section.categoryBucket ||
    section.source_candidate?.relevance_bucket ||
    ''
  ).trim();
}

function articlePerspectiveLabel(issue, section) {
  return 'Camera HAL/Driver 관점';
}

function articlePerspectiveHeading(issue, section) {
  return `${articlePerspectiveLabel(issue, section)}에서의 의미`;
}

// HTML 페이지 전용 관점 박스 라벨(mockup). markdown 산출물은 articlePerspectiveHeading 을 유지해
// 재렌더 시 newsletter.md 가 변하지 않는다.
function articlePerspectiveHeadingHtml() {
  return 'Camera HAL · Driver 관점';
}

// mockup 카테고리 눈썹 라벨: section.article_type -> 표시 라벨.
const ARTICLE_CATEGORY_LABELS = {
  direct_aosp_camera: 'AOSP Camera',
  camera_driver_image_pipeline: 'Camera Driver · ISP',
  android_platform_camera_adjacent: 'Android Platform',
  cpp_ai_tooling_fallback: 'C++ · AI Tooling',
  soc_platform_signal: 'SoC Platform',
  android_multimedia_camera_output: 'Android Multimedia'
};

function articleCategoryLabel(section = {}) {
  return ARTICLE_CATEGORY_LABELS[String(section.article_type || '').trim()] || 'Camera';
}

function issueTags(issue) {
  const tags = ensureArray(issue.tags).length > 0 ? issue.tags : ['Camera HAL', 'Android'];
  if (issue?.publication_mode !== PUBLICATION_MODES.FALLBACK_PUBLIC && issue?.fallback_only !== true) return tags;
  const cameraAnchorCount = issueCameraAnchorCount(issue);
  const cleaned = tags
    .map(String)
    .filter(Boolean)
    .filter(tag => !(cameraAnchorCount === 0 && String(tag).trim().toLowerCase() === 'camera hal'));
  return [...new Set([...FALLBACK_TAGS, ...cleaned])];
}

function reviewPublicationNoticeLines() {
  return [
    '검토 발행본입니다.',
    '각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.'
  ];
}

function publicationNoticeLines(issue) {
  const fallbackNotice = issue?.publication_mode === PUBLICATION_MODES.FALLBACK_PUBLIC || issue?.fallback_only === true;
  if (fallbackNotice) {
    if (Array.isArray(issue.publication_notice) && issue.publication_notice.length > 0) {
      return issue.publication_notice.map(String).filter(Boolean);
    }
    return fallbackEditionNoticeLines();
  }
  if (issue?.review_publication_ready === true || issue?.publication_mode === PUBLICATION_MODES.REVIEW_ONLY) {
    return reviewPublicationNoticeLines();
  }
  return [];
}

function publicationNoticeMarkdown(issue) {
  const lines = publicationNoticeLines(issue);
  if (lines.length === 0) return '';
  return `\n${lines.map(line => `> ${line}`).join('\n')}\n`;
}

function publicationNoticeHtml(issue) {
  const lines = publicationNoticeLines(issue);
  if (lines.length === 0) return '';
  return `<div class="publication-notice" role="note">
          ${lines.map(line => `<p>${escapeHtml(line)}</p>`).join('\n          ')}
        </div>`;
}

function tagsHtml(tags) {
  return ensureArray(tags).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
}

function normalizedLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function articleTagsHtml(section, headingCategory) {
  const tags = ensureArray(section.tags)
    .filter(tag => normalizedLabel(tag) !== normalizedLabel(headingCategory));
  if (tags.length === 0) return '';
  return `<div class="article-tags">${tagsHtml(tags)}</div>`;
}

function issueDisplayDate(issue = {}) {
  const explicitDate = String(issue.date || '').trim();
  if (explicitDate) return explicitDate;
  const titleDate = String(issue.title || '').match(/\d{4}-\d{2}-\d{2}/);
  return titleDate ? titleDate[0] : '';
}

// Weekly pages list the week's article titles under the issue title, so the section is "이번 주 기사".
function briefingHeading(issue = {}) {
  return issue.weekly_key ? '이번 주 기사' : '이번 주 3줄 브리핑';
}

// HTML 페이지 전용 브리핑 박스 타이틀(mockup "이번 호 기사"). markdown 은 briefingHeading 유지.
function briefingHeadingHtml(issue = {}) {
  return issue.weekly_key ? '이번 호 기사' : briefingHeading(issue);
}

// Weekly issues are labeled by ISO week ("2026-W22" -> "2026 W22"); daily issues fall back to date.
function issueWeekLabel(issue = {}) {
  const key = String(issue.weekly_key || '').trim();
  return /^\d{4}-W\d{2}$/.test(key) ? key.replace('-W', ' W') : '';
}

// Weekly issue hero kicker shows the week's date range in the mockup format ("2026.05.25 – 05.31").
function issueKickerText(issue = {}) {
  const dot = value => String(value).replace(/-/g, '.');
  const start = String(issue.week_start_date || '').trim();
  const end = String(issue.week_end_date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return `${dot(start)} – ${dot(end).slice(5)}`;
  }
  return `주간 뉴스레터 ${issue.date || ''}`.trim();
}

function issuePageTitle(issue = {}) {
  const weekLabel = issueWeekLabel(issue);
  if (weekLabel) return `${weekLabel} Camera SW Newsletter`;
  const date = issueDisplayDate(issue);
  return date ? `Camera SW Newsletter - ${date}` : 'Camera SW Newsletter';
}

function issueTitleHtml(issue = {}) {
  const weekLabel = issueWeekLabel(issue);
  if (weekLabel) {
    return `<span>${escapeHtml(weekLabel)}</span>`;
  }
  const date = issueDisplayDate(issue);
  return `<span>Camera SW</span><span>Newsletter${date ? ` - ${escapeHtml(date)}` : ''}</span>`;
}

function homepageHeaderHtml(rootPath = '') {
  return `<header class="site-header homepage-site-header">
    <div class="homepage-nav content-wrap">
      <a class="site-brand homepage-brand" href="${escapeHtml(rootPath)}index.html" aria-label="Camera SW Newsroom">
        <img class="brand-logo" src="${escapeHtml(rootPath)}assets/images/brand/HALley-logo.png" alt="" width="30" height="30">
        <span class="brand-name">Camera SW <span class="brand-subtitle">Newsroom</span></span>
      </a>
      <div class="nav-links homepage-nav-links" aria-label="Primary navigation">
        <a href="${escapeHtml(rootPath)}index.html">홈</a>
        <a href="${escapeHtml(rootPath)}archive.html">아카이브</a>
        <a href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>
      </div>
    </div>
  </header>`;
}

function siteFooterHtml(rootPath = '') {
  const root = escapeHtml(rootPath);
  return `<footer class="site-footer">
    <div class="content-wrap footer-inner">
      <div class="footer-cols">
        <div class="footer-col">
          <span class="footer-col-title">뉴스레터</span>
          <a class="footer-link" href="${root}index.html">홈</a>
          <a class="footer-link" href="${root}archive.html">아카이브</a>
          <span class="footer-note">구독 (지원예정)</span>
        </div>
        <div class="footer-col">
          <span class="footer-col-title">주제</span>
          <span class="footer-note">Camera HAL · Android</span>
          <span class="footer-note">Driver · Image Processing</span>
          <span class="footer-note">AI · SoC Platform</span>
        </div>
        <div class="footer-col">
          <span class="footer-col-title">리소스</span>
          <a class="footer-link" href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>
          <span class="footer-note">RSS (지원예정)</span>
          <span class="footer-note">편집 정책 (지원예정)</span>
        </div>
      </div>
      <div class="footer-legal"><small>© 2026 Camera SW Newsletter · Gemini 뉴스룸이 모아 사람이 검토·발행합니다.</small></div>
    </div>
  </footer>`;
}

function catchUpWeeksLabel(section) {
  const days = Number(section.catch_up_age_days);
  if (!Number.isFinite(days)) return '';
  const weeks = Math.max(1, Math.round(days / 7));
  return ` (${weeks}주 전 릴리스)`;
}

function normalizedSections(issue) {
  const usedAnchors = new Set();
  const ordered = ensureArray(issue.sections)
    .map((section, originalIndex) => ({ section, originalIndex }))
    .sort((a, b) => {
      const aCatch = a.section.coverage_type === 'catch_up' ? 1 : 0;
      const bCatch = b.section.coverage_type === 'catch_up' ? 1 : 0;
      return aCatch - bCatch || a.originalIndex - b.originalIndex;
    });
  return ordered.map(({ section }, index) => {
    const publicArticle = publicArticleForSection(section, { issue });
    const category = publicArticle.headline || `Main Article ${index + 1}`;
    const isCatchUp = section.coverage_type === 'catch_up';
    const badge = isCatchUp ? catchUpWeeksLabel(section) : '';
    return {
      heading: `## ${index + 2}. ${category}${badge}`,
      htmlHeading: `${index + 2}. ${category}${badge}`,
      headingCategory: category,
      className: section.article_type || (section.is_ai_related ? 'ai' : 'article'),
      anchorId: uniqueArticleAnchorId(category, index, usedAnchors),
      articleNumber: index + 1,
      isCatchUp,
      section
    };
  });
}

const CATCH_UP_DIVIDER_HEADING = '지난 소식 (Catch-up)';

function sectionsMarkdownWithCatchUpDivider(issue) {
  let dividerEmitted = false;
  return normalizedSections(issue)
    .map(({ heading, section, isCatchUp }) => {
      let prefix = '';
      if (isCatchUp && !dividerEmitted) {
        prefix = `## ${CATCH_UP_DIVIDER_HEADING}\n\n`;
        dividerEmitted = true;
      }
      return prefix + publicArticleMarkdown(issue, heading, section);
    })
    .join('\n---\n\n');
}

function sectionsHtmlWithCatchUpDivider(issue) {
  let dividerEmitted = false;
  return normalizedSections(issue)
    .map(({ htmlHeading, headingCategory, className, anchorId, articleNumber, section, isCatchUp }) => {
      let prefix = '';
      if (isCatchUp && !dividerEmitted) {
        prefix = `      <h2 class="catch-up-divider">${escapeHtml(CATCH_UP_DIVIDER_HEADING)}</h2>\n`;
        dividerEmitted = true;
      }
      return prefix + publicArticleHtml(issue, htmlHeading, headingCategory, className, anchorId, articleNumber, section);
    })
    .join('\n\n');
}

function markdownTableCell(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|') || 'none';
}

function normalizeParagraphForDeduplication(value) {
  return String(value || '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function duplicatesPerspectiveParagraph(paragraph, perspective) {
  const normalizedParagraph = normalizeParagraphForDeduplication(paragraph);
  const normalizedPerspective = normalizeParagraphForDeduplication(perspective);
  if (!normalizedParagraph || !normalizedPerspective) return false;
  if (normalizedParagraph === normalizedPerspective) return true;
  if (Math.min(normalizedParagraph.length, normalizedPerspective.length) < 120) return false;
  return normalizedParagraph.includes(normalizedPerspective) || normalizedPerspective.includes(normalizedParagraph);
}

function bodyParagraphsForRender(publicArticle) {
  const perspective = publicArticle?.camera_hal_takeaway || '';
  return ensureArray(publicArticle?.body_paragraphs)
    .filter(paragraph => !duplicatesPerspectiveParagraph(paragraph, perspective));
}

function uniquePublicParagraphs(values, existingValues = []) {
  const seen = new Set(ensureArray(existingValues)
    .map(normalizeParagraphForDeduplication)
    .filter(Boolean));
  const output = [];
  for (const value of ensureArray(values)) {
    const text = String(value || '').trim();
    if (!text) continue;
    const normalized = normalizeParagraphForDeduplication(text);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(text);
  }
  return output;
}

function storyBodyParagraphsForRender(publicArticle) {
  return uniquePublicParagraphs(
    bodyParagraphsForRender(publicArticle),
    [publicArticle?.lead, publicArticle?.camera_hal_takeaway]
  );
}

function isStoryArticle(publicArticle = {}) {
  return Number(publicArticle.story_contract_version) === STORY_CONTRACT_VERSION &&
    publicArticle.editorial_story &&
    typeof publicArticle.editorial_story === 'object';
}

function articleSectionContractRows(issue, qualityReport = null) {
  return buildArticleSectionContractRows(ensureArray(issue?.sections), {
    articleResults: ensureArray(qualityReport?.article_results)
  });
}

function articleSectionContractMarkdown(issue, qualityReport = null) {
  const rows = articleSectionContractRows(issue, qualityReport);
  if (rows.length === 0) return '- none';
  return [
    '| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |',
    '| ---: | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${articleSectionContractRowValues(row).map(markdownTableCell).join(' | ')} |`)
  ].join('\n');
}

function publicArticleMarkdown(issue, heading, section) {
  const publicArticle = publicArticleForSection(section, { issue });
  const perspectiveHeading = articlePerspectiveHeading(issue, section);
  const bodyParagraphs = isStoryArticle(publicArticle)
    ? storyBodyParagraphsForRender(publicArticle)
    : bodyParagraphsForRender(publicArticle);
  if (isStoryArticle(publicArticle)) {
    return `${heading}

${articleImageMarkdown(section, publicArticle)}

${publicArticle.source_subtitle ? `_${publicArticle.source_subtitle}_\n\n` : ''}${publicArticle.lead}

${bodyParagraphs.join('\n\n')}

### ${perspectiveHeading}

${publicArticle.camera_hal_takeaway}

**출처**

${sourceListMarkdown(publicArticle.source_links)}
`;
  }
  return `${heading}

${articleImageMarkdown(section, publicArticle)}

${publicArticle.lead}

${bodyParagraphs.join('\n\n')}

### ${perspectiveHeading}

${publicArticle.camera_hal_takeaway}

**출처**

${sourceListMarkdown(publicArticle.source_links)}
`;
}

const QUIET_CORE_CONTEXT_NOTE = '이번 기간 카메라 코어 직접 변경은 없었습니다. 아래는 실무 레이더 관점의 맥락입니다.';
const WATCH_POINTS_HEADING = '다음 관전 포인트';

function hasWatchPoints(issue) {
  return Array.isArray(issue?.watch_points) && issue.watch_points.length > 0;
}

function isContextPublishMode(issue) {
  return issue?.publish_mode === 'CONTEXT';
}

function quietCoreNoteMarkdown(issue) {
  if (!isContextPublishMode(issue)) return '';
  return `\n${QUIET_CORE_CONTEXT_NOTE}\n`;
}

function watchPointsMarkdown(issue) {
  if (!hasWatchPoints(issue)) return '';
  return `## ${WATCH_POINTS_HEADING}

${bulletsMarkdown(issue.watch_points)}

`;
}

function quietCoreNoteHtml(issue) {
  if (!isContextPublishMode(issue)) return '';
  return `\n      <section class="section issue-quiet-core-note" role="note">
        <div class="card issue-quiet-core-note-card">
          <p>${escapeHtml(QUIET_CORE_CONTEXT_NOTE)}</p>
        </div>
      </section>\n`;
}

function watchPointsHtml(issue) {
  if (!hasWatchPoints(issue)) return '';
  return `\n      <section class="section issue-watch-points" aria-labelledby="issue-watch-points-title">
        <div class="card issue-watch-points-card">
          <div class="issue-section-heading">
            <h2 id="issue-watch-points-title">${escapeHtml(WATCH_POINTS_HEADING)}</h2>
          </div>
          <ul>${bulletsHtml(issue.watch_points)}</ul>
        </div>
      </section>\n`;
}

const REFERENCE_ARTICLES_HEADING = '참고 / 더 읽을거리';

function escapeMarkdownLinkText(value) {
  return String(value).replace(/[[\]]/g, '\\$&');
}

function referenceArticlesMarkdown(issue) {
  const articles = Array.isArray(issue?.reference_articles) ? issue.reference_articles : [];
  if (!articles.length) return '';
  const bullets = articles
    .map(article => `- [${escapeMarkdownLinkText(article.title)}](<${article.url}>) — ${article.source} (${article.published_date}) · ${article.note}`)
    .join('\n');
  return `## ${REFERENCE_ARTICLES_HEADING}

${bullets}

`;
}

// HTML 페이지 전용 헤딩(mockup 중점 표기). markdown 은 REFERENCE_ARTICLES_HEADING 유지.
const REFERENCE_ARTICLES_HEADING_HTML = '참고 · 더 읽을거리';

function referenceArticlesHtml(issue) {
  const articles = Array.isArray(issue?.reference_articles) ? issue.reference_articles : [];
  if (!articles.length) return '';
  const items = articles
    .map(article => `<li><a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a><span class="reference-meta">${escapeHtml(article.source)} (${escapeHtml(article.published_date)}) · ${escapeHtml(article.note)}</span></li>`)
    .join('');
  return `\n      <section class="section issue-reference-articles" aria-labelledby="issue-reference-articles-title">
        <h2 id="issue-reference-articles-title">${escapeHtml(REFERENCE_ARTICLES_HEADING_HTML)}</h2>
        <ul class="reference-articles-list">${items}</ul>
      </section>\n`;
}

function buildPublicMarkdown(issue) {
  return `# ${issue.title}

${issue.summary}

${publicationNoticeMarkdown(issue)}

## 1. ${briefingHeading(issue)}

${bulletsMarkdown(issue.briefing)}
${quietCoreNoteMarkdown(issue)}
${sectionsMarkdownWithCatchUpDivider(issue)}

${watchPointsMarkdown(issue)}${referenceArticlesMarkdown(issue)}## 참고자료

${sourceListMarkdown(issue.references)}
`;
}

// mockup 기사 흐름: [번호+카테고리 눈썹] → 제목 → 출처 서브타이틀 → 이미지 → 리드 → 본문 →
// 관점 박스 → 출처. 카드 프레임 없이 섹션 자체가 hairline 으로 구분된다.
function publicArticleHtml(issue, htmlHeading, headingCategory, className, anchorId, articleNumber, section) {
  const publicArticle = publicArticleForSection(section, { issue });
  const perspectiveHeading = articlePerspectiveHeadingHtml();
  const bodyParagraphs = isStoryArticle(publicArticle)
    ? storyBodyParagraphsForRender(publicArticle)
    : bodyParagraphsForRender(publicArticle);
  const sourceSubtitle = isStoryArticle(publicArticle) && publicArticle.source_subtitle
    ? `<p class="article-source-subtitle">${escapeHtml(publicArticle.source_subtitle)}</p>`
    : '';
  const displayNumber = String(articleNumber).padStart(2, '0');
  const mediaHtml = articleMediaHtml(section, publicArticle)
    .split('\n')
    .map(line => `        ${line.trimStart()}`)
    .join('\n');
  const articleBodyBlocks = [
    sourceSubtitle,
    mediaHtml,
    `        <p class="article-lead">${escapeHtml(publicArticle.lead)}</p>`,
    ...bodyParagraphs.map(paragraph => `        ${paragraphHtml(paragraph)}`)
  ].filter(Boolean).join('\n');
  const articleTypeClass = isStoryArticle(publicArticle) ? ' story-article' : '';
  const articleImageClass = resolvedArticleImage(section) ? 'has-image' : 'has-placeholder-image';
  const articleTags = articleTagsHtml(section, headingCategory);
  const articleTagsBlock = articleTags ? `\n        ${articleTags}` : '';
  return `      <section class="section issue-story issue-section article-card${articleTypeClass} ${articleImageClass} ${escapeHtml(className)}" id="${escapeHtml(anchorId)}" aria-labelledby="${escapeHtml(anchorId)}-title">
        <div class="issue-story-eyebrow">
          <span class="issue-story-number" aria-label="Article ${escapeHtml(articleNumber)}">${escapeHtml(displayNumber)}</span>
          <span class="issue-story-category">${escapeHtml(articleCategoryLabel(section))}</span>
        </div>
        <h2 id="${escapeHtml(anchorId)}-title" class="article-title">${escapeHtml(publicArticle.headline || htmlHeading)}</h2>${articleTagsBlock}
${articleBodyBlocks}
        <div class="article-block camera-hal-takeaway"><strong class="article-block-title">${escapeHtml(perspectiveHeading)}</strong>${paragraphHtml(publicArticle.camera_hal_takeaway)}</div>
        <div class="source-list"><strong>출처</strong><ul>${sourceListHtml(publicArticle.source_links)}</ul></div>
      </section>`;
}

function issueHeroHtml(issue) {
  return `<header class="article-header issue-hero">
        <a class="issue-back" href="../../index.html">← 뉴스룸</a>
        <div class="article-meta issue-hero-meta">
          <span class="issue-kicker">${escapeHtml(issueKickerText(issue))}</span>
        </div>
        <h1 class="issue-title">${issueTitleHtml(issue)}</h1>
        <p class="subtitle">${escapeHtml(issue.summary)}</p>
        <div class="tag-row issue-tags">${tagsHtml(issueTags(issue))}</div>
      </header>`;
}

function issueBriefingHtml(issue) {
  return `<section class="section issue-briefing" aria-labelledby="issue-briefing-title">
        <div class="issue-briefing-card">
          <h2 id="issue-briefing-title">${briefingHeadingHtml(issue)}</h2>
          <ul>${bulletsHtml(issue.briefing)}</ul>
        </div>
      </section>`;
}

function issueCanonicalUrl(issue = {}) {
  const slug = String(issue.weekly_key || issue.date || '').trim();
  return `${SITE_BASE_URL}newsletters/${slug}/index.html`;
}

// #51 후속: 기사 페이지(newsletters/<slug>/index.html)의 share/SEO 메타.
// og:type=article, canonical/og:url은 발행물의 공개 경로(주간이면 weekly_key, 아니면 date),
// description은 issue summary, 대표 이미지는 기본 preview(HALley)를 쓴다.
function articleSeoHead(issue = {}) {
  const title = issuePageTitle(issue);
  const description = String(issue.summary || '').trim();
  const url = issueCanonicalUrl(issue);
  const image = DEFAULT_OG_IMAGE;
  return [
    `  <meta name="description" content="${escapeHtml(description)}" />`,
    `  <link rel="canonical" href="${escapeHtml(url)}" />`,
    '  <meta property="og:type" content="article" />',
    '  <meta property="og:site_name" content="Camera SW Newsletter" />',
    `  <meta property="og:title" content="${escapeHtml(title)}" />`,
    `  <meta property="og:description" content="${escapeHtml(description)}" />`,
    `  <meta property="og:url" content="${escapeHtml(url)}" />`,
    `  <meta property="og:image" content="${escapeHtml(image)}" />`,
    '  <meta name="twitter:card" content="summary_large_image" />',
    `  <meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `  <meta name="twitter:image" content="${escapeHtml(image)}" />`
  ].join('\n');
}

function buildPublicHtml(issue) {
  const publicationNotice = publicationNoticeHtml(issue);
  const publicationNoticeBlock = publicationNotice ? `      ${publicationNotice}\n\n` : '';
  const rootPath = '../../';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(issuePageTitle(issue))}</title>
${articleSeoHead(issue)}
  <link rel="preconnect" href="https://cdn.jsdelivr.net" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
  <link rel="stylesheet" href="../../css/styles.css" />
</head>
<body class="homepage newsletter-issue-page">
  ${homepageHeaderHtml(rootPath)}

  <main class="site-main article-page newsletter-main">
    <article class="wrap issue-wrap">
      ${issueHeroHtml(issue)}

${publicationNoticeBlock}      ${issueBriefingHtml(issue)}
${quietCoreNoteHtml(issue)}
${sectionsHtmlWithCatchUpDivider(issue)}
${watchPointsHtml(issue)}${referenceArticlesHtml(issue)}
      <section class="section issue-references" aria-labelledby="issue-references-title">
        <h2 id="issue-references-title">참고자료</h2>
        <div class="reference-list"><ul>${sourceListHtml(issue.references)}</ul></div>
      </section>

      <nav class="issue-footer-navigation" aria-label="이슈 하단 이동">
        <a href="../../index.html">← 뉴스룸으로</a>
        <span aria-hidden="true">·</span>
        <a href="../../archive.html">아카이브 전체 보기 →</a>
      </nav>

    </article>
  </main>
  ${siteFooterHtml(rootPath)}
</body>
</html>
`;
}

function buildMarkdown(issue) {
  return buildPublicMarkdown(issue);
}

function buildHtml(issue) {
  return buildPublicHtml(issue);
}

function buildFactCheckMarkdown(date, report) {
  const mustFix = ensureArray(report.must_fix);
  return `# 사실 검증 보고서 - ${date}

## 상태

${report.status}

## 반드시 수정할 항목

${mustFix.length === 0 ? '- 없음' : mustFix.map(item => `- 위치: ${item.location}
  - 문제: ${item.problem}
  - 제안: ${item.suggestion}
  - 출처: ${item.source_url}`).join('\n')}

## 권장 수정

${ensureArray(report.recommended_fixes).length === 0 ? '- 없음' : bulletsMarkdown(report.recommended_fixes)}

## 출처 공백

${ensureArray(report.source_gaps).length === 0 ? '- 없음' : bulletsMarkdown(report.source_gaps)}

## 최종 의견

${report.final_comment}
`;
}

function qualitySummaryMarkdown(qualityReport) {
  if (!qualityReport) return '- 품질 점수: 생성되지 않음';
  return [
    `- 품질 점수: ${qualityReport.score}/100`,
    `- 품질 기준: ${qualityReport.threshold}`,
    `- 품질 상태: ${qualityReport.status}`,
    `- 주요 감점: ${ensureArray(qualityReport.deductions).slice(0, 5).map(item => `${item.points}pt ${item.category}${item.location ? ` (${item.location})` : ''}`).join('; ') || '없음'}`
  ].join('\n');
}

function staleClaimSummaryMarkdown(staleClaimReport) {
  if (!staleClaimReport) return '- Stale claim report: not generated';
  return [
    `- Stale claim status: ${staleClaimReport.status || 'UNKNOWN'}`,
    `- Removed global stale items: ${ensureArray(staleClaimReport.stale_claim_items_removed).length}`,
    `- Removed unsupported release claims: ${ensureArray(staleClaimReport.unsupported_release_claims_removed).length}`,
    `- Unused references removed: ${ensureArray(staleClaimReport.unused_references_removed).length}`,
    `- Hard failures: ${ensureArray(staleClaimReport.hard_failures).length}`
  ].join('\n');
}

function articleSectionContractSummaryMarkdown(issue, qualityReport = null) {
  return `## Article Structure Contract

${articleSectionContractMarkdown(issue, qualityReport)}`;
}

function buildEditorChiefBrief(date, issue, factCheck, qualityReport = null, selectionDiagnostics = null, staleClaimReport = null) {
  const firstSection = ensureArray(issue.sections)[0] || {};
  const decision = factCheck.status === 'PASS' && (!qualityReport || qualityReport.status === 'PASS')
    ? 'APPROVE'
    : 'REQUEST_CHANGES';
  return `# 편집장 브리핑 - ${date}

## 이번 주 핵심 메시지

${issue.summary}

## 메인으로 봐야 할 기사

${firstSection.headline || '첫 번째 메인 기사 확인 필요'}

## Camera HAL 업무 연결 포인트
${bulletsMarkdown(ensureArray(issue.action_items).slice(0, 5))}

## 검증 결과 요약

- 상태: ${factCheck.status}
- must_fix 개수: ${ensureArray(factCheck.must_fix).length}
- source gap 개수: ${ensureArray(factCheck.source_gaps).length}
- 의견: ${factCheck.final_comment}

## 품질 게이트
${qualitySummaryMarkdown(qualityReport)}

${articleSectionContractSummaryMarkdown(issue, qualityReport)}

## Stale Claim Gate

${staleClaimSummaryMarkdown(staleClaimReport)}

${selectionDiagnostics ? `${renderCandidateSelectionDiagnostics(selectionDiagnostics)}
` : ''}

## 편집장 확인 checklist

- [ ] 이번 주 핵심 메시지가 Camera HAL 업무와 직접 연결되는가?
- [ ] 주요 항목의 출처가 충분하고 과장 표현이 없는가?
- [ ] 검증 결과의 must_fix가 모두 해소되었는가?
- [ ] 팀 공유용으로도 충분한 action item이 정리되었는가?

## 권장 판단

${decision}
`;
}

function buildReleaseQaReport(date, files, validateResult, factCheck, todoFound, emptySourceSections, qualityReport = null, reviewInventory = null) {
  return `# 릴리스 QA 보고서 - ${date}

## 생성 파일 목록

${files.map(file => `- ${file}`).join('\n')}

${reviewInventory ? `${renderReleaseQaInventorySection(reviewInventory)}
` : ''}

## npm run validate 실행 결과

${validateResult}

## 잔여 TODO 여부

${todoFound ? 'TODO 문자가 남아 있습니다.' : '없음'}

## 출처 누락 여부

${emptySourceSections.length === 0 ? '없음' : emptySourceSections.map(section => `- ${section}`).join('\n')}

## Gemini 검증 결과

- 상태: ${factCheck.status}
- must_fix 개수: ${ensureArray(factCheck.must_fix).length}
- source gap 개수: ${ensureArray(factCheck.source_gaps).length}

## 품질 게이트
${qualitySummaryMarkdown(qualityReport)}
`;
}

module.exports = {
  articleSectionContractMarkdown,
  articleSectionContractRows,
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  issueTags,
  ensureArray
};
