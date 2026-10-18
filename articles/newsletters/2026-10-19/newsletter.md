# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-10-19

Android Studio Canary의 외부 AI 코딩 에이전트 연동 지원과 AndroidX HeifWriter의 8비트 서피스 입력 색상 범위 정합성 패치, 그리고 Linux 미디어 서브시스템의 Himax HM1092 센서 드라이버 v7 및 atomisp 드라이버 스트림 생성 오류 검사 수정 제안을 분석합니다.





## 1. 이번 주 3줄 브리핑

- Android Studio Canary가 ACP 프로토콜 기반 BYOA를 도입해 외부 AI 코딩 에이전트를 네이티브 IDE 도구와 연동 지원
- AndroidX HeifWriter에서 8비트 RGBA_8888 서피스 인코딩 시 COLOR_RANGE_FULL 강제 지정을 해제해 양자화 블랙 레벨 왜곡 문제 해결
- Linux 커널 미디어 하위 시스템에 Himax HM1092 흑백 NIR 센서 드라이버 v7 제안 및 atomisp 스트림 생성 데드 코드 정리 제안 등록
<a id="issue-contents"></a>

## 목차

- [Android Studio, 맞춤형 AI 코딩 에이전트 연동을 위한 BYOA 기능 도입](#article-android-studio-ai-byoa)
- [AndroidX HeifWriter, 8비트 서피스 입력 색상 왜곡 방지 패치 병합](#article-androidx-heifwriter-8)
- [Linux media 하위 시스템, Himax HM1092 흑백 NIR 센서 드라이버 v7 제안](#article-linux-media-himax-hm1092-nir-v7)
- [Linux atomisp 드라이버, 스트림 생성 오류 분기 정리 패치 제안](#article-linux-atomisp)

<a id="article-android-studio-ai-byoa"></a>

## 2. Android Studio, 맞춤형 AI 코딩 에이전트 연동을 위한 BYOA 기능 도입

_Android Developers Blog (2026-10-15)_

Android Studio Canary 최신 빌드에 외부 AI 코딩 에이전트를 개발 환경에 직접 연결할 수 있는 BYOA(Bring Your Own Agent) 지원이 추가되었습니다.

### Camera HAL/Driver 관점에서의 의미

IDE 차원의 개발 워크플로 확장으로, C++ 네이티브 테스트 작성이나 AOSP 빌드 스크립트 수정 시 에이전트 활용성을 점검할 수 있으나 카메라 HAL 런타임 계약 변경은 수반하지 않습니다.


![Android Studio Canary, 외부 코딩 에이전트 연동 위한 BYOA 지원 도입](https://developer.android.com/static/blog/assets/BYOA_Backup_Strapi_1_5c3f94f766_sEPWb.webp)

_이미지: [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)_


구글은 2026년 10월 15일 공식 개발자 블로그를 통해 안드로이드 스튜디오 카나리 최신 릴리스에서 사용자가 선호하는 코딩 에이전트를 연결할 수 있는 BYOA 기능을 발표했습니다. 지난해 단일 AI 모델 선택을 개방한 데 이어 이번에는 에이전트 단위의 통합을 지원합니다.

이번 통합은 에이전트 클라이언트 프로토콜(ACP)을 기반으로 동작합니다. 안드로이드 스튜디오는 프로젝트 전체 구조, 빌드 구성, 플랫폼 상세 정보를 ACP를 통해 에이전트에 노출합니다. 이를 통해 에이전트는 불필요한 토큰 소비를 줄이면서 관련된 코드 맥락만 선별해 접근할 수 있습니다. 엔터프라이즈 및 개인 계정 플랜에 맞춰 Anthropic의 Claude Agent, OpenAI의 Codex, Google의 Antigravity 에이전트를 선택해 연동할 수 있습니다.

에이전트는 셸 명령 실행, 파일 읽기 및 편집, 테스트 구동과 같은 기본 작업 외에도 안드로이드 스튜디오의 내부 인프라에 접근합니다. 빌드 진단 도구, Jetpack Compose 미리보기, 안드로이드 SDK 도구, 에뮬레이터 제어 기능이 네이티브 도구 주입 형태로 제공됩니다.

이 기능은 네이티브 C++ 개발 도구 및 IDE 워크플로 개선에 해당하며 카메라 하드웨어 계층이나 HAL 인터페이스 동작을 직접 수정하지는 않습니다. 그러나 카메라 HAL 컴포넌트나 드라이버 단위 테스트를 작성하고 디버깅하는 엔지니어링 파이프라인에서 개발 보조 도구로 활용할 수 있는 선택지를 넓혀 줍니다.

[목차로 돌아가기](#issue-contents)

**출처**

- [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)

---

<a id="article-androidx-heifwriter-8"></a>

## 3. AndroidX HeifWriter, 8비트 서피스 입력 색상 왜곡 방지 패치 병합

_AndroidX Gerrit (2026-10-16)_

AndroidX의 HEIF 이미지 생성 라이브러리가 8비트 서피스 입력 시 색상 범위를 강제로 전체 범위로 선언하던 로직을 제거해 렌더링 검은색이 들뜨는 현상을 바로잡았습니다.

### Camera HAL/Driver 관점에서의 의미

카메라 HAL 자체의 변경은 아니지만, 카메라 프레임워크나 앱이 Surface 경로를 통해 8비트 SDR HEIF를 인코딩할 때 인코더 비트스트림의 VUI color_range 플래그 정합성을 보장해 다운스트림 갤러리 및 이미지 출력 품질 왜곡을 차단합니다.


![](../../assets/images/fallback/android.svg)


구글 안드로이드 오픈소스 프로젝트의 frameworks support 저장소에 2026년 10월 16일 HeifWriter의 8비트 색상 범위 처리 회귀를 수정하는 패치가 병합되었습니다. 대상 파일은 EncoderBase.java입니다.

기존 구현에서는 8비트 SDR 이미지를 서피스나 비트맵 입력 모드로 인코딩할 때 EglWindowSurface가 색상 공간 속성이 지정되지 않은 표준 RGBA_8888 EGL 서피스를 생성했습니다. 이때 amlogic이나 qti 등 일부 벤더 하드웨어 HEVC 인코더는 RGB(0, 0, 0)를 제한된 범위의 루마 값인 Y=16으로 양자화하면서도, 포맷에 지정된 COLOR_RANGE_FULL 지시를 따라 비트스트림 VUI 헤더에는 풀 레인지 플래그를 기록했습니다. 그 결과 디코딩 시 블랙이 0이 아닌 16/255로 해석되어 검은색 영역이 회색으로 들뜨고 CTS 및 HeifWriterTest 서피스 테스트가 실패하는 문제가 발생했습니다.

이번 수정은 내부 서피스를 사용하는 8비트 경로에서 MediaFormat.KEY_COLOR_RANGE를 설정하지 않고 비워 두도록 분기했습니다. 서피스 입력에 데이터스페이스 정보가 없는 경우 인코더가 자체 하드웨어 변환 범위와 비트스트림 VUI 헤더를 일관되게 맞추도록 위임하는 방식입니다. 반면 클라이언트가 직접 YUV를 전달하는 버퍼 입력 모드는 카메라의 일반적인 JFIF 규칙을 따라 풀 레인지 설정을 유지합니다. 10비트 HDR 서피스 입력 역시 BT.2020 데이터스페이스가 명시적으로 전달되므로 변경 없이 풀 레인지를 유지합니다.

이 수정은 라이브러리 소스에 병합된 상태이며 특정 안드로이드 버전 릴리스나 상용 디바이스 롬 반영 여부는 별도로 확인해야 합니다. 실무 엔지니어는 카메라 캡처 서피스를 HeifWriter에 연결해 8비트 SDR HEIF 이미지를 저장하는 경로에서 RGB(0, 0, 0) 입력 시 디코딩된 루마 값이 들뜨지 않는지 HeifWriterTest 관점에서 확인할 수 있습니다.

[목차로 돌아가기](#issue-contents)

**출처**

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)

---

<a id="article-linux-media-himax-hm1092-nir-v7"></a>

## 4. Linux media 하위 시스템, Himax HM1092 흑백 NIR 센서 드라이버 v7 제안

_linux-media 메일링 리스트 (2026-10-13)_

노트북 안면 인식 카메라 등에 쓰이는 Himax HM1092 1메가픽셀 흑백 근적외선 센서를 지원하기 위한 리눅스 V4L2 서브디바이스 드라이버 패치 v7이 공개되었습니다.

### Camera HAL/Driver 관점에서의 의미

Android Camera HAL 직접 변경은 아니지만, Linux 커널 레벨에서 단일 레인 MIPI CSI-2 흑백 센서의 V4L2 서브디바이스 모델링, 외부 클럭별 PLL 바인딩, libcamera 호환 픽셀 어레이 선택 타겟 구성을 파악하는 데 유용한 드라이버 설계 참고자료입니다.


![](../../assets/images/fallback/newsletter-default.svg)


리눅스 미디어 메일링 리스트에 2026년 10월 13일 Himax HM1092 센서를 위한 V4L2 서브디바이스 드라이버와 디바이스 트리 바인딩 패치 시리즈 7번째 개정판이 제출되었습니다. 이번 시리즈는 퀄컴 디바이스 트리 플랫폼과 인텔 IPU 기반 ACPI 시스템 모두를 고려한 초기화 구성을 담고 있습니다.

HM1092는 10비트 RAW 데이터를 출력하는 1메가픽셀 흑백 근적외선 센서로, 단일 MIPI CSI-2 데이터 레인을 360 Mbit/s 수준으로 구동해 약 30 fps 출력을 생성합니다. 드라이버는 외부 클럭 주파수에 맞춰 동작 모드를 결정하도록 설계되었습니다. 퀄컴 플랫폼의 24 MHz EXTCLK 환경에서는 180 MHz 링크 주파수로 560x360 해상도를 설정하며, 인텔 IPU 환경의 19.2 MHz EXTCLK 설정에서는 180.48 MHz 링크 주파수로 648x368 해상도를 구성합니다. ASUS Zenbook A14와 Dell XPS 16, Dell Latitude 7350 시스템에서 프로빙, 스트리밍, 런타임 PM 전환이 검증되었습니다.

이번 v7 개정에서는 디지털 게인 레지스터가 10비트 2.8 고정소수점 값이라는 점을 반영해 제어 범위를 0x3ff로 제한했습니다. 상위 비트 무시로 인해 1024 이상 설정 시 검은 화면이 출력되던 문제를 차단한 조치입니다. 또한 get_selection 패드 연산 인터페이스 변경을 반영하고 런타임 PM 오류 처리 방식을 정돈했습니다. 다만 19.2 MHz 환경에서 더미 보더를 포함한 크롭 영역 설정과 관련해 액티브 어레이 범위를 어떻게 보고할지에 대한 논의는 아직 열려 있습니다.

이 변경은 현재 리눅스 커널에 병합되지 않은 제안 상태이며 안드로이드 카메라 HAL API를 직접 바꾸는 것은 아닙니다. 리눅스 기반 플랫폼이나 V4L2 서브디바이스를 직접 바인딩하는 특수 목적 안드로이드 카메라 드라이버를 개발할 때 단일 레인 NIR 센서 연동 구조로 참고할 수 있습니다.

[목차로 돌아가기](#issue-contents)

**출처**

- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)

---

<a id="article-linux-atomisp"></a>

## 5. Linux atomisp 드라이버, 스트림 생성 오류 분기 정리 패치 제안

_linux-media 메일링 리스트 (2026-10-16)_

리눅스 스테이징 미디어 트리의 atomisp 드라이버에서 스트림 생성 시 의미 없이 남아 있던 데드 코드 오류 검사를 제거하는 패치가 제출되었습니다.

### Camera HAL/Driver 관점에서의 의미

드라이버 내부 정적 분석 결함 수정으로 직접적인 HAL 계약 변경은 없으나, ISP 펌웨어 래퍼에서 뷰파인더가 생략되는 RAW 캡처 파이프 구성 시 반환 코드 처리와 스트림 생성 성공 여부를 검토하는 데 도움이 됩니다.


![](../../assets/images/fallback/newsletter-default.svg)


리눅스 미디어 서브시스템에 2026년 10월 16일 atomisp 드라이버의 스트림 생성 로직을 정돈하는 패치가 등록되었습니다. 수정 대상은 drivers staging media atomisp pci sh_css.c 파일의 ia_css_stream_create 함수입니다.

해당 위치에서는 sh_css_pipe_get_viewfinder_frame_info 함수의 반환 값을 err 변수에 대입하지 않은 채 바로 if (err) goto ERR 분기를 검사하고 있었습니다. 이 검사는 직전에 수행된 그리드 정보 조회의 결과를 재검사하는 꼴이 되어 항상 거짓으로 평가되는 데드 코드였습니다.

정적 분석 도구 SVACE로 이 문제를 발견한 작성자는 단순히 반환값을 err 변수로 전파하도록 고쳐서는 안 된다고 설명합니다. RAW 및 BAYER 캡처 모드에서는 뷰파인더 출력이 애초에 존재하지 않아 해당 함수가 -EINVAL을 반환하기 때문입니다. 오류를 단순 전파할 경우 정상적인 RAW 캡처 파이프의 스트림 생성이 전면 실패하게 되므로, 의미 없는 분기문 두 줄을 삭제하는 방식으로 정리되었습니다.

이 변경은 현재 제안 상태의 커널 패치이며 상용 디바이스의 드라이버 릴리스 여부는 별개입니다. 스테이징 하위 드라이버의 특정 분기 제거이므로 안드로이드 카메라 HAL 인터페이스 동작을 직접 바꾸지는 않지만, ISP 파이프라인에서 뷰파인더 유무에 따른 스트림 구성 로직을 점검할 때 참고할 수 있습니다.

[목차로 돌아가기](#issue-contents)

**출처**

- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)


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
