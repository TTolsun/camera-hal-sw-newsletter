'use strict';

// 과거 주간호(W19~ )에 coverage(대상 주) 필드를 증거 기반으로 backfill하는 도구.
//
// 이 도구는 발행 identity(weekly_key, "이 호가 몇 번째 주에 나갔는가")는 건드리지 않는다.
// coverage 필드는 "이 호가 실제로 다루는 대상 주가 언제인가"만 표시 계층에 알려주는
// pass-through 값이다(Task 1~3, src/shared/common/coverage-week.js 참고).
//
// 판정 규칙(이 태스크의 불변식):
//   이슈의 sections 중 coverage_type이 'catch_up'이 아닌 것들의 날짜 증거
//   (section.date / section.published_date / section.sources[].date 중 파싱 가능한 값)를 모두
//   모아, coverage_end_exclusive_at(E) 이상인 것이 하나라도 있으면 그 이슈는 "다음 실행일(run-day)
//   기사가 섞여 들어온" 것이므로 legacy_rolling으로 분류한다. 전부 E 미만이면 iso_week이다.
//   날짜 값이 존재하는데(값은 비어있지 않은데) 날짜로 파싱되지 않으면 "손상된 증거"로 보고,
//   그 경우 다른 증거가 legacy_rolling을 시사하더라도 판정을 내리지 않고 fail로 보고한다
//   (안전 기본값: 데이터가 의심스러우면 추측하지 않는다). 값이 아예 없는 필드는 "증거 없음"일
//   뿐 손상이 아니므로 조용히 건너뛴다 — 실제 커밋된 발행분은 이 3개 필드를 채운 적이 없어서,
//   증거가 전혀 없는 이슈는 (반증이 없으므로) iso_week으로 분류된다.
//
// legacy_rolling일 때 coverage_week_key는 기록하지 않는다. ISO 주 라벨을 붙일 근거가 없는데
// 라벨만 붙이면 잘못된 주를 보여주는 셈이라, 표시 계층(coverageDisplayBounds, Task 2/3)의
// "3필드 전부 유효할 때만 표시" 규칙을 그대로 이용해 발행 주 표시로 안전하게 폴백시킨다.
// coverage_start_date/coverage_end_date + coverage_mode만 남기는 것은 의도된 설계이지,
// 누락이 아니다.

const fs = require('fs');
const path = require('path');

const { ensureArray } = require('../../common/value-coercion');
const { coverageForAnchorDate } = require('../../common/coverage-week');
const { buildWeeklyNewsletterPage } = require('../../../generator/render/weekly-newsletter-page');
const { isValidWeeklyKey } = require('../../../generator/reporter/weekly-newsletter');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_KEY_DIR_PATTERN = /^\d{4}-W\d{2}$/;
const COVERAGE_FIELD_NAMES = [
  'coverage_week_key',
  'coverage_start_date',
  'coverage_end_date',
  'coverage_mode',
  'generation_anchor_date'
];
// 재렌더된 index.html에서 archive/home 카드 topic 태그가 실리는 자리. weekly-newsletter-output.js가
// buildWeeklyNewsletterPage 호출 이후 page.issue.tags를 덮어써서 커밋된 index.html과 issue.json의
// 태그가 이미 어긋나 있는 경우가 있다(W30~W33 실측, 별도 세션에서 수정 중). 이 도구는 그 드리프트를
// 고치려 하지 않지만, 재렌더 결과가 우연히 그 드리프트를 없애 버리면(= 기존 파일과 태그 행이
// 달라지면) dry-run 보고에서 알 수 있어야 승인권자가 놀라지 않는다.
const TAG_ROW_PATTERN = /<div class="tag-row issue-tags">[\s\S]*?<\/div>/;

