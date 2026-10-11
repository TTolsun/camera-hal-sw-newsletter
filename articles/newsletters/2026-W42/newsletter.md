# 2026 W41 (10.05 ~ 10.11)

이번 주에는 AOSP cameraserver의 프라이버시 토글 시 조건부 mute를 유지하는 패치 제안을 살펴봅니다. Qualcomm CAMSS ISP 파라미터 문서화 패치에서는 공통 구조체 적용에 관한 리뷰를 확인합니다. ChromeOS 카메라 IPC에서는 타입이 명시된 platform handle로의 전환과 파일 디스크립터 전달 경로의 변경을 다룹니다.



## 1. 이번 주 기사

- AOSP cameraserver, 프라이버시 토글 시 조건부 mute를 유지하는 패치 제안
- Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의
- ChromeOS 카메라 IPC, 타입이 명시된 platform handle로 전환

## 2. AOSP cameraserver, 프라이버시 토글 시 조건부 mute를 유지하는 패치 제안


![AOSP cameraserver, 프라이버시 토글 시 조건부 mute를 유지하는 패치 제안 image](../../assets/images/fallback/newsletter-default.svg)


_AOSP Gerrit (camera changes under review)_

카메라 mute를 지원하고 화면에 보이는 UID의 클라이언트도 프라이버시 토글 직후 강제 종료되는 문제를 고치려는 패치가 AOSP에 제안되었습니다.

10월 7일 android17-release 브랜치에 제출된 Gerrit 변경 4348947은 CameraService.cpp의 프라이버시 처리 경로를 수정하는 제안입니다. 확인한 revision은 아직 NEW 상태로, Android에 반영이 완료된 변경은 아닙니다.

커밋 메시지는 같은 프라이버시 토글에서 SensorPrivacyManager 콜백과 AppOpsManager의 opChanged()가 서로 다른 binder 경로로 실행된다고 설명합니다. opChanged()는 UID 가시성과 camera mute 지원 여부를 검사하지만, 다른 경로의 무조건적인 block()이 먼저 실행되면 ERROR_CAMERA_DISABLED를 전달하며 클라이언트를 끊는다는 것이 패치 작성자가 지적한 문제입니다.

### mute 적용 조건과 유지되는 차단 경로

diff는 blockAllClients()와 blockPrivacyEnabledClients()에 같은 조건 검사를 추가합니다. UID의 프로세스 상태가 PROCESS_STATE_BOUND_TOP 이하이고 supportsCameraMute()가 참일 때만 setCameraMute(true)를 호출하며, 그렇지 않으면 기존 block()을 유지합니다. 커밋 메시지는 mute 지원 판단이 ANDROID_SENSOR_AVAILABLE_TEST_PATTERN_MODES와 관련됨을 설명합니다.

UID가 비활성 상태가 될 때 사용하는 blockClientsForUid()는 이 패치에서 바꾸지 않습니다. 따라서 모든 앱의 카메라 세션을 유지하는 변경으로 해석하면 안 됩니다. 기기에서 race 해소나 성능 개선을 실측한 결과는 제공되지 않았으므로, 패치의 의도와 실제 검증 결과도 구분해야 합니다.

### Camera HAL/Driver 관점에서의 의미

프라이버시 토글 시험을 UID 가시성 및 camera mute 지원 여부로 나누고, 조건을 만족할 때만 연결을 유지하는지 확인해야 합니다. 나머지 클라이언트와 UID 비활성 경로의 차단도 함께 검증할 대상입니다.

**출처**

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)

---

## 3. Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의


![Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

Qualcomm CAMSS 하위 시스템의 ISP 파라미터를 제어하기 위한 V4L2 메타데이터 포맷 문서화 패치 시리즈가 v10 리비전으로 검토되고 있습니다.

9월 25일 제출된 PATCH v10 문서화 패치에 대해 10월 6일 linux-media 메일링 리스트에서 리뷰 의견이 올라왔습니다. 이 패치는 Qualcomm CAMSS ISP 파라미터 메타데이터 형식인 V4L2_META_FMT_QCOM_ISP_PARAMS 제안을 포함합니다. 이 포맷은 공통 V4L2 확장 가능 ISP 파라미터 구조를 기반으로 설계되었습니다.

주요 구성 요소인 Offline Processing Engine(OPE)의 ope_params 노드가 이 메타데이터 형식을 가장 먼저 활용합니다. 메타데이터 버퍼 내부에 블록 단위 구조체를 배치하여 화이트 밸런스 게인, 색상 보정 행렬, 감마 곡선 등의 하드웨어 모듈을 설정하는 방식입니다.

### uAPI 구조체와 헤더 호환성 논의

리뷰 과정에서 공통 ISP 구조체인 v4l2_isp_buffer 및 v4l2_isp_block_header 적용에 대한 의견이 교환되었습니다. 구형 레거시 드라이버 호환용 구조체 대신 공통 구조체를 사용하는 방향으로 커널 내 표준화 작업이 지속 진행되고 있습니다.

### Camera HAL/Driver 관점에서의 의미

Qualcomm platform 커널 드라이버 연동 시 qcom-camss-config.h uAPI 구조체 및 v4l2_isp 공통 헤더 변경 사항을 사전 점검해야 합니다.

**출처**

- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)

