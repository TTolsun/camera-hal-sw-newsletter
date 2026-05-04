# 릴리스 QA 보고서 - 2026-05-05

## 생성 파일 목록

- content/collected-news/2026-05-05/candidates.json
- content/newsroom/2026-05-05/shortlisted-candidates.json
- content/newsroom/2026-05-05/article-capsules.json
- content/newsroom/2026-05-05/reporter-candidates.json
- content/newsroom/2026-05-05/editor-draft.json
- content/newsroom/2026-05-05/editor-draft.md
- content/newsroom/2026-05-05/fact-check-report.json
- content/newsroom/2026-05-05/fact-check-report.md
- content/newsroom/2026-05-05/quality-report.json
- content/newsroom/2026-05-05/quality-report.md
- content/newsroom/2026-05-05/retry-history.json
- content/newsroom/2026-05-05/retry-history.md
- content/newsroom/2026-05-05/cost-report.md
- content/newsroom/2026-05-05/recovery-prompt.md
- content/newsroom/2026-05-05/editor-in-chief-brief.md
- content/newsroom/2026-05-05/release-qa-report.md
- newsletters/2026-05-05/newsletter.md
- newsletters/2026-05-05/index.html
- data/newsletters.json

## npm run validate 실행 결과

> camera-hal-sw-newsletter@1.0.0 validate:site
> node scripts/validate-site.js


Warning: Newsletter 2026-05-05 main article count is 3; expected 4-5 for the new format.
Warning: Newsletter 2026-05-04 has unresolved fact-check must_fix items. Not enforcing because this run is not publishing that issue.
Warning: Newsletter 2026-05-04 selectedImage still points to an external URL after fallback: AI plus camera input path or HAL workflow. Not enforcing because this run is not publishing that issue.
Warning: Newsletter 2026-05-03 main article count is 3; expected 4-5 for the new format.
Warning: Newsletter 2026-05-02 main article count is 6; expected 4-5 for the new format.
Warning: Newsletter 2026-05-02 fact-check source_gap_count is 6.
- Newsletter 2026-05-05 has unresolved fact-check must_fix items.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 2
- source gap 개수: 0

## 품질 게이트

- 품질 점수: 72/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 4pt composition; 8pt hal-relevance; 1pt image-fallback (Android용 하이브리드 추론 및 새로운 Gemini 모델 지원); 4pt actionability (FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향); 1pt image-fallback (FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향)