function usage() {
  return [
    'Usage: node src/shared/tooling/cli/backfill-weekly-coverage.js [--dry-run] [--weekly-key 2026-W34]',
    '',
    '과거 주간호에 coverage(대상 주) 필드를 증거 기반으로 backfill한다.',
    '--dry-run 은 파일을 전혀 바꾸지 않고 이슈별 판정 표만 출력한다.',
    '--weekly-key 를 주면 그 이슈 하나만 처리한다(없으면 전체 주간호를 훑는다).'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--weekly-key') {
      options.weeklyKey = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--weekly-key=')) {
      options.weeklyKey = arg.slice('--weekly-key='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' 하루 전을 뺀 날짜의 'YYYY-MM-DD' (UTC 자정 기준).
function daysBeforeUtc(dateText, days) {
  const [year, month, day] = String(dateText).split('-').map(Number);
  return formatUtcDate(new Date(Date.UTC(year, month - 1, day) - days * DAY_MS));
}

// 섹션 하나의 날짜 증거. 증거가 아예 없으면 damaged:false, ms:null.
// 값이 있는데(비어있지 않은데) 날짜로 파싱되지 않으면 damaged:true.
function sectionDateEvidence(section = {}) {
  const candidates = [
    section.date,
    section.published_date,
    ...ensureArray(section.sources).map(source => source && source.date)
  ];
  let ms = null;
  for (const raw of candidates) {
    const text = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!text) continue; // 필드가 비어있음 = 증거 없음(손상 아님) — 조용히 건너뛴다.
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) {
      return { damaged: true, raw: text };
    }
    if (ms === null) ms = parsed;
  }
  return { damaged: false, ms };
}

// 불변식 판정: { ok: true, mode } 또는 { ok: false, reason }.
function classifyIssueCoverage({ sections, coverageEndExclusiveAt }) {
  const endExclusiveMs = Date.parse(coverageEndExclusiveAt);
  let sawForwardDatedEvidence = false;
  for (const section of ensureArray(sections)) {
    if (!section || section.coverage_type === 'catch_up') continue;
    const evidence = sectionDateEvidence(section);
    if (evidence.damaged) {
      return { ok: false, reason: `날짜 증거 손상(파싱 불가): "${evidence.raw}"` };
    }
    if (evidence.ms !== null && evidence.ms >= endExclusiveMs) {
      sawForwardDatedEvidence = true;
    }
  }
  return { ok: true, mode: sawForwardDatedEvidence ? 'legacy_rolling' : 'iso_week' };
}

function isoWeekFields(coverage, anchor) {
  return {
    coverage_week_key: coverage.coverage_week_key,
    coverage_start_date: coverage.coverage_start_date,
    coverage_end_date: coverage.coverage_end_date,
    coverage_mode: 'iso_week',
    generation_anchor_date: anchor
  };
}

// legacy_rolling: 실제 rolling 조회 범위(anchor-7d ~ anchor)를 그대로 남긴다. ISO 주 라벨은 없다
// (파일 상단 주석 참고 — coverage_week_key를 의도적으로 기록하지 않는다).
function legacyRollingFields(anchor) {
  return {
    coverage_start_date: daysBeforeUtc(anchor, 7),
    coverage_end_date: anchor,
    coverage_mode: 'legacy_rolling',
    generation_anchor_date: anchor
  };
}

// 이슈에 이미 같은 coverage 필드가 기록되어 있는지 — 있으면 다시 쓸 필요가 없다(멱등).
function fieldsAlreadyApplied(issue, fields) {
  return COVERAGE_FIELD_NAMES.every(field => {
    if (Object.prototype.hasOwnProperty.call(fields, field)) {
      return issue[field] === fields[field];
    }
    // legacy_rolling엔 coverage_week_key가 없어야 한다 — 이미 없어야 "변경 없음"이다.
    return issue[field] === undefined;
  });
}

function tagRowOf(html) {
  const match = TAG_ROW_PATTERN.exec(String(html || ''));
  return match ? match[0] : '';
}

function issueDir(root, weeklyKey) {
  return path.join(root, 'articles', 'newsletters', weeklyKey);
}

function evidencePath(root, anchor) {
  return path.join(root, 'articles', 'content', 'newsroom', anchor, 'generation-status.json');
}

// 이슈 하나를 읽어 backfill 계획을 세운다. 파일을 쓰지 않는 순수 계산(읽기만 한다) — dry-run과
// 실제 실행이 정확히 같은 판정을 내리도록, 판정 로직은 여기 한 곳에만 있다.
function planIssueBackfill({ root, weeklyKey }) {
  const dir = issueDir(root, weeklyKey);
  const issue = JSON.parse(fs.readFileSync(path.join(dir, 'issue.json'), 'utf8'));
  const anchor = issue.date;
  const base = { weeklyKey, anchor, coverageLabel: '-', mode: '-', reason: '' };

  if (!fs.existsSync(evidencePath(root, anchor))) {
    return { ...base, verdict: 'skipped_no_evidence' };
  }

  let coverage;
  try {
    coverage = coverageForAnchorDate(anchor);
  } catch (error) {
    return { ...base, verdict: 'fail', reason: `anchor 날짜가 무효합니다: ${error.message}` };
  }

  const classification = classifyIssueCoverage({
    sections: issue.sections,
    coverageEndExclusiveAt: coverage.coverage_end_exclusive_at
  });
  if (!classification.ok) {
    return { ...base, verdict: 'fail', reason: classification.reason };
  }

  const fields = classification.mode === 'iso_week' ? isoWeekFields(coverage, anchor) : legacyRollingFields(anchor);
  const mutatedIssue = { ...issue, ...fields };
  if (classification.mode === 'legacy_rolling') delete mutatedIssue.coverage_week_key;

  const page = buildWeeklyNewsletterPage(mutatedIssue, { weeklyKey });

  const indexHtmlPath = path.join(dir, 'index.html');
  const oldHtml = fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf8') : '';
  const tagsChanged = tagRowOf(oldHtml) !== tagRowOf(page.html);

  const verdict = fieldsAlreadyApplied(issue, fields) ? 'unchanged' : 'ready';

  return {
    ...base,
    mode: classification.mode,
    coverageLabel: `${fields.coverage_start_date}~${fields.coverage_end_date}`,
    fields,
    page,
    tagsChanged,
    verdict
  };
}

// plan.verdict === 'ready' 인 계획만 실제로 디스크에 쓴다. issue.json/index.html/newsletter.md와
// newsletters-weekly.json의 대응 entry에 coverage 필드만 patch한다 — 다른 필드(article_count,
// tags, article_images 등)는 이 backfill의 책임이 아니므로 건드리지 않는다.
function applyIssueBackfill(root, plan) {
  const dir = issueDir(root, plan.weeklyKey);
  fs.writeFileSync(path.join(dir, 'index.html'), plan.page.html, 'utf8');
  fs.writeFileSync(path.join(dir, 'newsletter.md'), plan.page.markdown, 'utf8');
  fs.writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(plan.page.issue, null, 2)}\n`, 'utf8');

  const dataPath = path.join(root, 'articles', 'data', 'newsletters-weekly.json');
  if (!fs.existsSync(dataPath)) return;
  let list;
  try {
    list = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (_) {
    return;
  }
  if (!Array.isArray(list)) return;
  const entry = list.find(item => item && item.weeklyKey === plan.weeklyKey);
  if (!entry) return;
  for (const field of COVERAGE_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(plan.fields, field)) entry[field] = plan.fields[field];
  }
  if (plan.fields.coverage_mode === 'legacy_rolling') delete entry.coverage_week_key;
  fs.writeFileSync(dataPath, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function enumerateWeeklyKeys(root, filterWeeklyKey) {
  const base = path.join(root, 'articles', 'newsletters');
  if (filterWeeklyKey) {
    if (!isValidWeeklyKey(filterWeeklyKey)) {
      throw new Error(`--weekly-key 형식이 올바르지 않습니다(YYYY-Www): ${filterWeeklyKey}`);
    }
    if (!fs.existsSync(path.join(base, filterWeeklyKey, 'issue.json'))) {
      throw new Error(`해당 주간호를 찾을 수 없습니다: ${filterWeeklyKey}`);
    }
    return [filterWeeklyKey];
  }
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && WEEKLY_KEY_DIR_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .filter(name => fs.existsSync(path.join(base, name, 'issue.json')))
    .sort();
}

function runBackfill({ root = process.cwd(), dryRun = true, weeklyKey } = {}) {
  const keys = enumerateWeeklyKeys(root, weeklyKey);
  const rows = [];
  for (const key of keys) {
    const plan = planIssueBackfill({ root, weeklyKey: key });
    if (plan.verdict === 'ready') {
      if (dryRun) {
        plan.verdict = 'would_update';
      } else {
        applyIssueBackfill(root, plan);
        plan.verdict = 'updated';
      }
    }
    rows.push(plan);
  }
  return rows;
}

function verdictLabel(row) {
  const parts = [row.verdict === 'fail' ? `fail: ${row.reason}` : row.verdict];
  if (row.tagsChanged) parts.push('태그 보정 포함');
  return parts.join(' / ');
}

function formatReportTable(rows) {
  const header = ['weeklyKey', 'anchor', 'coverage', 'mode', '판정'];
  const lines = [header.join(' | '), header.map(() => '---').join(' | ')];
  for (const row of rows) {
    lines.push([row.weeklyKey, row.anchor, row.coverageLabel, row.mode, verdictLabel(row)].join(' | '));
  }
  return lines.join('\n');
}

function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const rows = runBackfill({ root, dryRun: options.dryRun, weeklyKey: options.weeklyKey });
  console.log(formatReportTable(rows));
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  applyIssueBackfill,
  classifyIssueCoverage,
  enumerateWeeklyKeys,
  formatReportTable,
  main,
  parseArgs,
  planIssueBackfill,
  runBackfill
};
