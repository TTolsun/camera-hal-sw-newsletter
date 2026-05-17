# HAL 실행 중심 Article Structure Baseline

현재 canonical contract는 `docs/editorial/article-structure-contract.md`다.

이 baseline 문서는 PR #109에서 도입한 5-key `article_sections` contract의 역사적 위치를 남기기 위한 compatibility note다. 새 구현과 리뷰는 canonical 문서를 기준으로 한다.

핵심 유지 사항:

- `section.article_sections`가 source of truth다.
- Legacy fields는 `article_sections`를 만족시키는 fallback input이 아니다.
- Required 5개 key는 `verified_facts`, `background_context`, `hal_driver_impact`, `action_items`, `team_share_points`다.
- Optional key는 canonical 문서의 required/optional/allowed key policy를 따른다.
