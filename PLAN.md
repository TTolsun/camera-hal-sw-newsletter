# Current Plan

## Fallback Public Issue Recovery

- Keep publication gates intact: do not lower `quality_threshold`, minimum main article count, source gap blocking, or `public_newsletter_ready` semantics.
- Narrowly improve `scripts/newsroom/generate/fallback-public-issue.js` so AndroidX Camera release-note anchor URLs can provide distinct safe candidates while exact-anchor and anchorless page duplicates stay blocked.
- Split fallback article handling into explicit actions: `preserve`, `rebuild-from-bound-candidate`, `replace-or-demote`, and `demote-to-watch`.
- Keep `FAILED_REPAIR_REVIEWABLE` review-only and force publish-ready signals false.
- When fallback cannot fill the minimum safe article count, leave public files unwritten and emit diagnostics with candidate rejection reasons.

## Validation

- `node --test tests/workflow-scripts.test.js`
- `npm.cmd run test`
- `npm.cmd run validate`

## Self Review Focus

- P1 if a failed repair can become publish-ready without valid public newsletter files.
- P1 if source gap, source-integrity failure, or `publishable_scope=false` articles remain as main articles.
- P2 if AndroidX Camera anchor candidates are still blocked by base URL duplication.
- P2 if fallback failure lacks actionable diagnostics.
