'use strict';

// Hand labels are edited by hand — show.js tells the labeller to open the JSON and type
// the verdict in — so the plausible mistakes are typing "Yes", typing "y", or deleting
// the key. None of those are caught by a null check, and every consumer here treats
// anything that is not exactly 'yes' as a 'no'. A single mistyped label therefore moves
// the score without skipping a row or printing a warning.
//
// The splits this guards are answered once, so a wrong number cannot be re-measured
// away. Validate on load, in every tool that reads a label, using the same rule.

const VALID = ['yes', 'no'];

function describe(value) {
  if (value === undefined) return 'the key is missing';
  return `${JSON.stringify(value)}`;
}

// Returns the number of items carrying a verdict. Throws on anything malformed rather
// than letting it through as a silent 'no'.
function assertLabelsWellFormed(items, source) {
  const bad = [];
  for (const [index, item] of items.entries()) {
    const value = item.human_label;
    if (value === null || VALID.includes(value)) continue;
    bad.push(`  item ${index + 1} (${item.family_key}): ${describe(value)}`);
  }
  if (bad.length > 0) {
    throw new Error(
      `${bad.length} label(s) in ${source} are neither "yes", "no", nor null:\n${bad.join('\n')}\n` +
      'Values are compared exactly, so "Yes" or "y" would be scored as "no" without warning. ' +
      'Fix them by hand before this split is measured.'
    );
  }
  return items.filter(item => item.human_label !== null).length;
}

module.exports = { VALID, assertLabelsWellFormed };
