// 심층(deep-dive) 발동 판정·주제 선정·운영 report. 1단계(shadow) — 렌더/생성 없음.
// 예상 콘텐츠 실패(미발동·큐 빔)는 skip 값으로, 구현 오류는 error report 기록 후 재-throw.
// 스펙: .tmp/codex/deep-dive-section-design.md (구현 후 docs/NEWSROOM_WORKFLOW.md에 통합).
const fs = require('fs');
const path = require('path');
const { loadDeepDiveTopicQueue, selectDeepDiveTopic } = require('../../shared/collect/deep-dive-topic-queue');
const { sectionRelevanceBucket } = require('./newsletter-renderer');

const DEEP_DIVE_ROLLOUT_STAGE = 'shadow';

function weeklyDeepDiveTrigger(articles) {
  const count = (articles || [])
    .filter(section => sectionRelevanceBucket(section) === 'direct_aosp_camera')
    .length;
  return { direct_aosp_camera_weekly_final_count: count, activated: count <= 1 };
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
