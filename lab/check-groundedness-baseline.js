'use strict';

// FC-2 근거 정합(groundedness) 기준선 계산기.
//
// 묻는 것: 발행된 main 기사가, 원문을 실제로 받아와 뒷받침된 출처를 하나라도 가지고 있는가.
//
// 이 질문은 fact-checker(LLM)도 답하도록 되어 있다. 그런데 커밋된 산출물을 보면 그 답이
// 이 창의 9호 내내 전부 긍정이었다. publishable=false 0건, source_gap 0건, must_fix 0건.
// 부정 신호가 한 번도 없으면 그 판정은 무언가를 걸러낸 증거가 되지 못한다.
//
// 그래서 이 스크립트는 LLM을 쓰지 않는다. 커밋된 산출물만으로 같은 질문에 독립적으로 답한다.
// 결정론이라 같은 입력이면 언제 돌려도 같은 값이 나오고, 그래서 기준선이 될 수 있다.
//
// 읽는 것  articles/content/newsroom/<날짜>/quality-report.json
//          articles/content/newsroom/<날짜>/evidence-validation-report.json
// 쓰는 것  lab/results/groundedness-baseline.json   (--write 를 줬을 때만)
//
// lab 규약대로 파이프라인을 실행하지 않고 src/ 에 아무것도 쓰지 않는다.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 기준선 창. 아래·위 끝을 모두 고정한다.
//
// 시작이 2026-06-29 인 이유: 여기가 주간 체제의 첫 호다. quality-report.json 을 가진
// newsroom 디렉터리의 발행 간격을 세어 확인했다 - 06-11, 06-16, 06-20, 06-21, 06-22,
// 06-24 까지는 간격이 5·4·1·1·2일인 일간 체제이고 06-29 부터 5·7·7·7·… 로 주 단위가 된다.
// 일간 호와 섞으면 한 모집단이 아니다.
//
// 끝을 고정하는 이유: 상한이 없으면 다음 호가 발행되는 순간부터 이 스크립트가 다른 모집단을
// 재고, 얼린 기준선과의 차이가 "코퍼스가 자랐다"인지 "같은 코퍼스가 달라졌다"인지 구분되지
// 않는다. 새 호까지 포함해 다시 재려면 두 상수를 함께 올리고 --force 로 다시 얼린다.
const BASELINE_SINCE = '2026-06-29';
const BASELINE_UNTIL = '2026-08-24';

const NEWSROOM_DIRECTORY = path.join(__dirname, '..', 'articles', 'content', 'newsroom');
const BASELINE_FILE = path.join(__dirname, 'results', 'groundedness-baseline.json');

const ISSUE_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// 계측기 자신의 판본. 기준선의 수치가 달라졌을 때 파이프라인이 달라진 것인지 계측기가
// 달라진 것인지 구분하려면 이 값이 함께 남아 있어야 한다.
function instrumentVersion() {
  return crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex').slice(0, 16);
}

// quality-report 의 출처 URL과 evidence-validation-report 의 후보 URL을 같은 모양으로 맞춘다.
// 한쪽은 퍼센트 인코딩된 채로 남아 있는 경우가 있어서(예: v0.7.2%2Brpt20260817) 디코딩이 필요하다.
// 소문자화는 scheme 과 host 에만 적용한다. lore message-id 나 patchwork 경로는 대소문자를
// 구분하므로 경로까지 내리면 서로 다른 출처가 같은 키로 뭉개진다.
function normalizeSourceUrl(rawUrl) {
  const text = String(rawUrl || '').trim();
  if (!text) {
    return '';
  }
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch (error) {
    decoded = text;
  }
  try {
    const parsed = new URL(decoded);
    const host = parsed.host.toLowerCase();
    const rest = `${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/+$/, '');
    return `${parsed.protocol.toLowerCase()}//${host}${rest}`;
  } catch (error) {
    return decoded.replace(/\/+$/, '');
  }
}

