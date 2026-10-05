# Android 17 ITS 검증 환경과 libcamera AWB 제어 제안

ITS의 실행 버전·차트·검사 항목과 libcamera AWB의 게인 고정·재탐색 조건을 원문으로 확인합니다.



## 1. 이번 주 3줄 브리핑

- Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목
- libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기
- Mali-C55와 ChromeOS 카메라 변경은 짧은 참고 항목으로 확인합니다.

## 2. Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목


![Android Open Source Project](https://www.gstatic.com/devrel-devsite/prod/vfdb441d2e08dbd9d3e48d8cd72b242388a87bcf7626bf5fb9df50c2bdd4a70fd/androidsource/images/lockup.png)

_이미지: [Android 17 Camera Image Test Suite release notes | Android Open Source Project](https://source.android.com/docs/compatibility/cts/its-release-notes-17)_


_Android Open Source Project 공식 문서_

Android 17 Camera ITS를 준비할 때 맞춰야 할 것은 Python 패키지 목록만이 아닙니다. Python과 FFmpeg 실행 파일의 버전, 테스트 차트, CTS Verifier의 활동 구성을 함께 확인해야 합니다.

Android 17 Camera ITS 릴리스 노트는 Python 3.14와 FFmpeg 7.0.2를 사용하는 환경 구성 절차를 안내합니다. Android 릴리스별로 가상 환경을 만들고, 문서에 제시된 버전의 Python 패키지를 설치하는 방식을 강력히 권장합니다. Python 자체와 FFmpeg 실행 파일은 Python 패키지 설치만으로 준비되지 않으므로 따로 설치해야 합니다.

확인할 대상은 테스트를 실제로 실행하는 환경입니다. Python 3.14로 만든 가상 환경을 활성화한 뒤 Python 버전을 확인하고, pip freeze 결과를 공식 패키지 목록과 비교합니다. 같은 환경에서 ffmpeg -version이 7.0.2를 가리키는지도 확인해야 합니다. 다른 버전이 실행된다면 문서가 안내하는 것처럼 실행 경로와 가상 환경의 바이너리 연결을 점검할 수 있습니다. 가상 환경을 만들었다는 사실만으로 시스템에 설치된 다른 FFmpeg가 호출되는 문제까지 해결되지는 않습니다.

### 차트와 검사 항목도 달라집니다

새로운 gen2_chart 장면은 태블릿 대신 종이 차트를 사용합니다. scene3는 ArUco 마커로 차트를 검출하도록 바뀌어 망원 카메라의 다양한 화각과 거리 조건을 다룹니다. 기존 차트를 그대로 사용하면 새 검사 조건과 맞지 않을 수 있으므로, 실행 환경의 버전과 별도로 차트 구성도 확인할 필요가 있습니다.

신규 검사 중 test_tonemap_sequence는 android.tonemap.mode 적용을 확인하고, test_jca_jpegr_ip는 JPEG_R JCA 미리보기 스냅샷과 캡처 이미지 사이의 화이트 밸런스 차이를 검사합니다. test_display_p3는 P3 JPEG에 적절한 ICC 프로파일이 있는지, sRGB 색역 밖의 색상 비율이 1%를 넘는지 확인합니다. 기존 test_yuv_jpeg_capture_sameness는 RMS 차이 임계값을 낮춰 눈에 보이는 색상 차이를 실패로 잡도록 변경됐습니다. 문서에는 이 임계값의 새 수치가 제시되어 있지 않습니다.

테스트는 CTS Verifier의 Camera ITS Test와 Camera ITS Sensor Fusion Rig Test 활동으로 분리됩니다. 후자는 feature_combination과 sensor_fusion 장면을 포함하며, 별도 기기에서 병렬로 시험할 수 있도록 한 구성입니다. 추가로 경계 수준의 통과를 표시하는 PASS 별표 상태가 도입됩니다. sensor_fusion/test_video_stabilization은 폐기되며 test_video_stabilization_jca를 사용하도록 안내합니다. 동일한 빌드 지문(build fingerprint)을 사용하는 여러 기기와 세션에서 얻은 ITS 결과를 모아 빌드 승인에 제출하는 절차도 설명합니다.

Gen2 리그로 옮겨진 멀티 카메라 전환·플래시·센서 퓨전 테스트에는 새 차트가 필요합니다. config.yml의 chart_scaling은 망원 카메라의 차트 배율 문제를 다루며, 광색역 시험용 태블릿 허용 목록에는 Samsung Galaxy Tab S10 FE가 추가됐습니다.

이는 HAL API가 바뀌었다는 뜻이 아니라 시험 실행 환경과 검증 범위가 달라진다는 의미입니다. 릴리스 노트의 갱신일만으로 각 변경 사항의 최초 도입일을 단정할 수는 없습니다.

### Camera HAL/Driver 관점에서의 의미

검증 실패를 분석할 때 실행 환경의 버전·경로, 차트 구성, HAL 출력의 차이를 구분해야 합니다. 특히 YUV/JPEG 색상 차이와 JPEG_R 미리보기·캡처 간 화이트 밸런스는 새 검사 조건을 기준으로 결과를 비교할 항목입니다.

**출처**

- [Android 17 Camera Image Test Suite release notes](https://source.android.com/docs/compatibility/cts/its-release-notes-17)

---

## 3. libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기


![libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 image](../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork 메일링 리스트_

자동 화이트 밸런스를 끌 때 예전 수동 게인으로 되돌아가면서 색이 갑자기 변하는 동작을 개선하려는 제안입니다. 마지막 자동 게인을 유지하고, 요청할 때만 새 게인으로 갱신하는 흐름을 추가합니다.

2026년 9월 28일 제출된 libcamera의 AWB 패치 시리즈는 자동 모드에서 수동 모드로 바꿀 때의 게인 전환을 다룹니다. 기존에는 자동 게인과 수동 게인이 분리돼 있어 AwbEnable=false로 전환하면 이전 수동 값으로 돌아갔습니다. 제안은 자동 동작 중 계산한 게인으로 수동 게인을 계속 갱신하여, AWB를 끄는 순간 마지막 자동 게인을 유지하도록 합니다.

잠금 상태에서 조명이 바뀌어 다시 맞추고 싶을 때는 AwbTrigger=true를 요청할 수 있습니다. 이 제어는 AwbEnable=false일 때 작동합니다. 알고리즘은 Searching 상태에서 다시 수렴을 판단하고, 수렴한 게인을 수동 게인에 반영한 뒤 Locked로 돌아갑니다. AwbEnable=true이면 트리거는 효과가 없습니다. 따라서 자동 AWB를 계속 켜 두는 동작과, 수동 상태에서 한 번 재탐색하는 동작을 구분할 수 있습니다.

### AwbLocked 제거와 AwbState 상태 보고

실제 diff는 기존 AwbLocked 출력 메타데이터를 제거합니다. 입력 제어로 바꾸는 변경이 아닙니다. 상태 보고는 draft에서 core로 옮긴 AwbState가 맡고, Searching, Converged, Locked의 세 상태를 제공합니다. 별도의 비활성 상태는 제거됩니다. 시리즈 1번 패치(28387) 커밋 메시지의 입력 제어 전환 설명은 이 diff와 일치하지 않으므로, 여기서는 실제 코드의 제거·추가 내용을 기준으로 설명합니다.

수렴 기준도 아직 일치하지 않습니다. 1번 패치의 control_ids_core.yaml에 있는 AwbState 설명은 이전 프레임 대비 5%를 기준으로 쓰지만, 3번 구현 패치(28389)는 10% 범위의 프레임을 5회 누적하는 방식을 사용합니다. 구현 주석상 10%와 15% 사이 구간은 누적을 멈추고 15%를 넘으면 초기화하므로, 단순히 ‘연속 5프레임’이라고 요약하는 것도 정확하지 않습니다. 수렴 뒤에는 직전 프레임 대신 저장한 수렴 게인을 비교 기준으로 삼습니다.

시리즈에는 게인 벡터 비교를 지원하는 Vector 비교 연산자 확장도 포함됩니다. 이는 AWB의 수렴 판정을 뒷받침하는 내부 구현 변경입니다.

이 기사는 제출된 시리즈의 설계와 코드를 비교한 내용입니다. 설명과 구현의 차이가 남아 있어 확정된 API 계약이나 이미 배포된 기능으로 받아들이면 안 됩니다. Android Camera HAL 규격 자체의 변경도 아닙니다. libcamera 기반 카메라 스택을 다루는 팀에는 수동 전환 시 유지할 게인과 재탐색 완료 상태를 어떻게 표현할지 참고할 수 있는 제안입니다.

### Camera HAL/Driver 관점에서의 의미

핵심은 AWB를 끌 때 유지할 게인과 수동 상태에서의 재탐색 동작입니다. libcamera를 사용하는 구현에서는 이 동작과 상위 계층의 AWB 상태 표현을 함께 검토하되, 현재 패치의 수렴 기준을 확정된 계약으로 적용하지 않아야 합니다.

**출처**

- [libcamera AWB series patch 28387](https://patchwork.libcamera.org/patch/28387/)
- [Add AwbState metadata and AwbTrigger control](https://patchwork.libcamera.org/cover/28386/)
- [libcamera AWB series patch 28388](https://patchwork.libcamera.org/patch/28388/)
- [libcamera AWB series patch 28389](https://patchwork.libcamera.org/patch/28389/)
- [libcamera AWB series patch 28390](https://patchwork.libcamera.org/patch/28390/)
- [libcamera AWB series patch 28391](https://patchwork.libcamera.org/patch/28391/)


## 참고자료

- [Android 17 Camera Image Test Suite release notes](https://source.android.com/docs/compatibility/cts/its-release-notes-17)
- [libcamera AWB series patch 28387](https://patchwork.libcamera.org/patch/28387/)
- [Add AwbState metadata and AwbTrigger control](https://patchwork.libcamera.org/cover/28386/)
- [libcamera AWB series patch 28388](https://patchwork.libcamera.org/patch/28388/)
- [libcamera AWB series patch 28389](https://patchwork.libcamera.org/patch/28389/)
- [libcamera AWB series patch 28390](https://patchwork.libcamera.org/patch/28390/)
- [libcamera AWB series patch 28391](https://patchwork.libcamera.org/patch/28391/)
