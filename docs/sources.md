# Newsletter Sources

이 문서는 매주 뉴스 후보를 찾을 때 우선 확인할 출처 목록입니다. 뉴스레터 본문에는 각 항목별 `Sources`를 붙이고, 마지막 `References`에는 전체 링크를 모읍니다.

## AOSP Camera Watch

### Primary Sources

- Android Developers Blog: https://android-developers.googleblog.com/
- Android Developers News: https://developer.android.com/news
- Android CameraX release notes: https://developer.android.com/jetpack/androidx/releases/camera
- Android version release notes: https://developer.android.com/about/versions
- AOSP Camera documentation: https://source.android.com/docs/core/camera
- AOSP Camera HAL documentation: https://source.android.com/docs/core/camera/camera3
- AOSP Ultra HDR documentation: https://source.android.com/docs/core/camera/ultra-hdr

### Selection Rule

- Android Camera API, CameraX, AOSP Camera, HAL3 contract와 직접 연결되는 항목을 우선합니다.
- request/result, metadata, stream, buffer lifecycle 영향이 설명 가능한 항목을 우선합니다.
- HAL capability, session configuration, capture request/result, vendor tag, CTS/VTS 영향으로 연결할 수 있는 항목을 우선합니다.

## Tech Trend Radar

### Primary Sources

- ISO C++ Blog: https://isocpp.org/blog
- LLVM release notes: https://releases.llvm.org/
- Clang release notes: https://clang.llvm.org/docs/ReleaseNotes.html
- GitHub Blog Changelog: https://github.blog/changelog/
- OpenAI News: https://openai.com/news/
- Google AI for Developers Blog: https://developers.googleblog.com/
- C++ Reference: https://cppreference.com/

### Selection Rule

- Camera HAL / Android Camera 개발 생산성에 영향을 줄 수 있는 C++, LLVM/Clang, GitHub, AI 개발 도구 소식을 우선합니다.
- 빌드, 디버깅, 테스트, 코드 리뷰, 문서화, 자동화 품질을 개선할 수 있는 항목을 우선합니다.

## C++ / AI 실전 팁

### Primary Sources

- 내부 Camera HAL 코드 리뷰 사례
- 내부 Camera HAL 로그 분석 사례
- CTS / VTS / vendor test 실패 사례
- Perfetto tracing 사례: https://perfetto.dev/docs/
- GoogleTest documentation: https://google.github.io/googletest/
- clang-tidy documentation: https://clang.llvm.org/extra/clang-tidy/

### Selection Rule

- 바로 실험하거나 팀 작업 규칙으로 바꿀 수 있는 항목을 우선합니다.
- HAL 로그, 테스트 실패, 성능 추적, 코드 품질 개선과 연결되는 항목을 우선합니다.

## Selection Rules

- 공식 문서나 release note를 우선 사용합니다.
- 각 주요 항목에는 `배경지식`과 `Camera HAL에서 확인해볼 아이템`을 반드시 포함합니다.
- 가능하면 그림이나 block diagram을 포함합니다.
- 사실과 추정은 구분해서 씁니다.
- 출처가 불명확한 내용은 뉴스 항목으로 채택하지 않습니다.

## Drop Rules

아래 항목은 뉴스레터에 넣지 않습니다.

- Camera HAL / Android Camera / C++ / AI 개발 생산성과 연결하기 어려운 일반 IT 뉴스
- 공식 문서나 신뢰 가능한 출처로 확인하기 어려운 내용
- 출처가 불명확한 내용
- 제품 홍보성 내용이 대부분이고 기술 설명이 부족한 글
- 우리 팀 Action Item으로 연결할 수 없는 내용
- 지난 호와 거의 같은 내용
- 제목은 자극적이지만 HAL 관점 해석이 어려운 내용
