# Current Plan

## 2026-05-08 Public Output Repair

- Confirm why PR #36 did not update the site: the merge only added review artifacts under `content/**`; `newsletters/2026-05-08/**` and `data/newsletters.json` were not changed because the run was not publish-ready.
- Do not force-publish the existing failed draft. Repair only if the 2026-05-08 artifacts can be made to pass the existing fact-check, quality, image, localization, and site validators without weakening thresholds.
- Keep the repair date-scoped to `2026-05-08`: update `content/newsroom/2026-05-08/editor-draft.*`, regenerated reports, `newsletters/2026-05-08/*`, and `data/newsletters.json` only if validation passes.
- Preserve candidate/source binding from `shortlisted-candidates.json` and remove or replace any main article that lacks article-level Camera HAL / Android Camera relevance.

## Validation

- Run focused regeneration/recompute commands using existing `scripts/newsroom` renderer and validator modules.
- Run `npm.cmd run validate` as the final repository gate.
- Self-review the diff for publication safety, validator contract drift, unsupported claims, source binding, and unintended generated artifact churn.
