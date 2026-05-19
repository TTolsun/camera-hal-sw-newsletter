# 2026-05-07 libcamera v0.7.1 Raspberry Pi Atomic / AGC-AWB rewrite diff

## Article

libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선

## Original summary

The archived article framed Raspberry Pi Atomic control lists and Simple pipeline AGC/AWB statistics changes as improvements that affect HAL stability, performance, and captureResult metadata accuracy.

## Rewritten summary

The article now treats the release note as an upstream Linux camera stack driver/image-pipeline signal. Android HAL follow-up is limited to devices where the downstream vendor kernel or libcamera fork actually contains the change and AE/AWB regression evidence exists.

## Removed overclaim

- Direct HAL stability or performance improvement from the upstream release note alone.
- Metadata accuracy improvement without downstream integration evidence.
- Broad Preview/ImageCapture/VideoCapture regression work before product-path evidence exists.

## Source-backed boundary

The source supports the libcamera v0.7.1 release and the Raspberry Pi Atomic control lists / Simple pipeline AGC-AWB changes. It does not by itself prove Android Camera HAL runtime behavior changes.

## Validation intent

Keep this direct camera source as a keep candidate while bounding HAL action to downstream integration evidence and product regression logs.
