# 2026 W45 (11.02 ~ 11.08)





<a id="issue-briefing"></a>

## 1. 이번 주 핵심

이번 주 뉴스레터에서는 CameraX의 안정성과 기능 확장에 대한 소식을 전해드립니다. 먼저, 프레임 누락으로 인한 3A 세션 교착 방지를 위해 CameraX 타임아웃 메커니즘이 보강되어 안정성이 향상되었습니다. 또한, Android 37 API 대응을 위해 CameraPipe 다중 해상도 ImageReader 브리지가 정비되었으며, CameraX 저조도 처리 효과 확장을 위해 LowLightBoostEffect가 도입되어 앱 레벨에서 저조도 환경 이미지 화질을 보정할 수 있게 되었습니다.

- [프레임 누락으로 인한 3A 세션 교착 방지, CameraX 타임아웃 메커니즘 보강](#article-3a-camerax)

  하부 HAL 및 센서 드라이버가 3A 수렴 결과 전달을 지연하거나 드롭하더라도, 프레임워크 레벨에서 500ms 버퍼 타임아웃으로 세션 락을 안전하게 해제하도록 방어 로직이 구축되었습니다.

- [Android 37 API 대응, CameraPipe 다중 해상도 ImageReader 브리지 정비](#article-android-37-api-camerapipe-imagereader)

  Android 37 환경에서 MultiResolutionImageReader의 동시 리더 지원 여부 및 활성 Surface 콜백이 프레임워크 정식 API로 직결되므로, 관련 스트림 구성 시 버퍼 처리 흐름을 확인해 둘 필요가 있습니다.

- [CameraX 저조도 처리 효과 확장, LowLightBoostEffect 도입](#article-camerax-lowlightboosteffect)

  CameraX의 후처리 이펙트 파이프라인 확장이지만 HAL 레벨의 직접적인 인터페이스 계약 변경은 아니며, 상위 프레임 처리 경로 변화로 파악해 둘 수 있습니다.




<a id="article-3a-camerax"></a>

## 2. 프레임 누락으로 인한 3A 세션 교착 방지, CameraX 타임아웃 메커니즘 보강

_AndroidX Gerrit Camera (Change 4365755)_

하부 카메라 HAL이 프레임 전송을 멈추더라도 상위 세션이 무한히 멈추지 않도록, CameraX 3A 대기 제어에 절대 시간 기준의 안전 타임아웃이 적용되었습니다.

### Camera HAL/Driver 관점에서의 의미

하부 HAL 및 센서 드라이버가 3A 수렴 결과 전달을 지연하거나 드롭하더라도, 프레임워크 레벨에서 500ms 버퍼 타임아웃으로 세션 락을 안전하게 해제하도록 방어 로직이 구축되었습니다.


![](../../assets/images/fallback/android.svg)


2026년 11월 3일 AndroidX 메인 브랜치에 CameraX의 CapturePipeline 및 3A 제어 로직을 보완하는 변경이 병합되었습니다. 기존 CameraPipe의 3A 상태 리스너는 반복 프레임의 센서 타임스탬프 간격을 기준으로 제한 시간을 평가했습니다. 이로 인해 카메라 장치가 열려 있는 동안 하부 HAL이나 드라이버 파이프라인에서 프레임 전송이 멈추면 비동기 작업이 영구히 대기하며 세션 락을 점유하는 취약점이 있었습니다.

이번 패치는 lock3AForCapture, lockAf, unlockAf, startFocusAndMeteringAsync, cancelFocusAndMeteringAsync 대기 경로 전반에 절대 시간 기준의 타임아웃인 withTimeoutOrNull을 배치했습니다. 기준 시간은 기존 설정된 나노초 제한 시간에 500밀리초 버퍼를 더한 값으로 동작합니다. 또한 CapturePipeline의 결과 대기 코루틴에서 발생하던 누수를 막기 위해 예외 발생 및 종료 시 반드시 리스너를 정리하고 완료 신호를 닫는 finally 블록 구조로 재편했습니다.

더불어 카메라 세션 중단으로 캡처 시퀀스가 취소될 때 호출되는 onRequestSequenceAborted 이벤트를 포착하여 세션 닫힘 오류를 즉각 전파하도록 수정했습니다. 이는 드라이버 결함이나 하드웨어 지연이 발생했을 때 상위 레이어에서 세션이 복구되지 못한 채 멈추는 프레임워크 데드락 위험을 줄여 줍니다.

해당 변경은 프레임워크 레이어의 견고성을 개선하는 작업이며 카메라 HAL이나 커널 드라이버 자체의 3A 알고리즘 버그를 직접 수정하는 것은 아닙니다. 3A 결과 지연 시 세션이 적절히 회수되는지 모니터링하기 위해 반복 요청 중단 시퀀스를 인위적으로 트리거하는 회귀 점검을 제안할 수 있습니다. 현재 확인된 범위는 androidx-main 소스 트리 병합 상태이며, 실제 바이너리 배포 및 디바이스 제품 빌드 적용 여부는 각 릴리스 일정을 별도로 확인해야 합니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Fix CapturePipeline and 3A indefinite waits - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4365755)

---

<a id="article-android-37-api-camerapipe-imagereader"></a>

## 3. Android 37 API 대응, CameraPipe 다중 해상도 ImageReader 브리지 정비

_AndroidX Gerrit Camera (Change 4423978)_

CameraX의 내부 구현체인 CameraPipe가 compileSdk 37 승격에 맞춰 다중 해상도 리더 및 활성 Surface 감지 기능을 Android 37 정식 API로 전환했습니다.

### Camera HAL/Driver 관점에서의 의미

Android 37 환경에서 MultiResolutionImageReader의 동시 리더 지원 여부 및 활성 Surface 콜백이 프레임워크 정식 API로 직결되므로, 관련 스트림 구성 시 버퍼 처리 흐름을 확인해 둘 필요가 있습니다.


![](../../assets/images/fallback/newsletter-default.svg)


2026년 11월 7일 platform/frameworks/support 브랜치에 CameraPipe 내부의 호환성 레이어를 Android 37 정식 API로 교체하는 커밋이 병합되었습니다. 프로젝트의 compileSdk가 37로 상향됨에 따라, 임시 추상화였던 PlatformApiCompat 대신 Api37Compat 클래스를 통해 플랫폼 프레임워크 기능을 직접 호출하도록 변경되었습니다.

주요 변경 지점은 MultiResolutionImageReader 관련 제어입니다. Api37Compat에 isConcurrentReadersSupported, buildMultiResolutionImageReader, setOnActiveOutputSurfacesListener가 추가되었습니다. 이에 따라 Camera2MultiResolutionStreamConfigurationMap은 API 레벨 37 이상에서 프레임워크의 동시 판독 지원 여부를 직접 조회하며, 그 미만 버전에서는 지원하지 않음(false)을 명시적으로 반환합니다.

또한 AndroidMultiResolutionImageReader 생성 시 동시 출력이 활성화된 환경에서만 Api37Compat의 활성 Surface 리스너를 바인딩하도록 검증 로직이 정비되었습니다. 리더가 활성 Surface 목록을 전달받으면 기대 출력 식별자를 매핑해 상위 파이프라인으로 넘겨주므로, 다중 물리 카메라를 가진 기기에서 해상도 전환 시 버퍼 파이프라인 처리가 명확해집니다.

이번 커밋은 CameraPipe 내부의 플랫폼 브리징 코드를 정비한 것이며, 카메라 HAL 인터페이스의 새로운 바인딩을 강제하거나 즉각적인 드라이버 수정을 요구하는 것은 아닙니다. API 37 환경을 타깃으로 하는 디바이스에서 MultiResolutionImageReader 스트림 설정 및 동시 출력 플래그 적용 시 프레임 드롭이나 포맷 불일치가 발생하지 않는지 확인하는 관찰 작업이 유효합니다. 이 패치는 현재 androidx-main 소스 트리에 반영된 상태이며 제품 릴리스 시점은 별개입니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Transition PlatformApiCompat usages in CameraPipe to Api37Compat - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4423978)

---

<a id="article-camerax-lowlightboosteffect"></a>

## 4. CameraX 저조도 처리 효과 확장, LowLightBoostEffect 도입

_AndroidX Gerrit Camera (Change 4223279)_

앱 레벨에서 저조도 환경 이미지 화질을 보정할 수 있도록 CameraEffect를 확장한 LowLightBoostEffect가 CameraX 메인 트리에 병합되었습니다.

### Camera HAL/Driver 관점에서의 의미

CameraX의 후처리 이펙트 파이프라인 확장이지만 HAL 레벨의 직접적인 인터페이스 계약 변경은 아니며, 상위 프레임 처리 경로 변화로 파악해 둘 수 있습니다.


![](../../assets/images/fallback/android.svg)


2026년 11월 3일 AndroidX 메인 브랜치에 LowLightBoostEffect 및 관련 세션 관리자를 도입하는 대규모 패치가 병합되었습니다. 이 변경은 8개 소스 파일에 걸쳐 약 2,900줄 이상의 코드를 추가하며 CameraX effects 생태계에 새로운 효과를 통합했습니다.

새로 추가된 LowLightBoostEffect는 기존 CameraEffect 추상 클래스를 상속합니다. 애플리케이션 개발자는 컨텍스트와 타깃을 받는 생성자를 통해 인스턴스를 만들고, LiveData 형태의 상태 관찰과 setLowLightBoostEnabled 메서드로 효과를 제어할 수 있습니다. 또한 기기 및 카메라 정보에 따라 효과 지원 여부를 비동기 및 동기로 판별하는 isSupportedAsync와 isSupported 메서드가 함께 노출됩니다.

이 기능은 프레임워크 수준의 Surface Processor와 세션 매니저를 통해 카메라 프레임을 후처리하는 방식으로 동작합니다. 카메라 HAL 자체의 인터페이스 규격을 직접 변경하거나 새로운 드라이버 제어 코드를 요구하는 것은 아닙니다. 하지만 효과 처리 과정에서 프레임 지연이나 메모리 대역폭 점유가 발생할 수 있으므로 상위 이미지 처리 파이프라인의 변화를 참고할 필요가 있습니다.

원문에서 확인된 범위는 androidx-main 트리에 소스 코드가 병합되었다는 점까지입니다. 구체적인 후처리 알고리즘 사양이나 상용 릴리스 아티팩트 배포 일정은 아직 확정 근거가 없으므로 후속 릴리스 노트를 지켜보아야 합니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Add LowLightBoostEffect, surface processor and session manager - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4223279)


## 참고자료

- [Fix CapturePipeline and 3A indefinite waits - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4365755)
- [Transition PlatformApiCompat usages in CameraPipe to Api37Compat - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4423978)
- [Add LowLightBoostEffect, surface processor and session manager - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4223279)
