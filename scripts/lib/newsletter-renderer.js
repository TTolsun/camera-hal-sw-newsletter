const {
  renderCandidateSelectionDiagnostics
} = require('./selection-diagnostics');

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
  const title = source.title || source.url || 'Source';
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

function textOrBulletsMarkdown(value) {
  if (Array.isArray(value)) return bulletsMarkdown(value);
  return String(value || '').trim();
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
  const resolved = section.resolvedImage && section.resolvedImage.src ? section.resolvedImage : null;
  if (resolved) return resolved;
  if (!section.selectedImage) return null;
  return {
    src: section.selectedImage,
    usedFallback: false
  };
}

function articleImageMarkdown(section) {
  const image = resolvedArticleImage(section);
  if (!image || !image.src) return '';
  const attribution = section.imageAttribution || section.sources?.[0]?.title || 'Source article';
  const source = httpsUrlOrFallback(section.imageSource || section.sources?.[0]?.url, section.selectedImage);
  const alt = section.imageAlt || `${section.headline || 'Article'} image`;
  return `\n![${alt}](${image.src})\n\n_Image: [${attribution}](${source})_\n`;
}

function articleMediaHtml(section) {
  const image = resolvedArticleImage(section);
  if (image && image.src) {
    const imageSource = httpsUrlOrFallback(section.imageSource || section.sources?.[0]?.url, section.selectedImage);
    const attribution = section.imageAttribution || section.sources?.[0]?.title || 'Source article';
    const alt = section.imageAlt || `${section.headline || 'Article'} image`;
    return `<figure class="article-media">
            <img class="article-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
            <figcaption class="article-image-caption">Image: <a href="${escapeHtml(imageSource)}">${escapeHtml(attribution)}</a></figcaption>
          </figure>`;
  }

  const variant = slugClass(section.article_type || section.category || 'generic');
  return `<div class="article-media article-fallback-visual article-fallback-${escapeHtml(variant)}" role="img" aria-label="${escapeHtml(section.category || 'Article visual')}">
            <span></span>
          </div>`;
}

function articleFacts(section) {
  return ensureArray(section.confirmed_facts).length > 0 ? section.confirmed_facts : section.what_changed;
}

function articlePerspective(section) {
  return section.camera_hal_perspective || section.why_it_matters || '';
}

function articleActions(section) {
  const actions = ensureArray(section.action_items);
  return actions.length > 0 ? actions : ensureArray(section.action_hints);
}

function articleTeamSummary(section) {
  return section.team_summary || section.why_it_matters || '';
}

function issueTags(issue) {
  return ensureArray(issue.tags).length > 0 ? issue.tags : ['Camera HAL', 'Android', 'C++', 'AI'];
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
    const category = section.category || `Main Article ${index + 1}`;
    return {
      heading: `## ${index + 2}. ${category}`,
      htmlHeading: `${index + 2}. ${category}`,
      headingCategory: category,
      className: section.article_type || (section.is_ai_related ? 'ai' : 'article'),
      section
    };
  });
}

function buildMarkdown(issue) {
  return `# ${issue.title}

${issue.summary}

## 1. 이번 주 3줄 브리핑
${bulletsMarkdown(issue.briefing)}

${normalizedSections(issue).map(({ heading, section }) => `${heading}

### ${section.headline}
${articleImageMarkdown(section)}

**이번 주 확인한 사실**

${textOrBulletsMarkdown(articleFacts(section))}

**배경지식**

${section.background}

**Camera HAL 관점 해석**

${articlePerspective(section)}

**우리 팀이 확인할 Action Item**

${bulletsMarkdown(articleActions(section))}

**팀 공유용 한 줄**

${articleTeamSummary(section)}

**출처**

${sourceListMarkdown(section.sources)}
`).join('\n---\n\n')}

## 이번 주 실행 항목

${bulletsMarkdown(issue.action_items)}

## 참고자료

${sourceListMarkdown(issue.references)}
`;
}

function buildHtml(issue) {
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
        <a href="../../index.html#latest">최신</a>
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

      <section class="section issue-briefing">
        <h2>1. 이번 주 3줄 브리핑</h2>
        <div class="card">
          <ul>${bulletsHtml(issue.briefing)}</ul>
        </div>
      </section>

${normalizedSections(issue).map(({ htmlHeading, headingCategory, className, section }) => `      <section class="section">
        <h2>${escapeHtml(htmlHeading)}</h2>
        <div class="card issue-section article-card ${resolvedArticleImage(section) ? 'has-image' : 'has-fallback-image'} ${escapeHtml(className)}">
          ${articleMediaHtml(section)}
          ${articleTagsHtml(section, headingCategory)}
          <h3>${escapeHtml(section.headline)}</h3>
          <div class="article-block"><strong class="article-block-title">확인한 사실</strong>${Array.isArray(articleFacts(section)) ? `<ul>${bulletsHtml(articleFacts(section))}</ul>` : paragraphHtml(articleFacts(section))}</div>
          <div class="article-block"><strong class="article-block-title">배경지식</strong>${paragraphHtml(section.background)}</div>
          <div class="article-block"><strong class="article-block-title">Camera HAL 관점</strong>${paragraphHtml(articlePerspective(section))}</div>
          <div class="article-block"><strong class="article-block-title">실행 항목</strong><ul>${bulletsHtml(articleActions(section))}</ul></div>
          <div class="article-block"><strong class="article-block-title">팀 공유 포인트</strong>${paragraphHtml(articleTeamSummary(section))}</div>
          <div class="source-list"><strong>출처</strong><ul>${sourceListHtml(section.sources)}</ul></div>
        </div>
      </section>`).join('\n\n')}

      <section class="section">
        <h2>이번 주 실행 항목</h2>
        <div class="card action-card"><ul>${bulletsHtml(issue.action_items)}</ul></div>
      </section>

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

function buildEditorChiefBrief(date, issue, factCheck, qualityReport = null, selectionDiagnostics = null) {
  const firstSection = ensureArray(issue.sections)[0] || {};
  const decision = factCheck.status === 'PASS' && (!qualityReport || qualityReport.status === 'PASS')
    ? 'APPROVE'
    : 'REQUEST_CHANGES';
  return `# 편집장 브리프 - ${date}

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
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  ensureArray
};
