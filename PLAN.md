# Current Plan

## editorial_reviewable Structural Validation Hardening

- Keep `editorial_reviewable` review-only: no public issue files and no `data/newsletters.json` update.
- Move rendered issue structural checks into a shared validator used by both generator and `validate-site.js`.
- Treat structural publication failures as terminal before editorial-reviewable handoff.
- Keep editorial quality/fact-check failures reviewable when structure is valid.

## Implementation Scope

- Add `scripts/newsroom/validate/rendered-issue-structure.js`.
  - Export `validateRenderedIssueStructure({ date, editor, markdown, html, root })`.
  - Return `{ ok, errors, text }`.
  - Validate only terminal structural contracts: TODO, briefing, references, sources, HTML skeleton, anchors, required issue classes, source-list links, article image HTML, selectedImage contract, and existing `data/newsletters.json` parse/schema/path safety.
  - Do not fail for quality score, fact-check `must_fix`, `source_gap_count`, weak Camera HAL perspective/actionability, or article count/composition.
- Update `scripts/newsroom/cli/validate-site.js`.
  - Reuse the shared validator for newsletter markdown/html/editor structural checks.
  - Keep site-specific checks such as archive/MD link validation and quality/composition warnings outside the helper.
- Update `scripts/newsroom/cli/gemini-newsroom-newsletter.js`.
  - Replace the current partial `assertTerminalPublicationContracts()` checks with the shared validator.
  - On structural failure, write a recovery prompt and terminal-fail before `editorial_reviewable` return.
- Update PR body rendering and validation.
  - For `failure_kind="editorial_reviewable"`, keep public artifacts out of `## 생성 산출물`.
  - Add `## 생성하지 않은 public 산출물` with `not generated` / `not updated` wording.
  - Make `validate-pr-body.js` parse PR body sections and enforce the public artifact rule only in the relevant sections.

## Validation

- Run targeted tests:
  - `node --test tests/workflow-scripts.test.js`
  - `node --test tests/validator-strictness.test.js`
  - `node --test tests/rendered-issue-structure.test.js`
- Run full verification:
  - `npm.cmd run test`
  - `npm.cmd run validate`
- Self-review for P1/P2 risks: accidental public publication, weakened structural gates, PR body drift, and unrelated generated artifact edits.
