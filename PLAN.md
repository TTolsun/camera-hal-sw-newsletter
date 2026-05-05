# 2026-05-06 Newsroom Selection 개선 계획

## Summary

- `ABSOLUTE_MIN_REVIEWABLE_ARTICLES`와 quality gate를 낮추지 않고 upstream collection/parser/classifier를 보강한다.
- Camera/Android/driver/SoC non-fallback 후보가 부족해지는 원인을 줄이되, static documentation page는 main article 후보로 승격하지 않는다.
- deterministic selection 실패 시 debug artifact와 status diagnostics는 계속 보존한다.

## Key Changes

- `Android Developers Latest Updates` parser를 실제 페이지 구조 변화에 더 견고하게 만든다.
  - `Camera Maven Group versions`, `androidx.camera:*`, `CameraX` row/link/card에서 date, version, component, behavior evidence를 추출한다.
  - locale URL과 fragment는 기존 canonicalization 계약을 유지한다.
  - generic latest-updates page 자체는 main candidate로 승격하지 않는다.
- AOSP/Camera source-specific parser는 dated child item만 `release_note_item`으로 만든다.
  - `aosp-site-updates`의 month/date 기반 camera child row는 유지한다.
  - `aosp-camera-documentation`은 계속 empty parser / watch-reference path로 둔다.
- Linux camera/driver 및 platform fallback 분류를 보수적으로 조정한다.
  - `libcamera`는 dated blog/news/release item만 후보화한다.
  - GCC/native tooling 글은 strong SoC evidence 없이 `soc_platform_signal`로 과승격하지 않는다.
- Diagnostics는 기존 artifact-preserving flow를 유지하면서 status/body 출력의 bucket count, non-fallback count, shortage hints가 테스트로 고정되게 한다.

## Validation

- Targeted:
  - `node --test tests/source-item-parsers.test.js`
  - `node --test tests/collector-relevance.test.js`
  - `node --test tests/newsroom-selection.test.js`
  - `node --test tests/workflow-scripts.test.js`
- Repo:
  - `npm.cmd run test`
  - `npm.cmd run validate:config`
  - `npm.cmd run validate`
