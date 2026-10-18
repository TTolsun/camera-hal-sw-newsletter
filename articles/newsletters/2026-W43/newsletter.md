# 2026 W42 (10.12 ~ 10.18)





<a id="issue-briefing"></a>

## 1. 이번 주 핵심

이번 호는 저장 이미지의 검은색 문제를 고친 HeifWriter 소식으로 시작합니다. 이어서 Gemini 4 Argon을 Android 개발 도구에 연결하는 방법과 이용 조건을 살펴봅니다. HM1092의 게인 제한과 atomisp 오류 검사 정리 제안은 센서·드라이버 담당자가 확인할 내용입니다.

- [AndroidX HeifWriter, 8비트 HEIF에서 검은색이 회색으로 보이는 문제 수정](#article-androidx-heifwriter-8-heif)

  HEIF 저장 기능 담당자가 확인할 소식입니다. 특히 8비트 SDR Surface·Bitmap 입력을 살펴보세요. 직접 YUV를 넘기는 버퍼 입력과 10비트 HDR은 변경 대상이 아닙니다.

- [Gemini 4 Argon, Android Studio와 CLI에서 개발 작업 지원](#article-gemini-4-argon-android-studio-cli)

  Android 개발 자동화를 시험하는 팀이 확인할 소식입니다. 구독·API 조건을 먼저 확인하고, 작은 프로젝트에서 오류 로그 확인과 빌드 재실행을 시험해 보세요.

- [Linux HM1092 드라이버 v7 제안: 밝기 조절로 검은 화면이 생기지 않도록 제한](#article-linux-hm1092-v7)

  NIR 센서를 V4L2에 연결하는 개발자가 확인할 소식입니다. 게인 상한 변경과 아직 논의 중인 영상 영역 보고 방식을 나누어 살펴보세요.

- [Linux atomisp 패치 제안: 작동하지 않는 오류 검사를 제거하는 이유](#article-linux-atomisp)

  atomisp 유지보수 담당자가 확인할 소식입니다. 미리보기 정보가 없다는 결과와 캡처 스트림을 만들 수 없다는 오류를 구분해야 합니다.




<a id="article-androidx-heifwriter-8-heif"></a>

## 2. AndroidX HeifWriter, 8비트 HEIF에서 검은색이 회색으로 보이는 문제 수정

_AndroidX Gerrit (2026-10-16)_

검은색으로 저장한 부분이 회색처럼 보였다면, 픽셀 값과 파일의 색상 범위 표시가 어긋났을 수 있습니다. HeifWriter는 일부 8비트 입력에서 이 불일치를 없애는 수정을 병합했습니다.

### Camera HAL/Driver 관점에서의 의미

HEIF 저장 기능 담당자가 확인할 소식입니다. 특히 8비트 SDR Surface·Bitmap 입력을 살펴보세요. 직접 YUV를 넘기는 버퍼 입력과 10비트 HDR은 변경 대상이 아닙니다.


![](../../assets/images/fallback/android.svg)


### 왜 검은색이 회색으로 보였나요?

이미지 파일에는 픽셀 값뿐 아니라 그 값을 해석하는 방법도 들어갑니다. 이번 문제는 실제 픽셀 값과 색상 범위 표시가 서로 맞지 않아 생겼습니다.

일부 amlogic·qti HEVC 인코더는 검은색 RGB(0, 0, 0)를 밝기 값 Y=16으로 바꿨습니다. 이는 제한 범위에서 검은색을 나타내는 값입니다. 그런데 파일에는 전체 범위인 COLOR_RANGE_FULL이 표시되어, 디코딩할 때 검은색이 0 대신 16/255로 해석되었습니다.

### 무엇을 바꿨나요?

대상은 8비트 SDR 이미지를 Surface나 Bitmap으로 넘기는 경로입니다. 내부에서 만드는 RGBA_8888 EGL Surface에는 색상 해석 정보인 dataspace가 지정되지 않았습니다.

수정된 EncoderBase.java는 이 경로에서 MediaFormat.KEY_COLOR_RANGE를 강제로 지정하지 않습니다. 인코더가 실제 변환 범위와 파일의 VUI 색상 범위 표시를 일치시키도록 맡깁니다.

직접 YUV 데이터를 넘기는 버퍼 입력은 기존 JFIF 규칙에 따라 전체 범위를 유지합니다. BT.2020 dataspace를 전달하는 10비트 HDR 경로도 그대로입니다.

### 누가 무엇을 확인하면 되나요?

HEIF 저장 기능을 담당한다면 검은색 테스트 이미지를 저장한 뒤 다시 읽어 보세요. 디코딩된 검은색과 VUI 색상 범위 표시를 함께 확인하는 것이 점검의 핵심입니다.

### 지금 제품에 적용된 상태인가요?

2026년 10월 16일 라이브러리 소스에 병합되었습니다. 사용하는 라이브러리 버전이나 제품 빌드에 포함되었는지는 별도로 확인해야 합니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)

---

<a id="article-gemini-4-argon-android-studio-cli"></a>

## 3. Gemini 4 Argon, Android Studio와 CLI에서 개발 작업 지원

_Android Developers Blog (2026-10-13)_

AI에게 코드만 물어보는 것에서 빌드 도구를 연결해 작업시키는 방향으로 지원이 넓어졌습니다. Google은 10월 13일 Gemini 4 Argon의 Android 개발 환경 지원을 발표했습니다.

### Camera HAL/Driver 관점에서의 의미

Android 개발 자동화를 시험하는 팀이 확인할 소식입니다. 구독·API 조건을 먼저 확인하고, 작은 프로젝트에서 오류 로그 확인과 빌드 재실행을 시험해 보세요.



### 무엇이 달라졌나요?

Gemini 4 Argon을 Android Studio와 Antigravity에서 사용할 수 있게 되었습니다. 공식 Android CLI 플러그인은 에이전트를 로컬 Android 도구에 연결합니다. 에이전트가 개발 도구를 실행하는 작업 흐름을 구성할 수 있다는 뜻입니다.

Google은 빌드 실패 시 Gradle·Kotlin 컴파일러의 오류 로그를 받아 수정하는 사례를 소개했습니다. 공급사가 제시한 사례이며, 모든 프로젝트에서 자동으로 해결된다는 보장은 아닙니다.

### 어떤 조건에서 사용할 수 있나요?

Antigravity 앱·CLI와 Android Studio Canary 안의 Antigravity 경로는 Google AI Ultra 구독자를 대상으로 합니다. Android Studio에서는 유료 Gemini API를 사용하는 경로도 제공합니다. 지원 지역과 사용 환경을 확인해야 합니다.

### 누가 무엇을 확인하면 되나요?

Android 앱이나 개발 도구를 담당하는 팀이 살펴볼 소식입니다. 시험용 프로젝트에서 빌드 오류를 하나 재현하고, 에이전트가 실제 오류 로그를 읽는지와 수정 후 빌드가 통과하는지를 확인하는 방법을 제안합니다.

이 발표는 Camera HAL이나 C++ 네이티브 빌드의 자동 수정 능력을 입증하지 않습니다. 기존에 소개한 BYOA는 외부 에이전트를 연결하는 기능이고, 이번 소식은 특정 모델의 이용 경로와 Android 개발 도구 연결을 다룹니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Bringing our latest frontier model to Android Developers](https://developer.android.com/blog/posts/bringing-gemini-4-argon-to-android-agentic-engineering-antigravity-cli)

---

<a id="article-linux-hm1092-v7"></a>

## 4. Linux HM1092 드라이버 v7 제안: 밝기 조절로 검은 화면이 생기지 않도록 제한

_linux-media 메일링 리스트 (2026-10-13)_

밝기를 높이려고 넣은 값이 센서의 처리 범위를 넘으면 오히려 검은 화면이 나올 수 있습니다. HM1092 드라이버 v7은 디지털 게인 값의 상한을 정해 이 문제를 막도록 제안되었습니다.

### Camera HAL/Driver 관점에서의 의미

NIR 센서를 V4L2에 연결하는 개발자가 확인할 소식입니다. 게인 상한 변경과 아직 논의 중인 영상 영역 보고 방식을 나누어 살펴보세요.


![](../../assets/images/fallback/newsletter-default.svg)


### 어떤 센서를 위한 드라이버인가요?

HM1092는 노트북 얼굴 인식 카메라 등에 쓰이는 1메가픽셀 흑백 근적외선(NIR) 센서입니다. 제안된 드라이버는 센서를 Linux의 카메라 제어 체계인 V4L2에 연결합니다. 영상은 단일 레인 MIPI CSI-2로 전달합니다.

### 밝기를 높였는데 왜 검은 화면이 나오나요?

디지털 게인은 영상 신호를 얼마나 키울지 정하는 값입니다. 센서의 게인 레지스터는 10비트의 2.8 고정소수점 형식을 사용합니다. 정수 부분에 2비트, 소수 부분에 8비트를 쓰는 방식입니다.

v7은 기록할 수 있는 값의 상한을 0x3ff로 제한합니다. 1024 이상의 값을 넣으면 상위 비트가 무시되어 검은 화면이 나올 수 있기 때문입니다. get_selection 인터페이스 변경과 실행 중 전원 관리(runtime PM)의 오류 처리도 반영했습니다.

### 아직 정해지지 않은 부분은 무엇인가요?

플랫폼에 따라 센서에 공급하는 외부 클럭이 다릅니다. 제안은 Qualcomm의 24 MHz 환경과 Intel의 19.2 MHz 환경을 구분합니다.

19.2 MHz 환경에서는 영상 가장자리의 더미 영역과 실제 유효 영상 영역을 어떻게 보고할지 논의가 남아 있습니다. 크롭 영역은 영상에서 사용할 부분의 위치와 크기를 뜻합니다.

### 누가 무엇을 확인하면 되나요?

NIR 센서를 연결하는 개발자는 게인 상한과 실제 화면을 함께 확인하세요. libcamera에 전달되는 유효 영역과 크롭 정보도 별도로 비교할 만합니다. 이는 편집부의 점검 제안입니다.

2026년 10월 13일 제출된 드라이버 v7은 패치 제안 단계입니다. 커널 병합이나 상용 제품 지원이 완료되었다는 의미는 아닙니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)

---

<a id="article-linux-atomisp"></a>

## 5. Linux atomisp 패치 제안: 작동하지 않는 오류 검사를 제거하는 이유

_linux-media 메일링 리스트 (2026-10-16)_

atomisp에 실제로는 작동하지 않는 오류 검사가 남아 있었습니다. 이번 제안은 그 검사를 제거합니다. 반환값을 받아 검사하도록 고치면 정상적인 RAW 캡처까지 실패할 수 있기 때문입니다.

### Camera HAL/Driver 관점에서의 의미

atomisp 유지보수 담당자가 확인할 소식입니다. 미리보기 정보가 없다는 결과와 캡처 스트림을 만들 수 없다는 오류를 구분해야 합니다.


![](../../assets/images/fallback/newsletter-default.svg)


### 어떤 코드가 문제였나요?

ia_css_stream_create()는 캡처 스트림을 만드는 함수입니다. 이 안에서 sh_css_pipe_get_viewfinder_frame_info()를 호출한 뒤, 그 반환값 대신 이전 작업의 err 값을 검사하고 있었습니다.

이전 오류는 이미 확인한 상태여서 해당 분기는 항상 거짓이었습니다. 2026년 10월 16일 제출된 패치는 drivers/staging/media/atomisp/pci/sh_css.c에서 이 검사 두 줄을 제거합니다.

### 반환값을 받아 검사하면 안 되나요?

RAW·BAYER 모드에는 뷰파인더 출력이 없을 수 있습니다. 여기서 뷰파인더는 미리보기용 출력을 뜻합니다. 이 경우 조회 함수가 -EINVAL을 반환해도 캡처 스트림 자체가 잘못되었다고 볼 수는 없습니다.

이 반환값을 그대로 실패로 처리하면 정상 스트림 생성까지 막을 수 있습니다. 그래서 제안은 반환값 대입을 추가하는 대신 불필요한 검사를 없앱니다.

### 누가 무엇을 확인하면 되나요?

atomisp 유지보수 담당자는 미리보기 없는 RAW·BAYER 구성을 기준으로 반환값의 의미를 확인하세요. 다른 드라이버의 오류 검사까지 같은 방식으로 제거할 근거는 아닙니다.

이 소식은 병합 전 패치 제안을 설명합니다. 이미 배포된 커널에서 동작이 바뀌었다는 의미는 아닙니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)


## 참고 / 더 읽을거리

- [\[v6,1/4\] libcamera: software_isp: Add support for monochrome formats - Shaders](<https://patchwork.libcamera.org/patch/28492/>) — libcamera Patchwork (patch review) (2026-10-17) · 오픈소스 camera HAL 프로젝트 변경 · 기술 동향 참고
- [\[PATCH v3 0/6\] phy: qcom-mipi-csi2: C-PHY for X1E80100](<https://lore.kernel.org/linux-media/20261016-x1e-cphy-rfc-v3-0-40a346a72153@gmail.com/>) — lore.kernel.org linux-media list (2026-10-16) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v4 1/2\] media: dt-bindings: imx908: Add Sony IMX908 sensor](<https://lore.kernel.org/linux-media/20261016075918.19345-2-lachlan.michael@sony.com/>) — lore.kernel.org linux-media list (2026-10-16) · 카메라 드라이버 / 이미지 파이프라인 참고
- [v4l2: v4l2_camera_proxy: Handle 64-bit time_t buffer ioctls](<https://patchwork.libcamera.org/patch/28471/>) — libcamera Patchwork (patch review) (2026-10-16) · 오픈소스 camera HAL 프로젝트 변경 · 기술 동향 참고
- [Android Studio BYOA: 외부 AI 에이전트 연결](<https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio>) — Android Developers Blog (2026-09-24) · 이전 발표 참고: 특정 모델 지원과 외부 에이전트 연결 기능은 구분해야 합니다.

## 참고자료

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)
- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)
- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [전체 패치 시리즈](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)
- [Bringing our latest frontier model to Android Developers](https://developer.android.com/blog/posts/bringing-gemini-4-argon-to-android-agentic-engineering-antigravity-cli)
