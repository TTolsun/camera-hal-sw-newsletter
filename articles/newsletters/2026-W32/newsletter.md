# 2026 W31 (07.27 ~ 08.02)

이번 주에는 ‘Himax HM1092 흑백 근적외선 센서용 V4L2 드라이버 패치 v6 공개’, ‘onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출’ 등 4건의 소식을 다룹니다.



## 1. 이번 주 기사

- Himax HM1092 흑백 근적외선 센서용 V4L2 드라이버 패치 v6 공개
- onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출
- OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출
- Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개

## 2. Himax HM1092 흑백 근적외선 센서용 V4L2 드라이버 패치 v6 공개


![Himax HM1092 흑백 근적외선 센서용 V4L2 드라이버 패치 v6 공개 image](../../assets/images/fallback/newsletter-default.svg)

_이미지: [[PATCH v6 0/2] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/)_


_Himax HM1092 mono NIR sensor driver v6 patch_

Linux 커널 미디어 서브시스템에 Himax HM1092 흑백 근적외선(NIR) 이미지 센서를 지원하기 위한 V4L2 subdev 드라이버 패치 v6가 제출되었습니다.

이번에 제안된 패치 v6는 노트북의 얼굴 잠금 해제용 IR 카메라 등에 주로 탑재되는 Himax HM1092 100만 화소 흑백 근적외선 센서를 위한 V4L2 subdev 드라이버 및 Device Tree 바인딩을 추가하는 것을 골자로 합니다.

이 센서는 단일 MIPI CSI-2 데이터 레인을 통해 통신하며, 560x360 해상도에서 10비트 RAW 포맷 출력을 지원합니다. 드라이버는 해당 고정 모드와 함께 테스트 패턴 제어, 노출 제어, 아날로그 및 디지털 게인 컨트롤을 V4L2 서브디바이스 인터페이스를 통해 노출합니다.

이 패치는 현재 커널 메인라인 검토 단계에 있으며, 실제 Android 기기나 임베디드 플랫폼에 적용되기 위해서는 SoC 벤더 및 OEM의 커널 통합 과정이 필요합니다. 드라이버 수준의 변경이므로 Android Camera HAL API나 프레임워크에 직접적인 변경을 유발하지는 않습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL API 변경은 없으나, IR 카메라를 활용한 얼굴 인식(Face Unlock) 시나리오에서 하위 V4L2 subdev 노출 및 게인 컨트롤이 Android Camera HAL의 생체 인식 메타데이터 요구사항과 올바르게 매핑되는지 확인해야 합니다.

**출처**

