const { ensureArray } = require('../../../src/core/common/value-coercion');
const {
  LIMITATION_VISIBILITY,
  articleSectionSummary
} = require('./article-section-contract');

const ARTICLE_STRUCTURE_CONTRACT_ROW_FIELDS = Object.freeze([
  'index',
  'article',
  'five_section',
  'fact_boundary',
  'hal_impact_axis',
  'actionability',
  'limitations'
]);

function objectValue(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergeArticleSectionSummary(section = {}, reportSummary = {}) {
  const localSummary = articleSectionSummary(objectValue(section));
  const summary = objectValue(reportSummary);
  return {
    ...localSummary,
    ...summary,
    missing_keys: ensureArray(summary.missing_keys ?? localSummary.missing_keys),
    missing_required_keys: ensureArray(summary.missing_required_keys ?? localSummary.missing_required_keys),
    present_optional_keys: ensureArray(summary.present_optional_keys ?? localSummary.present_optional_keys),
    unexpected_keys: ensureArray(summary.unexpected_keys ?? localSummary.unexpected_keys),
    has_limitations: summary.has_limitations ?? localSummary.has_limitations,
    has_watch_items: summary.has_watch_items ?? localSummary.has_watch_items,
    has_do_not_claim: summary.has_do_not_claim ?? localSummary.has_do_not_claim,
    limitation_visibility: summary.limitation_visibility ?? localSummary.limitation_visibility
  };
}

function rowIndex(context = {}, articleResult = {}) {
  if (context.index !== undefined && context.index !== null) return Number(context.index) + 1;
  return articleResult.index ?? '';
}

function missingRequiredKeys(summary = {}) {
  return ensureArray(summary.missing_required_keys ?? summary.missing_keys);
}

function fiveSectionStatus(summary = {}) {
  const missing = missingRequiredKeys(summary);
  return summary.complete === true && missing.length === 0 ? 'pass' : `missing ${missing.join(', ') || 'unknown'}`;
}

function factBoundaryStatus(summary = {}) {
  const missing = missingRequiredKeys(summary);
  if (missing.includes('verified_facts')) return 'missing';
  if (summary.has_do_not_claim) return 'present+guarded';
  return 'present';
}

function halImpactAxisStatus(section = {}, articleResult = {}, summary = {}) {
  const missing = missingRequiredKeys(summary);
  if (missing.includes('hal_driver_impact')) return 'missing';
  const axes = ensureArray(section.hal_impact_axes).length > 0
    ? ensureArray(section.hal_impact_axes)
    : ensureArray(section.hal_signal_capsule?.impact_axes).length > 0
      ? ensureArray(section.hal_signal_capsule?.impact_axes)
      : ensureArray(articleResult.hal_impact_axes);
  return axes.join(', ') || 'present';
}

function actionabilityStatus(section = {}, articleResult = {}, summary = {}) {
  const missing = missingRequiredKeys(summary);
  if (missing.includes('action_items')) return 'missing';
  return section.effective_actionability_level ||
    section.actionability_level ||
    articleResult.effective_actionability_level ||
    articleResult.actionability_level ||
    'present';
}

function articleSectionContractRow(section, context = {}) {
  const sourceSection = objectValue(section);
  const articleResult = objectValue(context.articleResult);
  const summary = mergeArticleSectionSummary(sourceSection, articleResult.section_contract);
  const index = rowIndex(context, articleResult);
  return {
    index,
    article: sourceSection.headline || articleResult.headline || sourceSection.category || (index ? `article ${index}` : ''),
    five_section: fiveSectionStatus(summary),
    fact_boundary: factBoundaryStatus(summary),
    hal_impact_axis: halImpactAxisStatus(sourceSection, articleResult, summary),
    actionability: actionabilityStatus(sourceSection, articleResult, summary),
    limitations: summary.limitation_visibility ?? LIMITATION_VISIBILITY.NONE
  };
}

function articleSectionContractRows(sections, context = {}) {
  const sectionList = ensureArray(sections);
  const articleResults = ensureArray(context.articleResults);
  const hasSections = sectionList.length > 0;
  const rowCount = hasSections ? sectionList.length : articleResults.length;
  return Array.from({ length: rowCount }, (_, index) => {
    const rowContext = {
      ...context,
      articleResult: articleResults[index] || null
    };
    if (hasSections) rowContext.index = index;
    return articleSectionContractRow(sectionList[index] || {}, rowContext);
  });
}

function articleSectionContractRowValues(row) {
  return ARTICLE_STRUCTURE_CONTRACT_ROW_FIELDS.map(field => row[field]);
}

module.exports = {
  ARTICLE_STRUCTURE_CONTRACT_ROW_FIELDS,
  articleSectionContractRow,
  articleSectionContractRows,
  articleSectionContractRowValues
};
