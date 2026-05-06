# PR #33 Artifact Repair Plan

## Goal

- Repair the 2026-05-07 newsletter artifacts without lowering quality thresholds or publish gates.
- Do not mark `fact-check-report.json` as `PASS` before fixing `editor-draft.json`.
- Preserve the reason each original `must_fix` item is resolved in the final fact-check comment.

## Scope

- Update only the 2026-05-07 generated/review artifacts and narrow generator guard code.
- Keep `QUALITY_THRESHOLD`, review/publish gate constants, JSON schema, and enum values unchanged.
- Leave unrelated local untracked `2026-05-06` artifacts untouched.

## Implementation

- Fix `content/newsroom/2026-05-07/editor-draft.json` first:
  - Keep `sections[0].selectedImage` empty and use the local fallback through `resolvedImage`.
  - Explain that the mailing list source has no suitable image and the GitLab card candidate belongs to a different issue URL.
  - Reframe the Glaze article as `cpp_ai_tooling_fallback` watch/PoC material for `Clang / LLVM / libc++`-centric Android native development, not as an Android HAL toolchain migration.
  - Make the Glaze action item concrete with HAL owner, target metadata structures, serialization target, and metrics.
  - Remove unsourced `GCC 16.1` narrative mentions unless they are backed by a separate sourced article.
- After content repair, update `fact-check-report.*`:
  - Use LLM fact-check output if available.
  - If only artifact repair is feasible, set `must_fix` to empty only after the content fix and record per-item resolution evidence in `final_comment`.
- Regenerate derived artifacts from the repaired editor draft and fact-check data:
  - `editor-draft.md`
  - `newsletters/2026-05-07/newsletter.md`
  - `newsletters/2026-05-07/index.html`
  - `quality-report.json`
  - `quality-report.md`
  - `editor-in-chief-brief.md`
  - `release-qa-report.md`
  - `data/newsletters.json`
- Add a narrow deterministic guard for safe resolved fallback image false positives, plus regression coverage.

## Validation

- `npm.cmd run test`
- `npm.cmd run validate`
- `git diff --check`
