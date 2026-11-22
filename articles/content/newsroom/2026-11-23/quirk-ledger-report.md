# 기기 우회 장부 (quirk ledger)

- 실행 날짜: 2026-11-23
- 조회 창: 2026-11-16 ~ 2026-11-22 (UTC, 제출일 기준)
- 상태: ok
- 항목 4건, 제외 2건 (쿼크 파일 변경 6건 중)
- 이 보고서는 shadow 산출물이며 공개 뉴스레터에 쓰이지 않는다. 기기 식별자는 커밋 메시지와 diff에 적힌 문자열이고, 영향 여부의 판정이 아니다.

| 제출일 | change | 제목 | 기기 식별자 | 우회 클래스 | Exynos |
| --- | --- | --- | --- | --- | --- |
| 2026-11-17 | [4440995](https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995) | Exclude OPPO PHT110 physical camera IDs 2 and 3 | 코드: PHT110 | ExcludePhysicalCameraIdQuirk(modified) | - |
| 2026-11-17 | [4441195](https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195) | Disable ZSL on Samsung SM-F971 | 코드: SM-F971 / 커밋 메시지: SM-F971U1, SM-F936, SM-F731, SM-F721 | ZslDisablerQuirk(modified) | - |
| 2026-11-17 | [4445746](https://android-review.googlesource.com/c/platform/frameworks/support/+/4445746) | Use HLG10 camera stream for Dolby Vision on Xiaomi 17 Pro Max | 코드: 2509FPN0BC | DolbyVisionStreamIncorrectColorQuirk(added) | - |
| 2026-11-18 | [4441276](https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276) | Extend Samsung Extensions close quirk to API 35+ | 커밋 메시지: SM-F966U, SM-F968U1, SM-S942U1, SM-S947U1 | CloseCameraDeviceOnCameraGraphCloseQuirk(modified) | - |

## 제외된 변경

- 4459688 (noise_subject): Merge empty history for sparse-16848682-L69900030233478695
- 4458028 (noise_subject): Snap for 16740496 from 737fa4d135b1f389bbcd82f6e8c0db8390246cab to androidx-text-release
