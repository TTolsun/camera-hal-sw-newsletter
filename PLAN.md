# Current Plan

## Navigation Label Consistency

- Treat issue `#61` as a low stability-risk UI consistency task.
- Standardize only top navigation labels to `Latest / Archive / Sources / GitHub`.
- Do not change article body language, `Sources` / `출처` section contracts, quality gate scoring, or publish gate rules.

## Implementation Scope

- Update generated newsletter `.site-nav .nav-links` in `scripts/newsroom/render/newsletter-renderer.js`.
- Update public `newsletters/**/index.html` files only where `.site-nav .nav-links` still uses Korean labels.
- Add a focused validator assertion that inspects only `.site-nav` navigation labels.
- Leave legacy `.topbar` links, archive back buttons, source blocks, and article body text unchanged.

## Validation

- `node --check scripts\newsroom\render\newsletter-renderer.js`
- `node --check scripts\newsroom\cli\validate-site.js`
- `npm.cmd run test`
- `npm.cmd run validate`
- `rg` confirmation for `.site-nav` label consistency and retained `출처` source blocks.

## Self Review Focus

- P1 if quality gate, publish gate, source/evidence validation, or article body behavior changes.
- P2 if the validator scans article body/source blocks instead of only `.site-nav`.
- P2 if public generated issue edits go beyond navigation label text.
