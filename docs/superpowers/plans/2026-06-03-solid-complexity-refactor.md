# SOLID Complexity Refactor Plan

> Phased, low-risk decomposition of the newsroom's largest god-files. Each phase keeps the
> public surface (exports + shims) intact, is guarded by the full test + validate gate, and is
> committed independently per the repo's narrow-PR rule (AGENTS.md).

## Context

`npm.cmd run` over `scripts/newsroom` shows three files concentrate most of the complexity:

| File | LOC | Core SRP problem |
| --- | --- | --- |
| `cli/gemini-newsroom-newsletter.js` | 4825 | God-file: ~20 distinct responsibility clusters (prompts, editor validation, reporter matching, **section identity**, repair planning, quality post-processing, status/artifact writers, the main orchestration loop) in one module, mutating one shared `generationRunState`. |
| `validate/newsletter-quality.js` | 2313 | `buildNewsletterQualityReport` is a ~500-line function applying 15+ quality domains (composition, fields, source-integrity, claims, evidence, HAL depth, scope, actionability, HAL signal, image, …) inline. |
| `cli/build-newsroom-pr-body.js` | 2584 | 14 render clusters interleaving artifact IO (`readJsonObjectIfExists`) with markdown formatting. |

Constraints (AGENTS.md): keep changes narrow; do not mass-rewrite import paths or delete the
`scripts/*.js` / `scripts/lib/**` compatibility shims; real implementation stays under
`scripts/newsroom/{...}/`.

## Principle

Apply **SRP first** (the dominant violation), via the safest possible move: extract a
**pure, cohesive, internal** cluster into a focused module and have the parent `require` it back.
Pure clusters have no IO/LLM/shared-state coupling, are fully covered by the existing suite, and
do not appear in any module's `module.exports`, so extraction cannot change behavior or the public
surface. Later phases tackle the harder IO/stateful clusters.

## Phase 1 — Section identity / duplicate detection (DONE)

**What:** Extracted the 18 pure functions that decide "are these two sections (or a candidate and
a section) the same" out of the god-file into `scripts/newsroom/common/section-identity.js`:
`normalizeTitle`, `titleSimilarity`, `urlKeys`, `sectionUrls`, `sourceDateTitle`,
`sourceUrlSignature`, `sectionRepairSignature`, `sectionLabelKey`, `stableSectionKey`,
`stableSectionKeySet`, `sameStringSet`, `protectedRepairSignature`, `protectedRepairFieldsMatch`,
`sameSectionLabel`, `signaturesMatch`, `sectionsAreDuplicate`, `duplicateReasonForSections`,
`candidateDuplicatesSections`.

**Why this first:** single clear responsibility (section identity), all pure transforms, none were
exported (zero public-surface impact), used ~100× across the god-file by the validation/repair/locking
clusters — so the primitives belonged in a shared module, not the orchestrator.

**How:** new module owns the functions; the god-file destructures them from
`require('../common/section-identity')`; the only non-trivial dependency is `normalizeUrl`
(imported from `../generate/newsroom-selection`, no cycle). The god-file shrank from 4825 → ~4678
lines. New unit tests in `tests/unit/common/section-identity.test.js` cover the module directly.

**Verification:** `npm.cmd run test` (1322 pass) + `npm.cmd run validate` (EXIT 0).

## Phase 2 — Fact-check / quality post-processing (DONE)

Extracted the post-generation editor/fact-check transforms (`sanitizeClaimEvidenceIds`,
`stampCoverageType`, `pruneCatchUpFramingFactCheckItems`, `validateFactCheck`,
`collectValidEvidenceIds`, `isSchemaFieldFactCheckViolation`, `isCatchUpFramingFalsePositive`,
`FACT_CHECK_SCHEMA_FIELD_BLOCKLIST`) into `scripts/newsroom/cli/fact-check-postprocess.js`. Pure
transforms. The god-file requires the four it uses and re-exports `stampCoverageType` +
`pruneCatchUpFramingFactCheckItems`, so the surface is unchanged. God-file ~4678 → ~4566 lines.
Direct unit coverage in `tests/unit/cli/fact-check-postprocess.test.js`.

## Phase 3 — Decompose `buildNewsletterQualityReport` (DONE)

The publish-critical quality gate's main function held a ~275-line, 17-step per-section loop. Each
quality domain is now a named, pure descriptor-returning checker **in the same file** (cross-file
modules were rejected because each checker needs 5–15 sibling predicate helpers — a separate file
would force heavy coupling or a circular dependency): `requiredFieldDeductions`,
`fieldHygieneDeductions`, `sourceBindingDeductions`, `editorialStoryDeductions`, `cameraXDeductions`,
`evidenceSpecificityDeductions`, `halDepthDeductions`, `scopeRelevanceDeductions`,
`actionabilityDeductions`, `halSignalDeductions`, `fallbackAndAiScopeDeductions`,
`imageFallbackDeductions`. The loop applies them in identical order via `applyDeductionDescriptors`;
the cross-section duplicate-URL pass and stateful claim/linked-evidence calls stay inline. Behaviour
is unchanged (same deductions/points/options/order/counter). `buildNewsletterQualityReport` shrank
507 → 283 lines. Verified by the full quality contract/fixture suite + selection-diagnostics fixture
+ validate, all identical.

## Phase 4 — Split PR-body loaders from renderers (DONE)

Extracted the artifact IO/location concern from `build-newsroom-pr-body.js` into
`scripts/newsroom/cli/pr-body-artifacts.js` (`readTextIfExists`, `readJsonIfExists`,
`readJsonObjectIfExists`, the `newsroomArtifactPath`/`collectedArtifactPath` locators, and the
`loadNewsroomReport`/`loadNewsroomJson`/`loadCollectedReport` date-scoped loaders). Renderers focus
on formatting and call the shared loaders; the regular date-scoped reads were migrated to the
loaders. Public surface unchanged. `pr-body-rendering` tests (32) + full suite + validate pass.

## Out of scope

The main orchestration loop (`main()`), `generationRunState`, and LLM-context builders stay in the
god-file — they are the genuine coordination layer. The goal is to shrink the file by removing
**non-orchestration** concerns, not to invert control of the orchestration itself.
