# Fact-check Report - Camera HAL SW Newsletter 2026-04-30

## Scope

GitHub Issue #5의 자동 수집 후보를 기반으로 2026-04-30 발행용 기사에 포함할 항목을 공식 출처 중심으로 확인했습니다.

## Verified Items

| 항목 | 상태 | 확인 내용 | 출처 |
|---|---|---|---|
| Android 17 Beta 4 | Verified | 2026-04-16 게시. 마지막 scheduled beta, app/library/tool 호환성 테스트 권고, dynamic code loading/native library read-only, app memory limits, profiling trigger 언급 | Android Developers Blog |
| CameraX 1.6.0 | Verified | 2026-03-25 release. CameraPipe, Media3 Muxer, Feature Group, stable SessionConfig, `isSessionConfigSupported()`, Android 17 dynamic range crash fix 포함 | Android CameraX release notes |
| Android CLI / Skills | Verified | 2026-04-16 게시. Android CLI, Android Skills, Android Knowledge Base 소개. 내부 실험 기준 token 70% 감소, task 3x faster claim 포함 | Android Developers Blog |
| Android Studio Panda 4 | Verified | 2026-04-21 게시. Planning Mode, Next Edit Prediction, Gemini API Starter Template, Agent Web Search 소개 | Android Developers Blog |
| Hybrid inference | Verified | 2026-04-17 게시. Firebase AI Logic 기반 hybrid inference, Gemini Nano on-device/cloud fallback, experimental 상태 언급 | Android Developers Blog |
| LiteRT / NPU | Verified | 2026-04-23 게시. on-device AI에서 thermal, battery, frame drop 문제와 LiteRT의 CPU/GPU/NPU acceleration 설명 | Google Developers Blog |
| GitHub Copilot cloud agent startup | Verified | 2026-04-27 게시. Actions custom images로 cloud agent startup 20% 이상 개선 | GitHub Changelog |
| GPT-5.5 in GitHub Copilot | Verified | 2026-04-24 게시. Copilot Pro+/Business/Enterprise 대상 gradual rollout, 7.5x premium request multiplier 언급 | GitHub Changelog |
| OpenAI Agents SDK | Verified | 2026-04-15 게시. sandbox execution, filesystem/tools, MCP, skills, AGENTS.md, shell/apply patch primitive, snapshot/rehydration 설명 | OpenAI |
| CppCon Atomics / JSON posts | Verified | ISO C++ Blog 게시물 존재 확인. Camera HAL 직접 뉴스라기보다는 C++ native review tip으로 사용 | ISO C++ Blog |

## Editorial Inference

다음 내용은 공식 출처의 직접 문장이 아니라 Camera HAL 관점의 해석입니다.

- `isSessionConfigSupported()` 확대는 HAL capability / stream combination 정합성 검증 압력을 높인다.
- on-device AI와 LiteRT/NPU 흐름은 Camera preview, image processing, thermal/FPS 안정성 검증 항목과 연결된다.
- Android CLI / Skills / Planning Mode는 Camera HAL AI study의 SKILL.md, negative TC generator, code reviewer workflow로 전환 가능하다.
- Copilot cloud agent와 OpenAI Agents SDK의 sandbox 구조는 사내 HAL CI/agent runner 설계 시 참고할 수 있다.

## Excluded / Lower Priority

| 후보 | 제외 또는 보류 사유 |
|---|---|
| Jetpack Compose April 2026 | Camera HAL 직접 관련성이 낮아 제외 |
| Credential Manager verified email | Camera HAL 직접 관련성이 낮아 제외 |
| Play policies | Camera HAL 직접 관련성이 낮아 제외 |
| Google I/O schedule | 예고성 이벤트라 이번 호 핵심 기사로는 제외 |
| Multi-device Emulator | 유용하지만 Camera HAL 직접성은 CameraX/Android17보다 낮아 보조 후보로 처리 |

## Risk Notes

- Android 17 Beta / CameraX 1.6 관련 내용은 release note 기준이므로 실제 device/vendor branch 적용 여부는 별도 확인 필요합니다.
- GitHub Copilot GPT-5.5 및 OpenAI Agents SDK 내용은 public service 기준입니다. 회사 내부망/보안정책/라이선스와 직접 연결하려면 별도 검토가 필요합니다.
- C++ 게시물은 Camera HAL용 공식 변경사항이 아니라 교육/리뷰 팁으로만 사용했습니다.
