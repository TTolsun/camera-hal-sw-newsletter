# Camera HAL / SW Newsletter - 2026-10-05

이번 주 뉴스레터에서는 시스템 suspend/resume 시 Mali-C55 ISP의 전원 관리 안정성을 개선하는 커널 패치와 ChromeOS 플랫폼에서 카메라 버퍼 ID 독점성 강제 및 APPn 파싱 경계 검사를 통해 데이터 무결성을 확보하는 변경 사항을 다룹니다.



## 1. 이번 주 3줄 브리핑

- Mali-C55 ISP 드라이버에서 IRQ wake 활성화 시 시스템 suspend 중에도 ISP 전원을 유지하도록 하는 패치가 제안되어 프레임 인터럽트 유실을 방지하고 카메라 파이프라인의 안정성을 높입니다.
- ChromeOS 카메라 스택의 still capture processor에서 JPEG APPn 마커 파싱과 BLOB 출력 버퍼 크기 결정에 경계 검사를 추가하여 버퍼 오버런 위험을 차단합니다.
- ChromeOS 카메라 HAL 어댑터에서 활성 카메라 버퍼마다 고유한 ID를 갖도록 강제하여 버퍼 ID 충돌과 버퍼 소유권 꼬임을 방지합니다.

## 2. Mali-C55 ISP 드라이버 전원 관리 개선으로 시스템 복귀 시 프레임 인터럽트 유실 방지


