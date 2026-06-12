'use strict';

function text(value) {
  return String(value || '').trim();
}

function reliabilityScore(candidate) {
  const reliability = text(candidate.reliability || candidate.source_reliability).toLowerCase();
  if (reliability === 'official') return 5;
  if (['project-official', 'official-community'].includes(reliability)) return 4;
  if (['expert-media', 'community-doc'].includes(reliability)) return 2;
  if (['community', 'newsletter'].includes(reliability)) return 1;
  return 0;
}

module.exports = {
  reliabilityScore
};
