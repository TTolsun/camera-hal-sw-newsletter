# 2026 W41 (10.05 ~ 10.11)





<a id="issue-briefing"></a>

## 1. 이번 주 핵심

이번 주에는 AOSP의 조건부 카메라 mute 제안, Qualcomm CAMSS ISP 파라미터 uAPI 문서 리뷰, Claude Haiku 5.5 발표를 살펴봅니다. 카메라 관련 두 기사는 아직 제안·리뷰 단계이므로 적용 조건과 확인할 사항을 구분했습니다. Haiku는 반복 코딩 작업을 맡길 보조 모델로 소개하고, 실제 업무에서 품질·비용·응답 시간을 비교하는 방법을 제안합니다.

- [AOSP cameraserver, 프라이버시 토글 시 조건부 mute를 유지하는 패치 제안](#article-aosp-cameraserver-mute)

  프라이버시 토글 시험을 UID 가시성 및 camera mute 지원 여부로 나누고, 조건을 만족할 때만 연결을 유지하는지 확인해야 합니다. 나머지 클라이언트와 UID 비활성 경로의 차단도 함께 검증할 대상입니다.

- [Claude Haiku 5.5: 반복 코딩 작업을 위한 저비용 보조 모델](#article-claude-haiku-5-5)

  개발 도구 담당자는 빌드 오류 로그 요약·분류 표본으로 현재 모델과 Haiku 5.5를 비교할 수 있습니다. 정확도와 누락률을 유지하는 범위에서 비용·응답 시간 개선 여부를 측정하는 것이 도입 판단의 기준입니다.

- [Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의](#article-qualcomm-camss-isp-uapi-v10)

  Qualcomm platform 커널 드라이버 연동 시 qcom-camss-config.h uAPI 구조체 및 v4l2_isp 공통 헤더 변경 사항을 사전 점검해야 합니다.




<a id="article-aosp-cameraserver-mute"></a>

## 2. AOSP cameraserver, 프라이버시 토글 시 조건부 mute를 유지하는 패치 제안

_AOSP Gerrit (camera changes under review)_

카메라 mute를 지원하고 화면에 보이는 UID의 클라이언트도 프라이버시 토글 직후 강제 종료되는 문제를 고치려는 패치가 AOSP에 제안되었습니다.

### Camera HAL/Driver 관점에서의 의미

프라이버시 토글 시험을 UID 가시성 및 camera mute 지원 여부로 나누고, 조건을 만족할 때만 연결을 유지하는지 확인해야 합니다. 나머지 클라이언트와 UID 비활성 경로의 차단도 함께 검증할 대상입니다.


![](../../assets/images/fallback/newsletter-default.svg)


쉽게 말해, 카메라 영상을 가리는 것과 앱의 카메라 연결을 끊는 것을 구분하려는 제안입니다. 화상회의 중 카메라 접근을 차단하는 상황을 예로 들면, 화면에 보이는 앱이고 기기가 camera mute를 지원할 때는 영상을 차단하면서 연결을 유지하고, 그 밖에는 기존처럼 연결을 끊습니다. 여기서 mute는 마이크 음소거가 아니라 카메라 영상 차단을 뜻합니다. 프라이버시 보호를 유지하면서 불필요한 연결 종료를 줄이려는 제안이며, 아직 반영이 완료된 기능은 아닙니다.

10월 7일 android17-release 브랜치에 제출된 Gerrit 변경 4348947은 CameraService.cpp의 프라이버시 처리 경로를 수정하는 제안입니다. 확인한 revision은 아직 NEW 상태로, Android에 반영이 완료된 변경은 아닙니다.

커밋 메시지는 같은 프라이버시 토글에서 SensorPrivacyManager 콜백과 AppOpsManager의 opChanged()가 서로 다른 binder 경로로 실행된다고 설명합니다. opChanged()는 UID 가시성과 camera mute 지원 여부를 검사하지만, 다른 경로의 무조건적인 block()이 먼저 실행되면 ERROR_CAMERA_DISABLED를 전달하며 클라이언트를 끊는다는 것이 패치 작성자가 지적한 문제입니다.

### mute 적용 조건과 유지되는 차단 경로

diff는 blockAllClients()와 blockPrivacyEnabledClients()에 같은 조건 검사를 추가합니다. UID의 프로세스 상태가 PROCESS_STATE_BOUND_TOP 이하이고 supportsCameraMute()가 참일 때만 setCameraMute(true)를 호출하며, 그렇지 않으면 기존 block()을 유지합니다. 커밋 메시지는 mute 지원 판단이 ANDROID_SENSOR_AVAILABLE_TEST_PATTERN_MODES와 관련됨을 설명합니다.

UID가 비활성 상태가 될 때 사용하는 blockClientsForUid()는 이 패치에서 바꾸지 않습니다. 따라서 모든 앱의 카메라 세션을 유지하는 변경으로 해석하면 안 됩니다. 기기에서 race 해소나 성능 개선을 실측한 결과는 제공되지 않았으므로, 패치의 의도와 실제 검증 결과도 구분해야 합니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)

---

<a id="article-claude-haiku-5-5"></a>

## 3. Claude Haiku 5.5: 반복 코딩 작업을 위한 저비용 보조 모델

_Anthropic News 공식 발표_

빌드 오류 요약이나 단순 분류처럼 반복되는 작업을 큰 모델에 모두 맡길 필요가 줄어듭니다. Anthropic은 이런 작업과 코딩 보조 에이전트를 겨냥한 Haiku 5.5를 발표했습니다.

### Camera HAL/Driver 관점에서의 의미

개발 도구 담당자는 빌드 오류 로그 요약·분류 표본으로 현재 모델과 Haiku 5.5를 비교할 수 있습니다. 정확도와 누락률을 유지하는 범위에서 비용·응답 시간 개선 여부를 측정하는 것이 도입 판단의 기준입니다.


![Anthropic 소형 AI 모델 Claude Haiku 5.5 발표 및 네이티브 개발 워크플로 활용](https://www-cdn.anthropic.com/images/4zrzovbb/website/89e9b0fbfe0181f6ca565d913686ce8e49b5e9c2-1200x630.jpg)

_이미지: [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)_


10월 7일 발표된 Claude Haiku 5.5는 많은 요청을 빠르게 처리하면서 비용을 줄이는 데 초점을 둔 소형 언어 모델입니다. 공식 발표는 요약, 대화 내용 압축, 데이터베이스 질의, 분류를 대표적인 반복 작업으로 들고 있습니다.

코딩에서는 Opus 5.5나 Sonnet 5.5와 함께 보조 에이전트로 쓰는 구성을 제시합니다. 큰 모델이 전체 작업을 관리하고, 작게 나눌 수 있는 작업을 Haiku에 맡기는 방식으로 이해할 수 있습니다. 어떤 업무를 분리할지는 팀의 실제 입력과 결과 품질로 판단해야 합니다.

### 비용과 정확도를 함께 조절하는 선택지

Anthropic은 Haiku 4.5보다 실행 비용이 평균 약 75% 낮다고 설명합니다. 이는 공급사가 제시한 평균 비교이며, 모든 요청이나 우리 팀의 월간 비용이 똑같이 줄어든다는 보장은 아닙니다. Haiku 계열에 처음 도입된 effort 설정은 비용과 답변 성능 사이의 선택을 조절하는 수단입니다.

Camera HAL 개발 팀에서는 빌드 오류 로그의 요약·분류를 시험 대상으로 삼을 수 있습니다. 이는 편집 제안이며 원문이 Camera HAL 로그에서 성능을 검증했다는 뜻은 아닙니다. 같은 표본을 현재 모델과 Haiku에 주고, 정답 일치율과 중요한 오류의 누락률, 요청당 비용, 응답 시간을 함께 비교하면 도입 여부를 판단할 수 있습니다.

이번 소식의 실무 가치는 반복 작업을 별도 모델에 맡길 선택지가 생겼다는 점입니다. 성능이 충분한 작업부터 나누되, 복잡한 원인 분석까지 일괄 전환할 근거로 사용해서는 안 됩니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)

---

<a id="article-qualcomm-camss-isp-uapi-v10"></a>

## 4. Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의

_lore.kernel.org linux-media list_

Qualcomm CAMSS 하위 시스템의 ISP 파라미터를 제어하기 위한 V4L2 메타데이터 포맷 문서화 패치 시리즈가 v10 리비전으로 검토되고 있습니다.

### Camera HAL/Driver 관점에서의 의미

Qualcomm platform 커널 드라이버 연동 시 qcom-camss-config.h uAPI 구조체 및 v4l2_isp 공통 헤더 변경 사항을 사전 점검해야 합니다.


![](../../assets/images/fallback/newsletter-default.svg)


9월 25일 제출된 PATCH v10 문서화 패치에 대해 10월 6일 linux-media 메일링 리스트에서 리뷰 의견이 올라왔습니다. 이 패치는 Qualcomm CAMSS ISP 파라미터 메타데이터 형식인 V4L2_META_FMT_QCOM_ISP_PARAMS 제안을 포함합니다. 이 포맷은 공통 V4L2 확장 가능 ISP 파라미터 구조를 기반으로 설계되었습니다.

주요 구성 요소인 Offline Processing Engine(OPE)의 ope_params 노드가 이 메타데이터 형식을 가장 먼저 활용합니다. 메타데이터 버퍼 내부에 블록 단위 구조체를 배치하여 화이트 밸런스 게인, 색상 보정 행렬, 감마 곡선 등의 하드웨어 모듈을 설정하는 방식입니다.

### uAPI 구조체와 헤더 호환성 논의

리뷰 과정에서 공통 ISP 구조체인 v4l2_isp_buffer 및 v4l2_isp_block_header 적용에 대한 의견이 교환되었습니다. 구형 레거시 드라이버 호환용 구조체 대신 공통 구조체를 사용하는 방향으로 커널 내 표준화 작업이 지속 진행되고 있습니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)


## 참고 / 더 읽을거리

- [\[PATCH 0/3\] media: Add GalaxyCore GC5035 and GC8034 sensor drivers](<https://lore.kernel.org/linux-media/20261009072733.39877-1-nicfio@gmail.com/>) — lore.kernel.org linux-media list (2026-10-09) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH 0/2\] media: i2c: Add OmniVision OV3660 image sensor driver](<https://lore.kernel.org/linux-media/20261008160650.73927-1-tien.nguyenminh@embeddedlinux.blog/>) — lore.kernel.org linux-media list (2026-10-08) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v1 0/2\] media: support upside-down camera mounting](<https://lore.kernel.org/linux-media/20261007034914.1654831-1-jimmy.su@intel.com/>) — lore.kernel.org linux-media list (2026-10-07) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v3 0/2\] media: rkisp1: Add YUV bypass support for rkisp1](<https://lore.kernel.org/linux-media/20261006-media-rkisp1-add-yuv-bypass-support-for-rkisp1-v3-0-93d3d43991a0@ideasonboard.com/>) — lore.kernel.org linux-media list (2026-10-06) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)
- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)
- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)
