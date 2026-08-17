// 심층(deep-dive) 발동 판정·주제 선정·운영 report. 1단계(shadow) — 렌더/생성 없음.
// 예상 콘텐츠 실패(미발동·큐 빔)는 skip 값으로, 구현 오류는 error report 기록 후 재-throw.
//
// 호출 지점은 orchestrator-publish-decision.js의 **맨 끝**이다 — weekly writer 안이 아니다.
// 그 함수가 공개 산출물 기록·headline state·validate·generation-status를 전부 마친 뒤에 불러야,
// 여기서 나는 throw가 (1) 그 주의 발행 산출물을 하나도 선점하지 않고 (2) weekly writer의 바깥
// catch에 삼켜져 console 한 줄로 사라지지도 않는다.
// 계약 정본: docs/NEWSROOM_WORKFLOW.md 「심층(deep-dive) 주제 큐」 절.
const fs = require('fs');
const path = require('path');
const { loadDeepDiveTopicQueue, selectDeepDiveTopic } = require('../../shared/collect/deep-dive-topic-queue');
const { getDeepDivePolicy, getDefaultNewsletterPolicy } = require('../../shared/common/newsletter-policy');
const { sectionRelevanceBucket } = require('./newsletter-renderer');

const DEEP_DIVE_ROLLOUT_STAGE = 'shadow';

// 임계값은 newsletter-policy.json(`deepDivePolicy.directAospCameraMaxForActivation`)이 정본이다.
// 여기에 숫자를 적어 두면 정책 파일을 바꿔도 동작이 따라오지 않고, 생성 문서 블록만 갱신돼
// check:policy-docs가 통과하는 채로 코드와 문서가 갈라진다.
function weeklyDeepDiveTrigger(articles, policy = getDefaultNewsletterPolicy()) {
  const maxForActivation = getDeepDivePolicy(policy).directAospCameraMaxForActivation;
  const count = (articles || [])
    .filter(section => sectionRelevanceBucket(section) === 'direct_aosp_camera')
    .length;
  return { direct_aosp_camera_weekly_final_count: count, activated: count <= maxForActivation };
}

function writeDeepDiveReport(root, date, report) {
  const dir = path.join(root, 'articles', 'content', 'newsroom', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'deep-dive-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function baseReport(date, trigger) {
  return {
    schema_version: 1,
    date,
    rollout_stage: DEEP_DIVE_ROLLOUT_STAGE,
    status: 'skipped',
    activated: trigger.activated,
    trigger,
    selected_topic_key: null,
    skip_reason: null,
    error: null,
    queue_size: 0,
    accrued_this_week: 0,
    evidence_used: []
  };
}

function runWeeklyDeepDive({ root, date, articles }) {
  const trigger = weeklyDeepDiveTrigger(articles);
  const report = baseReport(date, trigger);
  try {
    if (!trigger.activated) {
      report.skip_reason = 'not_activated';
      writeDeepDiveReport(root, date, report);
      return report;
    }
    const queue = loadDeepDiveTopicQueue(root);
    report.queue_size = queue.topics.length;
    report.accrued_this_week = queue.topics
      .flatMap(topic => topic.evidence)
      .filter(evidence => evidence.detected_at === date)
      .length;
    const topic = selectDeepDiveTopic(queue);
    if (!topic) {
      report.skip_reason = 'queue_empty';
      writeDeepDiveReport(root, date, report);
      return report;
    }
    report.status = 'shadow_selected';
    report.selected_topic_key = topic.topic_key;
    writeDeepDiveReport(root, date, report);
    return report;
  } catch (error) {
    // 구현 오류: 콘텐츠 실패로 위장하지 않는다. best-effort로 기록하고 다시 던진다(불변식 3).
    report.status = 'error';
    report.error = error.message;
    try {
      writeDeepDiveReport(root, date, report);
    } catch {}
    throw error;
  }
}

module.exports = { DEEP_DIVE_ROLLOUT_STAGE, runWeeklyDeepDive, weeklyDeepDiveTrigger };
