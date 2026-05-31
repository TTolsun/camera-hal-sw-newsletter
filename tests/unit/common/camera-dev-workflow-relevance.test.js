'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  detectCameraDevWorkflowRelevanceDeterministic
} = require('../../../scripts/newsroom/domain/aosp-camera-scope');
const {
  isFallbackOnly
} = require('../../../scripts/newsroom/common/public-article-contract');
const {
  dropDecisionMetadataMustFix
} = require('../../../scripts/newsroom/common/fact-check-repair');

// ─── 결정론적 fallback keyword 룰 ───────────────────────────────────────────

test('detectCameraDevWorkflowRelevanceDeterministic: Camera + prototype 동시 등장 시 true', () => {
  const result = detectCameraDevWorkflowRelevanceDeterministic({
    title: 'Build and prototype Android Camera apps with Google AI Studio',
    summary: 'Google AI Studio allows rapid prototyping of Camera apps on Android.'
  });
  assert.equal(result.camera_dev_workflow_relevance, true);
  assert.equal(result.camera_dev_workflow_relevance_source, 'deterministic_fallback');
  assert.ok(result.camera_dev_workflow_relevance_reason.length > 0);
});

test('detectCameraDevWorkflowRelevanceDeterministic: CameraX + debug 동시 등장 시 true', () => {
  const result = detectCameraDevWorkflowRelevanceDeterministic({
    title: 'Debug CameraX session failures with Android Studio profiler',
    summary: 'Step-by-step guide to debugging CameraX session lifecycle issues.'
  });
  assert.equal(result.camera_dev_workflow_relevance, true);
  assert.equal(result.camera_dev_workflow_relevance_source, 'deterministic_fallback');
});

test('detectCameraDevWorkflowRelevanceDeterministic: Camera + reproduce 동시 등장 시 true', () => {
  const result = detectCameraDevWorkflowRelevanceDeterministic({
    title: 'Reproduce Camera2 capture errors in sample app',
    summary: 'How to reproduce Camera2 API capture failures using a minimal sample app.'
  });
  assert.equal(result.camera_dev_workflow_relevance, true);
});

test('detectCameraDevWorkflowRelevanceDeterministic: Camera 없이 C++ 일반 릴리스는 false', () => {
  const result = detectCameraDevWorkflowRelevanceDeterministic({
    title: 'GCC 17.0 general C++ compiler release',
    summary: 'GCC 17.0 improves native C++ code generation and optimization.'
  });
  assert.equal(result.camera_dev_workflow_relevance, false);
  assert.equal(result.camera_dev_workflow_relevance_source, 'deterministic_fallback');
});

test('detectCameraDevWorkflowRelevanceDeterministic: Camera 있지만 action 없으면 false', () => {
  const result = detectCameraDevWorkflowRelevanceDeterministic({
    title: 'Android Camera ecosystem overview',
    summary: 'General overview of Android Camera ecosystem updates in 2026.'
  });
  assert.equal(result.camera_dev_workflow_relevance, false);
});

test('detectCameraDevWorkflowRelevanceDeterministic: 빈 후보는 false', () => {
  const result = detectCameraDevWorkflowRelevanceDeterministic({});
  assert.equal(result.camera_dev_workflow_relevance, false);
  assert.equal(result.camera_dev_workflow_relevance_source, 'deterministic_fallback');
});

// ─── default false ─────────────────────────────────────────────────────────

test('camera_dev_workflow_relevance 기본값은 false', () => {
  const section = { relevance_bucket: 'cpp_ai_tooling_fallback' };
  // 필드 미설정 시 isFallbackOnly는 true(기존 동작 유지)
  assert.equal(isFallbackOnly(section), true);
});

// ─── LLM 결과 우선순위 ─────────────────────────────────────────────────────

test('isFallbackOnly: toggle=false(기본값)이면 camera_dev_workflow_relevance=true여도 cpp_fallback은 fallback-only', () => {
  // toggle=false이면 정책 toggle 조건 미충족 → 조기 return 없이 fallback-only=true (selection/quality 일관성)
  const sectionTrue = {
    relevance_bucket: 'cpp_ai_tooling_fallback',
    camera_dev_workflow_relevance: true
  };
  assert.equal(isFallbackOnly(sectionTrue), true);
});

