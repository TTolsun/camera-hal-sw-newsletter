# Current Plan

## Editor Retry Recovery And Reviewable PR Handoff

- Keep the existing quality and publish gates strict. A 2-section editor retry output remains invalid and must never become publish-ready.
- When an editor retry violates the output contract and `lastKnownValidEditor` exists, preserve the last valid draft plus canonical diagnostics under `content/newsroom/<date>/` and write `FAILED_REPAIR_REVIEWABLE`.
- Treat `FAILED_REPAIR_REVIEWABLE` as reviewable but not publishable. It can create a `needs-fix` PR, but site publish validation must not run for it.
- Do not let `.tmp` files alone make the workflow reviewable. Require at least one same-date canonical diagnostic/review artifact under `content/newsroom/<date>/`.

## Implementation Scope

- `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
  - Add editor retry contract helpers for `target_section_count`, `locked_section_count`, and `replacement_required_count`.
  - Prefer `lastKnownValidEditor.sections.length` for the target section count, then current valid draft length, then policy minimum.
  - Reject locked-only retry output and section-count drift before canonical write.
  - Route editor semantic failures with `lastKnownValidEditor` through `FAILED_REPAIR_REVIEWABLE` artifact preservation.
- Workflow handoff
  - Add a helper that outputs `date`, `branch`, `has_reviewable_artifacts`, `has_publish_candidate`, and `reviewable_artifact_reason`.
  - Use generation status date before `.tmp/newsletter-date.txt`, explicit `NEWSLETTER_DATE`, then KST today.
  - Run site validation and publish-status resolution only for publish candidates; still create PRs for reviewable needs-fix artifacts.
- tests
  - Cover 2-section retry failure recovery, locked/replacement contract counts, locked-only rejection, `.tmp`-only non-reviewability, and `FAILED_REPAIR_REVIEWABLE` workflow routing.

## Validation

- `node --test tests/targeted-retry.test.js`
- `node --test tests/workflow-scripts.test.js`
- `npm.cmd run test`
- `npm.cmd run validate`
