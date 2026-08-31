# Camera HAL / SW Newsletter - 2026-08-31

이번 주 뉴스레터에서는 Linux 커널 미디어 서브시스템과 libcamera 프레임워크의 주요 카메라 드라이버 및 이미지 파이프라인 업데이트를 다룹니다. AtomISP 드라이버의 OV2740 센서 링크 및 D-PHY 타이밍 파생 지원, libcamera의 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치, 그리고 Sony IMX908 센서의 Device Tree 바인딩 추가 등 하위 스택의 변화가 Android Camera HAL 구현과 이미지 처리 품질 검증에 미치는 영향을 상세히 분석합니다.



## 1. 이번 주 3줄 브리핑

- AtomISP 드라이버 및 Lenovo Yoga Book YB1-X91 카메라 드라이버 패치 시리즈가 공개되어, OV2740 및 OV8858 센서의 RAW Bayer 캡처 및 D-PHY 타이밍 파생 제어가 가능해졌습니다.
- libcamera 프레임워크에 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 및 소프트웨어 ISP EGL 모듈의 텍스처 필터 파라미터 추가 패치가 제출되어 이미지 처리 파이프라인의 유연성이 향상되었습니다.
- Sony IMX908 이미지 센서의 Device Tree 바인딩 추가 패치가 공개되어, MIPI CSI-2 2/4레인을 통한 RAW10/RAW12 출력 지원을 위한 커널 레벨의 공식 기반이 마련되었습니다.

## 2. AtomISP 드라이버, Lenovo Yoga Book OV2740 센서 링크 및 D-PHY 타이밍 파생 지원 추가


