const { ensureArray } = require('../../shared/common/value-coercion');
const { canonicalBucket, compareEditorialPriority } = require('../../shared/domain/aosp-camera-scope');
const { isFallbackImagePath } = require('../../shared/render/image-candidates');
const { publicArticleForSection } = require('../reporter/public-article-contract');
const { uniqueArticleAnchorId } = require('../reporter/article-anchor');
const { sectionIdentity } = require('../reporter/weekly-duplicate-merge');

function localizedImagePath(value, locale = 'ko') {
  return locale === 'en' && /^\.\.\/\.\.\//.test(value) ? `../${value}` : value;
}

function resolvedArticleImage(section, locale = 'ko') {
  const resolved = section.resolvedImage && (section.resolvedImage.url || section.resolvedImage.src) ? section.resolvedImage : null;
  if (resolved) {
    return {
      ...resolved,
      src: localizedImagePath(resolved.url || resolved.src, locale)
    };
  }
  if (!section.selectedImage) return null;
  return {
    src: localizedImagePath(section.selectedImage, locale),
    usedFallback: false
  };
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

const BUCKET_TOPIC_TAGS = {
  direct_aosp_camera: ['Camera HAL'],
  camera_driver_image_pipeline: ['Driver', 'Image Processing'],
  android: ['Android'],
  generic_tech_watchlist: []
};

// 드라이버 기사의 주제가 SoC 에 통합된 카메라 블록인지 가르는 제목 어휘. 외부 센서 드라이버(Sony IMX,
// Himax, onsemi 등)는 Driver 로만 두고, SoC 카메라 서브시스템·ISP 블록이나 SoC 플랫폼 카메라 지원이면
// SoC Platform 을 함께 붙인다(#1250 CAMSS 사례). 공개 주제 태그 전용이다. 수집 분류의
// counts_as_soc_topic 과 구성 게이트(counts.soc)는 바꾸지 않으므로 선정·발행 구성에는 영향이 없다.
// Samsung·Sony 처럼 센서도 만드는 회사 이름은 넣지 않는다(S5KJN5 같은 센서 기사가 걸린다).
const SOC_CAMERA_BLOCK_TITLE_PATTERNS = [
  /\bSoC\b/i,
  /\bcamss\b/i,
  /\brkisp\d*\b/i,
  /\batomisp\b/i,
  /\bmtk[-_]?(?:isp|cam)\b/i,
  /\bipu[367]\b/i,
  /\bMali[-\s]?C\d{2}\b/i,
  // \uD50C\uB7AB\uD3FC 은 한국어 제목의 '플랫폼'이다(렌더러 소스에는 한국어 리터럴을 두지 않는다).
  /\b(?:Qualcomm|MediaTek|Rockchip|Renesas|Snapdragon|Exynos)\b[^.\n]{0,60}(?:platform|\uD50C\uB7AB\uD3FC)/i
];

// watchlist 로 남은 옛 Tooling Watch 기사 중 제목이 C++ 언어·툴체인을 다루는 것(GCC 16, C++26 등).
// 본문의 지나가는 언급이 아니라 제목, 곧 기사 주제로만 판정한다.
const CPP_TITLE_PATTERNS = [
  /\bC\+\+/i,
  /\blibc\+\+/i,
  /\bGCC\b/i,
  /\bLLVM\b/i,
  /\bClang\b/i
];

function sectionTitle(section) {
  return String(section.headline || section.title || '');
}

function titleMatches(section, patterns) {
  const title = sectionTitle(section);
  return patterns.some(pattern => pattern.test(title));
}

// 기사 한 건이 얻는 주제 태그. 기사에 근거가 없는 주제는 붙이지 않는다.
//  - android bucket 은 SoC 플랫폼 기사(counts_as_soc_topic)면 SoC Platform, 아니면 Android.
//  - cpp_ai_tooling_fallback bucket 은 C++ 도구와 AI 도구를 함께 담는다. 편집 단계가 채우는
//    is_ai_related 가 false 면 C++, 그 밖에는(true 이거나 이 필드가 없던 옛 기사) AI.
//  - camera_driver_image_pipeline bucket 은 제목이 SoC 카메라 블록을 다루면 SoC Platform 을 더한다.
//  - generic_tech_watchlist bucket 은 AI 기사가 아니고 제목이 C++ 언어·툴체인을 다루면 C++.
function articleTopicTags(section) {
  const bucket = canonicalBucket(sectionRelevanceBucket(section));
  if (bucket === 'android' && section.counts_as_soc_topic === true) return ['SoC Platform'];
  if (bucket === 'cpp_ai_tooling_fallback') return section.is_ai_related === false ? ['C++'] : ['AI'];
  if (bucket === 'camera_driver_image_pipeline' && titleMatches(section, SOC_CAMERA_BLOCK_TITLE_PATTERNS)) {
    return [...BUCKET_TOPIC_TAGS[bucket], 'SoC Platform'];
  }
  if (bucket === 'generic_tech_watchlist' && section.is_ai_related !== true && titleMatches(section, CPP_TITLE_PATTERNS)) {
    return ['C++'];
  }
  return BUCKET_TOPIC_TAGS[bucket] || [];
}

// 그 주 기사(section)들의 주제를 archive/home 카드 topic 태그로 집계한다. lead 기사 topic 을 앞에
// 두어 카드 kicker(tags[0]) 로 삼고, 중복은 제거한다. 이슈 레벨 editor.tags 에 의존하지 않고 기사에
// 근거가 있는 주제만 싣기 때문에, 해당 기사가 없는 주간호는 그 주제 필터에서 빠진다.
function weeklyTopicTags(sections = []) {
  return [...new Set(ensureArray(sections).flatMap(articleTopicTags))];
}

function orderedArticleSections(issue) {
  const usedAnchors = new Set();
  const ordered = ensureArray(issue.sections)
    .map((section, originalIndex) => ({ section, originalIndex }))
    .sort((a, b) => {
      if (issue.weekly_key) return a.originalIndex - b.originalIndex;
      const aCatch = a.section.coverage_type === 'catch_up' ? 1 : 0;
      const bCatch = b.section.coverage_type === 'catch_up' ? 1 : 0;
      return aCatch - bCatch || compareEditorialPriority(a.section, b.section) || a.originalIndex - b.originalIndex;
    });
  return ordered.map(({ section }, index) => {
    const publicArticle = publicArticleForSection(section, { issue });
    const category = publicArticle.headline || `Main Article ${index + 1}`;
    return { section, publicArticle, category, anchorId: uniqueArticleAnchorId(category, index, usedAnchors), articleNumber: index + 1 };
  });
}

// Public projection only: input already carries final order and locale prose.
function articleDisplayRows(issue, { locale = 'ko', issueHref } = {}) {
  if (!['ko', 'en'].includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
  const prefix = locale === 'en' ? 'en/' : '';
  if (typeof issueHref !== 'string' || !new RegExp(`^${prefix}newsletters/[0-9]{4}-(?:W[0-9]{2}|[0-9]{2}-[0-9]{2})/index\\.html$`).test(issueHref)) {
    throw new Error('Invalid relative issueHref');
  }
  return orderedArticleSections(issue).map(({ section, publicArticle, anchorId }) => {
    const resolved = resolvedArticleImage(section, locale);
    let src = resolved?.src || '';
    if (src.startsWith('assets/')) {
      // Already site-root relative.
    } else if (/^(?:\.\.\/)+assets\//.test(src)) {
      const base = new URL(issueHref, 'https://newsletter.invalid/');
      const url = new URL(src, base);
      src = url.pathname.slice(1);
    } else if (/^https:\/\//i.test(src)) {
      try {
        const url = new URL(src);
        if (url.username || url.password) src = '';
      } catch { src = ''; }
    } else { src = ''; }
    if (src && !/^https:\/\//i.test(src) && (!src.startsWith('assets/') || /(?:^|\/)\.\.(?:\/|$)|[\\?#]/.test(src))) src = '';
    const fallback = isFallbackImagePath(src);
    return {
      id: section.id !== undefined ? section.id : sectionIdentity(section),
      href: `${issueHref}#${anchorId}`,
      headline: publicArticle.headline,
      lead: publicArticle.lead,
      takeaway: publicArticle.camera_hal_takeaway,
      tags: [...articleTopicTags(section)],
      image: src ? { src, alt: fallback ? '' : section.imageAlt || `${publicArticle.headline || section.headline || 'Article'} image`, is_fallback: fallback } : null
    };
  });
}

module.exports = { articleDisplayRows, orderedArticleSections, resolvedArticleImage, sectionRelevanceBucket, weeklyTopicTags };
