const {
  BUCKETS
} = require('./aosp-camera-scope');

const PRODUCT_VERSION_TOKEN_PATTERN = /^(?:android|aosp|camera|camerax|camera2|libcamera|gemini|ndk|sdk|gcc|clang|llvm|v?\d+(?:\.\d+){1,4}.*|c\+\+\d{2})$/i;
const RELEASE_BOILERPLATE_TOKEN_PATTERN = /^(?:released|release|announced|adds?|support|update|updates?|version|new)$/i;

const LINKED_EVIDENCE_UNRESOLVED_STATUSES = Object.freeze([
  'blocked',
  'failed',
  'skipped',
  'unsupported'
]);

const LINKED_EVIDENCE_RUNTIME_TERMS = /\b(?:stream|buffer|metadata|request|result|ImageCapture|VideoCapture|Surface|CameraPipe)\b/i;
const LINKED_EVIDENCE_RUNTIME_CLAIM = /\b(?:HAL runtime|runtime behavior|product behavior|implementation change|camera pipeline|stream|buffer|metadata|request|result|ImageCapture|VideoCapture|Surface|CameraPipe)\b[^.\n]{0,90}\b(?:change|changed|fix|fixed|impact|affect|improve|regression|behavior|implementation|runtime)\b|\b(?:change|changed|fix|fixed|impact|affect|improve|regression|behavior|implementation|runtime)\b[^.\n]{0,90}\b(?:HAL runtime|runtime behavior|product behavior|camera pipeline|stream|buffer|metadata|request|result|ImageCapture|VideoCapture|Surface|CameraPipe)\b/i;
const LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM = /\b(?:Gerrit|IssueTracker|Issue Tracker|GitHub|mailing list|CVE|linked evidence)\b[^.\n]{0,90}\b(?:confirm|confirmed|proves?|verified|resolved|landed|merged|shows?|fix(?:ed|es)?)\b|\b(?:confirm|confirmed|proves?|verified|resolved|landed|merged|shows?|fix(?:ed|es)?)\b[^.\n]{0,90}\b(?:Gerrit|IssueTracker|Issue Tracker|GitHub|mailing list|CVE|linked evidence)\b/i;
const LINKED_EVIDENCE_HIGH_IMPACT_CLAIM = /\b(?:high|direct|confirmed|runtime|pipeline|HAL)\b[^.\n]{0,80}\b(?:impact|effect|risk|regression|behavior change)\b/i;
const LINKED_EVIDENCE_LIMITATION_NOTE = /\b(?:unresolved|blocked|failed|skipped|unsupported|not fetched|not_fetched|limited|diagnostic|not confirmed|not resolved)\b/i;

const SCOPE_SCORE_FIELDS = Object.freeze([
  'aosp_camera_directness',
  'driver_stack_relevance',
  'multimedia_camera_output_relevance',
  'soc_platform_relevance',
  'native_tooling_relevance'
]);

const TOPIC_TIER_BUCKETS = Object.freeze({
  direct_camera: Object.freeze([
    BUCKETS.DIRECT_AOSP_CAMERA,
    BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
    BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT
  ]),
  multimedia: Object.freeze([
    BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT
  ]),
  platform: Object.freeze([
    BUCKETS.SOC_PLATFORM_SIGNAL
  ]),
  fallback: Object.freeze([
    BUCKETS.CPP_AI_TOOLING_FALLBACK
  ]),
  watchlist: Object.freeze([
    BUCKETS.GENERIC_TECH_WATCHLIST
  ])
});

const BRIEFING_WHAT_PATTERN = /\b(?:source|change|changed|update|updated|release|released|note|published|announced|android|aosp|camerax|camera2|libcamera|ndk|gcc|clang|llvm|driver|sensor|isp|soc|api)\b|릴리스|업데이트|변경|공개|출처/i;
const BRIEFING_READER_PATTERN = /\b(?:hal|driver|sensor|camera|camerax|camera2|preview|capture|stream|buffer|metadata|ci|review|test|debug|latency|frame|regression|pipeline|native|tooling)\b|카메라|검증|디버깅|리뷰/i;
const BRIEFING_ACTION_PATTERN = /\b(?:check|watch|test|review|compare|measure|track|triage|validate|verify|confirm|run|inspect|adopt)\b|확인|검증|테스트|비교|주시|점검|측정|추적|리뷰|도입/i;

module.exports = {
  PRODUCT_VERSION_TOKEN_PATTERN,
  RELEASE_BOILERPLATE_TOKEN_PATTERN,
  LINKED_EVIDENCE_UNRESOLVED_STATUSES,
  LINKED_EVIDENCE_RUNTIME_TERMS,
  LINKED_EVIDENCE_RUNTIME_CLAIM,
  LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM,
  LINKED_EVIDENCE_HIGH_IMPACT_CLAIM,
  LINKED_EVIDENCE_LIMITATION_NOTE,
  SCOPE_SCORE_FIELDS,
  TOPIC_TIER_BUCKETS,
  BRIEFING_WHAT_PATTERN,
  BRIEFING_READER_PATTERN,
  BRIEFING_ACTION_PATTERN
};
