'use strict';

const { BUCKETS } = require('../../../src/core/common/aosp-camera-scope');

// 섹션 본문 텍스트 기반 scope fallback 규칙을 우선순위 순서로 둔다(OCP).
// 새 버킷/패턴을 추가할 때 거대한 if-else를 고치는 대신 이 배열에 항목을 더한다.
// 위에서부터 첫 번째로 매칭되는 규칙의 scope를 사용하며, 어디에도 안 맞으면
// 호출 측에서 classifyAospCameraStackCandidate 기본 분류로 떨어진다.
const SECTION_SCOPE_FALLBACK_RULES = [
  {
    pattern: /카메라\s*HAL|안드로이드\s*카메라|카메라2|Camera\s*HAL|Android Camera|CameraX|Camera2|Camera ITS|CTS|VTS|AOSP Camera/i,
    scope: {
      editorial_priority: 1,
      relevance_bucket: BUCKETS.DIRECT_AOSP_CAMERA,
      aosp_camera_directness: 3,
      driver_stack_relevance: 0,
      multimedia_camera_output_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: true,
      counts_as_driver_topic: false,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    }
  },
  {
    pattern: /V4L2|libcamera|ISP|이미지\s*센서|image sensor|camera driver|media controller|MIPI|CSI-2|DMA-BUF/i,
    scope: {
      editorial_priority: 2,
      relevance_bucket: BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
      aosp_camera_directness: 0,
      driver_stack_relevance: 3,
      multimedia_camera_output_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: true,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    }
  },
  {
    pattern: /\bUltra\s+HDR\b|\bHDR\s+video\b|\bAPV\b|\bAdvanced\s+Professional\s+Video\b|\bMediaProvider\b|\bmedia\s+provider\b|\bMediaStore\b|\bmedia\s+store\b|\bgallery\s+output\b|\bmedia\s+output\b|\bvideo\s+call\b|\bcamera\s*\/\s*audio\s+sync\b|\bsocial\s+app\s+camera\s+capture\b|\bcamera\s+capture\s+result\b|\bcaptured\s+image\s*\/\s*video\s+output\b/i,
    scope: {
      editorial_priority: 4,
      relevance_bucket: BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      multimedia_camera_output_relevance: 3,
      soc_platform_relevance: 0,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: false,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    }
  },
  {
    pattern: /\bSoC\b|\bCPU\b|\bGPU\b|\bNPU\b|\bDSP\b|\bthermal\b|\bpower\b|\bDVFS\b|\bscheduler\b|\bmemory bandwidth\b|Exynos|Snapdragon|Google Tensor/i,
    scope: {
      editorial_priority: 5,
      relevance_bucket: BUCKETS.SOC_PLATFORM_SIGNAL,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      multimedia_camera_output_relevance: 0,
      soc_platform_relevance: 3,
      native_tooling_relevance: 0,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: false,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false,
      evidence_origin: 'section_text_fallback'
    }
  },
  {
    pattern: /C\+\+|LLVM|Clang|GCC|sanitizer|native|toolchain|build|test|AI coding|LLM agent/i,
    scope: {
      editorial_priority: 6,
      relevance_bucket: BUCKETS.CPP_AI_TOOLING_FALLBACK,
      aosp_camera_directness: 0,
      driver_stack_relevance: 0,
      multimedia_camera_output_relevance: 0,
      soc_platform_relevance: 0,
      native_tooling_relevance: 3,
      counts_as_primary_camera_topic: false,
      counts_as_driver_topic: false,
      counts_as_soc_topic: false,
      counts_as_fallback_topic: true,
      evidence_origin: 'section_text_fallback'
    }
  }
];

module.exports = SECTION_SCOPE_FALLBACK_RULES;
