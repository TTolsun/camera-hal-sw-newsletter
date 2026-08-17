'use strict';

// Turns a judge run into the numbers Week 01 is measured by.
//
//   node lab/score.js lab/results/run-calibration-v1-<stamp>.json
//
// Cohen's kappa rather than raw agreement, because raw agreement rewards a judge
// that has stopped discriminating: on a set that is 55% "no", a judge answering
// "no" every time scores 0.55 and looks passable. Kappa scores it exactly 0, which
// is what it deserves. judge_degenerate reports the same fact directly, so that a
// collapsed judge is visible even to someone skimming.

const fs = require('node:fs');
const path = require('node:path');

function confusion(rows) {
  const cells = { tp: 0, fn: 0, fp: 0, tn: 0 };
  for (const row of rows) {
    if (row.human_label === 'yes' && row.judge_label === 'yes') cells.tp += 1;
    else if (row.human_label === 'yes') cells.fn += 1;
    else if (row.judge_label === 'yes') cells.fp += 1;
    else cells.tn += 1;
  }
  return cells;
}

function cohensKappa(cells, total) {
  if (total === 0) return 0;
  const observed = (cells.tp + cells.tn) / total;
  const humanYes = (cells.tp + cells.fn) / total;
  const judgeYes = (cells.tp + cells.fp) / total;
  const expected = humanYes * judgeYes + (1 - humanYes) * (1 - judgeYes);
  // Both raters unanimous and identical: agreement is total but carries no
  // information, so chance already explains it.
  return expected === 1 ? 0 : (observed - expected) / (1 - expected);
}

function round(value) {
  return Number(value.toFixed(3));
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node lab/score.js <run file>');

  const run = JSON.parse(fs.readFileSync(file, 'utf8'));

  // A dry run carries stub verdicts, so every number derived from it is fiction
  // that happens to be shaped like a measurement. Refuse rather than print it.
  if (run.summary.dry_run && !process.argv.includes('--force')) {
    throw new Error(
      `${path.basename(file)} is a dry run: its verdicts are stubs, not judgements. ` +
      'Run "node lab/judge.js" with GEMINI_API_KEY set, then score that file. ' +
      'Pass --force only to inspect the wiring.'
    );
  }

  const scored = run.rows.filter(row => !row.error && row.human_label !== null && row.judge_label !== null);
  const skipped = run.rows.length - scored.length;

  if (scored.length === 0) {
    throw new Error(
      `nothing to score: ${run.rows.length} rows, none with both a human and a judge label. ` +
      'Either the run predates the hand labels, or the labels are still empty.'
    );
  }

  const cells = confusion(scored);
  const total = scored.length;
  const humanYes = total ? (cells.tp + cells.fn) / total : 0;
  const judgeYes = total ? (cells.tp + cells.fp) / total : 0;

  const result = {
    source: file,
    split: run.summary.split,
    prompt: run.summary.prompt,
    dry_run: run.summary.dry_run,
    n_scored: total,
    n_skipped: skipped,
    confusion: cells,
    raw_agreement: round(total ? (cells.tp + cells.tn) / total : 0),
    cohens_kappa: round(cohensKappa(cells, total)),
    human_yes_rate: round(humanYes),
    judge_yes_rate: round(judgeYes),
    judge_degenerate: total > 0 && (cells.tp + cells.fp === 0 || cells.fn + cells.tn === 0),
    // What a judge that had learned nothing would score. Kappa above zero means
    // beating these; a raw agreement below them means losing to a constant answer.
    constant_answer_agreement: { all_yes: round(humanYes), all_no: round(1 - humanYes) },
    run_health: {
      failed_cases: run.summary.failed_cases,
      routing_warning: run.summary.routing_warning,
      provider_requests: run.summary.provider_requests,
      amplification: run.summary.amplification,
      estimated_cost_usd: run.summary.totals.estimated_cost_usd
    },
    disagreements: scored
      .filter(row => row.human_label !== row.judge_label)
      .map(row => ({
        family_key: row.family_key,
        title: row.title,
        human: row.human_label,
        judge: row.judge_label,
        judge_reason: row.judge_reason,
        category: ''
      }))
  };

  console.log(JSON.stringify(result, null, 2));

  if (skipped > 0) {
    console.error(`\n${skipped} rows excluded: unlabelled or errored. Kappa covers ${total} items only.`);
  }
  if (result.judge_degenerate) {
    console.error('\njudge_degenerate: the judge answered one class throughout. Kappa is 0 by construction.');
  }
}

main();
