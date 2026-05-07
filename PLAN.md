# Editor Output Semantic Repair Plan

## Goal

Prevent recurrence of GitHub Actions run `25506887594` / job `74854877755`, where the editor returned valid JSON that failed the editor `briefing` count contract before reviewable artifacts could be produced.

## Scope

- Add semantic repair only for editor output contract failures where `field === 'briefing'`.
- Keep `briefing` strict: exactly 3 items.
- Do not change Newsletter Policy, article count policy, quality gate, source selection, or workflow guard behavior.
- Do not edit generated artifacts under `content/newsroom/**`, `content/collected-news/**`, or `newsletters/**`.
- Preserve future failure diagnostics in newsroom debug artifacts and generation status.

## Implementation

- Move editor output contract validation helpers to `scripts/newsroom/validate/editor-output-contract.js`.
- Add `EditorSemanticValidationError`, diagnostic artifact writing, repair orchestration with injectable fake repair function, and sections/sources preservation checks.
- Wire `scripts/newsroom/cli/gemini-newsroom-newsletter.js` to repair only `briefing` semantic failures once, then run preservation checks before continuing.
- Include `editor_semantic_validation`, `repairAttempted`, and `repairSucceeded` in terminal failure status.
- Add numeric `minItems: 3` and `maxItems: 3` to the editor `briefing` response schema.

## Validation

- `node --check scripts/newsroom/cli/gemini-newsroom-newsletter.js`
- `node --check scripts/newsroom/render/newsletter-schema.js`
- `node --check scripts/newsroom/validate/editor-output-contract.js`
- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run ci`

## Risks

- The repair prompt must not rewrite article facts, sections, sources, URLs, images, or source-derived claims.
- Preservation check failures must remain fatal so repair cannot silently change publication inputs.
