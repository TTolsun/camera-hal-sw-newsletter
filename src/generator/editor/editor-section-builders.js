const { ensureArray } = require('../../shared/common/value-coercion');
const {
  ARTICLE_SECTION_OPTIONAL_KEYS,
  normalizeArticleSections
} = require('../reporter/article-section-contract');
const {
  STORY_CONTRACT_VERSION,
  publicArticleForSection
} = require('../reporter/public-article-contract');
const {
  asObject,
  text,
  uniqueText
} = require('./editor-contract-helpers');

function strictArticleSections(section) {
  const normalized = normalizeArticleSections(section);
  const output = {
    verified_facts: normalized.verified_facts,
    background_context: normalized.background_context,
    hal_driver_impact: normalized.hal_driver_impact,
    action_items: normalized.action_items,
    team_share_points: normalized.team_share_points
  };
  for (const key of ARTICLE_SECTION_OPTIONAL_KEYS) {
    if (normalized[key].length > 0) output[key] = normalized[key];
  }
  return output;
}

function mergeBackgroundContext(section = {}) {
  const publicArticle = asObject(section.public_article);
  return uniqueText([
    section.evidence_summary,
    ...ensureArray(publicArticle.body_paragraphs)
  ]).join('\n\n');
}

function buildArticleSectionsFromSectionFields(section = {}) {
  const reasonCodes = [];
  const publicArticle = asObject(section.public_article);
  const editorialStory = asObject(publicArticle.editorial_story);
  const verifiedFacts = uniqueText(section.confirmed_facts);
  const backgroundContext = mergeBackgroundContext(section);
  const halDriverImpact = text(publicArticle.camera_hal_takeaway);
  const actionItems = uniqueText([section.action_items, section.camera_hal_checks]);
  const teamSharePoints = text(editorialStory.editor_take || publicArticle.camera_hal_takeaway);
  if (!backgroundContext) reasonCodes.push('missing_background_context');
  if (!halDriverImpact) reasonCodes.push('missing_hal_driver_impact');
  if (actionItems.length === 0) reasonCodes.push('missing_action_items');
  if (!teamSharePoints) reasonCodes.push('missing_team_share_points');

  const repaired = {
    verified_facts: verifiedFacts,
    background_context: backgroundContext,
    hal_driver_impact: halDriverImpact,
    action_items: actionItems,
    team_share_points: teamSharePoints
  };
  const knownLimitations = uniqueText([section.limitations, section.known_limitations]);
  const watchItems = uniqueText(section.watch_items);
  const doNotClaim = uniqueText([
    ...ensureArray(section.do_not_claim),
    ...ensureArray(section.overclaim_guardrails),
    ...ensureArray(section.do_not_overstate)
  ]);
  if (knownLimitations.length > 0) repaired.known_limitations = knownLimitations;
  if (watchItems.length > 0) repaired.watch_items = watchItems;
  if (doNotClaim.length > 0) repaired.do_not_claim = doNotClaim;
  return {
    article_sections: repaired,
    reason_codes: uniqueText(reasonCodes)
  };
}

function sourceSubtitleFromSection(section = {}, publicArticle = {}) {
  const firstSource = ensureArray(publicArticle.source_links)[0] || ensureArray(section.sources)[0] || {};
  return text(firstSource.title || firstSource.publisher || section.category || publicArticle.headline || section.headline);
}

function headlineRepairSuffix(section = {}, publicArticle = {}) {
  const combined = [
    section.relevance_bucket,
    section.category,
    section.headline,
    publicArticle.headline
  ].map(text).join(' ');
  if (/soc_platform|thermal|isp/i.test(combined)) return 'preview latency 검증 포인트';
  if (/camera_driver|image_pipeline|libcamera/i.test(combined)) return 'stream/buffer 검증 포인트';
  if (/android_platform|camerax|camera2/i.test(combined)) return 'preview/capture 호환성 확인';
  if (/tooling|cpp|native/i.test(combined)) return 'native tooling 확인 범위';
  return 'Camera HAL 검토 포인트';
}

function storyHeadlineFromSection(section = {}, publicArticle = {}) {
  const headline = text(publicArticle.headline || section.headline || section.category || 'Camera HAL 관련 소식');
  const normalizedHeadline = headline.toLowerCase();
  const sourceTitles = [
    ...ensureArray(section.sources),
    ...ensureArray(publicArticle.source_links)
  ]
    .map(source => text(source?.title))
    .filter(Boolean);
  if (sourceTitles.some(title => title.toLowerCase() === normalizedHeadline)) {
    return `${headline}: ${headlineRepairSuffix(section, publicArticle)}`;
  }
  return headline;
}

function buildStoryFromPublicArticle(section = {}, publicArticle = {}) {
  const headline = text(publicArticle.headline || section.headline || section.category || 'Camera HAL 관련 소식');
  const checkpoints = ensureArray(publicArticle.reader_checkpoints).filter(Boolean);
  const limitations = uniqueText([
    publicArticle.editorial_story?.not_to_overclaim,
    ...ensureArray(section.do_not_overstate),
    ...ensureArray(section.hal_signal_capsule?.do_not_overstate)
  ]);
  const articleSections = normalizeArticleSections(section);
  return {
    reader_scenario: `${headline}을 Camera HAL / Driver / Native tooling 리뷰 범위에 넣을지 판단하는 현업 상황을 가정합니다.`,
    what_happened: text(publicArticle.lead || section.what_changed || section.evidence_summary),
    why_it_matters: text(publicArticle.camera_hal_takeaway || articleSections.hal_driver_impact),
    field_scenario: checkpoints.join(' ') || text(section.camera_hal_checks || section.action_items),
    not_to_overclaim: limitations.join(' ') || 'source가 직접 말하지 않는 HAL runtime, driver branch, vendor tag, pipeline 영향으로 확대하지 않습니다.',
    editor_take: text(articleSections.team_share_points || publicArticle.camera_hal_takeaway || `${headline}은 source 범위 안에서만 확인합니다.`)
  };
}

function completeStoryPublicArticle(section = {}) {
  const publicArticle = publicArticleForSection(section);
  const headline = storyHeadlineFromSection(section, publicArticle);
  publicArticle.headline = headline;
  return {
    ...publicArticle,
    headline,
    story_contract_version: STORY_CONTRACT_VERSION,
    source_subtitle: text(publicArticle.source_subtitle) || sourceSubtitleFromSection(section, publicArticle),
    editorial_story: {
      ...buildStoryFromPublicArticle(section, publicArticle),
      ...(publicArticle.editorial_story && typeof publicArticle.editorial_story === 'object'
        ? Object.fromEntries(Object.entries(publicArticle.editorial_story).map(([key, value]) => [key, text(value)]))
        : {})
    }
  };
}

module.exports = {
  strictArticleSections,
  mergeBackgroundContext,
  buildArticleSectionsFromSectionFields,
  sourceSubtitleFromSection,
  headlineRepairSuffix,
  storyHeadlineFromSection,
  buildStoryFromPublicArticle,
  completeStoryPublicArticle
};
