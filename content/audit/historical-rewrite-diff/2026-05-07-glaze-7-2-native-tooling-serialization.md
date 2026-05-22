# 2026-05-07 Glaze 7.2 Material Rewrite Diff

## Article

- Date: 2026-05-07
- Article slug: `glaze-7-2-native-tooling-serialization`
- Source: ISO C++ Blog Glaze 7.2 release note
- Cleanup context: historical_archive_cleanup

## Original Summary

The historical article framed Glaze 7.2 as an Android native HAL metadata serialization PoC candidate. It asked the HAL team to inspect `camera3_capture_result_t` vendor tag paths and `vendor.camera.hal.stats` debug dump paths, then build a CBOR serialization PoC and compare CPU time, p95 latency, binary size, and boilerplate LOC.

## Rewritten Summary

The rewritten article treats Glaze 7.2 as a host-side native tooling watch item. It preserves source-backed facts about the Glaze v7.2.0 release and C++26 Reflection / serialization format support, but removes the implication that the source creates a Camera HAL production path, vendor metadata contract, or runtime behavior action.

## Removed Overclaim

- Removed direct HAL metadata serialization PoC framing.
- Removed `camera3_capture_result_t` and `vendor.camera.hal.stats` implementation-path instructions.
- Removed benchmark requirements for 10,000 records, CPU time, p95 latency, binary size, and boilerplate LOC.
- Removed wording that could read as a production HAL code or camera pipeline change request.

## Source-Backed Boundary

- The source supports Glaze v7.2.0 release facts and C++26 Reflection / format support.
- The source does not establish Camera HAL API, metadata contract, scheduling, pipeline behavior, or production HAL code changes.
- Follow-up is limited to toolchain support review and possible host-side utility consideration if an internal tooling need exists.

## Validation Intent

This is a source-backed clarification and downgrade. It does not add new API, benchmark, HAL contract, runtime behavior, or downstream product requirement claims.
