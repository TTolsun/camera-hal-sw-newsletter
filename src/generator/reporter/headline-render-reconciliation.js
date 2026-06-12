const { ensureArray } = require('../../core/common/value-coercion');
const fs = require('fs');
const path = require('path');

const {
  decodeHtml
} = require('../../core/common/common');
const {
  articleIdentityKey,
  normalizeArticleUrl
} = require('../../core/common/article-identity');
const {
  uniqueArticleAnchorId
} = require('./article-anchor');
const {
  computeHeadlineScore,
  headlineSnapshotFromCandidate,
  isHeadlineEligible,
  normalizeHeadlineImageUrl
} = require('./homepage-headline');

// 저장된 homepage-headline 상태를 실제로 렌더된 공개 뉴스레터
// (newsletters/<date>/index.html)에 맞춰 reconcile한다. article anchor는 LLM이 만든
// 영문 헤드라인에서 파생되어 실행마다 달라질 수 있으므로, retained 헤드라인 스냅샷의
// newsletter_article_url anchor가 새로 렌더된 이슈에 없을 수 있다. validate-site는 그
// anchor가 존재할 것을 요구하므로, generate 파이프라인과 public-artifact ensure 단계 모두
// 상태를 쓰고 검증하기 전에 헤드라인을 render에 맞춰 reconcile한다.

function stripHtml(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function matchFirst(value, pattern) {
  const match = String(value || '').match(pattern);
  return match ? match[1] : '';
}

function readRenderedNewsletterArticles(root, date) {
  const htmlPath = path.join(root, 'newsletters', date, 'index.html');
  if (!fs.existsSync(htmlPath)) return [];
  const html = fs.readFileSync(htmlPath, 'utf8');
  const usedAnchors = new Set();
  let articleIndex = 0;
  return [...html.matchAll(/<section\b([^>]*)>[\s\S]*?<\/section>/gi)]
    .map(match => {
      if (!/\barticle-card\b/i.test(match[0])) return null;
      const currentIndex = articleIndex;
      articleIndex += 1;
      const attrs = match[1] || '';
      const block = match[0];
      const sourceUrl = decodeHtml(
        matchFirst(block, /<div class="source-list"[\s\S]*?<a[^>]*href="([^"]+)"/i) ||
        matchFirst(block, /<figcaption[\s\S]*?<a[^>]*href="([^"]+)"/i)
      );
      const title = stripHtml(
        matchFirst(block, /<h[23][^>]*class="[^"]*\barticle-title\b[^"]*"[^>]*>([\s\S]*?)<\/h[23]>/i) ||
        matchFirst(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i)
      );
      const summary = stripHtml(
        matchFirst(block, /<p[^>]*class="[^"]*\barticle-lead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        matchFirst(block, /<p[^>]*>([\s\S]*?)<\/p>/i)
      );
      const sourceName = stripHtml(
        matchFirst(block, /<figcaption[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
        matchFirst(block, /<div class="source-list"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
      );
      const imageTag = matchFirst(block, /(<img\b(?=[^>]*class="[^"]*\barticle-image\b)[^>]*>)/i);
      const imageUrl = decodeHtml(matchFirst(imageTag, /\bsrc="([^"]+)"/i));
      const imageAlt = decodeHtml(matchFirst(imageTag, /\balt="([^"]*)"/i));
      if (!title || !summary || !sourceUrl) return null;
      const existingAnchor = decodeHtml(matchFirst(attrs, /\bid="([^"]+)"/i));
      const articleAnchor = existingAnchor || uniqueArticleAnchorId(title, currentIndex, usedAnchors);
      if (existingAnchor) usedAnchors.add(existingAnchor);
      return {
        article_identity_key: articleIdentityKey({ source_url: sourceUrl }),
        title,
        summary,
        source_url: sourceUrl,
        source_name: sourceName || '출처',
        article_anchor: articleAnchor,
        newsletter_article_url: `newsletters/${date}/index.html#${articleAnchor}`,
        image_url: imageUrl,
        image_alt: imageAlt || title
      };
    })
    .filter(Boolean);
}

function renderedHeadlineState({ root, date, state, shortlist }) {
  const rendered = readRenderedNewsletterArticles(root, date);
  if (rendered.length === 0 || !state?.current_headline) {
    return { state, reconciliation: null };
  }
  const newsletterUrl = `newsletters/${date}/index.html`;
  const selectedByKey = new Map(ensureArray(shortlist?.selected_articles).map(candidate => [
    articleIdentityKey(candidate),
    candidate
  ]));
  const current = state.current_headline;
  const currentSource = normalizeArticleUrl(current.source_url);
  const renderedCurrent = rendered.find(article =>
    article.article_identity_key === current.article_identity_key ||
    normalizeArticleUrl(article.source_url) === currentSource
  );

  if (renderedCurrent) {
    return {
      state: {
        ...state,
        current_headline: {
          ...current,
          title: renderedCurrent.title,
          summary: renderedCurrent.summary,
          source_url: renderedCurrent.source_url,
          newsletter_url: newsletterUrl,
          newsletter_article_url: renderedCurrent.newsletter_article_url || newsletterUrl,
          image_url: normalizeHeadlineImageUrl(renderedCurrent.image_url || current.image_url || '', newsletterUrl),
          image_alt: renderedCurrent.image_alt || current.image_alt || renderedCurrent.title,
          snapshot: {
            ...(current.snapshot || {}),
            source_name: renderedCurrent.source_name || current.snapshot?.source_name || ''
          }
        }
      },
      reconciliation: null
    };
  }

  const fallback = rendered
    .map(article => {
      const selected = selectedByKey.get(article.article_identity_key) || {};
      const candidate = {
        ...selected,
        article_identity_key: article.article_identity_key,
        canonical_url: article.source_url,
        normalized_url: article.source_url,
        url: article.source_url,
        article_url: article.source_url,
        source_url: article.source_url,
        title: article.title,
        summary: article.summary,
        newsletter_date: date,
        newsletter_url: newsletterUrl,
        newsletter_article_url: article.newsletter_article_url || newsletterUrl,
        image_url: article.image_url || selected.image_url || selected.selectedImage || '',
        image_alt: article.image_alt || selected.image_alt || selected.imageAlt || article.title,
        selected_at: date,
        snapshot: {
          ...(selected.snapshot || {}),
          source_name: article.source_name || selected.source_name || selected.source || ''
        }
      };
      if (!isHeadlineEligible(candidate)) return null;
      return {
        candidate,
        score: computeHeadlineScore(candidate).headline_score
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.candidate.title.localeCompare(right.candidate.title))[0];

  if (!fallback) return { state, reconciliation: null };
  const fallbackState = {
    ...state,
    current_headline: headlineSnapshotFromCandidate(fallback.candidate, {
      date,
      newsletterUrl,
      scoredAt: date
    })
  };
  return {
    state: fallbackState,
    reconciliation: {
      applied: true,
      previous_headline_key: current.article_identity_key || '',
      rendered_headline_key: fallbackState.current_headline.article_identity_key,
      reason: 'selected_headline_not_rendered_in_public_issue'
    }
  };
}

module.exports = {
  readRenderedNewsletterArticles,
  renderedHeadlineState
};
