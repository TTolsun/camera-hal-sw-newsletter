# 2026 W40 (09.28 ~ 10.04)

이번 주 뉴스레터에서는 Android 17 카메라 검증을 위한 중요한 소식과 libcamera의 새로운 기능 제안을 다룹니다. Android 17 카메라 이미지 테스트 스위트 검증을 위한 가상 환경 패키지 번들링 권장 사항을 통해 테스트 환경의 일관성을 확보하세요. 또한, libcamera 자동 화이트 밸런스 제어 확장과 메타데이터 재정의 제안으로 하위 이미지 파이프라인 제어의 정밀도를 높일 수 있는 방안을 살펴보시기 바랍니다.



## 1. 이번 주 기사

- Android 17 카메라 이미지 테스트 스위트 검증을 위한 가상 환경 패키지 번들링 권장 사항
- libcamera 자동 화이트 밸런스 제어 확장과 메타데이터 재정의 제안

## 2. Android 17 카메라 이미지 테스트 스위트 검증을 위한 가상 환경 패키지 번들링 권장 사항


![Android Open Source Project](https://www.gstatic.com/devrel-devsite/prod/vfdb441d2e08dbd9d3e48d8cd72b242388a87bcf7626bf5fb9df50c2bdd4a70fd/androidsource/images/lockup.png)

_이미지: [Android 17 Camera Image Test Suite release notes | Android Open Source Project](https://source.android.com/docs/compatibility/cts/its-release-notes-17)_


_Android Open Source Project 공식 문서_

Android 17 카메라 검증을 준비하는 팀이라면, 테스트 환경의 일관성을 유지하기 위한 새로운 권장 사항에 주목해야 합니다.

Android 17 카메라 이미지 테스트 스위트의 환경 구성 방식에 변화가 생겼습니다. 공식 문서에 따르면 가상 환경을 설정할 때 패키지 관리 소프트웨어를 사용하여 올바른 버전의 패키지를 번들링할 것을 강력히 권장하고 있습니다.

이 권장 사항은 파이썬과 관련 패키지 버전에 대한 기준을 다룹니다. 카메라 이미지 테스트 스위트의 개발 및 검증 환경 구성에 직접적인 영향을 미치는 요소입니다.

### 테스트 환경의 일관성 확보

카메라 하드웨어 추상화 계층의 동작을 검증하는 테스트 환경은 파이썬 패키지 버전 불일치로 인해 예기치 않은 오류를 겪기 쉽습니다. 이번에 제시된 가상 환경 번들링 방식은 이러한 버전 파편화를 방지하고 검증의 신뢰성을 높이기 위한 조치입니다.

다만 이 변경 사항은 하드웨어 추상화 계층의 실제 동작이나 인터페이스 자체를 수정하는 것은 아닙니다. 어디까지나 하드웨어 추상화 계층 구현을 검증하는 테스트 환경을 구성할 때 적용되는 권장 지침입니다.

### Camera HAL/Driver 관점에서의 의미

Android 17 이상을 대상으로 하는 카메라 하드웨어 추상화 계층 검증을 위해, 카메라 이미지 테스트 스위트 실행 환경을 설정할 때 패키지 관리 소프트웨어를 도입하여 파이썬 패키지 버전을 동기화해야 합니다. 이는 테스트 스크립트 실행 중 발생할 수 있는 환경적 무작위 오류를 줄이는 데 기여합니다.

**출처**

- [Android 17 Camera Image Test Suite release notes](https://source.android.com/docs/compatibility/cts/its-release-notes-17)

---

## 3. libcamera 자동 화이트 밸런스 제어 확장과 메타데이터 재정의 제안


![libcamera 자동 화이트 밸런스 제어 확장과 메타데이터 재정의 제안 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 메일링 리스트_

하위 이미지 파이프라인에서 자동 화이트 밸런스를 더 정밀하게 제어하기 위한 새로운 설계 제안이 논의되고 있습니다.

libcamera 프로젝트에 자동 화이트 밸런스 제어 기능을 확장하는 패치 시리즈의 첫 번째 조각이 제출되었습니다. 이번 제안은 기존의 드래프트 단계에 있던 자동 화이트 밸런스 상태를 코어 컨트롤로 이동시키는 내용을 담고 있습니다.

제안에 따르면 자동 화이트 밸런스 상태를 나타내는 메타데이터 항목인 AwbLocked가 상태를 고정하는 제어 명령으로 재정의됩니다. 또한 상태가 고정된 상황에서도 임시로 화이트 밸런스 게인 값을 다시 계산하도록 강제하는 AwbTrigger 메커니즘이 새롭게 추가됩니다.

### 하위 이미지 파이프라인과의 거리감

이 변경 사항은 리눅스 기반 하위 카메라 스택인 libcamera에 제안된 내용으로 안드로이드 카메라 하드웨어 추상화 계층에 즉각적으로 반영되는 것은 아닙니다. 하위 이미지 파이프라인 수준에서 자동 화이트 밸런스 동작이 어떻게 정교화되는지 보여주는 설계 참고 자료로 보아야 합니다.

현재 이 패치는 머지되지 않은 제안 상태이며 메일링 리스트에서 검토가 진행 중입니다. 또한 제공된 요약 정보가 일부 생략되어 있어 게인 재계산 강제 메커니즘의 상세한 동작 조건은 향후 변경될 가능성이 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 안드로이드 카메라 하드웨어 추상화 계층의 변경은 아니지만, 하위 이미지 파이프라인 수준에서 자동 화이트 밸런스 상태 고정 및 강제 트리거가 구현되는 방식을 참고할 수 있습니다. 향후 안드로이드 카메라 하드웨어 추상화 계층의 자동 화이트 밸런스 메타데이터 매핑 설계 시 하위 드라이버와의 제어 정렬을 검토하는 데 유용합니다.

**출처**

- [[1/5] libcamera: controls: Expand AWB controls](https://patchwork.libcamera.org/patch/28387/)


## 참고 / 더 읽을거리

- [\[PATCH 3/3\] media: mali-c55: Keep ISP powered while IRQ wake is armed](<https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/>) — lore.kernel.org linux-media list (2026-09-29) · Mali-C55 ISP 전원 관리 패치 제안
- ChromeOS 카메라 변경 모음: [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692>) (2026-09-30) · [camera: Enforce exclusive buffer IDs - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146>) (2026-09-30)

## 참고자료


