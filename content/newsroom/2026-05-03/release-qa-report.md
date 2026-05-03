# Release QA Report - 2026-05-03

## 생성 파일 목록

- content/collected-news/2026-05-03/candidates.json
- content/newsroom/2026-05-03/shortlisted-candidates.json
- content/newsroom/2026-05-03/reporter-candidates.json
- content/newsroom/2026-05-03/editor-draft.json
- content/newsroom/2026-05-03/editor-draft.md
- content/newsroom/2026-05-03/fact-check-report.json
- content/newsroom/2026-05-03/fact-check-report.md
- content/newsroom/2026-05-03/quality-report.json
- content/newsroom/2026-05-03/quality-report.md
- content/newsroom/2026-05-03/retry-history.json
- content/newsroom/2026-05-03/retry-history.md
- content/newsroom/2026-05-03/recovery-prompt.md
- content/newsroom/2026-05-03/editor-in-chief-brief.md
- content/newsroom/2026-05-03/release-qa-report.md
- newsletters/2026-05-03/newsletter.md
- newsletters/2026-05-03/index.html
- data/newsletters.json

## npm run validate 실행 결과

> camera-hal-sw-newsletter@1.0.0 validate:site
> node scripts/validate-site.js

Validated 4 newsletter entries.


> camera-hal-sw-newsletter@1.0.0 validate:images
> node scripts/validate-external-images.js

Validated 6 article images.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- Status: PASS
- Must fix count: 0
- Source gap count: 0

## Quality Gate

- Quality score: 74/100
- Quality threshold: 90
- Quality status: NEEDS_FIX
- Top deductions: 4pt composition; 5pt evidence-specificity (Android용 하이브리드 추론 및 새로운 Gemini 모델 지원); 4pt evidence-specificity (Android용 하이브리드 추론 및 새로운 Gemini 모델 지원); 5pt evidence-specificity (2026년 연례 C++ 개발자 설문조사 시작: HAL 개발자의 목소리를 전달할 기회); 4pt evidence-specificity (2026년 연례 C++ 개발자 설문조사 시작: HAL 개발자의 목소리를 전달할 기회)
