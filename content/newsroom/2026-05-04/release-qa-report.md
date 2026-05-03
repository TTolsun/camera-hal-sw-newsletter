# 릴리스 QA 보고서 - 2026-05-04

## 생성 파일 목록

- content/collected-news/2026-05-04/candidates.json
- content/newsroom/2026-05-04/shortlisted-candidates.json
- content/newsroom/2026-05-04/reporter-candidates.json
- content/newsroom/2026-05-04/editor-draft.json
- content/newsroom/2026-05-04/editor-draft.md
- content/newsroom/2026-05-04/fact-check-report.json
- content/newsroom/2026-05-04/fact-check-report.md
- content/newsroom/2026-05-04/quality-report.json
- content/newsroom/2026-05-04/quality-report.md
- content/newsroom/2026-05-04/retry-history.json
- content/newsroom/2026-05-04/retry-history.md
- content/newsroom/2026-05-04/recovery-prompt.md
- content/newsroom/2026-05-04/editor-in-chief-brief.md
- content/newsroom/2026-05-04/release-qa-report.md
- newsletters/2026-05-04/newsletter.md
- newsletters/2026-05-04/index.html
- data/newsletters.json

## npm run validate 실행 결과

> camera-hal-sw-newsletter@1.0.0 validate:site
> node scripts/validate-site.js


Warning: Newsletter 2026-05-03 main article count is 3; expected 4-5 for the new format.
Warning: Newsletter 2026-05-02 main article count is 6; expected 4-5 for the new format.
Warning: Newsletter 2026-05-02 fact-check source_gap_count is 6.
- Newsletter 2026-05-04 has unresolved fact-check must_fix items.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 1
- source gap 개수: 0

## 품질 게이트

- 품질 점수: 77/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 5pt evidence-specificity (2026년 4월 17일: Android 하이브리드 추론 및 Gemini 모델 지원 (Firebase AI Logic API)); 4pt evidence-specificity (2026년 4월 17일: Android 하이브리드 추론 및 Gemini 모델 지원 (Firebase AI Logic API)); 5pt evidence-specificity (2026년 5월 2일: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개); 4pt evidence-specificity (2026년 5월 2일: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개); 5pt source-integrity
