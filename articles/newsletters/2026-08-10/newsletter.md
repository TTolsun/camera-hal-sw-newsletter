# Camera HAL / SW Newsletter - 2026-08-10

이 변경사항들은 Android 하위 카메라 드라이버 스택의 확장성을 높이고, 수동 제어 및 글로벌 셔터 기능을 HAL 레이어에서 활용할 수 있는 기반을 마련합니다.



## 1. 이번 주 3줄 브리핑

- 글로벌 셔터를 지원하는 onsemi AR0234 센서 드라이버 패치 v2가 추가되어 고속 캡처 및 왜곡 없는 이미지 획득이 가능해질 전망입니다.
- Sony IMX908 센서의 디바이스 트리 바인딩 패치 v2가 제출되어 RAW10/RAW12 출력을 위한 하드웨어 리소스 정의가 추가되었습니다.
- 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2): 최종 선정된 출처 기준으로 Camera/driver/SoC 영향과 검증 포인트를 확인한다.

## 2. 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2)


![글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

이번 주 글로벌 셔터 기능을 갖춘 onsemi AR0234 CMOS 이미지 센서 드라이버를 추가하는 v2 패치 시리즈가 Linux 미디어 서브시스템에 제출되었습니다. 고속 촬영 및 정밀한 프레임 동기화가 필요한 머신 비전 및 AR/VR 시나리오에서 유용하게 활용될 수 있습니다.

Linux 커널에 onsemi AR0234 CMOS 이미지 센서 드라이버가 추가되는 것은 Android Camera HAL 및 드라이버 개발에 중요한 영향을 미칩니다. 이 센서는 글로벌 셔터 기능을 지원하며, 1920x1200 해상도에서 최대 120fps를 제공합니다. 이는 고속 이미지 캡처 및 특정 머신 비전 애플리케이션에 유용할 수 있습니다.

MIPI CSI-2 출력, RAW Bayer 형식(8/10비트) 및 DPCM 10->8 압축 지원은 HAL이 센서로부터 데이터를 효율적으로 수신하고 처리하는 방식에 직접적인 영향을 줍니다. HAL은 이러한 RAW 데이터를 ISP(Image Signal Processor)로 전달하여 최종 이미지 처리를 수행하거나, Camera2 API를 통해 RAW 출력을 앱에 제공할 수 있습니다.

글로벌 셔터는 움직이는 객체 촬영 시 롤링 셔터 왜곡을 방지하여 이미지 품질을 향상시킬 수 있으며, 이는 특정 사용 사례에서 중요한 검증 포인트가 됩니다. 개발팀은 고속 프레임 레이트 구동 시의 전송 안정성과 압축 포맷 디코딩 성능을 면밀히 검토해야 합니다.

### Camera HAL/Driver 관점에서의 의미

글로벌 셔터의 특성은 Android Camera HAL에서 고속 캡처 및 머신 비전 시나리오에 활용될 수 있습니다. 120fps 고속 스트림 구성 시 HAL의 버퍼 순환 주기와 ISP의 처리 지연 시간을 최소화해야 하며, DPCM 10->8 압축 해제 또는 RAW Bayer 8/10비트 포맷이 ISP 파이프라인에서 올바르게 디코딩되는지 검증해야 합니다.

**출처**

- [[PATCH v2 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/T/#t)

---

## 3. Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2)


![Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

이번 주 Sony IMX908 8.39MP CMOS 이미지 센서의 Linux 디바이스 트리 바인딩을 추가하는 v2 패치 시리즈가 제출되었습니다. 고해상도 RAW 출력을 지원하는 센서의 하드웨어 인터페이스 정의가 추가되어 플랫폼 통합의 기반이 마련되었습니다.

Sony IMX908 센서에 대한 디바이스 트리 바인딩 추가는 Linux 커널이 해당 센서를 인식하고 초기화하는 데 필요한 하드웨어 정보를 제공하는 것을 의미합니다. 디바이스 트리는 Linux 시스템에서 하드웨어 구성 정보를 커널에 전달하는 메커니즘으로, 카메라 센서의 경우 MIPI CSI-2 레인 구성, 클럭, 전원 관리, I2C 주소 등과 같은 중요한 파라미터를 정의합니다.

IMX908 센서가 8.39 메가픽셀(3856x2176) CMOS 이미지 센서로 RAW10 및 RAW12 출력을 지원한다는 점은, Android Camera HAL이 이 센서로부터 고해상도 RAW 데이터를 처리할 수 있어야 함을 시사합니다. HAL은 이러한 RAW 데이터를 ISP로 전달하거나, Camera2 API를 통해 앱에 직접 노출하여 고급 이미지 처리 기능을 가능하게 합니다.

디바이스 트리 바인딩의 정확성은 센서의 올바른 동작과 카메라 파이프라인의 안정성에 직접적인 영향을 미치므로, HAL 및 드라이버 개발자는 이 변경 사항을 면밀히 검토해야 합니다. 특히 MIPI CSI-2 레인 수 설정에 따른 대역폭 확보 여부를 확인하는 것이 중요합니다.

### Camera HAL/Driver 관점에서의 의미

디바이스 트리 바인딩의 정확성은 센서 프로빙(probing) 및 초기화 성공 여부를 결정합니다. RAW12 고해상도(3856x2176) 스트림은 RAW10에 비해 더 넓은 버퍼 메모리와 대역폭을 요구하므로, HAL 및 드라이버 레이어에서 DMA-BUF 할당 및 ISP 입력 버퍼 크기 설정을 정확히 매칭해야 합니다.

**출처**

- [[PATCH v2 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/T/#t)


## 참고 / 더 읽을거리

- [v0.7.2](<https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2>) — libcamera Upstream Releases (2026-07-10T11:12:38+01:00) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [[PATCH v2 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/T/#t)
- [[PATCH v2 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/T/#t)
