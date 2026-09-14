# AOSP Camera & Driver Platform 기술 뉴스레터 (2026-09-14)

이번 주에는 Linux 미디어 서브시스템 및 libcamera 프로젝트에서 카메라 드라이버와 ISP 이미지 파이프라인의 핵심적인 수정 및 기능 확장 제안이 대거 공개되었습니다. Rockchip RKISP1 ISP의 Bayer demosaicing 바이패스 로직 오류 수정, 새로운 os02g10 이미지 센서 드라이버 추가, 그리고 libcamera에서의 IMX355 테스트 패턴 매핑 수정 및 LensShadingCorrection/ToneCurve 메타데이터 제어 기능 확장이 포함됩니다. 이러한 변화는 하위 카메라 스택의 안정성을 높이고 Android Camera HAL 계층에서의 이미지 품질 제어 및 검증 효율성을 크게 향상시킬 것입니다.



## 1. 이번 주 3줄 브리핑

- Rockchip RKISP1 ISP 드라이버에서 Bayer demosaicing 바이패스 비트 처리 로직의 반전 오류를 수정하는 패치가 제안되어, RAW 및 YUV 이미지 파이프라인의 색상 처리 신뢰성이 개선될 예정입니다.
- 새로운 os02g10 이미지 센서 드라이버가 제안되어 수동 노출/게인, vblank/hblank, vflip/hflip 제어 및 1080p @ 30fps SBGGR10 모드를 지원하며, 신규 하드웨어 통합을 위한 기반을 마련했습니다.
- libcamera 프로젝트에서 IMX355 센서의 테스트 패턴 모드 매핑 오류 수정과 함께 LensShadingCorrection 맵 및 ToneCurve를 컨트롤 메타데이터에 추가하는 패치가 제안되어, HAL 계층의 정밀 튜닝과 검증 워크플로우를 강화합니다.

## 2. Rockchip RKISP1 ISP 드라이버, Bayer Demosaicing 바이패스 로직 오류 수정 패치 공개


