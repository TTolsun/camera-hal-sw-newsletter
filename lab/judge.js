'use strict';

// Runs the LLM judge over one split and records what it cost to find out.
//
// Every GEMINI_* variable is set before llm-client is required. That module reads
// its runtime configuration at load time, so a variable set afterwards is ignored
// without any error — the failure mode is a silently expensive run, not a crash.
//
//   node lab/judge.js                  calibration, prompt v1
//   node lab/judge.js --dry-run        wiring and metering only, no API key needed
//   node lab/judge.js --prompt v2      same split, revised rubric
//
// The defaults below are lab defaults, not production ones. Production allows two
// retries and an eight-minute timeout per call; against a two-model fallback chain
// that is up to six requests and sixteen minutes of wall clock for a single item,
// which would eat a whole study slot.

process.env.GEMINI_MAX_RETRIES = process.env.GEMINI_MAX_RETRIES || '1';
process.env.GEMINI_CALL_TIMEOUT_MS = process.env.GEMINI_CALL_TIMEOUT_MS || '60000';
process.env.LLM_RAW_OUTPUT_DIR = process.env.LLM_RAW_OUTPUT_DIR || 'lab/tmp/gemini-raw';

// --model has to be read here rather than in main(). llm-client resolves its stage
// model policy when the module loads, so an override set after the require below is
// accepted without complaint and then ignored.
{
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--model');
  if (at !== -1 && argv[at + 1]) process.env.NEWSROOM_JUDGE_MODEL = argv[at + 1];
}

const fs = require('node:fs');
const path = require('node:path');

const {
  callLlmJson,
  resetLlmDiagnostics,
  getLlmDiagnostics,
  getLlmCostCalls,
  buildCostReport
} = require('../src/shared/llm/llm-client');
const { assertLabelsWellFormed } = require('./label-schema');

// The stage name must contain "judge" as a standalone word. An unrecognised stage
// falls back to the reporter model group — the expensive one — and says so only in
// a routing_warning field that nothing reads by default.
const STAGE = 'week01 judge agreement';

const DATASETS_DIR = path.join(__dirname, 'datasets');
const RESULTS_DIR = path.join(__dirname, 'results');
const PROMPTS_DIR = path.join(__dirname, 'prompts');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', enum: ['yes', 'no'] },
    reason: { type: 'string' }
  },
  required: ['label', 'reason']
};

function parseArgs(argv) {
  const args = {
    set: 'calibration',
    prompt: 'v1',
    dryRun: argv.includes('--dry-run'),
    unseal: argv.includes('--unseal')
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--set') args.set = argv[i + 1];
    if (argv[i] === '--prompt') args.prompt = argv[i + 1];
    if (argv[i] === '--model') args.model = argv[i + 1];
  }
  return args;
}

// dev stays sealed until Week 02 and test until Week 08. Opening one is a decision,
// so it takes a flag; forgetting which split you were on should not be able to make it.
function assertSplitAllowed(splitName, unseal) {
  if (splitName === 'calibration') return;
  if (!['dev', 'test'].includes(splitName)) {
    throw new Error(`unknown split "${splitName}" (expected calibration, dev, or test)`);
  }
  if (!unseal) {
    throw new Error(
      `the ${splitName} split is sealed. Opening it spends a one-shot measurement: ` +
      'dev answers the Week 02 gate, test the Week 08 one. Pass --unseal if that is what you mean.'
    );
  }
  console.warn(`WARN opening the sealed ${splitName} split. This run is the measurement.`);
}