function listIssueDates() {
  return fs
    .readdirSync(NEWSROOM_DIRECTORY)
    .filter(name => ISSUE_DIRECTORY_PATTERN.test(name))
    .filter(name => name >= BASELINE_SINCE && name <= BASELINE_UNTIL)
    .sort();
}

// 후보 하나가 "근거로 인정되는가".
// 원문을 실제로 받아왔고(source_fetch_used), 그 원문이 뒷받침한 주장이 하나 이상 있어야 한다.
// 둘 중 하나라도 빠지면 그 출처는 기사를 뒷받침하지 못한 것으로 센다.
function isSupportingCandidate(candidate) {
  return candidate.source_fetch_used === true && Number(candidate.supported_claims) > 0;
}

function describeCandidate(candidate) {
  return [
    candidate.validation_mode || 'unknown',
    `fetch=${candidate.source_fetch_used === true}`,
    `supported=${Number(candidate.supported_claims) || 0}`,
    `status=${candidate.evidence_validation_status || 'unknown'}`,
    `blocked=${candidate.final_selection_blocked === true}`
  ].join(' ');
}

function evaluateIssue(date) {
  const issueDirectory = path.join(NEWSROOM_DIRECTORY, date);
  const qualityFile = path.join(issueDirectory, 'quality-report.json');
  const evidenceFile = path.join(issueDirectory, 'evidence-validation-report.json');
  const missing = [
    fs.existsSync(qualityFile) ? '' : 'quality-report.json',
    fs.existsSync(evidenceFile) ? '' : 'evidence-validation-report.json'
  ].filter(Boolean);
  if (missing.length) {
    // 조용히 버리면 모집단이 줄어든 것이 개선으로 읽힌다. 빠진 사실을 그대로 남긴다.
    return { date, skipped: true, missing_reports: missing };
  }

  const qualityReport = readJsonFile(qualityFile);
  const evidenceReport = readJsonFile(evidenceFile);

  // 한 URL이 후보 레코드 여러 개로 실린다. registry 수집본과 gemini 발견본이 같은 기사를
  // 가리키면서 판정이 갈리는 일이 흔하다(한쪽은 source_fetch·supported=1, 다른 쪽은 skipped).
  // 마지막 레코드만 남기면 배열 순서가 결과를 정하므로 URL당 레코드를 전부 들고 간다.
  const candidatesByUrl = new Map();
  for (const candidate of evidenceReport.candidates || []) {
    const key = normalizeSourceUrl(candidate.url);
    if (!key) continue;
    if (!candidatesByUrl.has(key)) {
      candidatesByUrl.set(key, []);
    }
    candidatesByUrl.get(key).push(candidate);
  }

  const articles = [];
  for (const articleResult of qualityReport.article_results || []) {
    const sourceUrls = (articleResult.sources || [])
      .map(source => normalizeSourceUrl(source.url))
      .filter(Boolean);
    const matchedCandidates = sourceUrls.flatMap(url => candidatesByUrl.get(url) || []);

    // 조인 실패는 근거 없음과 다른 문제다(리포트 두 개가 어긋난 상태). 따로 센다.
    const joined = matchedCandidates.length > 0;
    const grounded = joined && matchedCandidates.some(isSupportingCandidate);
    // 같은 URL의 레코드끼리 판정이 갈리면 어느 쪽을 믿을지는 이 리포트만으로 정해지지 않는다.
    // 판정은 "하나라도 뒷받침하면 근거 있음"으로 내리되, 갈렸다는 사실을 세어 남긴다.
    const ambiguous = joined &&
      matchedCandidates.some(isSupportingCandidate) &&
      matchedCandidates.some(candidate => !isSupportingCandidate(candidate));

    articles.push({
      headline: articleResult.headline || '',
      source_urls: sourceUrls,
      joined,
      grounded,
      ambiguous,
      evidence: matchedCandidates.map(describeCandidate)
    });
  }

  return {
    date,
    skipped: false,
    quality_score: qualityReport.score,
    quality_status: qualityReport.status,
    article_count: articles.length,
    grounded_count: articles.filter(article => article.grounded).length,
    ungrounded_count: articles.filter(article => article.joined && !article.grounded).length,
    unjoined_count: articles.filter(article => !article.joined).length,
    ambiguous_count: articles.filter(article => article.ambiguous).length,
    articles
  };
}

