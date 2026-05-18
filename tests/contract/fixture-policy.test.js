const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  fixturesRoot,
  listFixtureFiles,
  readJsonFixture,
  readTextFixture,
  resolveFixturePath
} = require('../helpers/fixture-loader');

const GENERATED_ARTIFACT_PATH_PATTERN = /\b(?:content\/newsroom|content\/collected-news|newsletters)\/\d{4}-\d{2}-\d{2}\b/;
const MINIMIZED_GENERATED_REGRESSION_SOURCE = 'minimized-generated-regression';
const GENERATED_SOURCE_VALUES = new Set([
  'generated_artifact',
  MINIMIZED_GENERATED_REGRESSION_SOURCE
]);
const SEED_ARTIFACT_NAME_PATTERN = /\b(?:collection-intent\.json|seed-evidence-pack\.json|seed-candidates\.json|compact_evidence)\b/;

function relativeFixturePath(filePath) {
  return path.relative(fixturesRoot, filePath).replace(/\\/g, '/');
}

function isPassStatus(value) {
  return String(value || '').toUpperCase() === 'PASS';
}

function isGoodFixturePath(entryPath) {
  return entryPath.includes('/good/');
}

function hasGeneratedProvenance(entry = {}, fixture = {}) {
  return entry.generatedArtifact === true ||
    entry.source === MINIMIZED_GENERATED_REGRESSION_SOURCE ||
    fixture.metadata?.generated === true ||
    GENERATED_SOURCE_VALUES.has(fixture.metadata?.source);
}

function mentionsSeedArtifactName(text) {
  return SEED_ARTIFACT_NAME_PATTERN.test(text);
}

function readFixtureLedger() {
  return readJsonFixture('fixture-ledger.json');
}

function ledgerFixtureFiles() {
  return listFixtureFiles('.', '')
    .map(relativeFixturePath)
    .filter(filePath => filePath !== 'README.md')
    .filter(filePath => filePath !== 'fixture-ledger.json')
    .filter(filePath => !filePath.endsWith('/.gitkeep'));
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
    .filter(filePath => isGoodFixturePath(relativeFixturePath(filePath)));

  assert.ok(goodFixtures.length > 0);
  for (const filePath of goodFixtures) {
    const fixturePath = relativeFixturePath(filePath);
    const fixture = readJsonFixture(fixturePath);
    assert.equal(
      hasGeneratedProvenance({}, fixture),
      false,
      `${fixturePath} must not carry generated provenance`
    );
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

test('fixture ledger covers every committed fixture file', () => {
  const ledger = readFixtureLedger();
  assert.equal(ledger.schemaVersion, 1);
  assert.ok(Array.isArray(ledger.entries), 'fixture ledger must have entries');

  const seen = new Set();
  for (const entry of ledger.entries) {
    assert.equal(typeof entry.path, 'string', 'ledger entry path must be a string');
    assert.equal(entry.path.includes('\\'), false, `${entry.path} must use normalized separators`);
    assert.equal(entry.path.includes('..'), false, `${entry.path} must not escape fixtures root`);
    assert.equal(path.isAbsolute(entry.path), false, `${entry.path} must be relative`);
    assert.equal(seen.has(entry.path), false, `${entry.path} is duplicated in fixture ledger`);
    seen.add(entry.path);
    assert.doesNotThrow(() => resolveFixturePath(entry.path), `${entry.path} must stay inside tests/fixtures`);
  }

  assert.deepEqual([...seen].sort(), ledgerFixtureFiles().sort());
});

test('fixture ledger trust metadata matches fixture policy', () => {
  const ledger = readFixtureLedger();

  for (const entry of ledger.entries) {
    assert.ok(entry.source, `${entry.path} must declare source`);
    assert.ok(entry.allowedUse, `${entry.path} must declare allowedUse`);
    assert.ok(entry.expectedStatus, `${entry.path} must declare expectedStatus`);
    assert.ok(entry.protectedPolicy, `${entry.path} must declare protectedPolicy`);
    assert.equal(typeof entry.generatedArtifact, 'boolean', `${entry.path} must declare generatedArtifact`);

    if (isGoodFixturePath(entry.path)) {
      assert.equal(entry.allowedUse, 'good', `${entry.path} is under good/ and must declare allowedUse=good`);
      assert.equal(entry.source, 'curated', `${entry.path} is under good/ and must be curated`);
      assert.equal(entry.generatedArtifact, false, `${entry.path} is under good/ and cannot be generated`);
      assert.equal(isPassStatus(entry.expectedStatus), true, `${entry.path} good fixture must expect PASS`);
    }

    if (entry.path.includes('/bad/')) {
      assert.equal(entry.allowedUse, 'bad', `${entry.path} is under bad/ and must declare allowedUse=bad`);
      assert.equal(isPassStatus(entry.expectedStatus), false, `${entry.path} bad fixture must not expect PASS`);
    }

    if (entry.generatedArtifact) {
      assert.notEqual(entry.allowedUse, 'good', `${entry.path} generated fixture cannot be good`);
      assert.equal(isGoodFixturePath(entry.path), false, `${entry.path} generated fixture cannot live under good/`);
      assert.equal(
        entry.source,
        MINIMIZED_GENERATED_REGRESSION_SOURCE,
        `${entry.path} generated fixture must be minimized regression evidence`
      );
    }

    if (!entry.path.endsWith('.json')) continue;
    const fixture = readJsonFixture(entry.path);
    assert.equal(
      isGoodFixturePath(entry.path) && hasGeneratedProvenance(entry, fixture),
      false,
      `${entry.path} good fixture cannot carry generated provenance`
    );
    if (fixture.metadata?.generated === true) {
      assert.equal(entry.generatedArtifact, true, `${entry.path} metadata.generated must match fixture ledger`);
      assert.notEqual(entry.allowedUse, 'good', `${entry.path} generated fixture cannot be a good/golden fixture`);
      assert.equal(
        fixture.metadata.source,
        MINIMIZED_GENERATED_REGRESSION_SOURCE,
        `${entry.path} generated fixture metadata.source must not point at a generated artifact path`
      );
    }
    if (fixture.expected?.status) {
      assert.equal(
        isPassStatus(fixture.expected.status),
        isPassStatus(entry.expectedStatus),
        `${entry.path} expected status must match fixture ledger pass/fail class`
      );
    }
  }
});

test('fixture files do not embed generated artifact paths', () => {
  for (const fixturePath of ledgerFixtureFiles()) {
    const text = readTextFixture(fixturePath);
    assert.equal(
      GENERATED_ARTIFACT_PATH_PATTERN.test(text),
      false,
      `${fixturePath} must not embed content/newsroom, content/collected-news, or newsletters generated artifact paths`
    );
  }
});

test('seed artifact names are allowed only without generated good-fixture provenance', () => {
  const ledger = readFixtureLedger();
  const entriesByPath = new Map(ledger.entries.map(entry => [entry.path, entry]));

  for (const fixturePath of ledgerFixtureFiles()) {
    const text = readTextFixture(fixturePath);
    const entry = entriesByPath.get(fixturePath);
    const fixture = fixturePath.endsWith('.json') ? readJsonFixture(fixturePath) : {};

    assert.equal(
      isGoodFixturePath(fixturePath) && mentionsSeedArtifactName(text) && hasGeneratedProvenance(entry, fixture),
      false,
      `${fixturePath} must not turn generated seed artifacts into a good/golden fixture`
    );
  }
});