function loadItems(splitName) {
  const file = path.join(DATASETS_DIR, `${splitName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `${path.basename(file)} does not exist. Sealed splits are not written until they are ` +
      `opened on purpose: node lab/build-dataset.js --open ${splitName}`
    );
  }
  const items = JSON.parse(fs.readFileSync(file, 'utf8')).items;
  const labelled = assertLabelsWellFormed(items, path.basename(file));

  // A gate run costs its split's one shot. Spending it on unlabelled items would burn
  // the seal and produce nothing, since kappa needs both raters.
  const unlabelled = items.length - labelled;
  if (splitName !== 'calibration' && unlabelled > 0) {
    throw new Error(
      `${unlabelled} of ${items.length} ${splitName} items have no hand label. This split is a ` +
      'one-shot measurement, so running it now would spend that shot on a set that cannot be ' +
      'scored. Label them first.'
    );
  }
  return items;
}

// The judge sees the same four fields the human labeller saw. pipeline_selection and
// human_label are withheld: either one would let it copy an answer instead of forming one.
function buildPrompt(item) {
  return [
    `title: ${item.title}`,
    `url: ${item.url}`,
    `source_name: ${item.source_name}`,
    `summary: ${item.summary}`
  ].join('\n');
}

// A stubbed provider keeps the whole call path — routing, retry, metering, cost
// accounting — and replaces only the network hop, so the wiring can be checked
// before an API key exists.
function stubbedProvider() {
  const gemini = require('../src/shared/llm/providers/gemini-provider');
  return {
    ...gemini,
    getApiKey: () => 'dry-run',
    async execute() {
      return {
        text: JSON.stringify({ label: 'no', reason: 'dry-run stub, not a judgement' }),
        usageMetadata: { promptTokenCount: 320, candidatesTokenCount: 40, totalTokenCount: 360 }
      };
    }
  };
}

function requestsForStage(diagnostics) {
  const perModel = diagnostics.model_usage[STAGE] || {};
  return Object.values(perModel).reduce((total, usage) => total + usage.requests, 0);
}

function sumField(calls, field) {
  return calls.reduce((total, call) => total + (Number(call[field]) || 0), 0);
}

async function judgeItem(item, options) {
  const costCallsBefore = getLlmCostCalls().length;
  const requestsBefore = requestsForStage(getLlmDiagnostics());
  const startedAt = Date.now();

  let verdict = null;
  let error = null;
  try {
    verdict = await callLlmJson(STAGE, options.systemPrompt, buildPrompt(item), RESPONSE_SCHEMA, options.llmOptions);
  } catch (caught) {
    // One bad item must not discard the nineteen that already cost money.
    error = caught.message;
  }

  const calls = getLlmCostCalls().slice(costCallsBefore);
  return {
    family_key: item.family_key,
    url: item.url,
    title: item.title,
    human_label: item.human_label,
    judge_label: verdict ? verdict.label : null,
    judge_reason: verdict ? verdict.reason : null,
    error,
    wall_ms: Date.now() - startedAt,
    provider_requests: requestsForStage(getLlmDiagnostics()) - requestsBefore,
    responded_calls: calls.length,
    models: calls.map(call => call.model),
    attempts: calls.map(call => call.attempt),
    prompt_tokens: sumField(calls, 'prompt_tokens'),
    output_tokens: sumField(calls, 'output_tokens'),
    thinking_tokens: sumField(calls, 'thinking_tokens'),
    estimated_cost_usd: sumField(calls, 'estimated_cost_usd')
  };
}

function summarise(rows, args, diagnostics) {
  const report = buildCostReport({ calls: getLlmCostCalls() });
  const providerRequests = requestsForStage(diagnostics);
  const routing = diagnostics.model_routing[STAGE] || {};

  return {
    stage: STAGE,
    split: args.set,
    prompt: args.prompt,
    // Recorded rather than inferred from model_usage, which only shows what answered.
    // Comparing two runs is meaningless without knowing which knob each one turned.
    model_override: process.env.NEWSROOM_JUDGE_MODEL || '(stage default)',
    dry_run: args.dryRun,
    logical_cases: rows.length,
    // Requests actually issued, including ones that failed. buildCostReport counts
    // only calls that came back, so timeouts and quota errors are invisible to it.
    provider_requests: providerRequests,
    responded_calls: report.totals.request_count,
    amplification: Number((providerRequests / Math.max(rows.length, 1)).toFixed(2)),
    failed_cases: rows.filter(row => row.error).length,
    unlabelled_cases: rows.filter(row => row.human_label === null).length,
    invalid_json_count: diagnostics.invalid_json_count,
    quota_error_count: diagnostics.quota_error_count,
    routing_warning: routing.routing_warning ?? 'MISSING',
    stage_group: routing.stage_group || '',
    model_usage: diagnostics.model_usage[STAGE] || {},
    totals: report.totals,
    knobs: {
      max_retries: process.env.GEMINI_MAX_RETRIES,
      call_timeout_ms: process.env.GEMINI_CALL_TIMEOUT_MS
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertSplitAllowed(args.set, args.unseal);

  if (!args.dryRun && !process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is required to run the judge. Export it, or pass --dry-run to check ' +
      'the wiring without it.'
    );
  }

  const promptFile = path.join(PROMPTS_DIR, `${args.prompt}.txt`);
  if (!fs.existsSync(promptFile)) throw new Error(`${promptFile} is missing`);
  const systemPrompt = fs.readFileSync(promptFile, 'utf8');

  const items = loadItems(args.set);
  const unlabelled = items.filter(item => item.human_label === null).length;
  if (unlabelled > 0) {
    console.warn(`WARN ${unlabelled}/${items.length} items have no human label; agreement will be partial`);
  }

  const options = {
    systemPrompt,
    llmOptions: args.dryRun ? { provider: stubbedProvider() } : {}
  };

  // All items run in one process: the diagnostics state is a module-level singleton,
  // so splitting the run across processes would reset the counters between items.
  resetLlmDiagnostics();
  const rows = [];
  for (const [index, item] of items.entries()) {
    const row = await judgeItem(item, options);
    rows.push(row);
    const verdict = row.error ? 'ERROR' : row.judge_label;
    console.log(`[${index + 1}/${items.length}] ${verdict} req=${row.provider_requests} ${row.family_key}`);
  }

  const summary = summarise(rows, args, getLlmDiagnostics());

  // Dry runs are written somewhere else on purpose. They used to land in results/
  // alongside real runs, and since the obvious way to find a run is to take the
  // newest file, a stub could be scored as though it were a measurement.
  const outDir = args.dryRun ? path.join(__dirname, 'tmp') : RESULTS_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = args.dryRun ? 'DRYRUN' : 'run';
  const outFile = path.join(outDir, `${prefix}-${args.set}-${args.prompt}-${stamp}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  console.log(`wrote ${path.relative(path.resolve(__dirname, '..'), outFile)}`);

  // Checked after the results are safely on disk: a misrouted run still cost money,
  // and its numbers are worth keeping even though they must not be compared.
  if (summary.routing_warning !== '') {
    throw new Error(
      `stage routing warning: ${summary.routing_warning}. The stage name lost its "judge" word, ` +
      `so this run used the ${summary.stage_group} model group. Do not compare it with other runs.`
    );
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