![Rockchip RKISP1 ISP 드라이버, Bayer Demosaicing 바이패스 로직 오류 수정 패치 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media 메일링 리스트 패치 제안 (2026-09-11)_

Rockchip RKISP1 ISP 드라이버에서 Bayer demosaicing 바이패스 비트가 반대로 처리되던 로직 오류를 해결하는 패치가 제안되었습니다.

2026년 9월 11일, lore.kernel.org linux-media 메일링 리스트를 통해 Rockchip RKISP1 ISP의 Bayer demosaicing 바이패스 제어 로직을 수정하는 패치가 제안되었습니다. 기존 드라이버 구현에서는 demosaicing 블록을 우회(bypass)해야 할 때 오히려 바이패스 비트(RKISP1_CIF_ISP_DEMOSAIC_BYPASS)를 해제하고, demosaicing을 활성화해야 할 때 비트를 설정하는 등 제어 로직이 완전히 반대로 동작하고 있었습니다.

이번 패치는 demosaicing 블록을 비활성화할 때 바이패스 비트를 설정하고, demosaicing을 수행할 때는 비트를 해제하도록 수정합니다. 작성자는 libcamera에 아직 demosaicing 바이패스를 제어하는 알고리즘이 없어 이 문제가 실제로 드러난 적은 없다고 밝혔습니다.

해당 패치는 현재 제안 단계(v1)로 검토 중이며, 실제 메인라인 커널 머지 여부는 지속적인 모니터링이 필요합니다. Rockchip ISP와 NXP i.MX8MP처럼 rkisp1 드라이버를 사용하는 플랫폼의 개발 팀은 이 패치를 통해 이미지 파이프라인의 동작 무결성을 선제적으로 검증할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 Android Camera HAL 변경은 없으나, 하위 ISP 드라이버의 demosaicing 바이패스 로직이 수정됨에 따라 RAW 스트림 출력 및 ISP 튜닝 파라미터 적용 시 색상 왜곡이나 노이즈 제어 동작이 달라질 수 있습니다. HAL 계층에서 RAW 및 YUV 스트림의 품질 검증을 수행해야 합니다.

**출처**

- [[PATCH] media: rkisp1: Fix Bayer demosaicing bypass](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/T/#t)

---

## 3. OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 공개


![OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media 메일링 리스트 패치 제안 (2026-09-08)_

OmniVision os02g10 이미지 센서를 공식 지원하기 위한 신규 V4L2 드라이버 패치 시리즈(v5)가 제안되었습니다.

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

2026년 9월 8일, libcamera Patchwork를 통해 Sony IMX355 카메라 센서 드라이버의 테스트 패턴 모드 매핑 문제를 해결하기 위한 패치가 제안되었습니다. 이 패치는 Samuel LEGROS가 제출한 2개짜리 패치 시리즈 중 첫 번째 조각([1/2])에 해당합니다.

기존 libcamera의 IMX355 센서 속성은 컬러 바(TestPatternModeColorBars)를 메뉴 인덱스 1, 단색(TestPatternModeSolidColor)을 인덱스 2에 매핑했지만, 커널 드라이버 imx355.c는 인덱스 1을 Solid Colour, 인덱스 2를 Eight Vertical Colour Bars로 정의합니다. 그래서 단색 테스트 패턴을 요청하면 컬러 바가 출력되고 그 반대도 마찬가지였습니다. 이번 패치는 두 항목을 맞바꿔 같은 메뉴를 쓰는 IMX258·IMX471과 순서를 맞춥니다. 작성자는 Google Pixel 3a 전면 카메라에서 이 동작을 확인했다고 밝혔습니다. 시리즈의 두 번째 패치([2/2])는 Sony IMX363 센서 속성과 helper를 추가합니다.

현재 이 패치는 'new' 상태로 프로젝트 패치 트래커에서 검토 중이며, 아직 메인라인에 머지되지 않은 제안 단계입니다. IMX355 센서를 탑재하고 libcamera 기반 하드웨어 추상화 계층을 사용하는 개발 팀은 이 패치를 적용하여 테스트 패턴 출력 신뢰성을 선제적으로 검증할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL 변경은 없으나, 하위 libcamera 계층에서 IMX355 센서의 테스트 패턴 매핑이 수정됨에 따라 Camera HAL에서 SENSOR_TEST_PATTERN_MODE를 설정할 때 정확한 하드웨어 테스트 패턴이 출력되도록 보장할 수 있습니다. 이는 CTS 테스트 패턴 검증 및 센서-HAL 간 데이터 경로 디버깅에 유용합니다.

**출처**

- [[1/2] libcamera: camera_sensor: Fix IMX355 test pattern mode mapping](https://patchwork.libcamera.org/patch/28200/)

---

## 5. libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 제안


![libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 제안 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 패치 제안 (2026-09-10)_

libcamera에서 렌즈 음영 보정 맵과 톤 곡선을 프레임 결과 메타데이터로 제공하여, DNG 파일의 색 재현을 JPEG에 맞추려는 패치가 제안되었습니다.

2026년 9월 10일, libcamera Patchwork에 렌즈 음영 보정 맵(LensShadingCorrectionMaps)과 톤 곡선(ToneCurve)을 프레임 결과 메타데이터로 제공하는 패치가 제출되었습니다. Michael Kunz가 작성했으며, 메일 서버 문제로 Kieran Bingham이 대신 제출했습니다.

패치는 Raspberry Pi 파이프라인의 프레임 메타데이터 보고 경로를 렌즈 음영 보정 맵과 톤 곡선도 내보내도록 확장합니다. DNG 저장 프로그램이 이 정보를 사용하여 JPEG와 색 재현을 맞추고 색조 차이를 줄이는 것이 목적입니다. 렌즈 음영 보정 맵의 출력 여부를 선택하는 컨트롤도 추가합니다.

이 패치는 제안 단계입니다. Raspberry Pi와 libcamera 기반으로 RAW/DNG를 저장하는 개발 팀은 패치 적용 후 결과 메타데이터에 보정 맵과 톤 곡선이 포함되는지, DNG 저장 프로그램이 이를 실제 파일에 반영하는지 확인할 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

Raspberry Pi 파이프라인의 프레임 결과와 DNG 저장 경로를 함께 확인하는 것이 핵심입니다. 같은 장면의 DNG와 JPEG를 비교하고, 렌즈 음영 보정 맵의 채널 구성과 크기, 톤 곡선 데이터가 파일에 올바르게 반영되는지 검증할 수 있습니다. Android Camera HAL 연동은 별도 구현과 검증이 필요한 영역이며, 이 패치에 HAL 요청을 ISP 제어로 연결하는 변경은 포함되어 있지 않습니다.

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
