# Deterministic Selection Hard Gate 개선 계획

## Summary

- `ABSOLUTE_MIN_REVIEWABLE_ARTICLES`는 낮추지 않고, LLM 호출 전 deterministic source/parser/classifier/selection gate를 수정한다.
- 현재 source id는 kebab-case convention이므로 새 source id는 `aosp-site-updates`로 둔다.
- `finalSelectionEligibility` enum은 `main`, `short`, `watchlist`, `exclude`만 유지한다.

## Key Changes

- `AOSP Site updates` source를 추가하고 `parseAospSiteUpdates()`를 만든다. 월별 섹션 child row/list item만 후보화하며, camera 관련 row만 `release_note_item`으로 생성한다.
- 월 단위 항목은 JS 내부에서 `datePrecision: "month"`를 유지하고, scoring에서 exact day-level fresh news처럼 가산하지 않는다.
- `Android Developers Latest Updates` parser는 locale을 fetch-time에 `hl=en`으로 고정하고, `Camera Maven Group versions` / `androidx.camera` row-level child item만 후보화한다.
- `developer.android.com` / `source.android.com` candidate URL canonicalization은 locale query를 제거하되 fragment는 보존한다.
- `aosp-camera-documentation`은 `reference_index` role로만 사용한다. `reference_index` source는 `mainEligible=false`, `referenceOnly=true`, `finalSelectionEligibility="exclude"`가 되며 final article input에서 강제 제외된다.
- Android Developers Blog에는 camera-focused source를 별도로 추가하되 article-level camera evidence가 없으면 `watchlist`/`exclude`에 남긴다.

## Selection Rule

- `cpp_ai_tooling_fallback`은 `ABSOLUTE_MIN_REVIEWABLE_ARTICLES` 충족 개수에 포함하지 않는다.
- hard gate는 최소 `ABSOLUTE_MIN_REVIEWABLE_ARTICLES`개의 non-fallback Camera/Android/driver/SoC 후보를 요구한다.
- C++ fallback은 충분한 primary 후보가 있을 때 보조 기사로만 허용한다.

## Diagnostics

- hard gate 실패 시 `generation status`, `shortlisted-candidates`, `recovery-prompt.md`에 부족한 source bucket count를 출력한다.
- 최소 bucket은 `direct_aosp_camera`, `android_platform_camera_adjacent`, `camera_driver_image_pipeline`, `soc_platform_signal`, `cpp_ai_tooling_fallback`로 한다.
- recovery hint에는 다음 run에서 보강할 parser/source 축을 명시한다.

## Test Plan

- fixture 기반 parser tests를 추가한다: AOSP `April 2026` camera rows, Latest Updates `Camera Maven Group versions`, `androidx.camera`, locale/title normalization.
- selection tests를 추가한다: fallback-only hard fail, AOSP site update camera rows 3개 이상 통과 가능, `reference_index` 제외, `referenceOnly`/`watchlist` final input 제외, `source_gap_risk=true` main 제외.
- live network에 의존하지 않는 deterministic fixture coverage를 우선한다. `npm.cmd run collect`는 Windows local smoke check로만 사용한다.
- Windows 검증은 `npm.cmd test`, `npm.cmd run validate:config`, `npm.cmd run validate`를 사용한다. CI/Linux 문서나 workflow 명령은 `npm` 형식을 유지한다.