- [[PATCH v6 0/2] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/T/#t)

---

## 3. onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출


![onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 image](../../assets/images/fallback/newsletter-default.svg)

_이미지: [[PATCH 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/)_


_onsemi AR0234 CMOS image sensor driver patch_

Linux 커널 미디어 서브시스템에 고속 캡처를 지원하는 onsemi AR0234 글로벌 셔터 CMOS 이미지 센서용 신규 V4L2 드라이버 패치가 제출되었습니다.

2026년 7월 31일 제출된 이번 패치는 1/2.6인치 글로벌 셔터 센서인 onsemi AR0234를 위한 드라이버를 추가합니다. 이 센서는 1940x1220 픽셀 배열을 갖추고 있으며, 최대 120fps의 고속 프레임률로 1920x1200 해상도 출력을 지원하여 움직이는 피사체의 롤링 셔터 왜곡을 방지합니다.

물리 인터페이스로는 1개에서 4개 데이터 레인의 MIPI CSI-2 출력을 지원하며, raw Bayer(8/10비트) 및 흑백 형식, 그리고 DPCM 10->8 압축 모드를 지원하는 것이 특징입니다. 드라이버는 Purwa EVK 보드에서 테스트 및 검증되었습니다.

글로벌 셔터 센서는 고속 움직임 캡처, 머신 비전, AR/VR 헤드셋의 슬램(SLAM) 카메라 등 특수 목적 기기에서 중요한 역할을 합니다. 이 드라이버의 추가로 Android 임베디드 플랫폼에서 고성능 글로벌 셔터 카메라 솔루션을 구현할 수 있는 하위 기반이 마련되었습니다.

### Camera HAL/Driver 관점에서의 의미

글로벌 셔터 센서 도입 시, 고속 프레임률(120fps) 스트림 구성에서 YUV/RAW 프레임 드롭 여부와 MIPI CSI-2 레인 구성에 따른 대역폭 병목을 드라이버 및 HAL 레이어에서 검증해야 합니다.

**출처**

- [[PATCH 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/T/#t)

---

## 4. OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출


![OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 image](../../assets/images/fallback/newsletter-default.svg)

_이미지: [[PATCH v5 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/)_


_OmniVision OG0VA1B CMOS VGA image sensor driver patch_

Linux 커널 미디어 서브시스템에 저전력 보조 카메라 및 감지용으로 적합한 OmniVision OG0VA1B 흑백 VGA 이미지 센서용 V4L2 드라이버 패치 v5가 제출되었습니다.

2026년 7월 31일 제출된 패치 v5는 1/10인치 초소형 흑백 CMOS VGA 이미지 센서인 OmniVision OG0VA1B를 위한 드라이버 지원을 추가합니다. 이 센서는 단일 레인 MIPI CSI-2 인터페이스를 통해 최대 640x480 해상도로 10비트 RAW (Y10) 프레임을 출력합니다.

제어 인터페이스로는 I2C 호환 SCCB 버스를 사용하며, 이번 드라이버 패치는 Purwa EVK 보드에서 테스트 패턴 제너레이터(TPG) 동작을 포함하여 기능 검증이 완료되었습니다.

OG0VA1B와 같은 저해상도 흑백 센서는 주로 저전력 임베디드 기기, 보안 카메라, 제스처 인식 또는 깊이 감지용 보조 센서로 활용됩니다. 이번 드라이버 추가를 통해 임베디드 Android 시스템 개발 시 하드웨어 선택지가 넓어질 것으로 기대됩니다.

### Camera HAL/Driver 관점에서의 의미

VGA급 저해상도 Y10 RAW 포맷 스트림을 수신할 때, ISP 파이프라인 및 Camera HAL에서 10비트 흑백 포맷(Y10)을 올바르게 처리하고 프레임 버퍼를 할당하는지 확인해야 합니다.

**출처**

- [[PATCH v5 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/T/#t)

---

## 5. Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개


![Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 image](../../assets/images/fallback/newsletter-default.svg)

_이미지: [[PATCH RESEND v9 0/9] media: camss: Add support for C-PHY configuration on Qualcomm platforms](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/)_


_Qualcomm CAMSS MIPI C-PHY support patch v9_

Qualcomm 플랫폼의 오픈소스 카메라 서브시스템(CAMSS) 드라이버에 고대역폭 MIPI C-PHY 물리 계층 구성을 지원하기 위한 패치 시리즈 v9가 제안되었습니다.

2026년 7월 29일 제출된 이번 패치 시리즈 v9는 Qualcomm CAMSS의 CSID(CSI Decoder) 및 CSIPHY(CSI PHY) 구성 요소를 확장하여 MIPI C-PHY 모드 구성을 지원하도록 합니다. MIPI C-PHY는 기존 D-PHY에 비해 더 높은 데이터 처리량과 뛰어난 신호 효율성을 제공하여, 최신 고해상도 및 고프레임률 스마트폰 카메라 센서 통합에 필수적인 기술입니다.

다만, 이번 패치에는 이전 검토 라운드에서 제기된 모든 피드백이 완벽히 반영되지 않아 'WIP' (Work In Progress) 태그가 추가된 상태로 제출되었습니다. 따라서 메인라인 병합 전 추가적인 수정과 검토가 진행될 예정입니다.

물리 계층 및 드라이버 수준의 변경은 Android Camera HAL API에 직접적인 수정을 요구하지는 않습니다. 그러나 하위 드라이버가 C-PHY 모드를 안정적으로 지원하게 되면, HAL 레이어에서는 더 높은 대역폭의 스트림 구성(예: 고해상도 RAW 캡처 또는 고속 프레임률 비디오)을 안정적으로 처리할 수 있는 성능적 이점을 얻을 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

물리 계층이 C-PHY로 전환됨에 따라, 고대역폭 스트림 구성 시 신호 정합성으로 인한 프레임 드롭이나 전송 지연이 발생하지 않는지 드라이버 및 ISP 연동 테스트를 통해 밀착 검증해야 합니다.

**출처**

- [[PATCH RESEND v9 0/9] media: camss: Add support for C-PHY configuration on Qualcomm platforms](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/T/#t)


## 참고 / 더 읽을거리

- [CameraX Release Notes - CameraX 1.7.0-alpha02](<https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02>) — CameraX Release Notes (July 01, 2026) · AOSP Camera 프레임워크 관련 참고
- [v0.7.2](<https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2>) — libcamera Upstream Releases (2026-07-10T11:12:38+01:00) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [[PATCH v6 0/2] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/T/#t)
- [[PATCH 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/T/#t)
- [[PATCH v5 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/T/#t)
- [[PATCH RESEND v9 0/9] media: camss: Add support for C-PHY configuration on Qualcomm platforms](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/T/#t)
