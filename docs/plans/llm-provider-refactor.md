# LLM Provider Refactoring Plan

## Goal

- Keep the default and scheduled newsroom generation behavior on Gemini.
- Allow only manual `workflow_dispatch` runs to override `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_FALLBACK_MODELS`.
- Isolate internal LLM API request/response differences inside `scripts/newsroom/llm/providers/internal-provider.js`.
- Preserve existing npm commands, compatibility imports, debug artifacts, and publication safety gates.

## Implementation Scope

- Add provider-neutral runtime config fields while keeping `GEMINI_MODEL` and `GEMINI_FALLBACK_MODELS` as compatibility aliases.
- Add `scripts/newsroom/llm/` with common retry, diagnostics, cost reporting, and provider dispatch.
- Move Gemini-specific SDK request, usage metadata, thinking budget, pricing, and Pro policy into the Gemini provider.
- Add an internal provider with minimal fetch-based POST support and safe response parsing.
- Keep both `scripts/newsroom/generate/gemini-client.js` and `scripts/lib/gemini-client.js` as compatibility shims, including existing test helper exports.
- Update the weekly workflow so scheduled runs use code defaults and only manual runs pass `LLM_*` overrides.
- Update Korean-facing operator docs without weakening validation or generated artifact policies.

## Safety Checks

- Do not change quality threshold, source binding, fact-check hard blockers, image validation, or publish-ready logic.
- Do not accept tokens through workflow inputs.
- Do not print raw secrets or endpoint values in doctor output, logs, artifacts, or PR body.
- Keep failed/reviewable generation artifact preservation intact.

## Validation

- Run `node --check` by enumerating `scripts/newsroom/**/*.js`.
- Run `npm.cmd run test`.
- Run `npm.cmd run validate`.
- Run `npm.cmd run doctor:config` with Gemini fake env.
- Run `npm.cmd run doctor:config` with internal fake env.
- Perform a final code-review pass for P1/P2 risks before reporting completion.