---

## 4. ChromeOS 카메라 IPC, 타입이 명시된 platform handle로 전환


![ChromeOS 카메라 IPC, 타입이 명시된 platform handle로 전환 image](../../assets/images/fallback/newsletter-default.svg)


_ChromeOS Gerrit_

10월 7일 머지된 ChromeOS platform2 변경은 카메라 Mojom 인터페이스와 C++ 구현의 핸들 표현을 함께 전환해 플랫폼 파일 디스크립터를 직접 전달하도록 정리했습니다.

Gerrit 변경 8506716은 chromiumos/platform2의 main 브랜치에 10월 7일 머지되었습니다. 커밋 메시지는 Chromium에서 타입 없는 레거시 Mojom handle 표기를 폐기하는 흐름에 맞춰, platform 타입을 명시한 핸들과 C++의 mojo::PlatformHandle로 옮긴다고 설명합니다.

변경은 camera/mojo/gpu의 dmabuf·JPEG 인터페이스에만 한정되지 않습니다. camera3.mojom과 카메라 알고리즘 인터페이스, HAL 어댑터 및 C++ 호출부를 포함한 20개 파일이 함께 바뀌었습니다. 예를 들어 버퍼 fd 배열은 mojo::ScopedHandle 대신 mojo::PlatformHandle을 사용하고, acquire/release fence를 회수할 때는 UnwrapPlatformHandle을 거치던 코드가 핸들의 ReleaseFD()를 직접 호출합니다.

### 인터페이스와 C++ 호출부를 함께 확인해야 하는 이유

Mojom 정의만 복사하고 송수신 측 C++ 타입을 그대로 두면 이 변경과 동일한 상태가 되지 않습니다. ChromeOS 카메라 코드를 유지하는 팀은 버퍼 등록과 fence 반환 경로의 타입·유효성 검사·fd 소유권 전달을 함께 확인해야 합니다.

이것은 ChromeOS 내부 IPC 타입 전환이며 AOSP Camera HAL3/AIDL 규격 변경이 아닙니다. 커밋의 TEST 항목은 CQ를 기록하지만 카메라 지연 시간이나 영상 품질 개선을 실측한 자료는 제시하지 않습니다.

### Camera HAL/Driver 관점에서의 의미

ChromeOS 파생 카메라 스택을 유지한다면 Mojom 정의와 C++ 송수신 코드를 함께 대조하고, 버퍼 fd 및 fence의 유효성·소유권 전달을 시험해야 합니다. Android HAL 인터페이스 변경으로 확대 해석하지 않습니다.

**출처**

- [camera: Migrate mojom files from legacy handle to handle - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8506716)


## 참고 / 더 읽을거리

- [\[PATCH 0/3\] media: Add GalaxyCore GC5035 and GC8034 sensor drivers](<https://lore.kernel.org/linux-media/20261009072733.39877-1-nicfio@gmail.com/>) — lore.kernel.org linux-media list (2026-10-09) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH 0/2\] media: i2c: Add OmniVision OV3660 image sensor driver](<https://lore.kernel.org/linux-media/20261008160650.73927-1-tien.nguyenminh@embeddedlinux.blog/>) — lore.kernel.org linux-media list (2026-10-08) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v1 0/2\] media: support upside-down camera mounting](<https://lore.kernel.org/linux-media/20261007034914.1654831-1-jimmy.su@intel.com/>) — lore.kernel.org linux-media list (2026-10-07) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v3 0/2\] media: rkisp1: Add YUV bypass support for rkisp1](<https://lore.kernel.org/linux-media/20261006-media-rkisp1-add-yuv-bypass-support-for-rkisp1-v3-0-93d3d43991a0@ideasonboard.com/>) — lore.kernel.org linux-media list (2026-10-06) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)
- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)
- [camera: Migrate mojom files from legacy handle to handle - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8506716)
