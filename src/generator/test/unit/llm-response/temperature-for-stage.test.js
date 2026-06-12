const assert = require('node:assert/strict');
const test = require('node:test');

const {
  temperatureForStage
} = require('../../../reporter/providers/gemini-provider');

const baseConfig = {
  geminiTemperatureDefault: 0.35,
  geminiTemperatureSourceDiscovery: 0.45,
  geminiTemperatureReporter: 0.30,
  geminiTemperatureEditor: 0.55,
  geminiTemperatureFactcheck: 0.20,
  geminiTemperatureRepair: 0.25,
  geminiTemperatureJudge: 0.20
};

test('stage별 temperature — 7개 정확 매핑', () => {
  assert.equal(temperatureForStage('source-discovery', baseConfig), 0.45);
  assert.equal(temperatureForStage('reporter', baseConfig), 0.30);
  assert.equal(temperatureForStage('editor', baseConfig), 0.55);
  assert.equal(temperatureForStage('fact-check', baseConfig), 0.20);
  assert.equal(temperatureForStage('repair', baseConfig), 0.25);
  assert.equal(temperatureForStage('public-article-judge', baseConfig), 0.20);
  assert.equal(temperatureForStage('judge', baseConfig), 0.20);
});

test('알 수 없는 stage — geminiTemperatureDefault 반환', () => {
  assert.equal(temperatureForStage('unknown-stage', baseConfig), 0.35);
  assert.equal(temperatureForStage('', baseConfig), 0.35);
  assert.equal(temperatureForStage(null, baseConfig), 0.35);
  assert.equal(temperatureForStage(undefined, baseConfig), 0.35);
});

test('regex 동의어 — fact-check 계열', () => {
  assert.equal(temperatureForStage('fact-check', baseConfig), 0.20);
  assert.equal(temperatureForStage('factchecker', baseConfig), 0.20);
  assert.equal(temperatureForStage('fact check repair attempt 1/2', baseConfig), 0.20);
  assert.equal(temperatureForStage('fact-checker completion attempt 1/2', baseConfig), 0.20);
});

test('regex 동의어 — judge 계열', () => {
  assert.equal(temperatureForStage('public-article-judge', baseConfig), 0.20);
  assert.equal(temperatureForStage('judge', baseConfig), 0.20);
  assert.equal(temperatureForStage('public article judge attempt 1/2', baseConfig), 0.20);
});

test('regex 동의어 — editor completion', () => {
  assert.equal(temperatureForStage('editor', baseConfig), 0.55);
  assert.equal(temperatureForStage('editor completion attempt 1/2', baseConfig), 0.55);
});

test('regex 동의어 — source discovery', () => {
  assert.equal(temperatureForStage('source-discovery', baseConfig), 0.45);
  assert.equal(temperatureForStage('source discovery', baseConfig), 0.45);
});

test('우선순위 — repair가 editor보다 먼저 매핑', () => {
  // "editor repair"는 repair 정규식에 먼저 걸리지 않음. reporter repair는 repair에 걸림.
  assert.equal(temperatureForStage('repair', baseConfig), 0.25);
  assert.equal(temperatureForStage('editor repair attempt 1/2', baseConfig), 0.25);
});
