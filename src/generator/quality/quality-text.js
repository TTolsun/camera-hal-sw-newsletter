'use strict';

const {
  normalizeArticleSections
} = require('../reporter/article-section-contract');

// Quality-gate text primitives shared across the binding, deduction, and markdown
// modules. Moved verbatim out of newsletter-quality.js as part of the SRP split
// (issue #52 phase 6); behaviour is byte-for-byte identical.

function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value || '').trim();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sectionText(section) {
  const articleSections = normalizeArticleSections(section);
  return [
    section.category,
    section.headline,
    articleSections.verified_facts,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.action_items,
    articleSections.team_share_points,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.camera_hal_checks,
    section.sources
  ].map(text).join(' ');
}

module.exports = {
  text,
  objectValue,
  sectionText
};
