'use strict';

const PUBLISH_MODES = {
  DEEP: 'DEEP',
  CONTEXT: 'CONTEXT',
  QUIET: 'QUIET'
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// 결정론적 발행 모드 판정. compositionSummary 카운트만 입력으로 사용한다.
// CLAUDE.md 원칙: LLM이 아니라 코드가 모드를 고른다.
function resolvePublishMode(compositionSummary = {}, publishModePolicy = {}) {
  const contextMinSignals = Number.isInteger(publishModePolicy.contextMinSignals)
    ? publishModePolicy.contextMinSignals
    : 1;

  const coreCount =
    num(compositionSummary.direct_aosp_camera_count) +
    num(compositionSummary.camera_driver_image_pipeline_count);
  const adjacentCount =
    num(compositionSummary.android_platform_camera_adjacent_count) +
    num(compositionSummary.android_multimedia_camera_output_count);
  const contextCount =
    num(compositionSummary.soc_platform_signal_count) +
    num(compositionSummary.cpp_ai_tooling_fallback_count);

  let mode;
  if (coreCount >= 1) {
    mode = PUBLISH_MODES.DEEP;
  } else if (adjacentCount + contextCount >= contextMinSignals) {
    mode = PUBLISH_MODES.CONTEXT;
  } else {
    mode = PUBLISH_MODES.QUIET;
  }

  return {
    mode,
    core_count: coreCount,
    adjacent_count: adjacentCount,
    context_count: contextCount,
    context_min_signals: contextMinSignals
  };
}

module.exports = {
  PUBLISH_MODES,
  resolvePublishMode
};
