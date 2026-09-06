'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { PUBLISH_MODES, resolvePublishMode } = require('../../../select/publish-mode');

function summary(overrides = {}) {
  return {
    direct_aosp_camera_count: 0,
    camera_driver_image_pipeline_count: 0,
    android_count: 0,
    android_multimedia_camera_output_count: 0,
    soc_platform_signal_count: 0,
    cpp_ai_tooling_fallback_count: 0,
    ...overrides
  };
}

test('core >= 1 yields DEEP', () => {
  const r = resolvePublishMode(summary({ direct_aosp_camera_count: 1 }), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.DEEP);
  assert.equal(r.core_count, 1);
});

test('driver core counts toward DEEP', () => {
  const r = resolvePublishMode(summary({ camera_driver_image_pipeline_count: 2 }), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.DEEP);
});

test('core 0 with adjacent/context >= threshold yields CONTEXT', () => {
  const r = resolvePublishMode(summary({ soc_platform_signal_count: 1 }), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.CONTEXT);
});

test('core 0 and below threshold yields QUIET', () => {
  const r = resolvePublishMode(summary(), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.QUIET);
});

test('core 0 with adjacent below higher threshold yields QUIET', () => {
  const r = resolvePublishMode(summary({ soc_platform_signal_count: 1 }), { contextMinSignals: 2 });
  assert.equal(r.mode, PUBLISH_MODES.QUIET);
});

test('result records counts for traceability', () => {
  const r = resolvePublishMode(summary({ android_count: 1, cpp_ai_tooling_fallback_count: 1 }), { contextMinSignals: 1 });
  assert.equal(r.core_count, 0);
  assert.equal(r.adjacent_count, 1);
  assert.equal(r.context_count, 1);
  assert.equal(r.mode, PUBLISH_MODES.CONTEXT);
});
