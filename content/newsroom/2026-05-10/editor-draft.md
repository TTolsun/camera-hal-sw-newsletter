# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-10

이번 2026-05-10호는 review-only fallback publication입니다. 독립 camera-stack evidence가 있는 main article은 CameraX 관찰 기사와 libcamera v0.7.1 기사 2개뿐이라 정책상 최소 3개 main article을 채우지 못했습니다. 편집장 승인 시 public newsletter로 게시되며, 자동 발행 기준은 통과하지 못했습니다.

## 1. 이번 주 3줄 브리핑
- CameraX 1.6.1 / 1.4.0-alpha07은 동일 AndroidX Camera release page 계열의 호환성 관찰 항목으로 병합했습니다.
- libcamera v0.7.1은 Linux camera driver / image pipeline 관찰 항목으로 유지했습니다.
- 이번 호는 article count 부족을 숨기지 않는 review-only fallback publication이며, final_publish_ready=false 상태입니다.

## 2. Android Platform / CameraX

### CameraX 1.6.1 / 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰


**이번 주 확인한 사실**

- Android Developers Latest Updates의 May 06, 2026 CameraX release table에서 확인한 항목입니다.
- 관련 컴포넌트: CameraX / androidx.camera
- 1.6.1은 camera-camera2, camera-core, camera-compose, camera-effects, camera-extensions, camera-lifecycle, camera-view, camera-video 등 CameraX artifact의 stable release 행으로 표시됩니다.
- 1.4.0-alpha07은 camera-video 계열 pre-release 행으로 함께 표시되어 CameraX video/viewfinder 호환성 관찰 대상으로 묶어 검토합니다.

**배경지식**

CameraX는 앱 계층 API이지만 camera-camera2, camera-view, camera-video, extensions 등의 조합은 HAL stream configuration, preview/video/image capture latency, device-specific workaround 검증 항목과 연결됩니다.

**Camera HAL 관점 해석**

Camera HAL 팀은 이번 CameraX 항목을 HAL 직접 변경으로 보지 않고, 앱 API release가 CTS/Camera ITS, stream/buffer/metadata, Preview + VideoCapture + ImageCapture 조합 검증에 영향을 줄 수 있는지 관찰 대상으로 둡니다.

**우리 팀이 확인할 Action Item**

- CameraX 1.6.1을 사용하는 reference app에서 Preview + VideoCapture + ImageCapture 조합의 latency와 frame drop을 측정합니다.
- CameraX 1.4.0-alpha07 관련 video/viewfinder 변경은 HAL `STREAM_CONFIGURATION_MAP`과 실제 지원 해상도/프레임율 범위의 mismatch 여부만 관찰합니다.
- 후속 release note에서 Camera2 interop, extensions, device workaround가 명시되면 다음 호에서 별도 기사로 재평가합니다.

**팀 공유용 한 줄**

CameraX 1.6.1 / 1.4.0-alpha07은 동일 AndroidX Camera release page의 호환성 관찰 항목으로 묶어 보고, HAL 직접 변경 claim 없이 validation checklist로만 추적합니다.

**출처**

- [CameraX 1.6.1 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.4.0-alpha07 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)

---

## 3. Camera Driver / Image Pipeline

### libcamera v0.7.1: SoftISP 및 camera pipeline 관찰


**이번 주 확인한 사실**

- libcamera Release Announcements의 2026-04-28 항목입니다.
- 관련 컴포넌트: libcamera / V4L2 camera pipeline
- v0.7.1 release announcement는 SoftISP debayering, image pipeline throughput, pipeline handler camera support, sensor mode configuration update를 언급합니다.

**배경지식**

libcamera는 Android Camera HAL 자체는 아니지만 Linux camera driver, V4L2, sensor mode, image pipeline 관찰 지점과 맞닿아 있습니다.

**Camera HAL 관점 해석**

Camera HAL 팀은 libcamera v0.7.1을 Android HAL 직접 변경으로 해석하지 않고, Linux camera pipeline과 sensor/ISP tuning 관찰 항목으로 둡니다. SoftISP debayering과 throughput 변화는 Android bring-up 환경의 reference comparison에만 활용합니다.

**우리 팀이 확인할 Action Item**

- libcamera v0.7.1 change list를 내부 Linux camera driver watch 항목으로 등록하고 Android HAL 직접 변경으로 표현하지 않습니다.
- SoftISP debayering 또는 sensor mode update가 포팅 branch에 들어올 때만 RAW/YUV 품질과 throughput 비교를 수행합니다.
- 후속 upstream patch가 V4L2 control, sensor configuration, pipeline handler behavior를 바꾸면 다음 호에서 재평가합니다.

**팀 공유용 한 줄**

libcamera v0.7.1은 Android HAL 직접 변경이 아니라 Linux camera driver/image pipeline 관찰 항목으로 공유합니다.

**출처**

- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)


## 이번 주 실행 항목

- CameraX 1.6.1 reference app에서 Preview + VideoCapture + ImageCapture stream 조합의 frame drop과 capture latency를 측정합니다. (담당: Camera HAL validation)
- libcamera v0.7.1의 SoftISP / sensor mode 항목이 내부 Linux camera driver branch에 반영되는지 확인합니다. (담당: camera driver)
- 독립 dated camera-stack source가 3개 미만인 주간호는 editor-approved exception 여부를 PR에서 명시적으로 판단합니다. (담당: editor-in-chief)

## 참고자료

- [CameraX 1.6.1 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.4.0-alpha07 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