function buildBaseline() {
  const evaluated = listIssueDates().map(evaluateIssue);
  const issues = evaluated.filter(issue => !issue.skipped);
  const skippedIssues = evaluated.filter(issue => issue.skipped);

  const totals = issues.reduce(
    (accumulator, issue) => ({
      issues: accumulator.issues + 1,
      articles: accumulator.articles + issue.article_count,
      grounded: accumulator.grounded + issue.grounded_count,
      ungrounded: accumulator.ungrounded + issue.ungrounded_count,
      unjoined: accumulator.unjoined + issue.unjoined_count,
      ambiguous: accumulator.ambiguous + issue.ambiguous_count
    }),
    { issues: 0, articles: 0, grounded: 0, ungrounded: 0, unjoined: 0, ambiguous: 0 }
  );

  return {
    metric: 'FC-2 groundedness',
    definition: 'main 기사의 출처 후보 중 source_fetch_used=true 이고 supported_claims>0 인 것이 하나 이상 있는가',
    instrument_version: instrumentVersion(),
    window_since: BASELINE_SINCE,
    window_until: BASELINE_UNTIL,
    totals,
    ungrounded_ratio: totals.articles ? Number((totals.ungrounded / totals.articles).toFixed(4)) : 0,
    skipped_issues: skippedIssues,
    issues
  };
}

function printReport(baseline) {
  console.log(`FC-2 근거 정합 기준선  창: ${baseline.window_since} ~ ${baseline.window_until}  계측기 ${baseline.instrument_version}`);
  console.log('');
  console.log('날짜         점수  상태   기사  근거있음  근거없음  조인실패  판정상충');
  for (const issue of baseline.issues) {
    console.log(
      [
        issue.date,
        String(issue.quality_score).padStart(6),
        String(issue.quality_status).padStart(6),
        String(issue.article_count).padStart(6),
        String(issue.grounded_count).padStart(9),
        String(issue.ungrounded_count).padStart(9),
        String(issue.unjoined_count).padStart(9),
        String(issue.ambiguous_count).padStart(9)
      ].join('')
    );
  }
  const { totals } = baseline;
  const percent = totals.articles ? `${Math.round((100 * totals.ungrounded) / totals.articles)}%` : '-';
  console.log('');
  console.log(`합계  ${totals.issues}호 / 기사 ${totals.articles}개  |  근거없음 ${totals.ungrounded}개 (${percent})  |  조인실패 ${totals.unjoined}개  |  판정상충 ${totals.ambiguous}개`);

  for (const skipped of baseline.skipped_issues) {
    console.log(`  건너뜀 ${skipped.date}: ${skipped.missing_reports.join(', ')} 없음`);
  }

  const ungroundedArticles = baseline.issues.flatMap(issue =>
    issue.articles
      .filter(article => article.joined && !article.grounded)
      .map(article => ({ date: issue.date, ...article }))
  );
  if (ungroundedArticles.length) {
    console.log('');
    console.log('근거 없이 발행된 기사:');
    for (const article of ungroundedArticles) {
      console.log(`  ${article.date}  ${article.headline.slice(0, 56)}`);
      console.log(`             ${article.evidence.join(' | ') || '(대응 후보 없음)'}`);
    }
  }
}

function articleVerdictKey(issueDate, article) {
  return `${issueDate} | ${article.source_urls.join(',')}`;
}

