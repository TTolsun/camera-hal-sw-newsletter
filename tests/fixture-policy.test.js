const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  fixturesRoot,
  listFixtureFiles,
  readJsonFixture
} = require('./helpers/fixture-loader');

function relativeFixturePath(filePath) {
  return path.relative(fixturesRoot, filePath).replace(/\\/g, '/');
}

function isPassStatus(value) {
  return String(value || '').toUpperCase() === 'PASS';
}

function hasPassBlockingPolicyFlag(flags = {}) {
  return flags.source_gap_risk === true ||
    flags.reference_only === true ||
    flags.finalSelectionEligibility === 'watchlist' ||
    flags.finalSelectionEligibility === 'exclude' ||
    flags.hasDatedEvidence === false ||
    flags.generic_ai_without_hal_connection === true ||
    flags.generic_it_without_hal_connection === true;
}

test('fixture policy keeps generated samples out of good fixtures', () => {
  const goodFixtures = listFixtureFiles('.', '.json')
    .filter(filePath => relativeFixturePath(filePath).includes('/good/'));

  assert.ok(goodFixtures.length > 0);
  for (const filePath of goodFixtures) {
    const fixture = readJsonFixture(relativeFixturePath(filePath));
    assert.notEqual(fixture.metadata?.generated, true, `${relativeFixturePath(filePath)} must not be generated`);
  }
});

test('bad fixtures cannot expect PASS', () => {
  const badFixtures = listFixtureFiles('.', '.json')
    .filter(filePath => relativeFixturePath(filePath).includes('/bad/'));

  assert.ok(badFixtures.length > 0);
  for (const filePath of badFixtures) {
    const fixture = readJsonFixture(relativeFixturePath(filePath));
    assert.equal(
      isPassStatus(fixture.expected?.status),
      false,
      `${relativeFixturePath(filePath)} is a bad fixture and must not expect PASS`
    );
  }
});

test('PASS golden fixtures cannot carry source-integrity blocker flags', () => {
  const fixtures = listFixtureFiles('.', '.json');

  for (const filePath of fixtures) {
    const fixture = readJsonFixture(relativeFixturePath(filePath));
    const isGoldenPass = relativeFixturePath(filePath).includes('/good/') && isPassStatus(fixture.expected?.status);
    assert.equal(
      isGoldenPass && hasPassBlockingPolicyFlag(fixture.policyFlags),
      false,
      `${relativeFixturePath(filePath)} cannot be a PASS golden fixture with blocking policy flags`
    );
  }
});
