# Source Candidate Binding / Quality Gate Hardening

## Summary

- Scope: Code + Tests + Minimal Artifact Update.
- Harden quality validation so every publishable main article must bind to source candidate metadata from shortlist/reporter artifacts.
- Keep `section_text_fallback` diagnostic-only and prevent it from contributing to PASS/composition counts.
- Recompute and align 2026-05-05 artifacts after the gate changes so `npm.cmd run validate` passes.

## Implementation Notes

- Candidate binding priority: final/primary selected shortlist candidates, reserve/demoted/excluded shortlist candidates, reporter candidates, then diagnostic text fallback.
- Resolve duplicate normalized URL matches using source id, title similarity, published date, version/release, and API/component; unresolved ambiguity is a hard failure.
- Recover `source_candidate_url` and `source_candidate_hash` only when section evidence is consistent with the bound candidate.
- Move this plan to `docs/plans/source-candidate-binding-quality-gate.md` before finishing.

## Validation

- `node --test tests/newsletter-quality.test.js`
- `npm.cmd run test`
- `npm.cmd run validate`
