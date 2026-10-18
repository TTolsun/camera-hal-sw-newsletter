# Camera HAL / SW Newsletter - 2026-10-19





<a id="issue-briefing"></a>

## 1. 이 호의 핵심

이번 주에는 8비트 HEIF 이미지에서 검은색이 들뜨는 문제를 다룬 HeifWriter 수정부터 살펴봅니다. Surface 입력의 색상 범위와 인코딩 결과를 함께 확인해야 하는 변경입니다. 이어서 HM1092 NIR 센서 드라이버 v7의 게인 제한과 남은 크롭 논의, atomisp의 RAW 캡처 오류 처리 패치 제안을 정리합니다. Android Studio의 외부 AI 에이전트 연동은 마지막에 짧은 개발 도구 소식으로 전합니다.

- [AndroidX HeifWriter, 8비트 서피스 입력 색상 왜곡 방지 패치 병합](#article-androidx-heifwriter-8)

  8비트 SDR HEIF를 Surface 경로로 저장한다면 검은색 입력의 디코딩 결과와 VUI color_range 선언을 함께 확인하세요. YUV 버퍼 입력과 10비트 HDR 경로는 이번 변경 대상이 아닙니다.

- [Linux media 하위 시스템, Himax HM1092 흑백 NIR 센서 드라이버 v7 제안](#article-linux-media-himax-hm1092-nir-v7)

  NIR 센서를 V4L2로 연동하는 개발자는 v7의 게인 상한 수정과 아직 논의 중인 액티브 어레이 보고 방식을 구분해 살펴보세요.

- [Linux atomisp 드라이버, 스트림 생성 오류 분기 정리 패치 제안](#article-linux-atomisp)

  atomisp의 RAW·BAYER 경로에서는 뷰파인더 정보가 없다는 반환값과 실제 스트림 생성 실패를 구분해야 합니다.

- [짧은 소식: Android Studio, 외부 AI 에이전트 연동 지원](#article-android-studio-ai)

  Canary의 개발 보조 기능으로 참고하세요. 현재 사용 중인 빌드·테스트 흐름에 맞는지 확인한 뒤 도입을 판단할 수 있습니다.




<a id="article-androidx-heifwriter-8"></a>

## 2. AndroidX HeifWriter, 8비트 서피스 입력 색상 왜곡 방지 패치 병합

_AndroidX Gerrit (2026-10-16)_

AndroidX의 HEIF 이미지 생성 라이브러리가 8비트 서피스 입력 시 색상 범위를 강제로 전체 범위로 선언하던 로직을 제거해 렌더링 검은색이 들뜨는 현상을 바로잡았습니다.

### Camera HAL/Driver 관점에서의 의미

8비트 SDR HEIF를 Surface 경로로 저장한다면 검은색 입력의 디코딩 결과와 VUI color_range 선언을 함께 확인하세요. YUV 버퍼 입력과 10비트 HDR 경로는 이번 변경 대상이 아닙니다.


![](../../assets/images/fallback/android.svg)


구글 안드로이드 오픈소스 프로젝트의 frameworks support 저장소에 2026년 10월 16일 HeifWriter의 8비트 색상 범위 처리 회귀를 수정하는 패치가 병합되었습니다. 대상 파일은 EncoderBase.java입니다.

기존 구현에서는 8비트 SDR 이미지를 서피스나 비트맵 입력 모드로 인코딩할 때 EglWindowSurface가 색상 공간 속성이 지정되지 않은 표준 RGBA_8888 EGL 서피스를 생성했습니다. 이때 amlogic이나 qti 등 일부 벤더 하드웨어 HEVC 인코더는 RGB(0, 0, 0)를 제한된 범위의 루마 값인 Y=16으로 양자화하면서도, 포맷에 지정된 COLOR_RANGE_FULL 지시를 따라 비트스트림 VUI 헤더에는 풀 레인지 플래그를 기록했습니다. 그 결과 디코딩 시 블랙이 0이 아닌 16/255로 해석되어 검은색 영역이 회색으로 들뜨고 CTS 및 HeifWriterTest 서피스 테스트가 실패하는 문제가 발생했습니다.

이번 수정은 내부 서피스를 사용하는 8비트 경로에서 MediaFormat.KEY_COLOR_RANGE를 설정하지 않고 비워 두도록 분기했습니다. 서피스 입력에 데이터스페이스 정보가 없는 경우 인코더가 자체 하드웨어 변환 범위와 비트스트림 VUI 헤더를 일관되게 맞추도록 위임하는 방식입니다. 반면 클라이언트가 직접 YUV를 전달하는 버퍼 입력 모드는 카메라의 일반적인 JFIF 규칙을 따라 풀 레인지 설정을 유지합니다. 10비트 HDR 서피스 입력 역시 BT.2020 데이터스페이스가 명시적으로 전달되므로 변경 없이 풀 레인지를 유지합니다.

이 수정은 라이브러리 소스에 병합된 상태이며 특정 안드로이드 버전 릴리스나 상용 디바이스 롬 반영 여부는 별도로 확인해야 합니다. 실무 엔지니어는 카메라 캡처 서피스를 HeifWriter에 연결해 8비트 SDR HEIF 이미지를 저장하는 경로에서 RGB(0, 0, 0) 입력 시 디코딩된 루마 값이 들뜨지 않는지 HeifWriterTest 관점에서 확인할 수 있습니다.

[이 호의 핵심으로](#issue-briefing)

**출처**

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)

---

<a id="article-linux-media-himax-hm1092-nir-v7"></a>

## 3. Linux media 하위 시스템, Himax HM1092 흑백 NIR 센서 드라이버 v7 제안

_linux-media 메일링 리스트 (2026-10-13)_

노트북 안면 인식 카메라 등에 쓰이는 Himax HM1092 1메가픽셀 흑백 근적외선 센서를 지원하기 위한 리눅스 V4L2 서브디바이스 드라이버 패치 v7이 공개되었습니다.

### Camera HAL/Driver 관점에서의 의미

NIR 센서를 V4L2로 연동하는 개발자는 v7의 게인 상한 수정과 아직 논의 중인 액티브 어레이 보고 방식을 구분해 살펴보세요.


![](../../assets/images/fallback/newsletter-default.svg)


2026년 10월 13일 제출된 HM1092 드라이버 v7은 단일 레인 MIPI CSI-2를 사용하는 흑백 NIR 센서의 V4L2 연동을 다룹니다. 퀄컴 디바이스 트리와 인텔 IPU 기반 ACPI 환경을 고려하며, 24 MHz와 19.2 MHz 외부 클럭에 따라 동작 모드를 구분합니다.

v7에서 눈여겨볼 변경은 디지털 게인 범위입니다. 레지스터의 10비트 2.8 고정소수점 형식에 맞춰 상한을 0x3ff로 제한해, 1024 이상 값을 넣었을 때 상위 비트가 무시되어 검은 화면이 나오던 문제를 방지합니다. get_selection 패드 연산 변경과 런타임 PM 오류 처리도 반영했습니다.

아직 검토가 끝나지 않은 쟁점은 19.2 MHz 환경의 더미 보더와 크롭 영역입니다. 센서의 액티브 어레이 범위를 어떻게 보고할지 논의가 남아 있으므로, 유사 센서를 연동한다면 게인 제어 한계와 libcamera에 노출되는 선택 영역을 함께 비교할 만합니다. 현재는 병합 전 패치 제안이며 상용 제품 지원 완료를 뜻하지 않습니다.

[이 호의 핵심으로](#issue-briefing)

**출처**

- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)

---

<a id="article-linux-atomisp"></a>

## 4. Linux atomisp 드라이버, 스트림 생성 오류 분기 정리 패치 제안

_linux-media 메일링 리스트 (2026-10-16)_

리눅스 스테이징 미디어 트리의 atomisp 드라이버에서 스트림 생성 시 의미 없이 남아 있던 데드 코드 오류 검사를 제거하는 패치가 제출되었습니다.

### Camera HAL/Driver 관점에서의 의미

atomisp의 RAW·BAYER 경로에서는 뷰파인더 정보가 없다는 반환값과 실제 스트림 생성 실패를 구분해야 합니다.


![](../../assets/images/fallback/newsletter-default.svg)


2026년 10월 16일 제출된 패치는 drivers/staging/media/atomisp/pci/sh_css.c의 ia_css_stream_create()에서 불필요한 오류 검사 두 줄을 제거합니다. sh_css_pipe_get_viewfinder_frame_info()의 반환값을 대입하지 않은 채 이전 err를 검사해 항상 거짓이 되는 분기였습니다.

핵심은 반환값 대입을 추가하는 것이 해법이 아니라는 점입니다. 뷰파인더가 없는 RAW·BAYER 모드에서는 해당 함수가 -EINVAL을 반환할 수 있어 이를 전파하면 정상 스트림 생성까지 실패합니다. atomisp 유지보수 시 출력 구성에 따른 반환값 의미를 확인해야 합니다. 이 변경은 병합 전 제안이며 다른 드라이버의 오류 처리를 일괄 제거할 근거는 아닙니다.

[이 호의 핵심으로](#issue-briefing)

**출처**

- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)

---

<a id="article-android-studio-ai"></a>

## 5. 짧은 소식: Android Studio, 외부 AI 에이전트 연동 지원

_Android Developers Blog (2026-10-15)_

Android Studio Canary 최신 빌드에 외부 AI 코딩 에이전트를 개발 환경에 직접 연결할 수 있는 BYOA(Bring Your Own Agent) 지원이 추가되었습니다.

### Camera HAL/Driver 관점에서의 의미

Canary의 개발 보조 기능으로 참고하세요. 현재 사용 중인 빌드·테스트 흐름에 맞는지 확인한 뒤 도입을 판단할 수 있습니다.


![Android Studio Canary, 외부 코딩 에이전트 연동 위한 BYOA 지원 도입](https://developer.android.com/static/blog/assets/BYOA_Backup_Strapi_1_5c3f94f766_sEPWb.webp)

_이미지: [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)_


10월 15일 발표된 Android Studio Canary의 BYOA는 ACP를 통해 외부 코딩 에이전트에 프로젝트·빌드 맥락과 IDE 도구를 제공합니다. Claude Agent, Codex, Antigravity 연동을 지원합니다.

개발 도구를 시험 중인 팀이 살펴볼 프리뷰 소식입니다. HAL 실행 동작이나 성능 개선을 뜻하지 않으며, 팀의 C++ 빌드·테스트 작업에 유용한지는 별도로 확인해야 합니다.

[이 호의 핵심으로](#issue-briefing)

**출처**

- [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)


## 참고 / 더 읽을거리

- [\[v6,1/4\] libcamera: software_isp: Add support for monochrome formats - Shaders](<https://patchwork.libcamera.org/patch/28492/>) — libcamera Patchwork (patch review) (2026-10-17) · 오픈소스 camera HAL 프로젝트 변경 · 기술 동향 참고
- [\[PATCH v3 0/6\] phy: qcom-mipi-csi2: C-PHY for X1E80100](<https://lore.kernel.org/linux-media/20261016-x1e-cphy-rfc-v3-0-40a346a72153@gmail.com/>) — lore.kernel.org linux-media list (2026-10-16) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v4 1/2\] media: dt-bindings: imx908: Add Sony IMX908 sensor](<https://lore.kernel.org/linux-media/20261016075918.19345-2-lachlan.michael@sony.com/>) — lore.kernel.org linux-media list (2026-10-16) · 카메라 드라이버 / 이미지 파이프라인 참고
- [v4l2: v4l2_camera_proxy: Handle 64-bit time_t buffer ioctls](<https://patchwork.libcamera.org/patch/28471/>) — libcamera Patchwork (patch review) (2026-10-16) · 오픈소스 camera HAL 프로젝트 변경 · 기술 동향 참고

## 참고자료

- [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)
- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)
- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)
- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)
