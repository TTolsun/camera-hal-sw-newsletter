# 2026-05-07 libcamera v0.7.1 SoftISP rewrite diff

## Article

libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선

## Original summary

The archived article described upstream SoftISP debayering and throughput updates as directly affecting Android RAW_SENSOR quality, ISP metadata behavior, runtime latency, and Camera ITS RAW tests.

## Rewritten summary

The article now presents SoftISP debayering and throughput work as an upstream image-pipeline signal. HAL follow-up is limited to product paths that actually integrate or reference libcamera SoftISP and have downstream image-quality or performance evidence.

## Removed overclaim

- Direct Android RAW_SENSOR, metadata, or runtime latency impact from the upstream source alone.
- Product-level 4K / dumpsys performance measurements without a downstream regression or requirement.
- Treating upstream SoftISP changes as vendor ISP behavior without integration evidence.

## Source-backed boundary

The source supports a libcamera SoftISP/image-pipeline update. It does not prove Android product HAL RAW/YUV behavior or ISP metadata changes.

## Validation intent

Keep SoftISP as a camera driver/image-pipeline signal while preventing unsupported Android runtime or metadata claims.
