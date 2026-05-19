# 2026-05-11 CameraX 1.6.1 Android Camera rewrite

## Original summary

The historical article used a generic Camera HAL / Android Camera / driver-image pipeline review frame for the CameraX 1.6.1 Android Camera release note row.

## Rewritten summary

The article now treats CameraX 1.6.1 as an AndroidX Camera artifact update and app/framework compatibility matrix input. HAL follow-up is only recorded when downstream device evidence separates the issue from app or framework behavior.

## Removed overclaim

- Generic HAL/source/API/driver/image pipeline impact framing.
- Release-note-only promotion to Camera HAL interface or metadata contract review.
- Unbounded CTS/VTS or Camera ITS follow-up without downstream evidence.

## Source-backed boundary

The source supports CameraX artifact version facts and release timing. It does not establish direct Camera HAL behavior changes.

## Validation intent

This rewrite keeps the historical CameraX source visible while reducing the article to an adjacent compatibility audit signal for #108 cleanup.
