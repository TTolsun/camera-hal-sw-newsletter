# lab/

Experiment workspace for the AI engineering learning track. The newsletter pipeline
is the system under test; this directory is the instrument, and it is kept separate
so that measuring the system never changes it.

**Nothing here writes to `src/` or runs the pipeline.** Week 01 reads frozen
collection artifacts and calls the shared LLM client directly.

## Layout

| Path | Committed | Contents |
| --- | --- | --- |
| `check-environment.js` | yes | Setup gate. Verifies imports, routing, and data before any timed slot |
| `build-dataset.js` | yes | Frozen artifacts to `datasets/`. No LLM calls |
| `datasets/split.json` | yes | Authoritative family allocation. Never regenerated |
| `datasets/calibration.json` | yes | The 20 calibration items and their hand labels |
| `label-definition.md` | yes | What `yes` and `no` mean |
| `prompts/` | yes | Judge rubrics, one file per version |
| `results/` | no | Run output. Ignored |
| `tmp/` | no | Scratch, including raw LLM dumps. Ignored |

`results/` and `tmp/` are ignored for a reason beyond tidiness: `check:domain-model-boundary`
scans untracked files as well as tracked ones, and a judge's free-text `reason` that
happens to contain one of its forbidden provider-shape tokens would fail `npm run validate`.

## Conventions

Never name a file in here `*.test.js`. The hygiene gate requires every `*.test.js` to
live under `src/<layer>/test/`, and its allowlist cannot be used as an escape hatch —
an entry in the allowlist is itself reported as a violation. Verification scripts are
named `check-*.js` and run directly with `node`.

Write files with `fs.writeFileSync`. PowerShell redirection adds a UTF-8 BOM, and
`check:encoding` is the first link in the `validate` chain.

Set any `GEMINI_*` environment variable before requiring `llm-client`. It reads its
runtime configuration at module load, so a variable set afterwards is ignored silently
rather than reported.

Give every stage name an independent word `judge`, for example `week01 judge agreement`.
An unrecognised stage name falls back to the reporter model group, which is the
expensive one, and only surfaces as a `routing_warning` field.

## Verifying a change

```
node lab/check-environment.js
git add -N lab/<new file>
npm run validate
git reset -- lab/
git status --porcelain
```

`npm run validate` takes about 19 seconds and needs neither network nor an API key.
The final `git status` must print nothing: `validate` alone cannot catch a missing
undo. Always scope the reset to a path — a bare `git reset` would unstage work that
another session had staged.

## Week 01 — judge agreement

The question is not whether the reporter stage can run standalone. It is whether an
LLM judge agrees with a human often enough to be worth building on.

```
calibration 20  ──  label by hand  ──  judge  ──  kappa_pre
                                                     │
                                          disagreement analysis
                                                     │
                                            rubric revision
                                                     │
                                                 kappa_post
```

`kappa_post` is measured on the same twenty items the rubric was revised against, so
it is a calibration score, not evidence of generalisation. It will rise; that is what
revising against a set does. It is recorded, not used as a gate.

Week 01 is complete when `failed_cases` is 0, `routing_warning` is empty, both kappa
values are recorded, and every disagreement carries a category. `kappa_post >= 0.40`
is the target, not the pass condition.

The judge's viability gate is Week 02: the untouched 20 dev families, rubric frozen,
one run. At or above 0.60 the judge is adopted; between 0.40 and 0.60 it keeps being
refined while experiments continue on its verdicts; below 0.40 the definition is rewritten.
The two tiers exist because one item moves kappa by 0.133 at n=20, so a single cut line
would turn one item into fifteen weeks of direction. The test families stay sealed until
Week 08.

## Metrics to record every run

`kappa`, raw agreement, the four confusion cells, human and judge positive rates,
`logical_cases`, `provider_requests`, prompt and output and thinking tokens,
`estimated_cost_usd`, `routing_warning`, `failed_cases`.

Count provider requests from `getLlmDiagnostics().model_usage[stage]`, not from
`buildCostReport().totals.request_count` — the latter counts only calls that returned
a response, so timeouts and quota errors vanish from it.
