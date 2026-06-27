const assert = require('node:assert/strict');
const test = require('node:test');

// #726: editorial-plan 단계가 기사를 어느 "계층(layer)"으로 보는지에 대한 과대해석 방지 가드를
// 고정한다. 과대해석은 거의 항상 한 형태다 — Camera HAL보다 아래·옆·위 계층(sensor·ISP·driver,
// toolchain·CI, framework·app, 산업)의 신호를 HAL 직접 영향으로 부풀리는 것.
//
// 중요: 프롬프트는 계층마다 전용 경계 "문장"을 두지 않는다. 과대해석 방지는 다음으로 이뤄진다.
//  - 추론 차원(axis) 목록(newsletter-prompts.js:133): 어느 계층인지 식별하는 축. taxonomy 테스트가 잠근다.
//  - 공유 경계 문장 1(:134): "근거 없으면 direct_hal_impact 기본 false" + 계층별 과대해석 예시
//    (Samsung·S.LSI·Exynos / 상용 제품·양산 / 성능·화질 개선)을 "확대 판단하지 마세요"로 금지.
//  - 공유 경계 문장 2(:136): entity-confusion + source_limitations 예시(RAW-only, ISP bypass 등).
// 아래 CASES는 그 공유 가드를 각 가드가 막는 계층 관점에서 anchor한다 — 계층 전용 문장이 아니라
// 공유 문장의 계층별 단서(예시 명사)를 그 금지절과 함께 고정한다. 그래서 문장이 약화/반전되면 실패한다.
//
// 보장 / 비보장(혼동 금지):
//  - 보장: 모델에 보내는 prompt가 위 추론 차원과 과대해석 경계 문구를 그대로 담고 있음.
//  - 보장 못 함: 실제 Gemini가 임의 기사를 올바른 계층으로 분류하는지. 분류의 의미적 정확성은 LLM
//    영역이며 사람이 docs/article-quality-checklist.md로 판정한다. green은 "가드 문구 온전"이지
//    "모델이 올바르게 분류함"이 아니다.
//
// 후처리 불변식(direct_hal_impact boolean 강제, coverage strip, 식별자 없는 항목 제거, 빈 plan
// fail-fast, 빈 문자열 필터)은 토픽과 무관하며 editorial-plan-stage.test.js가 이미 잠근다. 여기서
// 중복 재검증하지 않고, 그 파일이 보지 않는 prompt의 계층 가드 표면만 검사한다.

const { editorialPlanSystemPrompt } = require('../../publish/orchestrator-stage-prompts');

// 각 case는 #726이 지정한 5개 기사 유형(= 카메라 스택의 한 계층)이며, 그 계층의 과대해석을 막는
// 실제 경계 문구(예시 명사 + 금지절 또는 source_limitations 단서)로 매핑된다. 추론 차원 토큰은
// 여기서 중복 assert하지 않고 아래 taxonomy 테스트에만 둔다.
const CASES = [
  {
    name: 'Case 1 — Linux media / image-sensor 패치 (HAL 아래 계층): 한계(RAW-only/review) 보존',
    guardrails: [
      /RAW-only\/limited mode/ // source_limitations 예시 — 센서 RAW-only 한계를 보존하라는 단서
    ]
  },
  {
    name: 'Case 2 — ISP 드라이버 패치 (HAL 아래/옆 계층): 근거 없는 Exynos 양산 단정 금지',
    guardrails: [
      /Samsung, S\.LSI, Exynos/, // 과대해석 예시(vendor 양산)
      /확대 판단하지 마세요/,     // 예시를 금지절에 anchor — 문장이 반전되면 실패
      /ISP bypass/               // source_limitations 예시 — ISP bypass 한계 보존
    ]
  },
  {
    name: 'Case 3 — Android Camera API / CameraX / CTS (HAL 위 계층): 근거 없는 direct_hal_impact 승격 금지',
    guardrails: [
      // 프롬프트에 framework→HAL 전용 경계 문장은 없다. framework/app 신호의 HAL 승격은 일반 원칙
      // "근거 없으면 기본 false"가 막는다 — 그 원칙 문구를 anchor한다(editorial-plan-stage.test.js는
      // "...때만 true"만 보고 "기본은 false"는 안 본다).
      /기본은 false/
    ]
  },
  {
    name: 'Case 4 — 컴파일러 / C++ / CI (HAL 옆 계층): 근거 없는 runtime 성능 향상 단정 금지',
    guardrails: [
      /성능·화질 개선/,      // 과대해석 예시(런타임 성능/화질)
      /확대 판단하지 마세요/  // 예시를 금지절에 anchor
    ]
  },
  {
    name: 'Case 5 — 제품 / 산업 뉴스 (HAL 밖): 근거 없는 상용 제품 확대 금지',
    guardrails: [
      /상용 제품, 양산/,     // 과대해석 예시(상용 제품·양산)
      /확대 판단하지 마세요/  // 예시를 금지절에 anchor
    ]
  }
];

for (const testCase of CASES) {
  test(`editorialPlanSystemPrompt는 ${testCase.name} 가드를 담는다`, () => {
    const prompt = editorialPlanSystemPrompt();
    for (const guardrail of testCase.guardrails) {
      assert.match(prompt, guardrail);
    }
  });
}

test('editorialPlanSystemPrompt는 계층 추론 차원(taxonomy) 목록을 모두 보존한다', () => {
  // 계층 taxonomy가 줄면 모델이 그 계층을 식별할 추론 차원을 잃는다 — #726이 막으려는 드리프트.
  // 추론 차원(axis) 토큰을 검사하는 곳은 여기 한 곳뿐이다(CASES는 경계 문구만 anchor).
  const prompt = editorialPlanSystemPrompt();
  for (const dimension of [
    /직접 Android Camera HAL 영향/,
    /Android framework·API 관련/,
    /Linux media·V4L2·kernel lower-stack 참고/,
    /sensor·ISP driver 참고/,
    /native C\+\+·toolchain·CI 관련/,
    /산업·제품 trend/,
    /약한 관련성/
  ]) {
    assert.match(prompt, dimension);
  }
});
