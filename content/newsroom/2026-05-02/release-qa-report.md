# Release QA Report - 2026-05-02

## 생성 파일 목록

- content/collected-news/2026-05-02/candidates.json
- content/newsroom/2026-05-02/reporter-candidates.json
- content/newsroom/2026-05-02/editor-draft.json
- content/newsroom/2026-05-02/editor-draft.md
- content/newsroom/2026-05-02/fact-check-report.json
- content/newsroom/2026-05-02/fact-check-report.md
- content/newsroom/2026-05-02/quality-report.json
- content/newsroom/2026-05-02/quality-report.md
- content/newsroom/2026-05-02/editor-in-chief-brief.md
- content/newsroom/2026-05-02/release-qa-report.md
- newsletters/2026-05-02/newsletter.md
- newsletters/2026-05-02/index.html
- data/newsletters.json

## npm run validate 실행 결과

> camera-hal-sw-newsletter@1.0.0 validate:site
> node scripts/validate-site.js

Validated 3 newsletter entries.


> camera-hal-sw-newsletter@1.0.0 validate:images
> node scripts/validate-external-images.js

Validated 12 article images.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- Status: PASS
- Must fix count: 0
- Source gap count: 6

## Quality Gate

- Quality score: 88/100
- Quality threshold: 95
- Quality status: NEEDS_FIX
- Top deductions: 10pt source-integrity; 2pt hal-relevance
