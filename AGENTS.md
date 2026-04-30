# Repository Guidelines

## Project Structure & Module Organization

This repository is a static Camera HAL SW newsletter site with Node.js automation scripts.

- `index.html` is the archive landing page and reads `data/newsletters.json`.
- `css/` contains shared site styling; keep newsletter-specific HTML aligned with these classes.
- `data/newsletters.json` stores published newsletter metadata.
- `newsletters/YYYY-MM-DD/` contains each published issue: `newsletter.md` and `index.html`.
- `newsroom/YYYY-MM-DD/` contains editorial artifacts such as candidate lists, fact checks, briefs, and QA reports.
- `templates/` provides starting Markdown and HTML files for new issues.
- `scripts/` contains Node scripts for candidate collection, Gemini generation, rendering, and validation.
- `.github/workflows/` runs the Gemini newsroom PR flow and site validation.

## Build, Test, and Development Commands

Use Node 20, matching the GitHub Actions configuration.

```powershell
node scripts/validate-site.js
```

Validates `data/newsletters.json`, required newsletter files, required sections, duplicate dates, TODO markers, and basic HTML anchor balance.

```powershell
$env:NEWSLETTER_DATE="YYYY-MM-DD"
$env:LOOKBACK_DAYS="21"
node scripts/collect-news-candidates.js
```

Collects candidate news from `docs/sources.md` without using the OpenAI API.

```powershell
$env:NEWSLETTER_DATE="YYYY-MM-DD"
$env:GEMINI_API_KEY="xxx"
node scripts/gemini-newsroom-newsletter.js
```

Runs the Gemini reporter, editor, and fact-checker pipeline and updates newsletter files.

```powershell
npx serve .
```

Serves the static site locally so `fetch()` calls can load JSON correctly.

## Coding Style & Naming Conventions

JavaScript scripts use CommonJS (`require`), two-space indentation, semicolons, and explicit filesystem paths via `path.join` or `path.resolve`. Keep filenames lowercase with hyphens where applicable, such as `validate-site.js`. Date-based content directories must use `YYYY-MM-DD`. Do not edit `data/newsletters.json` by hand when publishing; the Gemini generation script updates it.

## Testing Guidelines

There is no separate unit test suite. Treat `node scripts/validate-site.js` as the required quality gate before opening or updating a PR. Published Markdown must include the required sections checked by the validator, exactly three briefing bullets, sources or source labels in major sections, and no `TODO` text.

## Commit & Pull Request Guidelines

Recent commits use concise imperative subjects, for example `Add Camera HAL newsletter for 2026-04-30`, `Generate Camera HAL newsletter YYYY-MM-DD`, and `Fix newsletter validation issues`. Keep commits scoped to one issue or workflow step.

PRs should follow `.github/pull_request_template.md`: include the dated newsletter files, metadata update, required sections, source checks, archive and Markdown links, and validation status. Newsletters are published through PRs only; do not push directly to `main` for publication.

## Agent-Specific Instructions

Preserve user-authored newsletter content and editorial artifacts. When adding a new issue, use the Gemini pipeline, verify generated files under the matching date directory, run validation, and avoid unrelated formatting churn.
