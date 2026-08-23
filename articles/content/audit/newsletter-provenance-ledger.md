# Historical Newsletter Provenance Ledger

이 문서는 과거 public archive provenance를 추적하되 unsupported seed evidence를 사후 보강하지 않습니다.

`content/audit/historical-archive-status.json`가 machine-readable source of truth입니다. `data/newsletters.json`는 public index와 archive routing metadata로만 유지합니다.

## 정책

- Seed evidence workflow 이전 archive entry에는 fake seed evidence provenance를 추가하지 않습니다.
- `keep` / `minor_edit` 대상은 현재 article structure로 강제 재작성하지 않습니다.
- Material rewrite는 `articles/content/audit/historical-rewrite-diff/<date>-<slug>.md`를 필요로 합니다.
- 발행된 archive 산출물(`articles/newsletters/**`)을 사후 편집하면 `minor_edit`이든 material rewrite든 `## Historical Content 정규화`에 항목을 남깁니다. `historical-rewrite-diff` 요구는 material rewrite 여부만 가르며 기록 자체를 면제하지 않습니다.
- 정규화 항목에는 대상 날짜/호, 무엇을 어떻게 바꿨는지, 근거 이슈, rewrite 판정을 적습니다.
- `removed` entry는 `data/newsletters.json`에 남기지 않습니다.

## Ledger

| Date | Original generation mode | Known quality issues | Rewrite allowed | Rewrite status | Archive status | Public visibility | Cleanup context |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-17 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-08-10 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-08-03 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-07-27 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-07-20 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-07-13 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-07-06 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-29 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-24 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-22 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-21 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-20 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-16 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-11 | current_generation | publish-ready public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-06 | current_generation | publish-ready public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-03 | current_generation | publish-ready under adjacent-content publishing; CameraX 1.6.0 catch-up retrospective; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-06-02 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | unlisted | review_only_publication |
| 2026-05-31 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-30 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-05-29 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-05-27 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-26 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-25 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-24 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-23 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-22 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-21 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | review_only_publication |
| 2026-05-20 | current_generation | current generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | current_generation_archive_review |
| 2026-05-19 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-18 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-17 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-16 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-15 | pre_185 | source provenance not backfilled, GCC tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | historical_archive_cleanup |
| 2026-05-13 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-12 | pre_185 | source provenance not backfilled, CameraX adjacent audit completed, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | historical_archive_cleanup |
| 2026-05-11 | pre_185 | source provenance not backfilled, bounded CameraX adjacent rewrites, direct camera claim audit completed, accepted limitations documented | yes_bounded | material_rewrite_camerax | reviewed_archive | listed | historical_archive_cleanup |
| 2026-05-10 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-09 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-08 | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |
| 2026-05-07 | pre_185 | source provenance not backfilled, bounded Glaze overclaim rewrite, bounded libcamera direct claim rewrites, accepted limitations documented | yes_bounded | material_rewrite_glaze_libcamera | reviewed_archive | listed | historical_archive_cleanup |
| 2026-05-05 | pre_185 | source provenance not backfilled, bounded Firebase / Claude / C++ / Android Security overclaim rewrites, accepted limitations documented | yes_bounded | material_rewrite_firebase_claude_cxx_android_security | reviewed_archive | listed | historical_archive_cleanup |
| 2026-04-30 | pre_185 | format inconsistency, delete-only cleanup completed | no | removed_archive | removed | removed | removed_archive_cleanup |

## Historical Content 정규화

- 2026-05-11은 날짜 단위 전역 action item 정규화를 받았습니다. article body 의미가 바뀌지 않아 article 단위 material rewrite diff는 추가하지 않았습니다. 변경은 최종 archive 신뢰 report에 기록됩니다.
- 2026-05-05 / 06-16 / 06-20 / 06-21 / 06-22 / 06-24 / 06-29 / 07-06 / 07-13 / 07-20 / 07-27 / 08-03 과 2026-W19 / W25 / W26 / W27 / W28 / W29 / W30 / W31 / W32 는 저장소 fallback 이미지에 붙어 있던 가짜 출처 캡션을 삭제했습니다(markdown 53건 + HTML figcaption 53건, 42파일 159줄 삭제·0줄 추가). 그림은 저장소 안의 fallback SVG인데 캡션은 lore.kernel.org 패치 등 외부 기사를 출처로 적고 있었습니다. 판정 기준은 직전 이미지의 src가 `assets/images/fallback/` 로 시작하는지 하나이며, 정상 외부 이미지 캡션 96건(형식 합계)은 전부 보존했습니다. URL·본문·구조와 `issue.json` 은 바꾸지 않았고 재렌더도 하지 않았습니다(#863, 전방 수정은 PR #861).
- 2026-06-02 와 2026-W26 은 렌더러가 쓰던 기간-수준 사실 주장 "이번 기간 카메라 코어 직접 변경은 없었습니다. 아래는 실무 레이더 관점의 맥락입니다." 4건(각 md+html)을 현재 렌더러가 내는 관점 라벨 표기(markdown `**실무 레이더 관점**`, HTML `issue-context-lens-label`)로 표적 교체했습니다. LLM이 직접 쓴 브리핑 불릿은 fact-check 관할이라 건드리지 않았습니다(#856 잔여분, 전방 수정은 PR #921). 위 두 편집 모두 현재 article structure로 강제 재작성하지 않은 minor_edit이라 material rewrite diff는 추가하지 않았습니다(커밋 `ec3426aa`, PR #939 / #940).
