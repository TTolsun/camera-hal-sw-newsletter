# Repository Guidelines

## Project Structure & Module Organization

This repository publishes a static Camera HAL SW newsletter with Node.js automation.

- `index.html` is the archive landing page and reads `data/newsletters.json`.
- `css/` contains shared site styling; avoid layout churn unless the task is UI-specific.
- `assets/images/fallback/` stores local article-image fallbacks used by validation.
- `data/news-sources.json` is the machine-readable source registry; `docs/news-sources.md` is the editorial view.
- `collected-news/YYYY-MM-DD/` stores raw candidate output.
- `newsroom/YYYY-MM-DD/` stores review artifacts: reporter candidates, editor drafts, fact checks, briefs, and QA reports.
- `newsletters/YYYY-MM-DD/` stores published issue artifacts: `newsletter.md` and `index.html`.
- `scripts/` contains collection, Gemini generation, rendering, image resolution, and validation logic.
- `.github/workflows/` contains the newsroom PR workflow and validation workflow.

## Build, Test, and Development Commands

Use Node 20.

```powershell
npm.cmd run collect
```

Collects candidates from `data/news-sources.json`; set `NEWSLETTER_DATE=YYYY-MM-DD` and optionally `LOOKBACK_DAYS=21`.

```powershell
npm.cmd run generate
```

Runs the Gemini newsroom pipeline. Requires `GEMINI_API_KEY`; optional model overrides include `GEMINI_MODEL` and `GEMINI_FALLBACK_MODELS`.

```powershell
npm.cmd run validate
```

Runs site, external image, and quality validation. This is the required gate before publication.

```powershell
npx serve .
```

Serves the static site locally so browser `fetch()` calls can load JSON.

## Coding Style & Naming Conventions

JavaScript uses CommonJS (`require`), two-space indentation, semicolons, and explicit paths via `path.join` or `path.resolve`. Prefer lowercase hyphenated filenames, such as `validate-quality.js`. Date directories must use `YYYY-MM-DD`. Preserve validator-sensitive HTML hooks such as `issue-briefing`, `issue-section`, `source-list`, and `reference-list`.

## Testing Guidelines

There is no separate unit test suite. Treat `npm.cmd run validate` as the authoritative test command. Published artifacts must contain no `TODO`, include required sections and references, satisfy article-image fallback rules, and meet the deterministic quality threshold.

## Commit & Pull Request Guidelines

Recent history uses concise imperative subjects, for example `Generate Camera HAL newsletter 2026-05-02`, `Add newsletter quality gate`, and `Align newsletter operations docs and validation`. Keep commits scoped and stage only relevant files.

Newsletter publication is PR-based. PRs should include generated `newsletters/`, `newsroom/`, and `data/newsletters.json` changes when applicable, plus validation status and any `needs-fix` context from fact-check or quality reports.

## Agent-Specific Instructions

Do not weaken validation to hide publication risks. Preserve review artifacts when generation needs editorial fixes, and avoid inventing replacement external images; use the resolver and local fallback contract.
