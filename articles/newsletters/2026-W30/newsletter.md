# 2026 W30 (07.20 ~ 07.26)

이번 주에는 ‘libcamera, IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안’ 소식을 다룹니다.



## 1. 이번 주 기사

- libcamera, IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안

## 2. libcamera, IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안


![libcamera, IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안 image](../../assets/images/fallback/newsletter-default.svg)

_이미지: [libcamera: camera_sensor: Add IMX335 test pattern sensor properties](https://patchwork.libcamera.org/patch/27362/)_


_libcamera 패치워크를 통한 IMX335 센서 속성 검토_

최근 libcamera 패치워크에 소니 IMX335 이미지 센서의 테스트 패턴 속성을 추가하는 패치가 제안되어 검토가 진행 중입니다. 이번 패치는 드라이버 수준에서 표준화된 테스트 패턴을 정의하여 이미지 파이프라인의 검증과 디버깅 편의성을 높이는 것을 목표로 합니다.

2026년 7월 14일, libcamera 프로젝트의 패치워크를 통해 소니(Sony) IMX335 이미지 센서의 테스트 패턴 속성(test pattern sensor properties)을 추가하기 위한 신규 패치가 공개되었습니다. 이 패치는 현재 커뮤니티에서 검토 중인 단계로, 센서 드라이버가 제공하는 테스트 패턴 메타데이터를 libcamera 프레임워크 내에서 올바르게 인식하고 활용할 수 있도록 지원하는 것을 골자로 합니다.

libcamera는 리눅스 카메라 스택의 핵심 추상화 계층으로, V4L2 API 상단에서 센서와 ISP 간의 복잡한 상호작용을 제어합니다. 이번에 제안된 IMX335 테스트 패턴 속성 추가는 하드웨어 검증 및 이미지 파이프라인 디버깅 시 매우 유용하게 활용될 수 있습니다. 표준화된 테스트 패턴을 활성화하면 센서 자체의 데이터 출력 상태와 이후 ISP 처리 단계를 분리하여 검증할 수 있기 때문입니다.

다만, 본 패치는 현재 제안 및 검토 단계(RFC/Patch review)에 머물러 있어 최종 메인라인 병합 여부와 구체적인 적용 시점은 유동적입니다. 또한, 이 변경사항이 Android Camera HAL API나 프레임워크의 동작을 직접적으로 수정하는 것은 아니므로, 상위 레이어 개발자는 하위 드라이버 및 미디어 스택의 호환성 준비 관점에서 이 흐름을 관찰할 필요가 있습니다.

### Camera HAL/Driver 관점에서의 의미

본 패치는 Android Camera HAL을 직접 변경하지는 않으나, 하위 드라이버 및 libcamera 스택에서 IMX335 센서 검증 시 테스트 패턴 속성을 활용할 수 있는 기반을 제공합니다. 개발자는 향후 해당 센서 통합 시 드라이버 단의 테스트 패턴 메타데이터가 V4L2 및 libcamera를 거쳐 상위 HAL 계층까지 올바르게 전달되는지 검증 경로를 점검해야 합니다.

**출처**

- [libcamera: camera_sensor: Add IMX335 test pattern sensor properties](https://patchwork.libcamera.org/patch/27362/)


## 참고자료

- [libcamera: camera_sensor: Add IMX335 test pattern sensor properties](https://patchwork.libcamera.org/patch/27362/)
