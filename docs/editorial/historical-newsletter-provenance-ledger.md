# Historical Newsletter Provenance Ledger

이 문서는 과거 public archive provenance를 추적하되 unsupported seed evidence를 사후 보강하지 않습니다.

`content/audit/historical-archive-status.json`가 machine-readable source of truth입니다. `data/newsletters.json`는 public index와 archive routing metadata로만 유지합니다.

## 정책

- Seed evidence workflow 이전 archive entry에는 fake seed evidence provenance를 추가하지 않습니다.
- `keep` / `minor_edit` 대상은 현재 article structure로 강제 재작성하지 않습니다.
- Material rewrite는 `content/audit/historical-rewrite-diff/<date>-<slug>.md`를 필요로 합니다.
- `removed` entry는 `data/newsletters.json`에 남기지 않습니다.

## 원장

| Date | Original generation mode | Known quality issues | Rewrite allowed | Rewrite status | Archive status | Public visibility | Cleanup context |
| --- | --- | --- | --- | --- | --- | --- | --- |
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
