# Current Plan

## PR #37 Public Output Repair and Publication Policy Split

- PR #37 still publishes the repaired `2026-05-08` issue, but this change also adds the general policy for future editor-approved publication.
- Freeze the repaired `2026-05-08` article content. Do not regenerate or edit `content/newsroom/2026-05-08/**`, `newsletters/2026-05-08/**`, or the `2026-05-08` entry content in `data/newsletters.json`.
- Keep this implementation limited to workflow, script, test, and docs changes. Add only minimal test fixtures if they are needed.
- Separate state meanings explicitly:
  - `has_public_artifacts`: public newsletter files or the public `data/newsletters.json` entry are included.
  - `has_reviewable_artifacts`: `content/newsroom/YYYY-MM-DD` review artifacts exist.
  - `has_ai_publish_ready`: `final_publish_ready === true`.
- Do not expand `has_publish_candidate` with a new meaning. Keep it only as a compatibility output while workflow logic moves to the explicit fields.

## Publication Policy

```text
AI quality gate PASS = automatic publication eligible
AI quality gate FAIL = editor-in-chief review required
editor-in-chief main merge = site publication approval
```

- `publish-ready` label means only `has_ai_publish_ready=true`.
- A PR may have `has_public_artifacts=true`, `has_ai_publish_ready=false`, and `needs-fix`. That means the article can be shown if the editor-in-chief merges it, while AI quality gate status remains review-needed.
- `02-validate-site.yml` reports quality/fact-check problems as non-blocking GitHub Actions annotations.
- Structural validation remains blocking: site config, `data/newsletters.json` integrity, HTML/Markdown existence, source links, image paths, localization, TODO checks, anchor mismatch, and path escape checks.
- `annotate-publication-quality.js` target policy:
  - `--date YYYY-MM-DD` inspects only that public issue.
  - Changed newsletter dates inspect only matching public issue dates.
  - If there is no changed public issue, the default target is the latest public issue only.
  - `--all` inspects every historical public issue.

## Validation

- Run the relevant targeted test after script/workflow updates.
- Run `npm.cmd run test`.
- Run `npm.cmd run validate`.
- Self-review the diff for P1/P2 risks, especially article content freeze violations, state-name drift, `publish-ready` label semantics, and accidental quality gate weakening outside `02-validate-site.yml`.
