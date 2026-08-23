# Historical Newsletter Provenance Ledger

이 문서는 과거 public archive provenance를 추적하되 unsupported seed evidence를 사후 보강하지 않습니다.

`content/audit/historical-archive-status.json`가 machine-readable source of truth입니다. `data/newsletters.json`는 public index와 archive routing metadata로만 유지합니다.

## 정책

- Seed evidence workflow 이전 archive entry에는 fake seed evidence provenance를 추가하지 않습니다.
- `keep` / `minor_edit` 대상은 현재 article structure로 강제 재작성하지 않습니다.
- Material rewrite는 `articles/content/audit/historical-rewrite-diff/<date>-<slug>.md`를 필요로 합니다.
- 발행된 archive 산출물(`articles/newsletters/**`)을 사후 편집하면 `minor_edit`이든 material rewrite든 `## Historical Content 정규화`에 항목을 남깁니다. `historical-rewrite-diff` 요구는 material rewrite 여부만 가르며 기록 자체를 면제하지 않습니다.
- 정규화 항목에는 대상 날짜/호, 무엇을 어떻게 바꿨는지, 근거 이슈, rewrite 판정을 적습니다.
- 이 기록 규칙은 규칙이 문서에 추가된 뒤의 편집에 적용합니다. 그 이전 편집 중 소급 기록한 것은 `## Historical Content 정규화`에 있는 항목뿐이며, 그 절은 과거 사후 편집의 완전한 목록이 아닙니다(위클리 coverage 정렬·재렌더·죽은 이미지 교체 등은 기록되어 있지 않습니다).
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
- 2026-05-05 / 06-16 / 06-20 / 06-21 / 06-22 / 06-24 / 06-29 / 07-06 / 07-13 / 07-20 / 07-27 / 08-03 과 2026-W19 / W25 / W26 / W27 / W28 / W29 / W30 / W31 / W32 는 저장소 fallback 이미지에 붙어 있던 가짜 출처 캡션을 삭제했습니다(markdown 53건 + HTML figcaption 53건, 42파일 159줄 삭제·0줄 추가). 그림은 저장소 안의 fallback SVG인데 캡션은 lore.kernel.org 패치 등 외부 기사를 출처로 적고 있었습니다. 판정 기준은 직전 이미지의 src가 `assets/images/fallback/` 로 시작하는지 하나이며, 정상 외부 이미지 캡션 96건(형식 합계)은 전부 보존했습니다. 이 삭제 편집은 URL·본문·구조와 `issue.json` 을 바꾸지 않았고 재렌더도 하지 않았습니다(#863, 전방 수정은 PR #861). 2026-W26 은 아래 항목의 편집도 함께 받았으므로 그 호의 추가된 줄은 이 항목이 아니라 아래 항목의 결과입니다.
- 2026-06-02 와 2026-W26 은 렌더러가 쓰던 기간-수준 사실 주장 "이번 기간 카메라 코어 직접 변경은 없었습니다. 아래는 실무 레이더 관점의 맥락입니다." 4건(각 md+html)을 현재 렌더러가 내는 관점 라벨 표기(markdown `**실무 레이더 관점**`, HTML `issue-context-lens-label`)로 표적 교체했습니다. LLM이 직접 쓴 브리핑 불릿은 fact-check 관할이라 건드리지 않았습니다(#856 잔여분, 전방 수정은 PR #921). 위 두 편집 모두 현재 article structure로 강제 재작성하지 않은 minor_edit이라 material rewrite diff는 추가하지 않았습니다(커밋 `ec3426aa`, PR #939 / #940).
- 2026-05-22 / 05-23 / 05-25 / 05-26 / 05-29 / 05-30 / 05-31 / 06-02 / 06-06 / 06-16 / 06-20 / 06-21 / 06-22 / 06-24 와 2026-W21 / W22 / W23 / W24 / W25 / W26 / W28 / W29 는 roundup child 제목 정규화를 받았습니다. 수집기가 `<섹션 heading> - <부모 문서 제목>` 으로 조립해 어느 페이지에도 없는 제목이 되어 버린 3종을, 현재 수집기가 내는 표기 `<섹션 heading> (『<부모 문서 제목>』)` 로 바꿨습니다(#857, 전방 수정은 #926). 대상은 링크 제목 93건(markdown 38 + HTML 38 + `issue.json` 17)과 기사 본문이 같은 제목을 인용한 4건(2026-05-25 / 05-26)이며, 52파일 97줄을 교체했습니다. URL·이미지·구조는 바꾸지 않았고 재렌더도 하지 않았습니다.
- 2026-05-24 / 05-25 / 05-26 / 2026-W21 은 생성기 상용구 산문 13문단을 삭제했습니다(#857). 내역은 markdown 6건 + HTML `<p>` 6건 + `issue.json` `body_paragraphs` 원소 1건이며 9파일 20줄 삭제·1줄 추가입니다. `public-prose-leakage` 의 `source_detail_review_placeholder` · `internal_followup_source_scope` 두 규칙에 걸리는 문단으로, 토큰 나열을 문장처럼 늘어놓은 상용구라 어떤 출처 주장도 담지 않습니다. 삭제만 했고 대체 문장을 새로 쓰지 않았습니다. 위 제목 정규화가 2026-05-25 / 05-26 을 변경 대상 집합에 넣으면서 그때까지 warning 이던 이 문단이 hard error 로 올라온 것이 계기입니다. 2026-05-24 는 제목 정규화가 건드리지 않아 같은 결함이 남아 있었고, 2026-W21 은 제목 정규화가 이미 건드리는 호였으므로 함께 지웠습니다. 이 두 편집(roundup child 제목 정규화·상용구 산문 삭제) 모두 현재 article structure로 강제 재작성하지 않은 minor_edit이라 material rewrite diff는 추가하지 않았습니다(커밋 `f7dde962` / `9e465796`).
