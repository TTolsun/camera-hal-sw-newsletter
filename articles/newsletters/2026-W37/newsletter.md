# 2026 W36 (08.31 ~ 09.06)

이번 주에는 ‘OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개’, ‘Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개’ 등 5건의 소식을 다룹니다.



## 1. 이번 주 기사

- OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개
- Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개
- Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개
- libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인
- libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개

## 2. OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개


![OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list 패치 분석_

Linux 미디어 하위 시스템에 OmniVision의 1/10인치 저전력 흑백 VGA 센서인 OG0VA1B 드라이버를 추가하기 위한 v6 패치 시리즈가 공개되었습니다. 단일 레인 MIPI CSI-2 인터페이스와 Y10 RAW 포맷 출력을 지원하여, 임베디드 및 모바일 흑백 카메라 파이프라인 구축의 기반이 마련될 것으로 보입니다.

2026년 9월 1일, Qualcomm의 Wenmeng Liu는 Linux 미디어 메일링 리스트를 통해 OmniVision OG0VA1B 이미지 센서 드라이버를 추가하는 v6 패치 세트를 제출했습니다. OG0VA1B는 1/10인치 크기의 초소형 흑백 CMOS VGA 센서로, 주로 저전력 센싱이나 보조 카메라 시스템에 적합하도록 설계되었습니다.

이번 드라이버 패치에 따르면, 해당 센서는 단일 레인 MIPI CSI-2 인터페이스를 통해 최대 640x480 해상도의 10비트 RAW (Y10) 프레임을 출력할 수 있습니다. 센서 제어는 표준 I2C 호환 SCCB 버스를 통해 이루어지며, 드라이버 구현은 Purwa EVK 보드에서 테스트 패턴 제너레이터(TPG) 동작을 포함하여 정상 검증되었습니다.

이 패치는 현재 커널 메인라인 병합을 위한 검토 단계에 있으며, 흑백 센서 특유의 Y10 픽셀 포맷 처리와 단일 레인 MIPI CSI-2 타이밍 설정 등을 포함하고 있어 하위 드라이버 개발자들에게 중요한 참고 자료가 될 것입니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 Android Camera HAL 변경은 없으나, 하위 V4L2 드라이버 레벨에서 10비트 흑백 RAW (Y10) 포맷이 추가되므로 HAL3 구현 시 RAW 스트림 구성 및 ISP 픽셀 포맷 매핑 테이블에 Y10 형식이 올바르게 정의되어 있는지 점검해야 합니다.

**출처**

- [[PATCH v6 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/T/#t)

---

## 3. Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개


![Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list 패치 분석_

Qualcomm x1e/Hamoa 플랫폼의 카메라 하드웨어 구성을 정의하는 Device Tree Source (DTS) 지원 v6 패치가 공개되었습니다. 이번 업데이트는 CAMSS 노드의 데이터 레인 정렬을 PHY 계층과 일치시키고 전원 공급 스키마를 정합화하는 등 하드웨어 초기화 안정성을 높이는 데 초점을 맞추었습니다.

2026년 9월 6일, Linaro 메일링 리스트를 통해 Qualcomm x1e/Hamoa 플랫폼의 카메라 서브시스템(CAMSS) DTS 구성을 개선하는 v6 패치 시리즈가 제출되었습니다. DTS는 하드웨어 리소스를 커널에 설명하는 핵심 명세로, 카메라 센서와 SoC 간의 물리적 연결을 정의합니다.

v6 패치의 핵심 변경 사항은 CAMSS 노드 내 데이터 레인 시작 인덱스를 기존 0에서 1로 조정하여 물리 계층(PHY)과 정렬을 맞춘 것입니다. 또한, 전원 공급 노드 정의를 기존 vdda-0p8-supply에서 vdda-0p9-supply로 변경하여 최신 하드웨어 스키마 요구사항과의 호환성을 확보했습니다.

이러한 변경은 하위 레벨에서 카메라 하드웨어 초기화 실패나 이미지 손상을 방지하는 데 필수적이며, x1e 플랫폼 기반의 카메라 드라이버 및 SoC 통합 엔지니어들에게 중요한 하드웨어 설정 가이드를 제공합니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL 변경은 없으나, 데이터 레인 정렬 및 전원 공급 변경은 카메라 서브시스템의 물리적 연결 안정성에 직결됩니다. 드라이버 레벨에서 MIPI CSI-2 수신기 초기화 에러나 전원 인가 실패가 발생하지 않도록 하위 스택 검증을 선행해야 합니다.

**출처**

- [[PATCH v6 00/13] arm64: dts: qcom: Add x1e/Hamoa camera DTSI](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/T/#t)

---

## 4. Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개


![Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list 패치 분석_

Lenovo Yoga Book YB1-X91의 전면 및 후면 카메라 시스템을 완벽히 지원하기 위한 v7 패치 시리즈가 공개되었습니다. 이번 패치는 OV8858 및 OV2740 이미지 센서 드라이버뿐만 아니라, AtomISP, IPU 브리지, 그리고 WV517S 렌즈 액추에이터까지 아우르는 종합적인 하드웨어 제어 로직을 담고 있습니다.

2026년 9월 2일, Maurizio Casciano는 Lenovo Yoga Book YB1-X91 태블릿의 카메라 하드웨어 스택을 활성화하기 위한 v7 패치 시리즈를 제출했습니다. 이 패치는 인텔 Cherry Trail 플랫폼 기반의 AtomISP와 연동되는 전·후면 카메라 모듈의 드라이버 지원을 구체화했습니다.

패치 세부 내용에 따르면, 후면 OV8858 센서는 19.2 MHz 클럭 설정 및 Cherry Trail 전용 게인 프로그래밍이 적용되었으며, 전면 OV2740 센서는 288 MHz 링크 주파수 설정과 수동 화이트 밸런스 제어 기능이 구현되었습니다. 또한, WV517S 렌즈 액추에이터 드라이버가 추가되어 자동 초점(AF) 기능을 위한 하드웨어 제어가 가능해졌습니다.

이와 함께 AtomISP의 RAW 프레임 캡처 로직 최적화 및 CSI-2 타이밍 조정, IPU 브리지 데이터 및 펌웨어 ID 매핑 등이 포함되어 있어, 하위 레벨 이미지 파이프라인의 안정성을 크게 향상시킬 것으로 기대됩니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL 변경은 없으나, OV2740의 수동 화이트 밸런스 및 OV8858의 게인 제어 기능이 V4L2 컨트롤로 노출되므로, Camera HAL3의 3A 메타데이터 제어 요청이 커널 드라이버의 V4L2 컨트롤러에 정확히 매핑되고 정상 동작하는지 검증해야 합니다.

**출처**

- [[PATCH v7 00/16] media: Add Yoga Book camera support](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/T/#t)

---

## 5. libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인


![libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 분석_

libcamera 내부의 컨트롤 스토리지 유니온 구조체에 명확한 이름을 부여하는 v3 패치가 제출되어 accepted 상태로 전환되었습니다. 이번 리팩토링은 소스코드의 가독성과 장기적인 유지보수성을 향상시키기 위한 내부 개선 작업입니다.

2026년 9월 3일, Barnabás Pőcze가 제출한 libcamera 컨트롤 스토리지 유니온 명명 v3 패치가 프로젝트 패치 트래커에서 accepted 상태로 확인되었습니다. 이 패치는 기존에 익명 유니온으로 선언되어 있던 컨트롤 스토리지 구조에 명확한 이름을 부여하는 것을 골자로 합니다.

익명 유니온을 명명된 유니온으로 변경하는 것은 C++ 코드베이스의 명확성을 높이고, 컴파일러가 구조체 레이아웃을 더 엄격하게 검증할 수 있도록 돕습니다. 이는 런타임 성능 변화를 유도하는 것은 아니지만, 대규모 카메라 프레임워크 소스코드의 품질을 유지하는 데 기여합니다.

libcamera를 직접 빌드하여 사용하거나 커스텀 컨트롤을 추가해 드라이버 스택을 개발하는 엔지니어들은 향후 소스 업데이트 시 발생할 수 있는 사소한 컴파일 호환성 이슈를 예방하기 위해 이 변경 사항을 참고할 필요가 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL 런타임 영향은 없으나, libcamera 소스를 커스텀하여 Android HAL 하위 계층에 연동하는 프로젝트의 경우, 유니온 명명 변경으로 인해 기존 커스텀 제어 코드에서 컴파일 에러가 발생하지 않는지 빌드 호환성을 점검해야 합니다.

**출처**

- [[v3,1/5] libcamera: controls: Give name to the union containing storage](https://patchwork.libcamera.org/patch/28179/)

---

## 6. libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개


![libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 분석_

libcamera의 소프트웨어 이미지 신호 처리(software_isp) 컴포넌트에서 초기화 오버헤드를 줄이기 위한 최적화 패치가 공개되었습니다. 워커 스레드가 시작되기 전에 불필요하게 호출되던 stop 동작을 생략함으로써, 스트림 시작 지연 시간을 단축하는 효과가 기대됩니다.

2026년 9월 6일, Birk Skyum은 libcamera 패치 트래커를 통해 software_isp의 초기화 시퀀스를 최적화하는 신규 패치를 제출했습니다. software_isp는 하드웨어 ISP가 없는 시스템에서 CPU 리소스를 활용해 이미지 처리를 수행하는 핵심 모듈입니다.

이번 패치는 워커(worker) 스레드가 본격적으로 구동되기 전에 불필요하게 수행되던 stop 호출을 건너뛰도록 구현되었습니다. 기존 구조에서는 초기화 과정에서 상태 기계의 불필요한 중복 리셋 작업이 발생했으나, 이를 생략함으로써 초기화 로직이 한층 간결해졌습니다.

이 최적화는 소프트웨어 ISP의 구동 속도를 높여 카메라 세션 오픈 시 첫 프레임이 화면에 표시되기까지의 지연 시간(Time to First Frame)을 개선하는 데 기여할 수 있으며, 특히 가상 카메라 환경이나 저사양 임베디드 기기에서 유용하게 활용될 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

직접적인 HAL 변경은 없으나, software_isp 초기화 시퀀스 단축은 카메라 스트림 시작 지연 시간 개선으로 이어집니다. 소프트웨어 ISP를 경유하는 가상 카메라나 에뮬레이터 환경에서 첫 프레임 출력 속도 향상 여부를 벤치마크해야 합니다.

**출처**

- [libcamera: software_isp: Skip stop before worker start](https://patchwork.libcamera.org/patch/28194/)


## 참고 / 더 읽을거리

- [Leverage Android skills and Gemma 4 in Android Studio Quail 4](<https://android-developers.googleblog.com/2026/09/leverage-gemma-4-android-studio-quail.html>) — Android Developers Blog (2026-09-01) · C++ / AI 네이티브 툴링 참고
- [Emulator control for adaptive app development](<https://android-developers.googleblog.com/2026/08/emulator-adaptive.html>) — Android Developers Blog (2026-08-31) · C++ / AI 네이티브 툴링 참고
- [\[PATCH RESEND v3 0/2\] media: i2c: Add Samsung S5KJN5 image sensor](<https://lore.kernel.org/linux-media/20260901-sk5jn5-v3-0-17e728917bd4@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-01) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[v1\] libcamera: pipeline: simple: Rework software-isp/converter selection](<https://patchwork.libcamera.org/patch/28156/>) — libcamera Patchwork (patch review) (2026-08-31) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [[PATCH v6 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/T/#t)
- [[PATCH v6 00/13] arm64: dts: qcom: Add x1e/Hamoa camera DTSI](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/T/#t)
- [[PATCH v7 00/16] media: Add Yoga Book camera support](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/T/#t)
- [[v3,1/5] libcamera: controls: Give name to the union containing storage](https://patchwork.libcamera.org/patch/28179/)
- [libcamera: software_isp: Skip stop before worker start](https://patchwork.libcamera.org/patch/28194/)
