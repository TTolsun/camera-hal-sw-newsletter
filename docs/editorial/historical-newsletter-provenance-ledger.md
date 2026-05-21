# Historical Newsletter Provenance Ledger

Issue #108은 과거 public archive provenance를 추적하되 unsupported seed evidence를 사후 보강하지 않습니다.

`content/audit/historical-archive-status.json`가 machine-readable source of truth입니다. `data/newsletters.json`는 public index와 archive routing metadata로만 유지합니다.

## Policy

- Pre-#185 archive entry에는 fake seed evidence provenance를 추가하지 않습니다.
- `keep` / `minor_edit` 대상은 #56 article structure로 강제 재작성하지 않습니다.
- Material rewrite는 `content/audit/historical-rewrite-diff/<date>-<slug>.md`를 필요로 합니다.
- `removed` entry는 `data/newsletters.json`에 남기지 않습니다.

## Ledger

| Date | Original generation mode | Known quality issues | Rewrite allowed | Rewrite status | Archive status | Public visibility | Related cleanup issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-22 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | #274 |
| 2026-05-21 | current_generation | review-only public artifact, editor review required before publish confidence; no historical provenance backfill required | no | none | stable_archive | listed | #257 |
| 2026-05-20 | current_generation | post-#185 generated public artifact; no historical provenance backfill required | no | none | stable_archive | listed | #242 |
| 2026-05-19 | current_generation | unlisted public artifact, GCC tooling overclaim audit downgraded, Glaze tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | unlisted | #108 |
| 2026-05-18 | current_generation | unlisted public artifact, GCC tooling overclaim audit downgraded, Glaze tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | unlisted | #108 |
| 2026-05-17 | transition_generation | unlisted public artifact, GCC tooling overclaim audit downgraded, Glaze tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | unlisted | #108 |
| 2026-05-16 | pre_185 | source provenance not backfilled, GCC tooling overclaim audit downgraded, Glaze tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | #108 |
| 2026-05-15 | pre_185 | source provenance not backfilled, GCC tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | #108 |
| 2026-05-13 | pre_185 | source provenance not backfilled, GCC tooling overclaim audit downgraded, Glaze tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | #108 |
| 2026-05-12 | pre_185 | source provenance not backfilled, CameraX adjacent audit completed, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | #108 |
| 2026-05-11 | pre_185 | source provenance not backfilled, bounded CameraX adjacent rewrites, direct camera claim audit completed, accepted limitations documented | yes_bounded | material_rewrite_camerax | reviewed_archive | listed | #108 |
| 2026-05-10 | pre_185 | source provenance not backfilled, CameraX adjacent audit completed, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | #108 |
| 2026-05-09 | pre_185 | source provenance not backfilled, bounded CameraX adjacent rewrite, Glaze tooling overclaim audit downgraded, bounded libcamera direct claim rewrite, accepted limitations documented | yes_bounded | material_rewrite_camerax_glaze_libcamera | reviewed_archive | listed | #108 |
| 2026-05-08 | pre_185 | source provenance not backfilled, CameraX adjacent audit completed, GCC tooling overclaim audit downgraded, direct camera claim audit completed, accepted limitations documented | no | none | reviewed_archive | listed | #108 |
| 2026-05-07 | pre_185 | source provenance not backfilled, bounded Glaze overclaim rewrite, bounded libcamera direct claim rewrites, accepted limitations documented | yes_bounded | material_rewrite_glaze_libcamera | reviewed_archive | listed | #108 |
| 2026-05-05 | pre_185 | source provenance not backfilled, bounded Firebase / Claude / C++ / Android Security overclaim rewrites, accepted limitations documented | yes_bounded | material_rewrite_firebase_claude_cxx_android_security | reviewed_archive | listed | #108 |
| 2026-04-30 | pre_185 | format inconsistency, delete-only slice completed | no | removed_by_73 | removed | removed | #73 |
## Issue-level Normalization

- 2026-05-11 received issue-level global action item normalization. No article-level material rewrite diff was added because article body meaning did not change; the change is recorded in the final archive trust report.