// 얼린 기준선이 있으면 지금 값과 비교해 무엇이 달라졌는지만 알린다.
// 통과/실패를 판정하지는 않는다. 그 선을 어디 그을지는 아직 정해진 바가 없다.
function reportDrift(baseline) {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('');
    console.log('얼린 기준선 없음. 지금 값을 고정하려면: node lab/check-groundedness-baseline.js --write');
    return;
  }
  const frozen = readJsonFile(BASELINE_FILE);
  const changes = [];
  if (frozen.instrument_version !== baseline.instrument_version) {
    changes.push(`계측기 판본: ${frozen.instrument_version} -> ${baseline.instrument_version} (수치 차이가 파이프라인 때문이 아닐 수 있다)`);
  }
  if (frozen.window_since !== baseline.window_since || frozen.window_until !== baseline.window_until) {
    changes.push(`창: ${frozen.window_since}~${frozen.window_until} -> ${baseline.window_since}~${baseline.window_until}`);
  }
  for (const key of Object.keys(baseline.totals)) {
    if (frozen.totals?.[key] !== baseline.totals[key]) {
      changes.push(`${key}: ${frozen.totals?.[key]} -> ${baseline.totals[key]}`);
    }
  }

  // 건너뛴 호는 totals 에 안 들어가므로 산출물이 사라져 모집단이 줄어도 합계 비교로는 안 잡힌다.
  const frozenSkipped = new Set((frozen.skipped_issues || []).map(issue => issue.date));
  const currentSkipped = new Set(baseline.skipped_issues.map(issue => issue.date));
  for (const date of currentSkipped) {
    if (!frozenSkipped.has(date)) changes.push(`새로 건너뛴 호: ${date}`);
  }
  for (const date of frozenSkipped) {
    if (!currentSkipped.has(date)) changes.push(`다시 읽히는 호: ${date}`);
  }

  // 합계만 비교하면 한 기사가 나빠지고 다른 기사가 좋아지는 상쇄 변화를 놓친다.
  const frozenVerdicts = new Map();
  for (const issue of frozen.issues || []) {
    for (const article of issue.articles || []) {
      frozenVerdicts.set(articleVerdictKey(issue.date, article), article.grounded);
    }
  }
  for (const issue of baseline.issues) {
    for (const article of issue.articles) {
      const key = articleVerdictKey(issue.date, article);
      if (!frozenVerdicts.has(key)) {
        changes.push(`새 기사: ${issue.date} ${article.headline.slice(0, 40)}`);
      } else if (frozenVerdicts.get(key) !== article.grounded) {
        changes.push(`판정 뒤집힘: ${issue.date} ${article.headline.slice(0, 40)} ${frozenVerdicts.get(key)} -> ${article.grounded}`);
      }
    }
  }

  console.log('');
  if (!changes.length) {
    console.log(`얼린 기준선과 동일 (${path.relative(process.cwd(), BASELINE_FILE)})`);
    return;
  }
  console.log('얼린 기준선과 차이:');
  for (const change of changes) {
    console.log(`  ${change}`);
  }
}

function main() {
  const shouldWrite = process.argv.includes('--write');
  const force = process.argv.includes('--force');
  const baseline = buildBaseline();
  printReport(baseline);

  if (!shouldWrite) {
    if (force) {
      console.log('');
      console.log('--force 는 --write 와 함께 써야 한다. 아무것도 쓰지 않았다.');
    }
    reportDrift(baseline);
    return;
  }

  // 커밋된 기준선은 변경 전 상태를 담은 단 하나의 기록이다. 파이프라인을 고친 뒤 이 스크립트를
  // 다시 돌리면 그 기록이 사라지므로, 덮어쓰기는 --force 를 명시할 때만 한다.
  if (fs.existsSync(BASELINE_FILE) && !force) {
    console.log('');
    console.log(`이미 기준선이 있다: ${path.relative(process.cwd(), BASELINE_FILE)}`);
    console.log('덮어쓰면 변경 전 측정치가 사라진다. 정말 교체하려면 --force 를 붙인다.');
    return;
  }

  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log('');
  console.log(`기준선 고정: ${path.relative(process.cwd(), BASELINE_FILE)}`);
}

main();