![AtomISP 드라이버, Lenovo Yoga Book OV2740 센서 링크 및 D-PHY 타이밍 파생 지원 추가 image](../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list - PATCH v3_

Linux 커널 미디어 서브시스템에 AtomISP 브리지 드라이버와 OV2740 이미지 센서의 통합을 개선하는 PATCH v3 패치 시리즈가 제출되었습니다. 이번 변경은 하드웨어 펌웨어의 불완전한 카메라 링크 정보를 드라이버 레벨에서 보완하고, 센서 링크 주파수로부터 D-PHY 타이밍을 동적으로 파생할 수 있도록 지원합니다.

이번에 공개된 PATCH v3 패치 시리즈는 Lenovo Yoga Book YB1-X91L 디바이스의 전면 OV2740 카메라 센서 통합을 목표로 합니다. 기존 펌웨어는 완전한 카메라 링크 정보를 제공하지 않아 드라이버가 이미지 파이프라인을 구성하는 데 어려움이 있었습니다. 이를 해결하기 위해 드라이버 레벨에서 전면 OV2740 센서가 2개의 CSI-2 레인을 사용하고 288 MHz 링크 주파수로 동작함을 명시하도록 변경되었습니다.

또한, 전송 프레임 규격을 1932x1092 BGGR 포맷으로 정의하고, 실제 1920x1080 이미지 영역 주변에 가로 및 세로 12픽셀의 패딩을 추가하도록 구성했습니다. 이 패딩 정보는 AtomISP 브리지가 센서별 링크 주파수와 함께 관리하며, ISP2401 D-PHY 타이밍을 파생하는 제어 로직의 기초 자료로 활용됩니다.

이러한 드라이버 레벨의 변경은 하위 이미지 파이프라인의 안정성을 높이고, Android Camera HAL이 V4L2 인터페이스를 통해 센서 모드 및 프레임 타이밍을 쿼리할 때 정확한 데이터를 수신할 수 있도록 돕습니다. 비록 직접적인 HAL API 변경은 아니지만, RAW Bayer 캡처 및 스트림 구성 유효성 검증 시 중요한 참고 자료가 됩니다.

### Camera HAL/Driver 관점에서의 의미

드라이버 레벨의 D-PHY 타이밍 파생 및 패딩 처리는 V4L2 서브시스템을 거쳐 Android Camera HAL의 스트림 구성 유효성 검사에 영향을 미칩니다. 특히 RAW Bayer 캡처 시 패딩 픽셀(12픽셀)이 메타데이터(active array size 등)에 정확히 반영되지 않으면 이미지 왜곡이나 CTS 테스트 실패가 발생할 수 있으므로 주의 깊게 점검해야 합니다.

**출처**

- [[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link](https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/)

---

## 3. libcamera, 고해상도 센서 처리를 위한 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치 검토


![libcamera, 고해상도 센서 처리를 위한 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치 검토 image](../../assets/images/fallback/android.svg)


_libcamera Patchwork - Patch ID 28095_

libcamera 프레임워크에 최신 고해상도 이미지 센서에서 널리 사용되는 쿼드-베이어(Quad-Bayer) CFA(Color Filter Array) 레이아웃 지원을 추가하는 패치가 제안되었습니다. 이번 변경은 하위 이미지 처리 파이프라인에서 RAW 데이터 처리의 정확성을 높이는 데 기여할 것으로 기대됩니다.

최신 모바일 기기에 탑재되는 고해상도 이미지 센서들은 감도 향상과 노이즈 감소를 위해 쿼드-베이어 구조를 채택하는 경우가 많습니다. 그러나 기존 libcamera 프레임워크는 이러한 특수한 CFA 레이아웃을 표준 베이어 패턴과 다르게 처리하는 데 한계가 있었습니다. 이번 패치는 libcamera가 쿼드-베이어 레이아웃을 직접 인식하고 처리할 수 있도록 지원을 추가합니다.

Frederic Laing이 제출한 이번 패치는 쿼드-베이어 CFA 레이아웃 지원과 더불어, 언팩된(unpacked) Bayer 데이터의 스트라이드(stride) 처리 방식을 개선하는 내용을 담고 있습니다. 스트라이드 정렬이 올바르지 않으면 메모리 오버런이나 이미지 왜곡이 발생할 수 있으므로, 이번 변경은 이미지 파이프라인의 안정성 확보에 매우 중요합니다.

Android Camera HAL은 종종 하위 계층으로 libcamera를 활용하므로, 이러한 변경사항은 HAL이 RAW_SENSOR 또는 RAW10/RAW12 스트림을 처리할 때 버퍼 정렬 및 디베이어링 품질을 높이는 데 직접적인 영향을 미칩니다. 향후 고해상도 센서 도입을 준비하는 팀에게 중요한 기술적 기반이 될 것입니다.

### Camera HAL/Driver 관점에서의 의미

libcamera 계층에서 쿼드-베이어 CFA 레이아웃을 직접 인식하고 처리함으로써, Android Camera HAL이 하위 스택에서 수신하는 RAW 데이터의 디베이어링(debayering) 품질과 스트라이드 계산의 정확도가 향상됩니다. 이는 HAL이 RAW_SENSOR 또는 RAW10/RAW12 스트림을 처리할 때 버퍼 오버플로우나 메모리 정렬 오류를 방지하는 데 기여합니다.

**출처**

- [libcamera: Add quad-Bayer CFA layout support](https://patchwork.libcamera.org/patch/28095/)

---

## 4. Linux 커널, Lenovo Yoga Book YB1-X91 카메라 드라이버 및 센서 통합 패치 시리즈 공개


![Linux 커널, Lenovo Yoga Book YB1-X91 카메라 드라이버 및 센서 통합 패치 시리즈 공개 image](../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list - PATCH v2_

Lenovo Yoga Book YB1-X91 디바이스의 카메라 하드웨어를 완벽히 지원하기 위한 Linux 커널 드라이버 패치 시리즈(PATCH v2)가 공개되었습니다. 이번 패치는 부족한 ACPI 펌웨어 정보를 드라이버 수준에서 보완하고, 전/후면 센서 및 렌즈 액추에이터의 제어 기능을 통합하는 데 중점을 둡니다.

Lenovo Yoga Book YB1-X91L 디바이스는 Cherry Trail AtomISP를 기반으로 전면 OV2740 센서와 후면 OV8858 센서를 탑재하고 있습니다. 그러나 기존 시스템 펌웨어는 드라이버가 완전한 카메라 링크를 구성하기에 충분한 정보를 제공하지 못했습니다. 이번 패치 시리즈는 ACPI ID 및 브리지 데이터를 추가하여 이러한 한계를 극복합니다.

패치 시리즈의 주요 변경사항에는 양쪽 카메라 링크에 대한 설명 추가, 센서 클럭 및 모드 지원, RAW Bayer 캡처 노출 기능이 포함되어 있습니다. 또한, 채널별 화이트 밸런스 제어 기능과 후면 카메라용 WV517S 렌즈 액추에이터 드라이버가 추가되어 하드웨어 제어 범위가 크게 넓어졌습니다.

이러한 하위 드라이버의 기능 확장은 Android Camera HAL이 하드웨어의 물리적 특성을 정확히 인식하고, 3A(자동 노출, 자동 화이트 밸런스, 자동 초점) 제어 기능을 원활하게 구현할 수 있는 기반이 됩니다. 하드웨어 통합을 담당하는 엔지니어들에게 중요한 참조 모델이 될 것입니다.

### Camera HAL/Driver 관점에서의 의미

드라이버 레벨에서 RAW Bayer 캡처 노출, 채널별 화이트 밸런스 제어, 렌즈 액추에이터(WV517S)가 추가됨에 따라, Camera HAL은 해당 하드웨어의 3A(Auto Exposure, Auto White Balance, Auto Focus) 제어 기능을 V4L2 컨트롤을 통해 직접 매핑할 수 있게 됩니다. 이는 HAL의 `android.control` 메타데이터 계약을 충족하고 CTS/VTS 검증을 통과하는 데 필수적입니다.

**출처**

- [[PATCH v2 00/11] media: Add Lenovo Yoga Book YB1-X91 camera support](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/T/#t)

---

## 5. Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련


![Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련 image](../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list - PATCH v3_

Sony IMX908 이미지 센서의 Linux 커널 공식 지원을 위한 Device Tree 바인딩 패치(PATCH v3)가 공개되었습니다. 이번 바인딩 정의는 신규 센서를 탑재하는 SoC 플랫폼 개발자들에게 표준 하드웨어 인터페이스 구성 가이드를 제공합니다.

Sony IMX908은 8.39메가픽셀(3856x2176) 해상도를 지원하는 고성능 CMOS 이미지 센서입니다. MIPI CSI-2 인터페이스를 통해 RAW10 및 RAW12 출력을 지원하며, 시스템 요구사항에 따라 2개 또는 4개의 데이터 레인을 유연하게 구성할 수 있는 특징을 가지고 있습니다.

이번 PATCH v3에서는 실제 하드웨어 설계 사양을 반영하여, I2C 슬레이브 타겟 주소가 하드웨어 SLAVE 핀 설정에 의해 동적으로 선택되도록 바인딩 설명을 조정했습니다. 이는 보드 설계에 따른 주소 충돌을 방지하는 데 필수적인 요소입니다.

Device Tree 바인딩이 커널에 통합되면, Android 기기 개발 시 dts 파일에 센서 노드를 표준 방식으로 선언할 수 있습니다. 이는 Android Camera HAL이 드라이버를 통해 센서의 물리적 해상도와 데이터 포맷을 정확히 인식하고 RAW 스트림을 구성하는 출발점이 됩니다.

### Camera HAL/Driver 관점에서의 의미

Device Tree 바인딩을 통해 센서의 MIPI CSI-2 레인 수(2 또는 4레인)와 RAW 포맷(RAW10/RAW12)이 커널에 올바르게 정의되면, Camera HAL은 드라이버로부터 정확한 센서 해상도(3856x2176)와 포맷 정보를 쿼리할 수 있습니다. 이는 HAL의 `SensorCharacteristics` 메타데이터를 구성하고, 고해상도 RAW 스트림 조합의 안정성을 확보하는 데 기여합니다.

**출처**

- [[PATCH v3 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/T/#t)

---

## 6. libcamera, 소프트웨어 ISP EGL 모듈의 createTexture2D()에 필터 파라미터 추가


![libcamera, 소프트웨어 ISP EGL 모듈의 createTexture2D()에 필터 파라미터 추가 image](../../assets/images/fallback/android.svg)


_libcamera Patchwork - v15_

libcamera 프레임워크의 소프트웨어 ISP EGL 모듈에서 이미지 처리 품질을 미세 조정할 수 있는 v15 패치가 공개되었습니다. 이번 변경은 텍스처 생성 시 필터링 옵션을 직접 제어할 수 있도록 파라미터를 추가하여 GPU 가속 렌더링 파이프라인의 유연성을 높입니다.

하드웨어 ISP가 부족하거나 없는 저가형 SoC 플랫폼에서는 CPU와 GPU를 활용하는 소프트웨어 ISP의 역할이 매우 중요합니다. libcamera는 이러한 환경을 위해 software_isp 모듈을 제공하며, EGL을 통해 GPU 가속을 활용합니다. 이번에 제출된 v15 패치는 EGL 모듈의 핵심 함수 중 하나인 `createTexture2D()`에 필터 파라미터를 추가합니다.

Milan Zamazal이 제안한 이 패치는 텍스처 생성 시 선형(Linear) 또는 근접(Nearest) 필터링과 같은 옵션을 개발자가 직접 지정할 수 있도록 합니다. 필터링 옵션은 이미지 스케일링이나 디베이어링 후처리 단계에서 결과물의 시각적 선명도와 앨리어싱 품질에 직접적인 영향을 미칩니다.

Android Camera HAL 구현 시 하위 이미지 처리 파이프라인으로 libcamera의 소프트웨어 ISP를 사용하는 경우, 이번 필터 파라미터 추가를 통해 프리뷰 이미지의 품질을 한층 더 미세하게 조정할 수 있게 됩니다. 성능과 화질 간의 균형을 맞추는 데 유용한 도구가 될 것입니다.

### Camera HAL/Driver 관점에서의 의미

소프트웨어 ISP의 EGL 텍스처 생성 시 필터링 옵션을 제어할 수 있게 됨으로써, GPU 가속을 활용한 이미지 스케일링이나 디베이어링 후처리 단계에서 시각적 품질(예: 앨리어싱 감소, 샤프니스 조절)을 미세 조정할 수 있습니다. 이는 하드웨어 ISP가 없는 보급형 SoC 플랫폼에서 libcamera 기반 Android Camera HAL을 구현할 때 프리뷰 이미지의 품질 향상에 직접적인 영향을 미칩니다.

**출처**

- [[v15,1/6] libcamera: software_isp: egl: Add filter parameter to createTexture2D()](https://patchwork.libcamera.org/patch/28105/)


## 참고 / 더 읽을거리

- [\[PATCH v4 14/15\] media: atomisp: allow raw Bayer capture - Maurizio Casciano](<https://lore.kernel.org/linux-media/749f33adb08c4b311aec241c0bdcc455fcdc0a3c.1787933456.git.mauriziocasciano7@gmail.com/>) — lore.kernel.org linux-media list (2026-08-28) · 카메라 드라이버 / 이미지 파이프라인 참고
- [Camera ITS tests](<https://source.android.com/docs/compatibility/cts/camera-its-tests>) — AOSP Site Updates (2026-07) · AOSP Camera 프레임워크 관련 참고

## 참고자료

- [[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link](https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/)
- [libcamera: Add quad-Bayer CFA layout support](https://patchwork.libcamera.org/patch/28095/)
- [[PATCH v2 00/11] media: Add Lenovo Yoga Book YB1-X91 camera support](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/T/#t)
- [[PATCH v3 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/T/#t)
- [[v15,1/6] libcamera: software_isp: egl: Add filter parameter to createTexture2D()](https://patchwork.libcamera.org/patch/28105/)
