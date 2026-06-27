# 기사 품질 체크리스트 (article-quality-checklist)

이 문서는 발행 정책이 아니라, **editorial-plan 단계가 기사를 어느 계층(layer)으로 보고 framing했는지 사람이 draft를 보며 점검하는 리뷰어용 체크리스트**입니다. 편집 정책 본문은 [EDITORIAL_POLICY.md](EDITORIAL_POLICY.md)가 정본이며, 여기서는 그 정책을 복제하지 않고 리뷰 때 실제로 확인할 항목만 정리합니다.

## 왜 필요한가

editorial-plan 단계는 선택된 기사마다 내부 editorial plan(coverage/impact/framing)을 LLM으로 생성합니다. 이 단계의 전형적 실수는 **Camera HAL보다 아래·옆·위 계층의 신호를 HAL 직접 영향으로 부풀리는 것**입니다(예: 이미지 센서 패치를 HAL 변경처럼, 컴파일러 변경을 카메라 런타임 성능 향상처럼).

결정론 코드는 "나쁜 출력이 새지 않게" 하는 안전망까지만 보장합니다 — `direct_hal_impact`는 boolean으로 강제되고, `coverage_decision`/`impact_level`은 editor에 넘어가기 전 제거되며, 식별자 없는 항목과 빈 plan은 차단됩니다. **실제 분류가 의미적으로 맞는지는 코드가 판정할 수 없으므로**, 이 체크리스트로 사람이 확인합니다.

## 두 분류 값은 서로 다릅니다

editorial-plan은 두 개의 별개 vocabulary를 씁니다. 혼동하지 마세요.

- `coverage_decision`: `main_article`, `short_mention`, `reference_only`, `exclude` — 이 기사를 얼마나 다룰지.
- `impact_level`: `Direct Impact`, `Design Reference`, `Trend Watch`, `Exclude` — Camera HAL 관점의 영향 강도.

이 두 값은 public 본문에 라벨로 노출되지 않으며 editor에게 넘어가기 전에 제거됩니다. 리뷰어는 `articles/content/newsroom/<date>/editorial-plan.json` artifact에서 읽습니다.

## 계층 지도 (layer map)

과대해석은 "어느 계층의 신호인가"를 잘못 잡는 데서 옵니다. 새 기사를 만나면 먼저 **어느 계층인지** 정한 뒤, 그 계층의 과대해석 신호와 점검 항목을 봅니다. 계층은 EDITORIAL_POLICY.md의 우선순위 bucket과 대응합니다.

| 계층 | 예시 기사 | 전형적 과대해석 | 리뷰어 점검 |
| --- | --- | --- | --- |
| 이미지 센서 / lower-stack (`camera_driver_image_pipeline`) | Linux media·V4L2·센서 드라이버 패치 | "센서 패치 = Android HAL 변경"으로 단정 | source가 HAL 변경을 직접 말하지 않으면 `direct_hal_impact=false`인가? RAW-only·review NACK 같은 한계가 `source_limitations`에 남았나? URL/제목의 `sensor` 키워드만으로 분류하지 않았나? |
| ISP / IP (`camera_driver_image_pipeline`) | ISP 드라이버·파이프라인 제어 패치 | "ISP IP 제공자 = device vendor 양산"으로 단정 | source 근거 없이 Samsung/S.LSI/Exynos 양산을 단정하지 않았나? ISP IP 제공자와 적용 디바이스를 구분했나? |
| Camera HAL (`direct_aosp_camera`) | Camera HAL3/AIDL, CameraService, stream/metadata | (정상 직접 영향) | 실제 HAL interface·metadata·buffer 영향이 source로 뒷받침되나? |
| Android framework / app (`android_platform_camera_adjacent`) | Camera2/CameraX, CTS/VTS/ITS | "app/API 영향 = vendor HAL contract 변경"으로 단정 | app·framework 계층 영향과 vendor HAL contract 영향을 구분했나? |
| 컴파일러 / 툴체인 / CI (`cpp_ai_tooling_fallback`) | Clang/LLVM, static analysis, build/test | "툴체인 변경 = 카메라 런타임 성능 향상"으로 단정 | code 품질·빌드 안정성으로 framing했나? 근거 없는 runtime 성능·화질 개선 주장이 없나? Android native는 Clang/LLVM/libc++ 중심으로 봤나? |
| 제품 / 산업 (`generic_tech_watchlist`) | 제품 출시·산업 트렌드 | 구체 연결 없이 "Camera HAL 관련"으로 승격 | 구체적 HAL 인접 trend를 설명하나? 못 하면 `short_mention`/`reference_only`/`exclude`로 강등했나? |

> 계층에 딱 맞지 않는 새 토픽(예: GPU 드라이버, 전력관리)도 같은 원칙으로 봅니다 — "Camera HAL보다 아래/옆/위 계층의 신호는 명시적 HAL 근거가 있을 때만 직접 영향으로 본다." 어느 계층에 가까운지 매핑한 뒤 그 행의 점검 항목을 적용하세요. EDITORIAL_POLICY.md의 과장 금지 기준도 함께 봅니다.

## 코드가 보장하는 것 vs 사람이 판정하는 것

| 항목 | 보장 주체 | 내용 |
| --- | --- | --- |
| 가드 문구 보존 | 코드 (`editorial-plan-classification.test.js`) | prompt가 계층 taxonomy와 계층별 과대해석 경계 문구를 그대로 담고 있음 |
| 후처리 안전망 | 코드 (`editorial-plan-stage.test.js`) | `direct_hal_impact` boolean 강제, coverage 권한 strip, 식별자 없는 항목 제거, 빈 plan fail-fast |
| **분류의 의미적 정확성** | **사람 (이 체크리스트)** | 실제 모델이 이 기사를 올바른 계층·강도로 분류했는지 |

테스트가 green이라는 것은 "가드 문구가 온전하고 나쁜 출력이 새지 않는다"는 뜻이지 "모델이 올바르게 분류했다"는 뜻이 아닙니다. 분류가 맞는지는 위 계층 지도로 사람이 확인합니다.
