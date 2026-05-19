# 2026-05-09 libcamera v0.7.1 SoftISP / pipeline rewrite diff

## Article

libcamera v0.7.1 출시: SoftISP 및 파이프라인 처리량 개선

## Original summary

The archived article said libcamera v0.7.1 affects HAL interaction with V4L2/libcamera drivers, may improve RAW processing and sensor modes, may expose new HAL camera features, and should drive stream/latency/power validation.

## Rewritten summary

The article now treats libcamera v0.7.1 as an upstream Linux camera stack release. HAL follow-up is limited to vendor kernel/libcamera forks that actually consume the release or to downstream device regressions tied to the change.

## Removed overclaim

- HAL feature exposure or HAL declaration updates from the release note alone.
- STREAM_CONFIGURATION_MAP / CONTROL_AE_TARGET_FPS_RANGE validation without downstream evidence.
- Broad latency, frame-drop, and power behavior claims without product-path logs.

## Source-backed boundary

The source supports the libcamera v0.7.1 release contents. It does not prove Android Camera HAL stream, metadata, latency, power, or feature-declaration changes.

## Validation intent

Bound the direct camera source to source-backed driver/image-pipeline review while preserving downstream evidence as the gate for HAL actions.
