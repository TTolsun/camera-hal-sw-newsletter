const {
  renderCandidateSelectionDiagnostics
} = require('../generate/selection-diagnostics');
const {
  articleSectionContractRows: buildArticleSectionContractRows,
  articleSectionContractRowValues
} = require('../common/article-structure-summary');
const {
  publicArticleForSection
} = require('../common/public-article-contract');

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

  const variant = slugClass(section.article_type || section.category || 'generic');
  return `<div class="article-media article-fallback-visual article-fallback-${escapeHtml(variant)}" role="img" aria-label="${escapeHtml(section.category || 'Article visual')}">
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
  const fallbackIssue = issue?.publication_mode === 'fallback_public' || issue?.fallback_only === true;
  if (fallbackIssue || sectionRelevanceBucket(section) === 'cpp_ai_tooling_fallback') {
    return 'Android Native / Tooling 관점';
  }
  return 'Camera HAL / Driver 관점';
}

function issueTags(issue) {
  const tags = ensureArray(issue.tags).length > 0 ? issue.tags : ['Camera HAL', 'Android'];
  if (issue?.publication_mode !== 'fallback_public' && issue?.fallback_only !== true) return tags;
  const cameraAnchorCount = issueCameraAnchorCount(issue);
  const cleaned = tags
    .map(String)
    .filter(Boolean)
    .filter(tag => !(cameraAnchorCount === 0 && String(tag).trim().toLowerCase() === 'camera hal'));
  return [...new Set(['Fallback Edition', 'Tooling Watch', ...cleaned])];
}

function reviewPublicationNoticeLines() {
  return [
    '편집자 검토 후 공개 가능한 검토 발행본입니다.',
    '이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.',
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
      'Fallback Edition: C++ / Tooling Watch',
      '이번 호는 Camera HAL / Driver / Android multimedia 직접 후보가 부족하여 C++/tooling 중심의 fallback issue로 발행되었습니다.',
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

function normalizedSections(issue) {
  return ensureArray(issue.sections).map((section, index) => {
    const publicArticle = publicArticleForSection(section);
    const category = publicArticle.headline || section.headline || section.category || `Main Article ${index + 1}`;
    return {
      heading: `## ${index + 2}. ${category}`,
      htmlHeading: `${index + 2}. ${category}`,
      headingCategory: category,
      className: section.article_type || (section.is_ai_related ? 'ai' : 'article'),
      section
    };
  });
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
  const publicArticle = publicArticleForSection(section);
  const perspectiveLabel = articlePerspectiveLabel(issue, section);
  const bodyParagraphs = bodyParagraphsForRender(publicArticle);
  return `${heading}

${articleImageMarkdown(section, publicArticle)}

${publicArticle.lead}

${bodyParagraphs.join('\n\n')}

**${perspectiveLabel}**

${publicArticle.camera_hal_takeaway}

### 확인할 점

${bulletsMarkdown(publicArticle.reader_checkpoints)}

**출처**

${sourceListMarkdown(publicArticle.source_links)}
`;
}

function buildPublicMarkdown(issue) {
  return `# ${issue.title}

${issue.summary}

${publicationNoticeMarkdown(issue)}

## 1. 이번 주 3줄 브리핑

${bulletsMarkdown(issue.briefing)}

${normalizedSections(issue).map(({ heading, section }) => publicArticleMarkdown(issue, heading, section)).join('\n---\n\n')}

## 참고자료

${sourceListMarkdown(issue.references)}
`;
}

function publicArticleHtml(issue, htmlHeading, headingCategory, className, section) {
  const publicArticle = publicArticleForSection(section);
  const perspectiveLabel = articlePerspectiveLabel(issue, section);
  const bodyParagraphs = bodyParagraphsForRender(publicArticle);
  return `      <section class="section">
        <h2>${escapeHtml(htmlHeading)}</h2>
        <div class="card issue-section article-card ${resolvedArticleImage(section) ? 'has-image' : 'has-fallback-image'} ${escapeHtml(className)}">
          ${articleMediaHtml(section, publicArticle)}
          ${articleTagsHtml(section, headingCategory)}
          <h3>${escapeHtml(publicArticle.headline)}</h3>
          <p class="article-lead">${escapeHtml(publicArticle.lead)}</p>
          ${bodyParagraphs.map(paragraphHtml).join('\n          ')}
          <div class="article-block"><strong class="article-block-title">${escapeHtml(perspectiveLabel)}</strong>${paragraphHtml(publicArticle.camera_hal_takeaway)}</div>
          <div class="article-block reader-checkpoints"><strong class="article-block-title">확인할 점</strong><ul>${bulletsHtml(publicArticle.reader_checkpoints)}</ul></div>
          <div class="source-list"><strong>출처</strong><ul>${sourceListHtml(publicArticle.source_links)}</ul></div>
        </div>
      </section>`;
}

function buildPublicHtml(issue) {
  const publicationNotice = publicationNoticeHtml(issue);
  const publicationNoticeBlock = publicationNotice ? `      ${publicationNotice}\n\n` : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(issue.title)}</title>
  <link rel="stylesheet" href="../../css/styles.css" />
</head>
<body>
  <header class="site-header">
    <nav class="site-nav content-wrap" aria-label="Primary navigation">
      <a class="site-brand" href="../../index.html">Camera HAL SW Newsletter</a>
      <div class="nav-links">
        <a href="../../index.html#latest">최신호</a>
        <a href="../../index.html#archive">아카이브</a>
        <a href="../../docs/news-sources.md">출처</a>
        <a href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>
      </div>
    </nav>
  </header>

  <main class="article-page">
    <article class="wrap">
      <header class="article-header">
        <div class="article-meta">
          <span class="issue-kicker">주간 뉴스레터</span>
          <span class="issue-date">${escapeHtml(issue.date)}</span>
        </div>
        <h1>Camera HAL SW Newsletter</h1>
        <p class="subtitle">${escapeHtml(issue.summary)}</p>
        <div class="tag-row issue-tags">${tagsHtml(issueTags(issue))}</div>
        <div class="actions newsletter-actions issue-actions">
          <a class="button button-secondary" href="../../index.html#archive">아카이브로 돌아가기</a>
          <a class="button button-primary" href="newsletter.md">MD 원본 보기</a>
        </div>
      </header>

${publicationNoticeBlock}      <section class="section issue-briefing">
        <h2>1. 이번 주 3줄 브리핑</h2>
        <div class="card">
          <ul>${bulletsHtml(issue.briefing)}</ul>
        </div>
      </section>

${normalizedSections(issue).map(({ htmlHeading, headingCategory, className, section }) =>
    publicArticleHtml(issue, htmlHeading, headingCategory, className, section)
  ).join('\n\n')}

      <section class="section">
        <h2>참고자료</h2>
        <div class="card reference-list"><ul>${sourceListHtml(issue.references)}</ul></div>
      </section>

      <nav class="bottom-nav" aria-label="Issue navigation">
        <a class="button button-secondary" href="../../index.html#archive">아카이브로 돌아가기</a>
      </nav>
    </article>
  </main>
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

function buildReleaseQaReport(date, files, validateResult, factCheck, todoFound, emptySourceSections, qualityReport = null) {
  return `# 릴리스 QA 보고서 - ${date}

## 생성 파일 목록

${files.map(file => `- ${file}`).join('\n')}

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
