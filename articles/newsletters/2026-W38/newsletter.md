# 2026 W37 (09.07 ~ 09.13)

이번 주에는 ‘Rockchip RKISP1 ISP 드라이버, Bayer Demosaicing 바이패스 로직 오류 수정 패치 공개’, ‘OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 공개’ 등 4건의 소식을 다룹니다.



## 1. 이번 주 기사

- Rockchip RKISP1 ISP 드라이버, Bayer Demosaicing 바이패스 로직 오류 수정 패치 공개
- OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 공개
- libcamera, Sony IMX355 센서 테스트 패턴 모드 매핑 수정 패치 제안
- libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 제안

## 2. Rockchip RKISP1 ISP 드라이버, Bayer Demosaicing 바이패스 로직 오류 수정 패치 공개


![Rockchip RKISP1 ISP 드라이버, Bayer Demosaicing 바이패스 로직 오류 수정 패치 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media 메일링 리스트 패치 제안 (2026-09-11)_

Rockchip RKISP1 ISP 드라이버에서 Bayer demosaicing 바이패스 비트가 반대로 처리되던 심각한 로직 오류를 해결하는 패치가 제안되었습니다.

2026년 9월 11일, lore.kernel.org linux-media 메일링 리스트를 통해 Rockchip RKISP1 ISP의 Bayer demosaicing 바이패스 제어 로직을 수정하는 패치가 제안되었습니다. 기존 드라이버 구현에서는 demosaicing 블록을 우회(bypass)해야 할 때 오히려 바이패스 비트(RKISP1_CIF_ISP_DEMOSAIC_BYPASS)를 해제하고, demosaicing을 활성화해야 할 때 비트를 설정하는 등 제어 로직이 완전히 반대로 동작하고 있었습니다.

이번 패치는 demosaicing 블록을 비활성화할 때 바이패스 비트를 정상적으로 설정하고, demosaicing을 수행할 때는 비트를 해제하도록 수정하여 하드웨어 레지스터 제어의 정밀도를 확보했습니다. 이는 이미지 파이프라인의 색상 처리 및 이미지 품질 신뢰성을 높이는 데 기여합니다.

해당 패치는 현재 제안 단계(v1)로 검토 중이며, 실제 메인라인 커널 머지 여부는 지속적인 모니터링이 필요합니다. Rockchip ISP 기반의 하드웨어를 사용하는 개발 팀은 이 패치를 통해 이미지 파이프라인의 동작 무결성을 선제적으로 검증할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 Android Camera HAL 변경은 없으나, 하위 ISP 드라이버의 demosaicing 바이패스 로직이 수정됨에 따라 RAW 스트림 출력 및 ISP 튜닝 파라미터 적용 시 색상 왜곡이나 노이즈 제어 동작이 달라질 수 있습니다. HAL 계층에서 RAW 및 YUV 스트림의 품질 검증을 수행해야 합니다.

**출처**

- [[PATCH] media: rkisp1: Fix Bayer demosaicing bypass](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/T/#t)

---

## 3. OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 공개


![OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media 메일링 리스트 패치 제안 (2026-09-08)_

OmniVision os02g10 이미지 센서를 공식 지원하기 위한 신규 V4L2 드라이버 패치 시리즈가 제안되어 하드웨어 생태계가 확장되었습니다.

2026년 9월 8일, lore.kernel.org linux-media 메일링 리스트를 통해 OmniVision os02g10 카메라 센서용 신규 i2c 드라이버를 추가하는 패치 시리즈(v5)가 공개되었습니다. 이번 패치는 새로운 하드웨어 센서를 리눅스 미디어 서브시스템에 통합하기 위한 기여의 일환입니다.

제안된 드라이버는 수동 노출 및 게인 제어, vblank/hblank 제어, vflip/hflip 제어, 그리고 테스트 패턴 제어 등 카메라 실무에 필수적인 다양한 제어 기능을 포함하고 있습니다. 또한, 1920x1080 해상도에서 초당 30프레임을 출력하는 SBGGR10(10비트 Bayer) 모드를 공식 지원합니다.

해당 드라이버는 IMX8MP Debix Model A 개발 보드에서 mainline v7.0-rc2 커널 및 v4l2-compliance 1.31.0-5387 도구를 사용하여 정상 동작 및 규격 준수 여부가 검증되었습니다. 신규 센서를 탑재할 예정인 하드웨어 및 드라이버 개발 팀은 이 패치를 기반으로 조기 검증을 진행할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

새로운 센서 드라이버의 추가로 Android Camera HAL에서 수동 노출 및 게인 제어(SENSOR_EXPOSURE_TIME, SENSOR_SENSITIVITY), 플립 제어 등을 구현할 수 있는 하위 경로가 확보되었습니다. 1080p30 SBGGR10 스트림 구성을 HAL의 스트림 맵에 매핑하고 V4L2 컨트롤과의 연동을 검증해야 합니다.

**출처**

- [[RESEND PATCH v5 0/2] media: i2c: Add os02g10 camera sensor driver](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/T/#t)

---

## 4. libcamera, Sony IMX355 센서 테스트 패턴 모드 매핑 수정 패치 제안


![libcamera, Sony IMX355 센서 테스트 패턴 모드 매핑 수정 패치 제안 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 패치 제안 (2026-09-08)_

libcamera 프로젝트에서 Sony IMX355 센서의 테스트 패턴 모드 매핑 오류를 바로잡아 하위 카메라 스택의 검증 신뢰성을 높이는 패치가 제안되었습니다.

2026년 9월 8일, libcamera Patchwork를 통해 Sony IMX355 카메라 센서 드라이버의 테스트 패턴 모드 매핑 문제를 해결하기 위한 패치가 제안되었습니다. 이 패치는 개발자 Sam Gnu가 제출한 2개짜리 패치 시리즈 중 첫 번째 조각([1/2])에 해당합니다.

기존 드라이버 구현에서는 IMX355 센서의 하드웨어 테스트 패턴 모드와 소프트웨어 매핑 간의 불일치로 인해, 특정 테스트 패턴을 요청했을 때 의도하지 않은 이미지가 출력되거나 오동작할 위험이 있었습니다. 이번 패치는 이러한 매핑 테이블을 올바르게 수정하여 테스트 모드의 정확성을 확보하고자 합니다.

현재 이 패치는 'new' 상태로 프로젝트 패치 트래커에서 검토 중이며, 아직 메인라인에 머지되지 않은 제안 단계입니다. IMX355 센서를 탑재하고 libcamera 기반 하드웨어 추상화 계층을 사용하는 개발 팀은 이 패치를 적용하여 테스트 패턴 출력 신뢰성을 선제적으로 검증할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL 변경은 없으나, 하위 libcamera 계층에서 IMX355 센서의 테스트 패턴 매핑이 수정됨에 따라 Camera HAL에서 SENSOR_TEST_PATTERN_MODE를 설정할 때 정확한 하드웨어 테스트 패턴이 출력되도록 보장할 수 있습니다. 이는 CTS 테스트 패턴 검증 및 센서-HAL 간 데이터 경로 디버깅에 유용합니다.

**출처**

- [[1/2] libcamera: camera_sensor: Fix IMX355 test pattern mode mapping](https://patchwork.libcamera.org/patch/28200/)

---

## 5. libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 제안


![libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 제안 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 패치 제안 (2026-09-10)_

libcamera 프로젝트에서 이미지 처리 제어 기능을 한층 더 세밀하게 확장하기 위해, 컨트롤 메타데이터에 LensShadingCorrection 맵과 ToneCurve를 추가하는 패치가 제안되었습니다.

2026년 9월 10일, libcamera Patchwork를 통해 카메라 컨트롤 메타데이터에 LensShadingCorrection(렌즈 음영 보정) 맵과 ToneCurve(톤 곡선) 제어 기능을 추가하는 패치가 공개되었습니다. 이 패치는 프로젝트 메인테이너 중 한 명인 Kieran Bingham이 제출하여 현재 검토가 진행 중입니다.

이번 변경 사항은 하위 이미지 처리 파이프라인 제어 기능을 대폭 확장하는 것을 목표로 합니다. 메타데이터를 통해 렌즈 주변부의 광량 저하를 보정하는 쉐이딩 맵과 이미지의 대비 및 밝기 톤을 조절하는 톤 곡선 파라미터를 직접 제어할 수 있게 됨으로써, 이미지 품질 튜닝의 정밀도가 크게 향상될 것으로 기대됩니다.

현재 이 패치는 'new' 상태로 프로젝트 패치 트래커에서 검토 중인 제안 단계의 변경 사항입니다. libcamera 기반의 카메라 소프트웨어 스택을 구축하고 있는 개발 팀은 이 패치를 통해 향후 HAL 계층과의 고급 이미지 제어 메타데이터 연동을 미리 준비할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

하위 libcamera 스택에서 LensShadingCorrection 및 ToneCurve 메타데이터 제어가 가능해짐에 따라, Android Camera HAL의 LENS_SHADING_MAP 및 TONE_MAP_CURVE 제어 요청을 하위 드라이버 및 ISP 파이프라인에 직접적이고 정밀하게 매핑할 수 있는 경로가 마련되었습니다. HAL 계층의 메타데이터 매핑 모듈을 업데이트할 준비가 필요합니다.

**출처**

- [libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata](https://patchwork.libcamera.org/patch/28219/)


## 참고 / 더 읽을거리

- [Introducing Fast and Reliable Wireless Debugging with Android Debug Bridge (ADB) Wi-Fi 2.0](<https://android-developers.googleblog.com/2026/09/wireless-debugging-adb-wifi-2.html>) — Android Developers Blog (2026-09-09) · C++ / AI 네이티브 툴링 참고
- [\[PATCH\] media: ipu-bridge: Add DMI quirk for Dell 14 Premium DA14250](<https://lore.kernel.org/linux-media/20260912103431.15388-1-kthhrv@gmail.com/>) — lore.kernel.org linux-media list (Intel IPU) (2026-09-12) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH 0/8\] media: qcom: camss: add V4L2 subdev streams API support](<https://lore.kernel.org/linux-media/20260911062213.195007-1-gjorgji.rosikopulos@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-11) · 카메라 드라이버 / 이미지 파이프라인 참고
- [Acer Swift SFG14-01 Camera Support not working on Linux](<https://lore.kernel.org/linux-media/CAFJ6yro2PRQAsNwDMRmU8sve6nrXXWVruStgyYVRMcYeksdufQ@mail.gmail.com/>) — lore.kernel.org linux-media list (2026-09-09) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [[PATCH] media: rkisp1: Fix Bayer demosaicing bypass](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/T/#t)
- [[RESEND PATCH v5 0/2] media: i2c: Add os02g10 camera sensor driver](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/T/#t)
- [[1/2] libcamera: camera_sensor: Fix IMX355 test pattern mode mapping](https://patchwork.libcamera.org/patch/28200/)
- [libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata](https://patchwork.libcamera.org/patch/28219/)
