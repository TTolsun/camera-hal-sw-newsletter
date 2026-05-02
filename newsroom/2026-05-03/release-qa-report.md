# Release QA Report - 2026-05-03

## 생성 파일 목록

- collected-news/2026-05-03/candidates.json
- newsroom/2026-05-03/reporter-candidates.json
- newsroom/2026-05-03/editor-draft.json
- newsroom/2026-05-03/editor-draft.md
- newsroom/2026-05-03/fact-check-report.json
- newsroom/2026-05-03/fact-check-report.md
- newsroom/2026-05-03/quality-report.json
- newsroom/2026-05-03/quality-report.md
- newsroom/2026-05-03/editor-in-chief-brief.md
- newsroom/2026-05-03/release-qa-report.md
- newsletters/2026-05-03/newsletter.md
- newsletters/2026-05-03/index.html
- data/newsletters.json

## npm run validate 실행 결과

> camera-hal-sw-newsletter@1.0.0 validate:site
> node scripts/validate-site.js

Validated 4 newsletter entries.


> camera-hal-sw-newsletter@1.0.0 validate:images
> node scripts/validate-external-images.js

Validated 14 article images.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- Status: PASS
- Must fix count: 0
- Source gap count: 6

## Quality Gate

- Quality score: 80/100
- Quality threshold: 95
- Quality status: NEEDS_FIX
- Top deductions: 4pt composition; 10pt source-integrity; 6pt hal-relevance
