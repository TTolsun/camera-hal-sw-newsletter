const { ensureArray } = require('../../shared/common/value-coercion');
const { loreThreadUrl } = require('../../shared/common/article-groups');
const { isFallbackImagePath } = require('../../shared/render/image-candidates');
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
  publicArticleForSection,
  storyContractMarkers
} = require('../reporter/public-article-contract');
const {
  parseBodyBlocks
} = require('../reporter/public-body-markdown');
const {
  usesBodyMarkdown
} = require('../../shared/common/story-contract-version');
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

// 그림이 repo 안의 fallback 그림인지 봅니다. fallback 그림은 어느 기사 출처에서도 오지
// 않았으므로 출처 캡션을 붙이면 안 됩니다. 붙이면 그 기사에서 가져온 그림처럼 보입니다.
//
// 판정 기준은 "최종적으로 렌더되는 경로"입니다. resolvedImage.usedFallback 플래그는 쓰지
// 않습니다. 두 가지 이유가 있습니다.
//
// 1. 플래그로는 못 잡는 형태가 실제 발행물에 있습니다. selectedImage가 이미 fallback
//    경로인데 usedFallback은 false인 기사가 있고, 그런 기사에도 출처 캡션이 붙어 있었습니다.
// 2. 반대로 플래그를 함께 보면 렌더러와 게이트의 답이 갈립니다. 게이트는 렌더된 HTML만
//    보므로 경로로 판정할 수밖에 없는데, 렌더러만 플래그를 더 보면 "플래그는 true인데 경로는
//    fallback이 아닌" 그림에서 렌더러는 캡션을 빼고 게이트는 캡션을 요구해 발행이 막힙니다.
//
// 그래서 렌더러와 게이트가 같은 함수 하나로 판정합니다.
function articleImageMarkdown(section, publicArticle = null) {
  const image = resolvedArticleImage(section);
  if (!image || !image.src) return '';
  const alt = section.imageAlt || `${publicArticle?.headline || section.headline || 'Article'} image`;
  if (isFallbackImagePath(image.src)) {
    return `\n![${alt}](${image.src})\n`;
  }
  const attribution = section.imageAttribution || section.sources?.[0]?.title || '출처 기사';
  const source = articleImageSource(section);
  return `\n![${alt}](${image.src})\n\n_이미지: [${attribution}](${source})_\n`;
}