![Mali-C55 ISP 드라이버 전원 관리 개선으로 시스템 복귀 시 프레임 인터럽트 유실 방지 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (2026-09-29)_

시스템이 대기 모드로 들어갔다 깨어나는 순간 카메라 화면이 멈추거나 프레임이 누락되는 현상을 겪어보셨다면, 하위 드라이버의 전원 관리 타이밍을 의심해볼 필요가 있습니다.

리눅스 미디어 서브시스템 메일링 리스트에 mali-c55 ISP 드라이버의 전원 관리 동작을 개선하는 패치가 제안되었습니다. 이번에 공개된 패치는 시스템 suspend 및 resume 과정에서 발생할 수 있는 ISP 인터럽트 유실 문제를 해결하는 데 초점을 맞추고 있습니다.

기존 구조에서는 시스템 suspend가 IRQ wake를 활성화한 직후 pm_runtime_force_suspend()를 호출하는 방식으로 동작했습니다. 이 과정에서 활성화 상태였던 ISP의 리셋 신호가 어서트되고 클럭이 비활성화되면서, ISP가 더 이상 프레임 인터럽트를 생성할 수 없는 상태에 빠지는 문제가 있었습니다. 이미 런타임 suspend 상태였던 ISP 역시 전원이 꺼진 채로 방치되었습니다.

### 런타임 PM 참조 유지를 통한 전원 확보

제안된 변경 사항은 IRQ wake를 활성화하기 전에 런타임 PM 참조를 명시적으로 가져오고, 이를 시스템이 완전히 resume될 때까지 유지하도록 합니다. 이를 통해 유휴 상태의 ISP 전원을 켜진 상태로 유지하고 IRQ wake가 정상적으로 활성화될 수 있도록 보장합니다. 만약 IRQ wake 설정이 실패하면 가져왔던 참조를 즉시 해제하여 불필요한 전력 소모를 방지합니다.

이 패치는 아직 리눅스 커널 메인라인에 머지되지 않은 제안 단계의 패치 시리즈 중 일부입니다. 실제 하드웨어 플랫폼에 적용하기 전에 전력 소비 변화와 suspend/resume 주기에서의 카메라 파이프라인 안정성을 충분히 검증해야 합니다.

### Camera HAL/Driver 관점에서의 의미

이 변경은 하위 ISP 드라이버의 안정성을 높여 HAL 계층에 안정적인 이미지 스트림을 공급하는 데 기여합니다. Mali-C55 ISP를 사용하는 SoC 플랫폼 개발자는 시스템 suspend/resume 복귀 시점에 HAL에서 프레임 드롭이나 타임아웃 로그가 발생하는지 확인하고, 드라이버 계층에서 PM 참조가 정상적으로 해제되는지 전력 소모 메트릭을 모니터링해야 합니다.

**출처**

- [PATCH 3/3 media: mali-c55: Keep ISP powered while IRQ wake is armed](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/T/#t)

---

## 3. ChromeOS 카메라 스택에서 APPn 파싱 및 BLOB 버퍼 경계 검사 도입으로 이미지 처리 안정성 강화


![ChromeOS 카메라 스택에서 APPn 파싱 및 BLOB 버퍼 경계 검사 도입으로 이미지 처리 안정성 강화 image](../../assets/images/fallback/newsletter-default.svg)


_ChromeOS Gerrit (2026-09-30)_

카메라 캡처 과정에서 이미지 메타데이터를 파싱할 때 경계 검사가 누락되면 메모리 오버플로우나 시스템 크래시로 이어질 수 있습니다.

ChromeOS의 카메라 공통 라이브러리 스택에 이미지 캡처 처리 안정성을 높이기 위한 보안 패치가 병합되었습니다. 이번 변경은 정적 이미지 캡처 프로세서에서 발생할 수 있는 버퍼 오버런 위험을 차단하는 데 중점을 둡니다.

Gerrit 변경 사항에 따르면, 개발진은 still capture processor 모듈의 소스 코드를 수정하여 JPEG 이미지의 APPn 마커를 파싱할 때와 BLOB 출력 버퍼 크기를 결정할 때 엄격한 경계 검사를 수행하도록 했습니다. 구체적으로는 still capture processor 소스 파일 내에서 버퍼의 남은 공간과 파싱하려는 데이터 크기를 대조하는 로직이 보강되었습니다.

### 이미지 메타데이터 파싱의 안전성 확보

APPn 마커는 JPEG 파일 내에서 애플리케이션 고유의 메타데이터(예: Exif 데이터 등)를 담는 영역입니다. 이 영역을 파싱할 때 입력 데이터의 크기를 제대로 검증하지 않으면 잘못된 메모리 주소에 접근하거나 버퍼 크기를 초과하여 데이터를 쓰는 문제가 발생할 수 있습니다. 이번 경계 검사 추가를 통해 비정상적인 메타데이터를 포함한 이미지 프레임이 입력되더라도 카메라 서비스가 크래시 없이 안전하게 예외 처리를 수행할 수 있게 되었습니다.

이 변경은 ChromeOS 플랫폼의 카메라 스택에 적용된 것이지만, 동일한 JPEG 파싱 및 BLOB 버퍼 관리 메커니즘을 사용하는 Android Camera HAL 및 공통 이미지 프로세서 구현에서도 참고할 만한 중요한 안정성 개선 사례입니다.

### Camera HAL/Driver 관점에서의 의미

Android Camera HAL에서 JPEG/BLOB 스트림을 처리할 때도 동일한 취약점이 발생할 수 있습니다. HAL 개발자는 JPEG 인코딩 및 Exif/APPn 메타데이터 파싱 시 입력 버퍼 크기와 출력 BLOB 버퍼 크기에 대한 경계 검사가 누락되지 않았는지 정적 분석 도구 및 퍼징 테스트를 통해 점검해야 합니다.

**출처**

- [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692)

---

## 4. ChromeOS 카메라 어댑터에서 독점적 버퍼 ID 강제로 버퍼 관리 충돌 방지


![ChromeOS 카메라 어댑터에서 독점적 버퍼 ID 강제로 버퍼 관리 충돌 방지 image](../../assets/images/fallback/newsletter-default.svg)


_ChromeOS Gerrit (2026-09-30)_

카메라 버퍼를 관리할 때 동일한 ID가 중복 할당되거나 오용되면 심각한 메모리 오염이나 프레임 왜곡이 발생할 수 있습니다.

ChromeOS 카메라 HAL 어댑터 스택에 버퍼 관리의 일관성을 높이고 버퍼 ID 충돌을 방지하기 위한 중요한 패치가 병합되었습니다. 이번 변경은 카메라 디바이스 어댑터 계층에서 버퍼 ID의 독점성을 엄격히 강제하도록 설계되었습니다.

Gerrit 변경 내역에 따르면, 개발진은 카메라 디바이스 어댑터의 소스 코드를 수정하여 시스템 내에서 활성화된 각 카메라 버퍼가 고유하고 독점적인 ID를 가지도록 보장하는 로직을 추가했습니다. 이 변경은 버퍼 할당 및 사용 주기 전반에 걸쳐 버퍼 ID의 일관성을 유지하는 데 기여합니다.

### 버퍼 ID 충돌 및 오용 차단

카메라 파이프라인에서 여러 스트림이 동시에 활성화될 때, 버퍼 ID가 고유하게 관리되지 않으면 특정 스트림의 버퍼가 다른 스트림에 의해 잘못 덮어씌워지거나 런타임에 버퍼 소유권이 꼬이는 문제가 발생할 수 있습니다. 이번 패치는 버퍼 ID 등록 및 해제 시점에 독점성 검증을 강제함으로써 이러한 동시성 버그와 메모리 관리 오류를 원천 차단합니다.

이 변경은 ChromeOS 카메라 어댑터에 적용된 것이지만, 다중 스트림 환경에서 복잡한 버퍼 라이프사이클을 관리해야 하는 Android Camera HAL 개발자들에게도 버퍼 관리의 안정성을 높이는 좋은 설계 기준을 제시합니다.

### Camera HAL/Driver 관점에서의 의미

Android Camera HAL3 구현에서도 버퍼 ID 독점성 관리는 매우 중요합니다. HAL3에서는 프레임 요청 시 버퍼 ID를 매핑하여 관리하므로, HAL 개발자는 다중 스트림 구성 시 버퍼 ID 충돌이 발생하지 않도록 버퍼 맵 등록 로직을 점검하고, 중복된 버퍼 ID가 입력될 경우 즉시 에러를 반환하는 방어 로직을 구현해야 합니다.

**출처**

- [camera: Enforce exclusive buffer IDs - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146)


## 참고 / 더 읽을거리

- [\[PATCH v2\] media: rcar-isp: ispcore: Fix inconsistent step sizes](<https://lore.kernel.org/linux-media/20261001085130.84565-1-barnabas.pocze+renesas@ideasonboard.com/>) — lore.kernel.org linux-media list (2026-10-01) · Android 플랫폼 · 미디어 출력 · SoC 신호 참고
- [camera: Prevent buffer UAF on PortraitModeEffect timeout - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424689>) — ChromeOS Gerrit (platform2 camera merged changes) (2026-09-30) · 카메라 드라이버 / 이미지 파이프라인 참고
- [camera: Validate plane offsets in RegisterBuffer - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424691>) — ChromeOS Gerrit (platform2 camera merged changes) (2026-09-30) · 카메라 드라이버 / 이미지 파이프라인 참고
- [camera: Validate plane sizes against dmabuf bounds in RegisterBuffer - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424690>) — ChromeOS Gerrit (platform2 camera merged changes) (2026-09-30) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [PATCH 3/3 media: mali-c55: Keep ISP powered while IRQ wake is armed](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/T/#t)
- [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692)
- [camera: Enforce exclusive buffer IDs - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146)
