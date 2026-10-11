# 2026 W41 (10.05 ~ 10.11)

이번 주 뉴스레터에서는 Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의 소식을 전해드립니다. Qualcomm CAMSS 하위 시스템의 ISP 파라미터를 제어하기 위한 V4L2 메타데이터 포맷 문서화 패치 시리즈가 v10 리비전으로 검토되고 있으니 많은 관심 부탁드립니다.



## 1. 이번 주 기사

- Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의

## 2. Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의


![Qualcomm CAMSS ISP 파라미터 uAPI 포맷 문서화 v10 패치 논의 image](../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

Qualcomm CAMSS 하위 시스템의 ISP 파라미터를 제어하기 위한 V4L2 메타데이터 포맷 문서화 패치 시리즈가 v10 리비전으로 검토되고 있습니다.

10월 6일 linux-media 메일링 리스트에 제출된 PATCH v10 패치 패밀리는 Qualcomm CAMSS ISP 파라미터 메타데이터 형식인 V4L2_META_FMT_QCOM_ISP_PARAMS 제안을 포함합니다. 이 포맷은 공통 V4L2 확장 가능 ISP 파라미터 구조를 기반으로 설계되었습니다.

주요 구성 요소인 Offline Processing Engine(OPE)의 ope_params 노드가 이 메타데이터 형식을 가장 먼저 활용합니다. 메타데이터 버퍼 내부에 블록 단위 구조체를 배치하여 화이트 밸런스 게인, 색상 보정 행렬, 감마 곡선 등의 하드웨어 모듈을 설정하는 방식입니다.

### uAPI 구조체와 헤더 호환성 논의

리뷰 과정에서 공통 ISP 구조체인 v4l2_isp_buffer 및 v4l2_isp_block_header 적용에 대한 의견이 교환되었습니다. 구형 레거시 드라이버 호환용 구조체 대신 공통 구조체를 사용하는 방향으로 커널 내 표준화 작업이 지속 진행되고 있습니다.

### Camera HAL/Driver 관점에서의 의미

Qualcomm platform 커널 드라이버 연동 시 qcom-camss-config.h uAPI 구조체 및 v4l2_isp 공통 헤더 변경 사항을 사전 점검해야 합니다.

**출처**

- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)


## 참고 / 더 읽을거리

- [\[PATCH 0/3\] media: Add GalaxyCore GC5035 and GC8034 sensor drivers](<https://lore.kernel.org/linux-media/20261009072733.39877-1-nicfio@gmail.com/>) — lore.kernel.org linux-media list (2026-10-09) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH 0/2\] media: i2c: Add OmniVision OV3660 image sensor driver](<https://lore.kernel.org/linux-media/20261008160650.73927-1-tien.nguyenminh@embeddedlinux.blog/>) — lore.kernel.org linux-media list (2026-10-08) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v1 0/2\] media: support upside-down camera mounting](<https://lore.kernel.org/linux-media/20261007034914.1654831-1-jimmy.su@intel.com/>) — lore.kernel.org linux-media list (2026-10-07) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH v3 0/2\] media: rkisp1: Add YUV bypass support for rkisp1](<https://lore.kernel.org/linux-media/20261006-media-rkisp1-add-yuv-bypass-support-for-rkisp1-v3-0-93d3d43991a0@ideasonboard.com/>) — lore.kernel.org linux-media list (2026-10-06) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)
