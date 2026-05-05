# Repo Hygiene And Agent Guidance Cleanup 계획

## Summary

- `README.md`를 짧은 entry 문서로 줄이고 긴 설명은 `docs/glossary.ko.md`, `docs/newsroom-workflow.md`, `docs/config/**`, `docs/operations/README.ko.md`로 분리합니다.
- root `AGENTS.md`는 repo-wide 원칙만 남기고 `scripts/newsroom/`, `tests/`, `data/`, `.github/workflows/`에 scoped `AGENTS.md`를 둡니다.
- stale root `handoff.md`는 `docs/archive/handoff-2026-05-05.md`로 이동하고 archive note를 붙입니다.
- `content/newsroom/**`에서는 intermediate attempt markdown만 제거하고, attempt JSON과 final review/publish artifact는 보존합니다.

## Key Changes

- `README.md`: overview, start links, operating model, core commands, repository map, 발행 안전 규칙만 유지합니다.
- `docs/glossary.ko.md`: newsroom과 artifact 용어를 한국어 설명 우선으로 정리하고 계약 문자열은 원문으로 둡니다.
- `docs/START_HERE.ko.md`: glossary와 operations 문서 링크를 추가하고 docs folder 역할을 현재 구조에 맞게 정리합니다.
- `AGENTS.md`: 공통 언어, 계약, 검증, 발행 안전, fixture 신뢰, PR scope 규칙만 남기고 scoped guide로 연결합니다.
- `package.json`: `"ci": "npm run test && npm run validate"`만 추가합니다.
- `.gitignore`: actual attempt-only markdown pattern만 추가하고 JSON artifact와 final markdown report는 ignore하지 않습니다.

## Cleanup Rules

- `editor-draft-attempt-*.md`, `editor-repair-attempt-*.md`, `fact-check-report-attempt-*.md`, `fact-check-repair-attempt-*.md`, `quality-report-attempt-*.md`, `quality-report-repair-attempt-*.md`만 cleanup 대상으로 봅니다.
- `editor-draft.md`, `fact-check-report.md`, `quality-report.md`, `retry-history.md`, `editor-in-chief-brief.md`, `release-qa-report.md`, `cost-report.md`, `summary-cache-report.md`, `newsletter.md`, 모든 attempt JSON은 보존합니다.
- `scripts/lib/**` imports는 compatibility shim 경로로 유지합니다. docs에서는 현재 구현 설명이 필요한 경우 `scripts/newsroom/**`를 우선 사용합니다.

## Verification

- `git grep -n "weekly-newsroom-pr.yml\\|plan.md\\|PLAN.md\\|handoff.md\\|editor-draft-attempt\\|editor-repair-attempt\\|fact-check-report-attempt\\|quality-report-attempt"`
- `npm.cmd run validate:localization`
- `npm.cmd run validate:config`
- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run ci`
