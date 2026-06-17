# Camera HAL / SW Newsletter - 2026-06-17

이번 주 뉴스레터에서는 최근 발표된 GCC 16의 컴파일러 개선 사항과 지난 5월 릴리스된 CameraX 1.6.1의 주요 버그 수정 및 Camera ITS 자동화 테스트 문서 업데이트를 다룹니다. C++ 네이티브 빌드 워크플로우 개선부터 카메라 프레임워크 호환성 검증까지 실무 엔지니어가 주목해야 할 핵심 변경 사항을 분석합니다.



## 1. 이번 주 3줄 브리핑

- 최근 공개된 GCC 16은 개선된 오류 메시지와 SARIF 출력을 지원하여 Camera HAL 및 네이티브 드라이버 코드의 빌드/디버깅 워크플로우 효율성을 높입니다.
- 지난 5월 6일 출시된 CameraX 1.6.1은 1.6.0의 ListenableFuture 컴파일 오류를 해결하고 특정 기기(Samsung Z Fold 4, A53 등)의 YUV 왜곡 및 플래시 오동작 문제를 수정했습니다.
- 지난 5월 1일 업데이트된 Camera ITS 자동화 테스트 문서는 Honor Pad 20을 태블릿 허용 목록에 추가하고 개별 장면 실행 지침을 재정렬하여 HAL 호환성 검증 절차를 최적화했습니다.

## 지난 소식 (Catch-up)

## 2. CameraX 1.6.1 릴리스 분석: 컴파일 오류 해결 및 삼성 Z Fold 4·A53 등 기기별 HAL 호환성 버그 수정 (6주 전 릴리스)


![CameraX 1.6.1 릴리스 분석: 컴파일 오류 해결 및 삼성 Z Fold 4·A53 등 기기별 HAL 호환성 버그 수정](https://developer.android.com/static/images/social/android-developers.png?hl=zh-cn)

_이미지: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)_


_Android Developers Latest Updates - CameraX Release Notes_

지난 5월 6일 공식 출시된 CameraX 1.6.1은 빌드 차단의 원인이었던 컴파일 에러를 수정하고, 삼성 Galaxy Z Fold 4 및 A53 등 주요 기기에서 보고된 스트림 왜곡 및 플래시 오동작 문제를 해결했습니다.

이번 CameraX 1.6.1 업데이트는 개발자들의 빌드 안정성을 위협하던 'ListenableFuture 클래스 액세스 불가' 컴파일 오류를 전면 수정했습니다. 이와 함께 차기 Android 17 기기에서 알 수 없는 다이내믹 레인지 모드가 추가됨에 따라 발생할 수 있는 앱 크래시 현상을 선제적으로 방지하는 패치가 포함되었습니다. 이 크래시 방지 패치는 하위 버전인 1.5.2에도 체리픽되어 적용되었습니다.

특히 HAL 및 드라이버 엔지니어들이 주목해야 할 부분은 기기별 스트림 및 버퍼 호환성 수정 사항입니다. 삼성 Galaxy Z Fold 4에서 YUV 포맷 출력 시 이미지 왜곡을 유발하던 특정 해상도 크기가 출력 목록에서 제외되었습니다. 또한 Galaxy A53 기기에서 비디오 녹화(VideoCapture) 유스케이스가 바인딩된 상태에서 토치(torch)를 켜고 사진을 촬영할 때 간헐적으로 캡처가 실패하던 타이밍 이슈가 해결되었습니다.

그 외에도 초광각 카메라 사용 시 플래시 동기화 불일치로 인해 이미지가 어둡게 나오던 언더노출 현상과, JPEG 인코더가 마커 앞에 채움 바이트(fill bytes)를 추가할 때 0xFF 패딩 파싱 오류로 인해 캡처가 실패하던 ExifInterface 종속성 버그가 수정되었습니다. 비디오 안정화(PREVIEW_STABILIZATION)와 비디오 캡처 조합 시 Preview 유스케이스 유무에 상관없이 일관된 지원 여부를 반환하도록 API 동작도 정교화되었습니다.

### Camera HAL/Driver 관점에서의 의미

이번 릴리스는 상위 프레임워크(CameraX) 계층의 패치이지만, YUV 왜곡 해상도 배제나 토치 활성화 시의 이미지 캡처 실패 등 HAL/드라이버 계층의 타이밍 및 버퍼 구성 특성과 밀접하게 연관되어 있습니다. 특히 Z Fold 4의 YUV 왜곡이나 A53의 토치+비디오 캡처 실패는 HAL 단에서의 스트림 조합 검증 및 플래시 동기화 신호 제어가 정상적으로 동작하는지 재검토할 필요성을 시사합니다.

**출처**

- [CameraX Release Notes - CameraX 1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)

---

## 3. Camera ITS 가이드라인 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 개별 장면 실행 지침 최적화 (7주 전 릴리스)


![Modular rig and extension for Camera ITS testing](https://source.android.com/static/compatibility/cts/images/modular_rig_and_extension.png)

_이미지: [AOSP Site Updates](https://source.android.com/docs/compatibility/cts/camera-its-box)_


_AOSP Site Updates - Test camera images using automation_

지난 5월 1일 업데이트된 AOSP Camera ITS(Image Test Suite) 문서에 따르면, 자동화 테스트용 태블릿 허용 목록에 Honor Pad 20이 추가되었으며, 각 테스트 장면의 실행 지침이 재정렬되어 검증 효율성이 개선되었습니다.

Camera ITS는 Android 기기의 카메라 HAL 구현이 호환성 정의 문서(CDD) 요구 사항을 충족하는지 검증하는 핵심 자동화 도구입니다. 이번 문서 업데이트를 통해 테스트 차트 표시용 태블릿 허용 목록에 Honor Pad 20이 공식 추가되어, 테스트 장비를 구성하는 엔지니어들의 선택 폭이 넓어졌습니다.

또한 개별 ITS 장면(scene)을 실행할 때의 세부 지침이 재정렬 및 업데이트되었습니다. 이는 테스트 실행 중 발생할 수 있는 오동작이나 불일치를 줄이고, 조명 및 정렬 상태에 따른 테스트 결과의 신뢰성을 극대화하기 위한 조치입니다.

HAL 검증을 담당하는 엔지니어들은 업데이트된 지침에 따라 자사 테스트 환경의 태블릿 설정과 장면 실행 스크립트를 재점검하여, 불필요한 테스트 실패(false negative)를 방지하고 검증 파이프라인을 최적화해야 합니다.

### Camera HAL/Driver 관점에서의 의미

Camera ITS 문서 업데이트는 HAL 자체의 코드 변경을 유발하지는 않지만, CTS/VTS 호환성 검증 통과 여부를 결정짓는 중요한 기준입니다. 특히 태블릿 허용 목록의 변화와 장면 실행 지침의 재정렬은 자사 검증 랩(lab)의 자동화 장비 구성 및 스크립트 실행 순서에 즉각 반영되어야 합니다.

**출처**

- [Test camera images using automation](https://source.android.com/docs/compatibility/cts/camera-its-box)


## 참고자료

- [CameraX Release Notes - CameraX 1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [Test camera images using automation](https://source.android.com/docs/compatibility/cts/camera-its-box)
