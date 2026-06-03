const {
  renderCandidateSelectionDiagnostics
} = require('../generate/selection-diagnostics');
const {
  articleSectionContractRows: buildArticleSectionContractRows,
  articleSectionContractRowValues
} = require('../common/article-structure-summary');
const {
  STORY_CONTRACT_VERSION,
  publicArticleForSection
} = require('../common/public-article-contract');
const {
  uniqueArticleAnchorId
} = require('../common/article-anchor');
const {
  renderReleaseQaInventorySection
} = require('../common/review-artifact-inventory');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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
  return `- [${title}](${source.url})`;
}

function sourceListMarkdown(sources) {
  return ensureArray(sources).filter(source => source && source.url).map(markdownLink).join('\n');
}

function sourceListHtml(sources) {
  return ensureArray(sources)
    .filter(source => source && source.url)
    .map(source => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title || source.url)}</a></li>`)
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

function issueTags(issue) {
  const tags = ensureArray(issue.tags).length > 0 ? issue.tags : ['Camera HAL', 'Android'];
  if (issue?.publication_mode !== 'fallback_public' && issue?.fallback_only !== true) return tags;
  const cameraAnchorCount = issueCameraAnchorCount(issue);
  const cleaned = tags
    .map(String)
    .filter(Boolean)
    .filter(tag => !(cameraAnchorCount === 0 && String(tag).trim().toLowerCase() === 'camera hal'));
  return [...new Set(['Tooling Watch Edition', 'Tooling Watch', ...cleaned])];
}

function reviewPublicationNoticeLines() {
  return [
    '검토 발행본입니다.',
    '각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.'
  ];
}

function publicationNoticeLines(issue) {
  const fallbackNotice = issue?.publication_mode === 'fallback_public' || issue?.fallback_only === true;
  if (fallbackNotice) {
    if (Array.isArray(issue.publication_notice) && issue.publication_notice.length > 0) {
      return issue.publication_notice.map(String).filter(Boolean);
    }
    return [
      'Tooling Watch Edition',
      '이번 호는 Camera HAL / Driver / Android multimedia 직접 후보가 부족하여 Android native tooling / build/test/debug workflow 중심의 참고 issue로 발행되었습니다.',
      'Camera pipeline, Android native 성능, build/test/debug workflow 관점에서 참고 가능한 항목만 선별했으며 정상 Camera HAL issue로 간주하지 않습니다.'
    ];
  }
  if (issue?.review_publication_ready === true || issue?.publication_mode === 'review_only') {
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

function issuePageTitle(issue = {}) {
  const date = issueDisplayDate(issue);
  return date ? `Camera SW Newsletter - ${date}` : 'Camera SW Newsletter';
}

function issueTitleHtml(issue = {}) {
  const date = issueDisplayDate(issue);
  return `<span>Camera SW</span><span>Newsletter${date ? ` - ${escapeHtml(date)}` : ''}</span>`;
}

function homepageHeaderHtml(rootPath = '') {
  return `<header class="site-header homepage-site-header">
    <div class="homepage-nav content-wrap">
      <a class="site-brand homepage-brand" href="${escapeHtml(rootPath)}index.html" aria-label="Camera SW Newsletter">
        <span>Camera SW</span>
        <span class="brand-subtitle">Newsletter</span>
      </a>
      <div class="nav-links homepage-nav-links" aria-label="Primary navigation">
        <a href="${escapeHtml(rootPath)}index.html">Home</a>
        <a href="${escapeHtml(rootPath)}archive.html">Archive</a>
        <a href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>
      </div>
    </div>
  </header>`;
}

function siteFooterHtml(rootPath = '') {
  void rootPath;
  return `<footer class="site-footer">
    <div class="content-wrap footer-legal"><small>© 2026 Camera SW Newsletter</small></div>
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

function buildPublicMarkdown(issue) {
  return `# ${issue.title}

${issue.summary}

${publicationNoticeMarkdown(issue)}

## 1. 이번 주 3줄 브리핑

${bulletsMarkdown(issue.briefing)}
${quietCoreNoteMarkdown(issue)}
${sectionsMarkdownWithCatchUpDivider(issue)}

${watchPointsMarkdown(issue)}## 참고자료

${sourceListMarkdown(issue.references)}
`;
}

