# Newsletter Policy Follow-Up Fix Plan

## Goal

Apply the narrow Newsletter Policy follow-up directly on `main`: keep injected policy rendering pure, document historical fact-check strictness, and record validation results in the final response.

## Scope

- Make `renderNewsletterPolicyBlock(policy)` use the injected policy for the article count range.
- Make historical fact-check `must_fix` warning-only behavior explicit in validator messages, docs, and tests.
- Keep strict target dates hard-failing on unresolved fact-check `must_fix`.
- Do not create or update a PR body in this direct-`main` path.
- Do not edit `content/newsroom/**`, `content/collected-news/**`, or historical newsletter artifacts.

## Validation

- `node --check scripts/newsroom/common/newsletter-policy.js`
- `node --check scripts/newsroom/cli/validate-site.js`
- `npm.cmd run validate:policy`
- `npm.cmd run check:policy-docs`
- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run ci`
- `git diff --check`

## Risks

- Fixing the historical `must_fix` warning wording must not relax current/changed/generated hard failures.
- The generated policy block must remain generated from config; do not hand-edit the block or embed new article-count magic numbers outside it.