test('isFallbackOnly: camera_dev_workflow_relevance=false이면 cpp_fallback은 true 반환', () => {
  const sectionFalse = {
    relevance_bucket: 'cpp_ai_tooling_fallback',
    camera_dev_workflow_relevance: false
  };
  assert.equal(isFallbackOnly(sectionFalse), true);
});

test('isFallbackOnly: 다른 bucket은 camera_dev_workflow_relevance에 영향 없음', () => {
  const directCamera = {
    relevance_bucket: 'direct_aosp_camera',
    camera_dev_workflow_relevance: false
  };
  assert.equal(isFallbackOnly(directCamera), false);
});

// ─── fact-check-repair dropDecisionMetadataMustFix ────────────────────────

test('dropDecisionMetadataMustFix: decision_metadata must_fix 항목 제거', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      {
        location: 'sections[0].public_article.decision_metadata.impact',
        problem: 'impact field must be X',
        suggestion: 'set impact to X',
        source_url: 'https://example.com'
      },
      {
        location: 'sections[1].public_article.decision_metadata.overclaim_risk',
        problem: 'overclaim_risk must be Medium',
        suggestion: 'set overclaim_risk to Medium',
        source_url: 'https://example.com'
      },
      {
        location: 'sections[0].public_article.headline',
        problem: 'headline factual error',
        suggestion: 'fix headline',
        source_url: 'https://example.com'
      }
    ],
    recommended_fixes: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: ''
  };

  const { factCheck: repaired, droppedCount } = dropDecisionMetadataMustFix(factCheck);

  // decision_metadata 관련 2개 제거, headline 관련 1개 유지
  assert.equal(droppedCount, 2);
  assert.equal(repaired.must_fix.length, 1);
  assert.equal(repaired.must_fix[0].location, 'sections[0].public_article.headline');
});

test('dropDecisionMetadataMustFix: must_fix가 모두 decision_metadata이면 status PASS로 승격', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      {
        location: 'sections[0].public_article.decision_metadata.scope',
        problem: 'scope field must be set',
        suggestion: 'set scope',
        source_url: 'https://example.com'
      }
    ],
    recommended_fixes: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: ''
  };

  const { factCheck: repaired, droppedCount } = dropDecisionMetadataMustFix(factCheck);

  assert.equal(droppedCount, 1);
  assert.equal(repaired.must_fix.length, 0);
  assert.equal(repaired.status, 'PASS');
});

test('dropDecisionMetadataMustFix: decision_metadata 없으면 아무것도 제거 안 함', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      {
        location: 'sections[0].public_article.headline',
        problem: 'factual error',
        suggestion: 'fix it',
        source_url: 'https://example.com'
      }
    ],
    recommended_fixes: [],
    source_gaps: ['missing source'],
    source_gap_count: 1,
    final_comment: ''
  };

  const { factCheck: repaired, droppedCount } = dropDecisionMetadataMustFix(factCheck);

  assert.equal(droppedCount, 0);
  assert.equal(repaired.must_fix.length, 1);
  // source_gaps가 있으면 PASS 승격 안 됨
  assert.equal(repaired.status, 'NEEDS_FIX');
});

test('dropDecisionMetadataMustFix: 빈 factCheck은 안전하게 처리', () => {
  const { factCheck: repaired, droppedCount } = dropDecisionMetadataMustFix({});
  assert.equal(droppedCount, 0);
  assert.equal(Array.isArray(repaired.must_fix), true);
  assert.equal(repaired.must_fix.length, 0);
});

test('dropDecisionMetadataMustFix: NEEDS_FIX + must_fix=[] + source_gaps=[] 비정합 입력은 PASS 승격하지 않음', () => {
  // droppedCount=0이면 LLM이 처음부터 must_fix=[]로 반환한 비정합 상태 — final_comment 덮어쓰기 금지
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [],
    recommended_fixes: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: '원본 final_comment'
  };

  const { factCheck: repaired, droppedCount } = dropDecisionMetadataMustFix(factCheck);

  assert.equal(droppedCount, 0);
  assert.equal(repaired.status, 'NEEDS_FIX', 'droppedCount=0이면 PASS 승격하지 않아야 함');
  assert.equal(repaired.final_comment, '원본 final_comment', 'final_comment를 덮어쓰지 않아야 함');
});
