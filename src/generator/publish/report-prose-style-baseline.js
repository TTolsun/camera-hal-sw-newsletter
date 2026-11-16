'use strict';

// #1380: 과거 호의 문체 참고 지표를 한 번에 계산해 기준선으로 출력합니다.
// 파일을 쓰지 않고 표준 출력에만 냅니다. 발행 판정과 무관한 읽기 전용 도구입니다.

const fs = require('fs');
const path = require('path');
const { measureProseStyle } = require('../quality/prose-style-metrics');

function listIssueFiles(root) {
  const dir = path.join(root, 'articles', 'newsletters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /^\d{4}-W\d{2}$/.test(name))
    .sort()
    .map(name => ({ week: name, file: path.join(dir, name, 'issue.json') }))
    .filter(item => fs.existsSync(item.file));
}

function buildBaseline(root) {
  return listIssueFiles(root).map(({ week, file }) => {
    const issue = JSON.parse(fs.readFileSync(file, 'utf8'));
    const metrics = measureProseStyle(issue.sections);
    return { week, ...metrics };
  });
}

function main() {
  const rows = buildBaseline(process.cwd());
  const lines = ['호\t평균 문장 길이\t120자 초과 비율\t목적절 lead\t번역투 합계'];
  for (const row of rows) {
    const translationese = Object.values(row.translationese_counts).reduce((sum, count) => sum + count, 0);
    lines.push([
      row.week,
      row.avg_sentence_length,
      `${Math.round(row.long_sentence_ratio * 100)}%`,
      `${row.purpose_clause_lead_count}/${row.lead_count}`,
      translationese
    ].join('\t'));
  }
  console.log(lines.join('\n'));
}

if (require.main === module) main();

module.exports = { buildBaseline, listIssueFiles };
