# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-07

이번 2026-05-07호는 중복 News Source를 최신 indexed issue 기준으로 정리하고, 남은 2개 기사(libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트, libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선)를 source-backed 내용으로 보강했습니다.


> 편집자 검토 후 공개 가능한 검토 발행본입니다.
> 이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트: libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 기준으로 중복 issue에 흩어진 내용을 합쳐 libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 항목을 다시 정리했습니다.
- libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선: libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 기준으로 중복 issue에 흩어진 내용을 합쳐 libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 항목을 다시 정리했습니다.
- 중복 source cleanup 후 남은 공개 source 기준으로 읽을 만한 개발자 관점만 유지했습니다.

## 2. libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트


![libcamera 로고가 있는 GitLab 트위터 카드 이미지](https://gitlab.freedesktop.org/assets/twitter_card-570ddb06edf56a2312253c5872489847a0f385112ddbcd71ccfa1570febab5d2.jpg)

_이미지: [libcamera Release Announcements](https://gitlab.freedesktop.org/camera/libcamera/-/issues/300)_


libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 기준으로 중복 issue에 흩어진 내용을 합쳐 libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 항목을 다시 정리했습니다.

이 article은 camera_driver_image_pipeline 범위에서 공개 source가 확인한 사실과 이전 issue의 중복 설명을 합친 survivor article입니다.

삭제된 중복 issue의 donor 내용은 구조화 필드로만 반영했고, source가 말하지 않은 HAL 영향은 새로 만들지 않았습니다.

**Camera HAL / Driver 관점**

Camera HAL / Driver owner는 source가 직접 말한 범위 안에서 stream, buffer, metadata, pipeline 검증 필요성을 확인합니다.

### 확인할 점

- libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트의 release/version 범위를 기준으로 downstream camera stack 검토 범위를 정리합니다.
- Camera HAL / Driver owner가 downstream test나 log 확인이 필요한지 판단합니다.

**출처**

- [libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트](https://gitlab.freedesktop.org/camera/libcamera/-/issues/300)

---

## 3. libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선


![libcamera 로고가 있는 GitLab 트위터 카드 이미지](https://gitlab.freedesktop.org/assets/twitter_card-570ddb06edf56a2312253c5872489847a0f385112ddbcd71ccfa1570febab5d2.jpg)

_이미지: [libcamera Release Announcements](https://gitlab.freedesktop.org/camera/libcamera/-/issues/311)_


libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 기준으로 중복 issue에 흩어진 내용을 합쳐 libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 항목을 다시 정리했습니다.

이 article은 camera_driver_image_pipeline 범위에서 공개 source가 확인한 사실과 이전 issue의 중복 설명을 합친 survivor article입니다.

삭제된 중복 issue의 donor 내용은 구조화 필드로만 반영했고, source가 말하지 않은 HAL 영향은 새로 만들지 않았습니다.

**Camera HAL / Driver 관점**

Camera HAL / Driver owner는 source가 직접 말한 범위 안에서 stream, buffer, metadata, pipeline 검증 필요성을 확인합니다.

### 확인할 점

- libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선의 release/version 범위를 기준으로 downstream camera stack 검토 범위를 정리합니다.
- Camera HAL / Driver owner가 downstream test나 log 확인이 필요한지 판단합니다.

**출처**

- [libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선](https://gitlab.freedesktop.org/camera/libcamera/-/issues/311)


## 참고자료

- [libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트](https://gitlab.freedesktop.org/camera/libcamera/-/issues/300)
- [libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선](https://gitlab.freedesktop.org/camera/libcamera/-/issues/311)
