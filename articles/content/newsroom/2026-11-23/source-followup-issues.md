# Source Follow-up Issue Drafts - 2026-11-23

이 문서는 제안이며 발행 판정에 영향을 주지 않습니다. GitHub 이슈를 자동으로 만들지도 않습니다.

- 기준: 같은 대상에 같은 권고가 10회 연속, 또는 실행 전체 진단 taxonomy_missing이 이번 실행에서 참
- 살펴본 실행: 40
- 이번 실행의 조치 대상 권고: 21건
- draft: 1건

## [Source] 소스 풀 보강 검토: Claude Code Changelog

- 연속 10회
- 소스: claude-code-changelog
- 권고: REVIEW_SOURCE_GAP
- 제안 라벨: area:newsroom, source-coverage

Claude Code Changelog에 REVIEW_SOURCE_GAP 권고가 10회 연속 붙었습니다. 진단이 적은 사유: Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.

제안 작업 순서

1. 이 소스가 내는 신호가 실제로 카메라 범위인지 1차 출처로 확인한다
1. evidence 추출이 api_or_component를 채우는지 본다
1. 범위 밖이면 등록부에서 우선순위를 내린다
