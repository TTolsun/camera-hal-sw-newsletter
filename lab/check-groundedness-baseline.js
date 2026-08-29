'use strict';

// FC-2 근거 정합(groundedness) 기준선 계산기.
//
// 묻는 것: 발행된 main 기사가, 원문을 실제로 받아와 뒷받침된 출처를 하나라도 가지고 있는가.
//
// 이 질문은 fact-checker(LLM)도 답하도록 되어 있다. 그런데 커밋된 산출물을 보면
// 그 답이 12호 내내 전부 긍정이었다. publishable=false 0건, source_gap 0건.
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

const fs = require('fs');
const path = require('path');

// 기준선 창의 시작일.
// 2026-06-29 가 주간 체제의 첫 호다. 커밋된 산출물의 발행 간격을 세어 확인했다 -
// 06-11, 06-16, 06-20, 06-21, 06-22, 06-24 까지는 간격이 5·4·1·1·2일로 일간 체제이고,
// 06-29 부터 5·7·7·7·… 로 주 단위가 된다.
// 일간 호와 섞으면 한 모집단이 아니게 되므로 창을 여기서 끊는다.
// 창을 바꾸려면 이 상수를 고친다.
const BASELINE_SINCE = '2026-06-29';

const NEWSROOM_DIRECTORY = path.join(__dirname, '..', 'articles', 'content', 'newsroom');
const BASELINE_FILE = path.join(__dirname, 'results', 'groundedness-baseline.json');

const ISSUE_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// quality-report 의 출처 URL과 evidence-validation-report 의 후보 URL을 같은 모양으로 맞춘다.
// 한쪽은 퍼센트 인코딩된 채로 남아 있는 경우가 있어서(예: v0.7.2%2Brpt20260817) 디코딩이 필요하다.
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
  return decoded.replace(/\/+$/, '').toLowerCase();
}

function listIssueDates() {
  return fs
    .readdirSync(NEWSROOM_DIRECTORY)
    .filter(name => ISSUE_DIRECTORY_PATTERN.test(name))
    .filter(name => name >= BASELINE_SINCE)
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
    `supported=${Number(candidate.supported_claims) || 0}`
  ].join(' ');
}

function evaluateIssue(date) {
  const issueDirectory = path.join(NEWSROOM_DIRECTORY, date);
  const qualityFile = path.join(issueDirectory, 'quality-report.json');
  const evidenceFile = path.join(issueDirectory, 'evidence-validation-report.json');
  if (!fs.existsSync(qualityFile) || !fs.existsSync(evidenceFile)) {
    return null;
  }

  const qualityReport = readJsonFile(qualityFile);
  const evidenceReport = readJsonFile(evidenceFile);

  const candidateByUrl = new Map();
  for (const candidate of evidenceReport.candidates || []) {
    candidateByUrl.set(normalizeSourceUrl(candidate.url), candidate);
  }

  const articles = [];
  for (const articleResult of qualityReport.article_results || []) {
    const sourceUrls = (articleResult.sources || [])
      .map(source => normalizeSourceUrl(source.url))
      .filter(Boolean);
    const matchedCandidates = sourceUrls
      .map(url => candidateByUrl.get(url))
      .filter(Boolean);

    // 조인 실패는 근거 없음과 다른 문제다(리포트 두 개가 어긋난 상태). 따로 센다.
    const joined = matchedCandidates.length > 0;
    const grounded = joined && matchedCandidates.some(isSupportingCandidate);

    articles.push({
      headline: articleResult.headline || '',
      source_urls: sourceUrls,
      joined,
      grounded,
      evidence: matchedCandidates.map(describeCandidate)
    });
  }

  return {
    date,
    quality_score: qualityReport.score,
    quality_status: qualityReport.status,
    article_count: articles.length,
    grounded_count: articles.filter(article => article.grounded).length,
    ungrounded_count: articles.filter(article => article.joined && !article.grounded).length,
    unjoined_count: articles.filter(article => !article.joined).length,
    articles
  };
}

function buildBaseline() {
  const issues = listIssueDates()
    .map(evaluateIssue)
    .filter(Boolean);

  const totals = issues.reduce(
    (accumulator, issue) => ({
      issues: accumulator.issues + 1,
      articles: accumulator.articles + issue.article_count,
      grounded: accumulator.grounded + issue.grounded_count,
      ungrounded: accumulator.ungrounded + issue.ungrounded_count,
      unjoined: accumulator.unjoined + issue.unjoined_count
    }),
    { issues: 0, articles: 0, grounded: 0, ungrounded: 0, unjoined: 0 }
  );

  return {
    metric: 'FC-2 groundedness',
    definition: 'main 기사의 출처 중 source_fetch_used=true 이고 supported_claims>0 인 후보가 하나 이상 있는가',
    window_since: BASELINE_SINCE,
    window_until: issues.length ? issues[issues.length - 1].date : null,
    totals,
    ungrounded_ratio: totals.articles ? Number((totals.ungrounded / totals.articles).toFixed(4)) : 0,
    issues
  };
}

function formatPercent(part, whole) {
  if (!whole) {
    return '  -  ';
  }
  return `${((100 * part) / whole).toFixed(0).padStart(3)}%`;
}

function printReport(baseline) {
  console.log(`FC-2 근거 정합 기준선  창: ${baseline.window_since} ~ ${baseline.window_until}`);
  console.log('');
  console.log('날짜         점수  상태   기사  근거있음  근거없음  조인실패');
  for (const issue of baseline.issues) {
    console.log(
      [
        issue.date,
        String(issue.quality_score).padStart(6),
        String(issue.quality_status).padStart(6),
        String(issue.article_count).padStart(6),
        String(issue.grounded_count).padStart(9),
        String(issue.ungrounded_count).padStart(9),
        String(issue.unjoined_count).padStart(9)
      ].join('')
    );
  }
  const { totals } = baseline;
  console.log('');
  console.log(
    `합계  ${totals.issues}호 / 기사 ${totals.articles}개  |  근거없음 ${totals.ungrounded}개 (${formatPercent(totals.ungrounded, totals.articles).trim()})  |  조인실패 ${totals.unjoined}개`
  );

  const ungroundedArticles = baseline.issues.flatMap(issue =>
    issue.articles
      .filter(article => article.joined && !article.grounded)
      .map(article => ({ date: issue.date, ...article }))
  );
  if (ungroundedArticles.length) {
    console.log('');
    console.log('근거 없이 발행된 기사:');
    for (const article of ungroundedArticles) {
      console.log(`  ${article.date}  ${article.headline.slice(0, 60)}`);
      console.log(`             ${article.evidence.join(' | ') || '(대응 후보 없음)'}`);
    }
  }
}

// 얼린 기준선이 있으면 지금 값과 비교해 무엇이 달라졌는지만 알린다.
// 통과/실패를 판정하지는 않는다. 그 선을 어디 그을지는 아직 정해진 바가 없다.
function reportDrift(baseline) {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('');
    console.log(`얼린 기준선 없음. 지금 값을 고정하려면: node lab/check-groundedness-baseline.js --write`);
    return;
  }
  const frozen = readJsonFile(BASELINE_FILE);
  const changes = [];
  for (const key of ['issues', 'articles', 'grounded', 'ungrounded', 'unjoined']) {
    if (frozen.totals[key] !== baseline.totals[key]) {
      changes.push(`${key}: ${frozen.totals[key]} -> ${baseline.totals[key]}`);
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