function articleMediaHtml(section, publicArticle = null) {
  const image = resolvedArticleImage(section);
  if (image && image.src) {
    const alt = section.imageAlt || `${publicArticle?.headline || section.headline || 'Article'} image`;
    const imageHtml = `<img class="article-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
    if (isFallbackImagePath(image.src)) {
      return `<figure class="article-media">
            ${imageHtml}
          </figure>`;
    }
    const imageSource = articleImageSource(section);
    const attribution = section.imageAttribution || section.sources?.[0]?.title || '출처 기사';
    return `<figure class="article-media">
            ${imageHtml}
            <figcaption class="article-image-caption">이미지: <a href="${escapeHtml(imageSource)}">${escapeHtml(attribution)}</a></figcaption>
          </figure>`;
  }

  // placeholder 는 패턴 하나다(DESIGN.md). 기사 종류별 variant 클래스는 붙이지 않는다 —
  // article_type·category 는 LLM 자유 텍스트라 클래스 어휘가 닫히지 않고, 스타일 차이도 없었다.
  return `<div class="article-media article-placeholder-visual" role="img" aria-label="${escapeHtml(publicVisualLabel(section.category))}">
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

// mockup 카테고리 눈썹 라벨: relevance bucket -> 표시 라벨.
const ARTICLE_CATEGORY_LABELS = {
  direct_aosp_camera: 'AOSP Camera',
  camera_driver_image_pipeline: 'Camera Driver · ISP',
  android_platform_camera_adjacent: 'Android Platform',
  cpp_ai_tooling_fallback: 'C++ · AI Tooling',
  soc_platform_signal: 'SoC Platform',
  android_multimedia_camera_output: 'Android Multimedia',
  generic_tech_watchlist: 'Tooling Watch'
};

// bucket 은 sectionRelevanceBucket 이 8개 필드 변형에서 해석한다. article_type 은
// 예전 아티팩트가 bucket 값을 article_type 에 실었던 경우를 위한 보조 키다.
function articleCategoryLabel(section = {}) {
  return ARTICLE_CATEGORY_LABELS[sectionRelevanceBucket(section)] ||
    ARTICLE_CATEGORY_LABELS[String(section.article_type || '').trim()] ||
    'Camera';
}

// relevance bucket -> archive/home 카드 topic 태그. archive 필터 TOPICS(Camera HAL / Android /
// Driver / Image Processing / AI / SoC Platform) 값에 맞춘다. 각 리스트의 첫 항목이 그 bucket 의
// primary topic 이고, lead 기사(첫 section)의 primary 가 카드 kicker(tags[0]) 가 된다.
// generic_tech_watchlist 는 topic 이 아니라 편집 상태 마커라 비워 둔다.
const BUCKET_TOPIC_TAGS = {
  direct_aosp_camera: ['Camera HAL'],
  camera_driver_image_pipeline: ['Driver', 'Image Processing'],
  android_platform_camera_adjacent: ['Android'],
  android_multimedia_camera_output: ['Android', 'Image Processing'],
  soc_platform_signal: ['SoC Platform'],
  cpp_ai_tooling_fallback: ['AI'],
  generic_tech_watchlist: []
};

// 모든 카메라 뉴스레터가 공통으로 걸치는 baseline topic — 카드 필터가 항상 잡도록 맨 뒤에 붙인다.
const BASELINE_TOPIC_TAGS = ['Camera HAL', 'Android'];

// 그 주 기사(section)들의 relevance bucket 을 archive/home 카드 topic 태그로 집계한다. lead 기사
// topic 을 앞에 두어 카드 kicker(tags[0]) 로 삼고, 나머지 기사 topic, 마지막에 baseline 순으로
// 중복을 제거한다. 이슈 레벨 editor.tags(대개 ['Camera HAL','Android'] 기본값)에 의존하지 않으므로
// Driver·Image Processing·AI·SoC Platform 필터가 실제로 채워지고 카드 kicker 가 다양화된다.
function weeklyTopicTags(sections = []) {
  const ordered = [];
  for (const section of ensureArray(sections)) {
    for (const tag of BUCKET_TOPIC_TAGS[sectionRelevanceBucket(section)] || []) {
      ordered.push(tag);
    }
  }
  return [...new Set([...ordered, ...BASELINE_TOPIC_TAGS])];
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

// coverage 필드 3개(coverage_week_key/coverage_start_date/coverage_end_date, optional)가 모두
// 유효할 때만 coverage 표시를 쓴다. issueWeekLabel과 issueKickerText가 이 판정을 각자 따로 하면
// 하나만 채워진 경우(예: week_key만 있고 날짜가 없음) 라벨은 대상 주, range는 발행 주를 가리키는
// 화면 불일치가 생긴다 — 한 함수로 모아 라벨·range가 항상 같은 소스(coverage 전체 또는 발행 주
// 전체)를 쓰게 한다.
//
// coverage_mode는 discriminated union이다(리뷰 fix 3). legacy_rolling은 실제 ISO 주가 아닌
// rolling 조회 범위일 뿐이라 주 라벨을 붙일 근거가 없다 — key: null로 돌려주고 날짜만 채운다.
// 호출부(issueWeekLabel)가 key가 없으면 발행 주(weekly_key)로 폴백하고, 날짜(issueKickerText)는
// 그대로 rolling 범위를 쓴다.
function issueCoverageDisplay(issue = {}) {
  const key = String(issue.coverage_week_key || '').trim();
  const start = String(issue.coverage_start_date || '').trim();
  const end = String(issue.coverage_end_date || '').trim();
  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  if (issue.coverage_mode === 'legacy_rolling') {
    return datesValid ? { key: null, start, end } : null;
  }
  const keyValid = /^\d{4}-W\d{2}$/.test(key);
  return (keyValid && datesValid) ? { key, start, end } : null;
}

// 표시 계약 v2: 이슈 페이지(HTML)도 발행 identity(weekly_key)와 대상 identity(coverage)를 항상
// 함께 보여준다. 세 variant는 카드(articles/assets/js/newsletter-archive.js entryCoverageVariant)와
// 같은 판정을 쓴다 — 판정 기준이 갈리면 카드와 이슈 페이지가 서로 다른 표시를 보여준다.
//
// - iso_week: coverage 3필드가 모두 유효. 제목/kicker는 issueCoverageDisplay(위)가 이미 대상
//   주로 바꿔치기하므로 여기서는 "발행 WNN" 보조 배지만 추가한다.
// - legacy_rolling: 실제 ISO 주가 아닌 rolling 조회 범위라 대상엔 날짜만 있다. kicker에 "대상"
//   접두를 붙인다(제목은 이미 issueCoverageDisplay가 rolling range로 바꿔치기했으므로 그대로 둔다).
// - unverified: coverage_mode가 명시적으로 unverified이거나, weekly_key가 있는데 coverage 필드가
//   통째로 없다. 이 경우 issueCoverageDisplay는 null을 돌려주고 kicker/제목은 발행 주의 실제
//   달력 날짜로 폴백하는데, 그 날짜를 "대상 기간"인 것처럼 보여주면 모르는 기간을 아는 것처럼
//   꾸미는 셈이다 — 그래서 이 variant에서만 별도로 "대상 기간 미확인"으로 바꿔 보여준다.
//
// coverage 필드가 부분적으로만 있는 경우와 daily-era issue(weekly_key가 아예 없음)는 이
// discriminated union 밖이다 — 기존 폴백(발행 주 표시 그대로)을 그대로 둔다.
function issueCoverageVariant(issue = {}) {
  const mode = issue.coverage_mode;
  const key = String(issue.coverage_week_key || '').trim();
  const start = String(issue.coverage_start_date || '').trim();
  const end = String(issue.coverage_end_date || '').trim();
  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  const keyValid = /^\d{4}-W\d{2}$/.test(key);
  const hasAnyCoverageField = Boolean(key || start || end);

  if (mode === 'legacy_rolling') {
    return datesValid ? { variant: 'legacy_rolling', start, end } : null;
  }
  if (mode === 'unverified') {
    return { variant: 'unverified' };
  }
  if (keyValid && datesValid) {
    return { variant: 'iso_week', key, start, end };
  }
  if (!hasAnyCoverageField && String(issue.weekly_key || '').trim()) {
    return { variant: 'unverified' };
  }
  return null;
}

// iso_week variant에서만 "발행 WNN" 배지를 보여준다 — legacy_rolling/unverified는 제목이나
// kicker가 이미 발행 주 기준으로 남아 있어서 별도 배지가 발행 identity를 중복 표시할 뿐이다.
function issuePublishedWeekBadgeText(issue = {}) {
  const variant = issueCoverageVariant(issue);
  if (!variant || variant.variant !== 'iso_week') return '';
  const weeklyKey = String(issue.weekly_key || '').trim();
  return /^\d{4}-W\d{2}$/.test(weeklyKey) ? `발행 ${weeklyKey.slice(5)}` : '';
}

// Weekly issues are labeled by ISO week ("2026-W22" -> "2026 W22"); daily issues fall back to date.
// coverage(대상 주)가 유효하면 그것을 우선 쓴다 — 발행 identity(weekly_key)는 그대로 두고 표시만
// 대상 주로 바꾼다. 없으면(과거호·전환 전, 또는 legacy_rolling이라 key가 없으면) 기존 weekly_key
// 표시를 그대로 유지한다.
function issueWeekLabel(issue = {}) {
  const coverage = issueCoverageDisplay(issue);
  const key = (coverage && coverage.key) || String(issue.weekly_key || '').trim();
  return /^\d{4}-W\d{2}$/.test(key) ? key.replace('-W', ' W') : '';
}

// Weekly issue hero kicker shows the week's date range in the mockup format ("2026.05.25 – 05.31").
// 연말처럼 주가 연도를 걸치면 끝 날짜의 연도를 생략하지 않는다.
// coverage(대상 주)가 유효하면 그것으로 range를 만든다 — issueWeekLabel과 같은 판정을 쓴다.
//
// 표시 계약 v2: unverified variant는 발행 주의 실제 날짜를 대상 기간인 것처럼 보여주지 않고
// "대상 기간 미확인"으로 바꾼다. legacy_rolling은 실제 ISO 주가 아닌 rolling 범위임을 밝히려고
// "대상 " 접두를 붙인다. iso_week는 기존 표시(접두 없는 range) 그대로다 — 카드와 달리 이슈
// 페이지는 h1 옆 "발행 WNN" 배지가 따로 발행 identity를 맡는다.
function issueKickerText(issue = {}) {
  const dot = value => String(value).replace(/-/g, '.');
  const variant = issueCoverageVariant(issue);
  if (variant && variant.variant === 'unverified') {
    return '대상 기간 미확인';
  }
  const coverage = issueCoverageDisplay(issue);
  const start = coverage ? coverage.start : String(issue.week_start_date || '').trim();
  const end = coverage ? coverage.end : String(issue.week_end_date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    const range = `${dot(start)} – ${sameYear ? dot(end).slice(5) : dot(end)}`;
    const prefix = (variant && variant.variant === 'legacy_rolling') ? '대상 ' : '';
    return `${prefix}${range}`;
  }
  return `주간 뉴스레터 ${issue.date || ''}`.trim();
}

// 표시 계약 v2: iso_week variant만 "(발행 WNN)" 접미를 붙인다 — 브라우저 탭 제목/공유 카드에서도
// 대상 주(제목의 주 라벨)와 발행 주가 다르다는 것을 알 수 있게 한다. 그 외 variant는 기존 그대로다.
function issuePageTitle(issue = {}) {
  const weekLabel = issueWeekLabel(issue);
  if (weekLabel) {
    const badge = issuePublishedWeekBadgeText(issue);
    return `${weekLabel} Camera SW Newsletter${badge ? ` (${badge})` : ''}`;
  }
  const date = issueDisplayDate(issue);
  return date ? `Camera SW Newsletter - ${date}` : 'Camera SW Newsletter';
}

// 표시 계약 v2: unverified variant는 h1 자체에 "(대상 기간 미확인)"을 덧붙인다. iso_week/
// legacy_rolling은 h1 문구를 바꾸지 않는다(둘 다 issueWeekLabel이 이미 옳은 주 라벨을 고른다).
function issueTitleHtml(issue = {}) {
  const weekLabel = issueWeekLabel(issue);
  if (weekLabel) {
    const variant = issueCoverageVariant(issue);
    const suffix = (variant && variant.variant === 'unverified') ? ' (대상 기간 미확인)' : '';
    return `<span>${escapeHtml(weekLabel + suffix)}</span>`;
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
          <a class="footer-link" href="${root}learning/ai-engineering/index.html">AI Engineering Lab</a>
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
    .map(({ htmlHeading, headingCategory, anchorId, articleNumber, section, isCatchUp }) => {
      let prefix = '';
      if (isCatchUp && !dividerEmitted) {
        prefix = `      <h2 class="catch-up-divider">${escapeHtml(CATCH_UP_DIVIDER_HEADING)}</h2>\n`;
        dividerEmitted = true;
      }
      return prefix + publicArticleHtml(issue, htmlHeading, headingCategory, anchorId, articleNumber, section);
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

// 렌더 분기는 **계약 마커가 선언한 버전**으로 정한다. 정규화된 필드의 유무로 정하면
// "버전은 v2인데 본문이 비었다"가 조용히 v1 경로로 흘러 본문 0문단 기사가 발행된다 —
// 이 모듈이 막으려는 무음 다운렌더와 같은 부류다.
//
// 미지원 버전과 빈 본문은 둘 다 render 진입에서 throw한다. 정상 경로는 validation이
// 먼저 차단하는 것이고 이 throw는 최후 방어선이다. 판정은 새로 만들지 않고 계약 모듈의
// 마커 판정(storyContractMarkers)과 버전 술어(usesBodyMarkdown)를 그대로 쓴다.
//
// **이 방어선의 범위**: 마커가 한 버전을 가리키거나(정상) 지원 밖 값일 때(throw)를 덮는다.
// 마커 2개가 서로 다른 버전을 가리키는 조합은 계약 모듈이 unsupported가 아니라 mismatch로
// 분류하고, 여기서는 생산자 기본값(v1)으로 폴백한다 — 그 상태는 상류 validateEditor가
// story_contract_version_mismatch로 이미 차단한다. mismatch까지 render에서 throw로 올리면
// 마커가 부분적인 **과거 발행분 재렌더**(syncWeeklyArticleImages)가 깨지므로 넓히지 않는다.
function unsupportedContractDetail(item) {
  // family mismatch 항목에는 value가 없고 선언된 세 버전이 각각 실려 온다. value만 읽으면
  // 발행이 막힌 이유가 `(story_contract_version=undefined)`로 지워진다.
  if (item.value !== undefined) return `${item.type}(${item.key}=${item.value})`;
  const declared = ['public_contract_version', 'generation_contract_version', 'story_contract_version']
    .filter(key => item[key] !== undefined)
    .map(key => `${key}=${item[key]}`)
    .join(' ');
  return `${item.type}(${declared || item.key})`;
}

function storyContractRenderVersion(issue, section) {
  const markers = storyContractMarkers(issue, section);
  if (markers.hasUnsupportedMarker) {
    const detail = markers.unsupported.map(unsupportedContractDetail).join(', ');
    throw new Error(`newsletter-renderer: refusing to render an unsupported story contract — ${detail}`);
  }
  return markers.version;
}

function assertRenderableBody(publicArticle, storyContractVersion) {
  if (!usesBodyMarkdown(storyContractVersion)) return;
  const body = publicArticle.body_markdown;
  if (typeof body === 'string' && body.trim() !== '') return;
  throw new Error('newsletter-renderer: refusing to render a story contract '
    + `v${storyContractVersion} article with an empty body_markdown (headline=${publicArticle.headline || 'unknown'})`);
}

function storyV2BodyHtml(publicArticle) {
  return parseBodyBlocks(publicArticle.body_markdown)
    .map(block => (block.type === 'subheading'
      ? `        <h3 class="article-subheading">${escapeHtml(block.text)}</h3>`
      : `        ${paragraphHtml(block.text)}`))
    .join('\n');
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

// 기사 markdown 셸은 하나뿐이다. 버전별로 다른 것은 본문 식과 출처 서브타이틀 유무이고,
// 셸을 복제하면 v1 바이트 불변을 사람이 눈으로 맞춰야 한다(해시 잠금이 그것을 검사한다).
function articleBodyMarkdown(publicArticle, storyContractVersion) {
  if (usesBodyMarkdown(storyContractVersion)) {
    // 정본은 계약 모듈이 정규화해 둔 문자열이다. 여기서 다시 손대면 lint가 본 문자열과
    // 렌더되는 문자열이 갈린다.
    return publicArticle.body_markdown;
  }
  const paragraphs = isStoryArticle(publicArticle)
    ? storyBodyParagraphsForRender(publicArticle)
    : bodyParagraphsForRender(publicArticle);
  return paragraphs.join('\n\n');
}

function publicArticleMarkdown(issue, heading, section) {
  const storyContractVersion = storyContractRenderVersion(issue, section);
  const publicArticle = publicArticleForSection(section, { issue });
  assertRenderableBody(publicArticle, storyContractVersion);
  const perspectiveHeading = articlePerspectiveHeading(issue, section);
  const sourceSubtitle = publicArticle.source_subtitle
    ? `_${publicArticle.source_subtitle}_\n\n`
    : '';
  return `${heading}

${articleImageMarkdown(section, publicArticle)}

${sourceSubtitle}${publicArticle.lead}

${articleBodyMarkdown(publicArticle, storyContractVersion)}

### ${perspectiveHeading}

${publicArticle.camera_hal_takeaway}

**출처**

${sourceListMarkdown(publicArticle.source_links)}
`;
}

// CONTEXT 모드 표시는 라벨이지 문장이 아니다(#856).
//
// publish_mode 는 compositionSummary 카운트만 보고 정해지는 파이프라인 내부 판정이라, 그 값이
// 그 기간에 실제로 무슨 일이 있었는지를 보증하지 못한다. 예전에는 이 자리에서 "이번 기간 카메라
// 코어 직접 변경은 없었습니다" 라는 기간-수준 사실 주장을 인쇄했고, 2026-W26 은 V4L2 이미지 센서
// 드라이버 기사(정확히 카메라 코어 변경) 바로 위에 그 문장을 실었다. LLM 이 쓴 적도 팩트체커가
// 검증한 적도 없는 문장이었다.
//
// 그래서 코드가 직접 쓰는 문자열은 참/거짓을 가릴 수 있는 명제가 아니라, 그 호를 어떤 관점으로
// 읽는지만 알리는 관점 라벨로 제한한다. 사실 주장은 LLM 이 쓰고 팩트체커가 검증하는 본문 몫이다.
const CONTEXT_LENS_LABEL = '실무 레이더 관점';
const WATCH_POINTS_HEADING = '다음 관전 포인트';

function hasWatchPoints(issue) {
  return Array.isArray(issue?.watch_points) && issue.watch_points.length > 0;
}

function isContextPublishMode(issue) {
  return issue?.publish_mode === 'CONTEXT';
}

function contextLensLabelMarkdown(issue) {
  if (!isContextPublishMode(issue)) return '';
  return `\n**${CONTEXT_LENS_LABEL}**\n`;
}

function watchPointsMarkdown(issue) {
  if (!hasWatchPoints(issue)) return '';
  return `## ${WATCH_POINTS_HEADING}

${bulletsMarkdown(issue.watch_points)}

`;
}

function contextLensLabelHtml(issue) {
  if (!isContextPublishMode(issue)) return '';
  return `\n      <section class="section issue-context-lens-label" role="note">
        <p class="issue-context-lens-label-text">${escapeHtml(CONTEXT_LENS_LABEL)}</p>
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
${contextLensLabelMarkdown(issue)}
${sectionsMarkdownWithCatchUpDivider(issue)}

${watchPointsMarkdown(issue)}${referenceArticlesMarkdown(issue)}## 참고자료

${sourceListMarkdown(issue.references)}
`;
}

// mockup 기사 흐름: [번호+카테고리 눈썹] → 제목 → 출처 서브타이틀 → 이미지 → 리드 → 본문 →
// 관점 박스 → 출처. 카드 프레임 없이 섹션 자체가 hairline 으로 구분된다.
function publicArticleHtml(issue, htmlHeading, headingCategory, anchorId, articleNumber, section) {
  const storyContractVersion = storyContractRenderVersion(issue, section);
  const publicArticle = publicArticleForSection(section, { issue });
  assertRenderableBody(publicArticle, storyContractVersion);
  const perspectiveHeading = articlePerspectiveHeadingHtml();
  const storyV2 = usesBodyMarkdown(storyContractVersion);
  const sourceSubtitle = publicArticle.source_subtitle
    ? `        <p class="article-source-subtitle">${escapeHtml(publicArticle.source_subtitle)}</p>`
    : '';
  const displayNumber = String(articleNumber).padStart(2, '0');
  const mediaHtml = articleMediaHtml(section, publicArticle)
    .split('\n')
    .map(line => `        ${line.trimStart()}`)
    .join('\n');
  const bodyBlocksHtml = storyV2
    ? [storyV2BodyHtml(publicArticle)]
    : (isStoryArticle(publicArticle)
      ? storyBodyParagraphsForRender(publicArticle)
      : bodyParagraphsForRender(publicArticle)
    ).map(paragraph => `        ${paragraphHtml(paragraph)}`);
  const articleBodyBlocks = [
    sourceSubtitle,
    mediaHtml,
    `        <p class="article-lead">${escapeHtml(publicArticle.lead)}</p>`,
    ...bodyBlocksHtml
  ].filter(Boolean).join('\n');
  const articleTypeClass = storyV2 || isStoryArticle(publicArticle) ? ' story-article' : '';
  const articleImageClass = resolvedArticleImage(section) ? 'has-image' : 'has-placeholder-image';
  const articleTags = articleTagsHtml(section, headingCategory);
  const articleTagsBlock = articleTags ? `\n        ${articleTags}` : '';
  // 클래스는 결정론 훅만 붙인다. article_type(LLM 자유 텍스트)을 클래스로 찍으면
  // "Android Camera / Platform API" 처럼 공백·슬래시가 든 값이 class 속성에 그대로 들어간다.
  return `      <section class="section issue-story issue-section article-card${articleTypeClass} ${articleImageClass}" id="${escapeHtml(anchorId)}" aria-labelledby="${escapeHtml(anchorId)}-title">
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

// 표시 계약 v2: iso_week variant일 때만 h1 아래 "발행 WNN" 보조 배지를 붙인다(대상 주 제목과
// 발행 주가 갈릴 때 두 identity를 함께 보여줘 아카이브 카드-이슈 페이지 표시가 어긋나지 않게 한다).
function issueHeroHtml(issue) {
  const publishedWeekBadge = issuePublishedWeekBadgeText(issue);
  const publishedWeekBadgeHtml = publishedWeekBadge
    ? `\n        <p class="issue-publish-badge">${escapeHtml(publishedWeekBadge)}</p>`
    : '';
  return `<header class="article-header issue-hero">
        <a class="issue-back" href="../../index.html">← 뉴스룸</a>
        <div class="article-meta issue-hero-meta">
          <span class="issue-kicker">${escapeHtml(issueKickerText(issue))}</span>
        </div>
        <h1 class="issue-title">${issueTitleHtml(issue)}</h1>${publishedWeekBadgeHtml}
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
${contextLensLabelHtml(issue)}
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
  sectionRelevanceBucket,
  weeklyTopicTags
};
