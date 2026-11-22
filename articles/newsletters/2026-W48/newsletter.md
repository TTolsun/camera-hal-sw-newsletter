# 2026 W47 (11.16 ~ 11.22)





<a id="issue-briefing"></a>

## 1. 이번 주 핵심

CameraX 1.7.0에서는 앱이 물리 카메라를 직접 고릅니다. OPPO Find N3 Flip에서는 출력 대상으로 지정하면 카메라 서비스가 멈출 수 있는 물리 ID 두 개를 목록에서 뺐습니다. SM-F971에서 줌 전환이 멈춘 사례와 3A 요청을 곧바로 거절하는 CameraPipe 변경도 살펴봅니다. 녹화 첫 프레임의 PTS와 첫 출력 콜백을 받은 시각을 따로 남겨야 대기 중이던 프레임과 출력 전달 지연을 구별할 수 있습니다.

- [CameraX 1.7.0에서 물리 카메라를 직접 고른다](#article-camerax-1-7-0)

  렌즈 목록과 바인딩 결과를 함께 남기면 실패 지점을 좁힐 수 있습니다.

- [3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요](#article-3a-id)

  지원 목록에서 거절된 요청과 카메라가 받은 뒤 수렴이 늦어진 요청은 조사할 로그가 다릅니다.

- [SM-F971에서 두 번째 렌즈 전환이 멈춘 이유](#article-sm-f971)

  ZSL을 켠 세션과 끈 세션에서 같은 렌즈 전환 뒤 첫 캡처 결과가 돌아오는지 비교할 수 있습니다.

- [OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭](#article-oppo-find-n3-flip)

  앱의 연결 해제 로그를 출력 구성의 물리 ID와 HAL의 마지막 flush 기록에 맞춰 보세요.

- [녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점](#article-camerax)

  첫 프레임의 PTS와 첫 출력 콜백을 받은 시각을 따로 남겨야 대기 중이던 프레임과 출력 전달 지연을 구별할 수 있습니다.




<a id="article-camerax-1-7-0"></a>

## 2. CameraX 1.7.0에서 물리 카메라를 직접 고른다

_Android Developers Latest Updates_

원하는 렌즈가 목록에 없었을까, 골랐는데 열리지 않았을까? CameraX 1.7.0에서는 두 경우를 나눠 볼 수 있습니다.

### Camera HAL/Driver 관점에서의 의미

렌즈 목록과 바인딩 결과를 함께 남기면 실패 지점을 좁힐 수 있습니다.


![CameraX 1.7.0 정식 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원](https://developer.android.com/static/images/social/android-developers.png)

_이미지: [CameraX Release Notes - CameraX 1.7.0](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0)_


11월 18일 출시된 CameraX 1.7.0에서는 CameraInfo.getPhysicalCameraInfos()가 돌려준 물리 카메라 정보에서 CameraSelector를 얻습니다. 앱은 그 선택자로 원하는 카메라에 촬영 유스케이스를 바인딩할 수 있습니다.

Camera2Interop V2도 이번 버전에서 안정화됐습니다. 별도 opt-in 없이 쓸 수 있고, 초점·측광 요청을 만들 때는 FocusMeteringAction.Builder.setLockingMode()로 노출과 화이트밸런스 잠금을 지정할 수 있습니다.

렌즈 선택 기능을 옮기는 팀이라면 바인딩 성공 여부만 남기기 아깝습니다. 단말이 열거한 물리 ID와 앱이 바인딩을 요청한 ID를 함께 기록해 두면, 렌즈가 처음부터 빠져 있었는지 촬영을 시작하면서 문제가 생겼는지 구별하기 쉽습니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [CameraX Release Notes - CameraX 1.7.0](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0)

---

<a id="article-3a-id"></a>

## 3. 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요

_AndroidX Gerrit Camera_

CameraPipe가 지원 모드를 먼저 확인합니다. 초점이나 노출이 움직이기를 기다릴 필요도 없이 요청이 끝나는 경우가 생겼습니다.

### Camera HAL/Driver 관점에서의 의미

지원 목록에서 거절된 요청과 카메라가 받은 뒤 수렴이 늦어진 요청은 조사할 로그가 다릅니다.


![](../../assets/images/fallback/android.svg)


11월 19일 병합된 변경에서 Controller3A는 노출(AE), 초점(AF), 화이트밸런스(AWB), 제어 모드와 플래시 모드를 해당 카메라의 CameraMetadata와 대조합니다. 3A 상태를 갱신하거나 요청을 제출하거나 잠글 때 이 검사를 거칩니다.

요청한 값이 지원 목록에 없으면 경고를 남기고 즉시 SUBMIT_FAILED를 반환합니다. 직전의 3A 상태는 그대로입니다. 이 변경이 실린 CameraX 배포 버전이나 단말 빌드는 원문에서 확인되지 않습니다.

이 패치가 들어간 빌드에서 잠금이 실패하면 경고에 찍힌 카메라 ID와 요청값을 먼저 맞춰 보세요. 반대로 요청은 받아들여졌는데 잠금이 늦다면, 그때는 이어지는 캡처 결과에서 3A 상태가 어떻게 움직였는지 볼 차례입니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Check if 3A modes are supported in Controller3A - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488)

---

<a id="article-sm-f971"></a>

## 4. SM-F971에서 두 번째 렌즈 전환이 멈춘 이유

_AndroidX Gerrit Camera_

같은 단말에서 같은 순서로 줌을 바꿨는데, 일반 촬영은 끝까지 됐고 ZSL 촬영은 마지막 전환에서 멈췄습니다.

### Camera HAL/Driver 관점에서의 의미

ZSL을 켠 세션과 끈 세션에서 같은 렌즈 전환 뒤 첫 캡처 결과가 돌아오는지 비교할 수 있습니다.


![](../../assets/images/fallback/android.svg)


원문에서 문제를 재현한 단말은 Samsung SM-F971U1입니다. PRIVATE 재처리 기반 ZSL(제로 셔터 랙)을 켜고 줌을 2.0배에서 0.6배로, 다시 2.0배로 바꾸자 마지막 전환 뒤 새 반복 요청의 TotalCaptureResult가 오지 않았습니다. 그 뒤 setZoomRatio()가 시간 초과됐습니다.

일반 촬영 세션에서는 같은 줌 전환과 사진 촬영이 모두 끝났습니다. 11월 17일 병합된 패치는 모델명이 SM-F971로 시작하는 단말에서 ZSL을 끄고 일반 촬영을 사용합니다. 어느 CameraX 릴리스부터 받을 수 있는지, 실제 판매 단말에 적용됐는지는 아직 확인할 수 없습니다.

비슷한 로그를 만났다면 마지막 타임아웃보다 한 줄 앞을 보는 게 좋습니다. 렌즈 전환 순서를 고정한 상태에서 ZSL만 바꿔 각 줌 요청과 그 뒤 첫 캡처 결과를 짝지으면, 어느 전환부터 결과가 끊겼는지 드러납니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Disable ZSL on Samsung SM-F971 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195)

---

<a id="article-oppo-find-n3-flip"></a>

## 5. OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭

_AndroidX Gerrit Camera_

PHT110에서 후면 물리 ID 2와 3은 목록에 있었지만, 출력 대상으로 지정하면 카메라 서비스까지 멈출 수 있었습니다.

### Camera HAL/Driver 관점에서의 의미

앱의 연결 해제 로그를 출력 구성의 물리 ID와 HAL의 마지막 flush 기록에 맞춰 보세요.


![](../../assets/images/fallback/android.svg)


후면 논리 카메라 0에 속한 물리 ID 2 또는 3을 출력 대상으로 지정하자 vendor HAL의 P2StreamingNode에서 캡처가 멈췄습니다. 이어 세션을 정리하는 BasicSession::flush도 끝나지 않았습니다.

watchdog이 카메라 서비스를 종료한 뒤 앱이 받은 오류는 ERROR_CAMERA_DEVICE와 CAMERA_DISCONNECTED였습니다. 11월 17일 병합된 CameraX 패치는 PHT110에서 getPhysicalCameraInfos()가 두 ID를 반환하지 않도록 바꿨습니다. 확인된 범위는 androidx-main 병합까지입니다. 배포된 CameraX 버전과 제품 빌드에 들어갔는지는 별도 확인이 필요합니다.

기존 장애를 조사할 때는 연결이 끊긴 시각에서 거꾸로 따라가 보세요. 출력 구성에 들어간 물리 ID와 캡처가 멎은 시점, 마지막 flush 기록을 맞춰 보면 앱의 오류가 어디서 시작됐는지 좁힐 수 있습니다. 수정 빌드에서 가장 먼저 확인할 것은 두 ID가 렌즈 목록에서 빠졌는지입니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Exclude OPPO PHT110 physical camera IDs 2 and 3 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995)

---

<a id="article-camerax"></a>

## 6. 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점

_AndroidX Gerrit Camera_

녹화 버튼을 누르기 전에도 카메라는 프레임을 보냅니다. 11월 20일 병합된 CameraX 패치는 이때 들어온 프레임을 비디오 인코더가 어떻게 처리할지 바꿨습니다.

### Camera HAL/Driver 관점에서의 의미

첫 프레임의 PTS와 첫 출력 콜백을 받은 시각을 따로 남겨야 대기 중이던 프레임과 출력 전달 지연을 구별할 수 있습니다.


![](../../assets/images/fallback/android.svg)


### 패치에서 확인된 동작

EncoderImpl은 녹화를 시작하기 전에 MediaCodec을 구성하고 지속 입력 서피스를 연결합니다. 중지 후 다음 녹화를 준비할 때도 마찬가지입니다. 기존에는 코덱이 CONFIGURED일 때 들어온 프레임을 GraphicBufferSource가 보관했습니다. 그러다 MediaCodec.start() 안에서 출력 버퍼 풀 초기화가 끝나기 전에 그 프레임을 제출할 수 있었습니다.

패치가 적용된 API 29 이상에서는 구성할 때 KEY_CREATE_INPUT_SURFACE_SUSPENDED를 설정합니다. 구성 중 받은 프레임은 버리고 MediaCodec.start()가 반환한 직후 PARAMETER_KEY_SUSPEND로 입력을 재개합니다. 추가된 테스트는 시작 전에 프레임을 흘려보낸 다음 첫 인코딩 출력의 표시 시각(PTS)이 기록해 둔 기준 시각 이상인지, 첫 출력이 키프레임인지 검사합니다. 시작 지연이 몇 ms 줄었는지 보여주는 측정값은 원문에 없습니다. 원문이 확인해 주는 것은 androidx-main 병합까지입니다. 이 변경을 담은 CameraX 배포 버전이나 단말 빌드는 명시돼 있지 않습니다.

### 현장에서 해볼 진단

첫 녹화와 중지 직후 재녹화를 따로 추적해 보세요. 카메라 프레임 도착, 코덱 시작 호출과 반환, 첫 출력 콜백을 차례로 기록합니다. 첫 출력에는 PTS와 키프레임 여부도 붙입니다. PTS는 어느 프레임이 나왔는지를, 콜백 수신 시각은 앱이 그 출력을 언제 받았는지를 알려줍니다. 센서 타임스탬프와 PTS를 대조하기 전에 시간 기준과 단위부터 맞춰야 합니다.

첫 출력에 녹화 시작 전의 오래된 PTS가 붙었다면, 구성 중에 들어온 프레임이 남았을 가능성을 살펴볼 만합니다. 반대로 PTS는 예상 범위인데 콜백만 늦다면 코덱이 시작 호출 안에서 쓴 시간과 반환 후 첫 출력을 전달하기까지의 시간을 나눠 재보세요. 어느 쪽인지는 해당 단말의 로그로 판단해야 합니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Suspend video encoder input surface until start - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407)


## 참고 / 더 읽을거리

- [Honor abort cancellation in still capture control - platform/frameworks/support](<https://android-review.googlesource.com/c/platform/frameworks/support/+/4449679>) — AndroidX Gerrit Camera (2026-11-19) · AOSP Camera 프레임워크 관련 참고
- [Extend Samsung Extensions close quirk to API 35+ - platform/frameworks/support](<https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276>) — AndroidX Gerrit Camera (2026-11-18) · AOSP Camera 프레임워크 관련 참고
- [Use HLG10 camera stream for Dolby Vision on Xiaomi 17 Pro Max - platform/frameworks/support](<https://android-review.googlesource.com/c/platform/frameworks/support/+/4445746>) — AndroidX Gerrit Camera (2026-11-17) · AOSP Camera 프레임워크 관련 참고
- [Claude Code v2.1.327](<https://github.com/anthropics/claude-code/releases/tag/v2.1.327>) — Claude Code Changelog (2026-11-17) · C++ / AI 네이티브 툴링 참고

## 참고자료

- [CameraX Release Notes - CameraX 1.7.0](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0)
- [Check if 3A modes are supported in Controller3A - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488)
- [Disable ZSL on Samsung SM-F971 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195)
- [Exclude OPPO PHT110 physical camera IDs 2 and 3 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995)
- [Suspend video encoder input surface until start - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407)