function publicArticleHtml(issue, htmlHeading, headingCategory, className, anchorId, articleNumber, section) {
  const publicArticle = publicArticleForSection(section, { issue });
  const perspectiveHeading = articlePerspectiveHeading(issue, section);
  const bodyParagraphs = isStoryArticle(publicArticle)
    ? storyBodyParagraphsForRender(publicArticle)
    : bodyParagraphsForRender(publicArticle);
  const sourceSubtitle = isStoryArticle(publicArticle) && publicArticle.source_subtitle
    ? `<p class="article-source-subtitle">${escapeHtml(publicArticle.source_subtitle)}</p>`
    : '';
  const articleCopyBlocks = [
    articleTagsHtml(section, headingCategory),
    `<h2 id="${escapeHtml(anchorId)}-title" class="article-title">${escapeHtml(publicArticle.headline || htmlHeading)}</h2>`,
    sourceSubtitle,
    `<p class="article-lead">${escapeHtml(publicArticle.lead)}</p>`,
    ...bodyParagraphs.map(paragraphHtml)
  ].filter(Boolean);
  const articleCopyHtml = articleCopyBlocks.map(block => `              ${block}`).join('\n');
  const mediaHtml = articleMediaHtml(section, publicArticle)
    .split('\n')
    .map(line => `            ${line.trimStart()}`)
    .join('\n');
  const articleTypeClass = isStoryArticle(publicArticle) ? ' story-article' : '';
  const articleImageClass = resolvedArticleImage(section) ? 'has-image' : 'has-placeholder-image';
  return `      <section class="section issue-story" id="${escapeHtml(anchorId)}" aria-labelledby="${escapeHtml(anchorId)}-title">
        <span class="issue-story-number" aria-label="Article ${escapeHtml(articleNumber)}">${escapeHtml(articleNumber)}</span>
        <article class="card issue-section article-card${articleTypeClass} ${articleImageClass} ${escapeHtml(className)}">
          <div class="article-feature-row">
${mediaHtml}
            <div class="article-copy">
${articleCopyHtml}
            </div>
          </div>
          <div class="article-block camera-hal-takeaway"><strong class="article-block-title">${escapeHtml(perspectiveHeading)}</strong>${paragraphHtml(publicArticle.camera_hal_takeaway)}</div>
          <div class="source-list"><strong>출처</strong><ul>${sourceListHtml(publicArticle.source_links)}</ul></div>
        </article>
      </section>`;
}

function issueHeroHtml(issue) {
  return `<header class="article-header issue-hero">
        <div class="issue-hero-copy">
          <div class="article-meta issue-hero-meta">
            <span class="issue-kicker">주간 뉴스레터 ${escapeHtml(issue.date)}</span>
            <div class="tag-row issue-tags">${tagsHtml(issueTags(issue))}</div>
          </div>
          <h1 class="issue-title">${issueTitleHtml(issue)}</h1>
          <p class="subtitle">${escapeHtml(issue.summary)}</p>
        </div>
        <figure class="issue-hero-mascot" aria-label="HALley mascot">
          <img
            src="../../assets/images/brand/HALley.png"
            alt="HALley 뉴스레터 마스코트"
            width="1254"
            height="1254"
            decoding="async"
            loading="eager"
          />
        </figure>
      </header>`;
}

function issueBriefingHtml(issue) {
  return `<section class="section issue-briefing" aria-labelledby="issue-briefing-title">
        <div class="card issue-briefing-card">
          <div class="issue-section-heading">
            <span class="section-icon section-icon-list" aria-hidden="true"></span>
            <h2 id="issue-briefing-title">이번 주 3줄 브리핑</h2>
          </div>
          <ul>${bulletsHtml(issue.briefing)}</ul>
        </div>
      </section>`;
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
${watchPointsHtml(issue)}
      <section class="section issue-references" aria-labelledby="issue-references-title">
        <h2 id="issue-references-title">참고자료</h2>
        <div class="card reference-list"><ul>${sourceListHtml(issue.references)}</ul></div>
      </section>

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
