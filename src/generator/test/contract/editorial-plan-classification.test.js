const assert = require('node:assert/strict');
const test = require('node:test');

// #726: editorial-plan 단계가 기사를 어느 "계층(layer)"으로 보는지에 대한 과대해석 방지 가드를
// 고정한다. 과대해석은 거의 항상 한 형태다 — Camera HAL보다 아래·옆·위 계층(sensor·ISP·driver,
// toolchain·CI, framework·app, 산업)의 신호를 HAL 직접 영향으로 부풀리는 것. editorialPlanPrompt()는
// 계층 taxonomy와 계층별 경계 문구로 이를 막는다. 이 파일은 그 prompt 표면이 살아 있는지 검사한다.
//
// 이 파일이 보장하는 것(가드레일 표면)과 보장하지 못하는 것을 분명히 한다:
//  - 보장: 모델에 보내는 prompt가 계층 taxonomy와 계층별 과대해석 경계 문구를 그대로 담고 있음.
//  - 보장 못 함: 실제 Gemini가 임의의 센서/ISP/CameraX/툴체인/제품 기사를 올바른 계층으로
//    분류하는지. 분류의 의미적 정확성은 LLM 영역이며, 사람이 docs/article-quality-checklist.md로
//    판정한다. 이 테스트는 canned 응답이 아니라 prompt 문자열만 보므로, green은 "가드 문구 온전"이지
//    "모델이 올바르게 분류함"이 아니다.
//
// 후처리 불변식(direct_hal_impact boolean 강제, coverage 권한 strip, 식별자 없는 항목 제거,
// 빈 plan fail-fast, 빈 문자열 필터)은 토픽과 무관하며 editorial-plan-stage.test.js가 이미 잠근다.
// 여기서 중복으로 재검증하지 않고, 그 파일이 보지 않는 prompt의 계층 가드 표면만 검사한다.

const { editorialPlanSystemPrompt } = require('../../publish/orchestrator-stage-prompts');

// 각 case는 #726이 지정한 5개 기사 유형(= 카메라 스택의 한 계층)이며, 그 계층의 과대해석을 막는,
// editorial-plan-stage.test.js가 아직 검사하지 않는 prompt 가드 문구로 매핑된다.
const CASES = [
  {
    name: 'Case 1 — Linux media / image-sensor 패치 (HAL 아래 계층): 직접 HAL 변경 단정 금지',
    layerGuardrails: [
      /Linux media·V4L2·kernel lower-stack 참고/, // sensor/driver는 lower-stack 참고로 본다
      /sensor·ISP driver 참고/,
      /RAW-only\/limited mode/ // source_limitations로 한계(RAW-only)를 보존
    ]
  },
  {
    name: 'Case 2 — ISP 드라이버 패치 (HAL 아래/옆 계층): Exynos 양산 단정 금지',
    layerGuardrails: [
      /sensor·ISP driver 참고/,
      /Samsung, S\.LSI, Exynos/, // source 근거 없는 vendor 양산 확대 금지
      /확대 판단하지 마세요/,
      /ISP bypass/ // source_limitations로 한계 보존
    ]
  },
  {
    name: 'Case 3 — Android Camera API / CameraX / CTS (HAL 위 계층): app/framework vs vendor HAL 구분',
    layerGuardrails: [
      /Android framework·API 관련/ // framework·API는 별도 추론 차원으로 분리
    ]
  },
  {
    name: 'Case 4 — 컴파일러 / C++ / CI (HAL 옆 계층): runtime 성능 향상 단정 금지',
    layerGuardrails: [
      /native C\+\+·toolchain·CI 관련/,
      /성능·화질 개선/ // 근거 없는 성능 개선으로 확대 금지(같은 경계 문구)
    ]
  },
  {
    name: 'Case 5 — 제품 / 산업 뉴스 (HAL 밖): 구체 trend 설명 또는 강등',
    layerGuardrails: [
      /산업·제품 trend/,
      /상용 제품, 양산/, // 상용 제품으로 확대 금지
      /약한 관련성/ // 약하면 강등할 추론 차원이 존재
    ]
  }
];

for (const testCase of CASES) {
  test(`editorialPlanSystemPrompt는 ${testCase.name}의 과대해석 가드를 담는다`, () => {
    const prompt = editorialPlanSystemPrompt();
    for (const guardrail of testCase.layerGuardrails) {
      assert.match(prompt, guardrail);
    }
  });
}

test('editorialPlanSystemPrompt는 계층 추론 차원(taxonomy) 목록을 모두 보존한다', () => {
  // 계층 taxonomy가 줄면 모델이 그 계층을 식별할 추론 차원을 잃는다 — #726이 막으려는 드리프트.
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
