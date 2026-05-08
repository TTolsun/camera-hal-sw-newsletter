# Current Plan

## Public Newsletter Ready + Structural Gate

- Add `scripts/ensure-public-newsletter-artifacts.js` and the canonical `scripts/newsroom/cli/ensure-public-newsletter-artifacts.js`.
- Add `scripts/newsroom/generate/fallback-public-issue.js` so quality failure, `final_publish_ready=false`, repair failure, `section_count_drift`, hard failure articles, and article shortage trigger deterministic public issue generation instead of PR suppression.
- Preserve PASS/preserve articles from `quality-report.json` without changing source URL, `source_candidate_hash`, headline, category, `confirmed_facts`, `camera_hal_perspective`, or `action_items`.
- Remove, demote, or replace only hard failure articles. Add replacement/fallback articles only when needed to satisfy the configured minimum main article count.
- Make `public_newsletter_ready=true` require public files, non-empty contents, changed-file inclusion, `data/newsletters.json` path integrity, and structural validation.
- Change `.github/workflows/01-weekly-newsroom-pr.yml` to run `ensure-public-newsletter-artifacts.js` after generation and before `resolve-reviewable-artifacts.js`; PR body, labels, and PR creation must require `public_newsletter_ready == 'true'`.
- Update PR body generation and validation so Newsletter PRs never describe missing public files; when `final_publish_ready=false`, state that public newsletter files were generated and editor merge publishes the issue.
- Restore 2026-05-09 public files using existing newsroom artifacts, with GCC 16.1 removed from direct HAL main article treatment or clearly downgraded to fallback/watch context.

## Validation

- `npm.cmd run test`
- `npm.cmd run validate:policy`
- `npm.cmd run validate`
- `git diff --check`

## Self Review Focus

- P1 if `create-pull-request` can run with `public_newsletter_ready=false`.
- P1 if structural validation is not part of public readiness.
- P1 if PASS/preserve article fields are changed unnecessarily.
- P1 if quality/repair/final-publish/article-shortage is treated as a public readiness failure reason instead of a fallback trigger.
