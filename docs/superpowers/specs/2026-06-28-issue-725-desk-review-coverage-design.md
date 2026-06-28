# #725 Desk Review 커버리지 갭 해소 — 설계

> 상태: 설계 승인됨(2026-06-28). 구현은 별도 PR. **머지는 프로덕션 A/B run 검증 후**(LLM 동작 변경이므로 자율 머지 금지).

## 1. 배경과 현재 상태 분석

이슈 #725는 "현재 `publicArticleJudge`가 pass/fail 판정만 하고 rewrite가 없다"는 전제로 작성됐으나, 코드 재검증 결과 그 전제는 **부분 드리프트**다.

- `validatePublicArticleJudgeOrRepair`(`orchestrator-public-article-judge.js`)에는 이미 **judge → semantic repair(LLM rewrite) → re-judge 루프**가 있다. `repairEditorSemanticWithLlm`이 rewrite를 수행하며, 프롬프트에 "**source fact를 만들지 마라**", "validation에 필요한 local edit가 아니면 한국어 prose를 보존하라"는 안전제약이 이미 있다.
- 다만 그 rewrite는 **schema/validation 오류**(sections/claims/blocked_context/briefing)에 한정되고, #700 §5의 **편집-품질 실패모드**는 다루지 않는다.
- 현재 judge(`publicArticleJudgePrompt`)는 section마다 4개 축을 평가한다: `public_article_pass`, `reader_checkpoints_pass`, `source_boundary_pass`, `public_prose_pass`. 이 4개가 §5 실패모드 중 **직접영향 과대(source_boundary)·generic summary(reader_checkpoints)·내부 운영언어 노출(public_prose)** 약 3개를 이미 커버한다.

### 정확한 갭

#700 §4(Desk Review)/§5(Quality Gate)가 요구하는 검사 중, 현재 judge가 **명시적으로 안 보는** 4개:

1. **대상 기술 설명** — 기사 prose가 대상(드라이버/센서/ISP/API/툴)이 무엇인지 설명했는가.
2. **레이어 구분** — Android HAL / framework·API / Linux kernel / V4L2 / sensor driver / ISP driver / toolchain / product trend를 혼동 없이 구분했는가.
3. **source 한계 보존** — source가 명시한 한계(RAW-only, ISP bypass, 제한된 모드, review 상태 등)를 prose가 보존했는가.
4. **주체 attribution** — 센서 제조사 / 패치 작성자 / 플랫폼 벤더 / 테스트 보드 / 실제 기기를 혼동하지 않았는가.

### 핵심 발견: judge는 이미 충분한 입력을 받는다

`publicArticleJudgeInput`(`orchestrator-judge-helpers.js`)이 section마다 넘기는 입력에는 이미 **prose(`public_article`), `reporter_evidence`(`api_or_component`/`behavior_change`/`evidence_notes`/`do_not_overstate`), section `do_not_overstate`·`do_not_claim`, `claims`(overclaim_risk 포함), `relevance_bucket`** 가 들어 있다. 이것이 desk 4축 판정의 **충분한 근거**다 — 대상 기술(api_or_component/behavior_change), 과장 경계(do_not_overstate/do_not_claim/overclaim_risk), 레이어/주체(relevance_bucket + 근거)를 모두 담는다.

따라서 desk 검사를 위해 editorial-plan을 judge에 새로 thread할 필요가 없다(불필요한 plumbing 회피 = 정책 심플). plan의 `target_description`/`source_limitations`는 더 정밀한 정답지가 될 수 있으나, 3개 호출부를 통과하는 배선 비용 대비 이득이 낮아 본 슬라이스에서는 채택하지 않는다(필요 시 후속).

### 중복 없음

- **fact-check**: 사실 정확성/claim 검증. 데스크 4축(편집 반영 충실도)과 책임 분리.
- **quality 감점**: 구조/source-binding. 4축을 다루지 않음(코드 확인).
- 따라서 4축은 기존 검사와 중복되지 않는다(이슈의 "중복 제거" 제약 충족).

## 2. 목표와 범위

- **목표(승인됨)**: 커버리지 갭 해소 — 위 4개 편집 실패모드를 desk가 잡아 repair가 고치게 한다. 성공기준 = 그 결함이 발행물에 나가지 않는다.
- **비범위**: 독립 desk-review stage 신설(아님), #724(coverage_decision을 composition에 반영, 별개 이슈·핵심 원칙 변경), 코드-우선 편집 합성.

## 3. 설계 결정 (모두 승인됨)

| 결정 | 선택 | 근거 |
| --- | --- | --- |
| 접근 | 기존 judge+repair 확장(새 stage 없음) | 인프라/안전제약 재사용, 범위 최소 |
| 심각도 | **repair 시도 후 advisory** | 새 축은 hard-block 안 함 → 발행 안정성 보존. §5 "reject/regenerate, 자기합성 금지" 준수 |
| repair 트리거 | 편집 issue도 트리거 | "편집 결함을 실제로 고친다"에 충실 |

### 정책 심플 원칙 (비협상)

- **새 hard-fail 조건 0개.** 데스크 4축은 `publicArticleJudgeBlockingIssues`에 절대 들어가지 않는다. 이 비차단은 **코드 불변식**이다(프롬프트의 "P3" 라벨에 의존하지 않음): issue의 `field`가 desk_* 이면 severity와 무관하게 차단에서 제외하고 advisory로만 모은다. LLM이 severity를 잘못 라벨해도 hard-block 되지 않는다.
- **새 config threshold / policy JSON 키 0개.** 기존 `severity: P3` = advisory 관례를 그대로 쓴다.
- **schema 변경 0개 / 새 judge-input plumbing 0개.** desk issue는 기존 `issues[]`(free string `field`/`severity`)로 표현하고, 판정은 기존 judge 입력으로 한다.
- **새 stage / 새 LLM 호출 타입 0개.** 기존 judge 호출과 기존 repair 호출에 흡수한다. 단 결정 ④에 따라 편집 issue가 repair를 트리거하므로, blocking 없이 편집 issue만 있던 기사는 repair를 1회 더 탈 수 있다(비용 수용됨, 4.3 참조).
- 기존 repair 안전제약("source fact 만들지 마라", prose 보존)을 그대로 재사용한다.

## 4. 컴포넌트와 데이터 흐름

세 군데만 변경한다.

### 4.1 Judge 입력 — 변경 없음

`publicArticleJudgeInput`은 그대로 둔다. desk 4축은 이미 전달되는 입력(`public_article` prose, `reporter_evidence`, `do_not_overstate`, `do_not_claim`, `claims`, `relevance_bucket`)으로 판정한다. **새 입력 plumbing 0, schema 변경 0.**

### 4.2 Judge 프롬프트 — `publicArticleJudgePrompt` (`newsletter-prompts.js`)

기존 프롬프트에 데스크 4축 평가 지침을 추가한다. judge는 **여전히 "판정만, rewrite 금지"** 다. 기존 입력(prose + reporter_evidence + do_not_overstate/do_not_claim + claims + relevance_bucket)을 근거로 본다.

- 4축: `desk_target_explanation` / `desk_layer_distinction` / `desk_source_limitations` / `desk_subject_attribution`.
- 위반 시 `issues[]`에 **`severity: "P3"`**, `field`는 위 4개 중 하나, `reason`/`suggested_fix` 작성. (`publicArticleJudgeIssue.field`/`severity`는 free string이라 schema 변경 불필요.)
- 근거가 부족하면(예: source가 대상 설명을 안 줌) 위반으로 단정하지 말고 보수적으로 통과시킨다(자기합성 유도 금지).
- 단어 매칭 금지(기존 의미 기반 판정 원칙 유지).

### 4.3 흐름 — `orchestrator-public-article-judge.js` + `orchestrator-judge-helpers.js`

- 헬퍼 추가 `deskAdvisoryIssues(report)` = `field`가 데스크 4축 중 하나이고 `severity === 'P3'`인 section issue 목록. (기존 `publicArticleJudgeBlockingIssues`는 P1/P2만 보므로 데스크 P3는 **자동으로 non-blocking**.)
- `runPublicArticleJudge` 반환에 `deskAdvisory` 목록을 포함한다(보고/기록용).
- `validatePublicArticleJudgeOrRepair`:
  1. repair 트리거 조건을 `blockingIssues.length > 0 **OR** deskAdvisory.length > 0` 로 확장.
  2. repair 입력 validationError에 데스크 issue를 함께 실어 보낸다(고칠 목록에 포함).
  3. repair + re-judge 후:
     - 잔여 **blocking(P1/P2)** > 0 → 기존대로 `throw`(발행 차단).
     - 잔여 **desk advisory(P3)** → `recordEditorSemanticStatus`에 `editor_desk_advisory`로 기록하고 editor 반환(**발행 진행, throw 안 함**).
  4. blocking·desk 둘 다 0 → 기존대로 ok.
- desk-only 트리거로 repair가 돌았는데 repair 자체가 실패(throw)하면: 데스크 issue는 advisory이므로 **원본 editor를 그대로 반환**하고 advisory로 기록한다(편집 품질 때문에 발행을 막지 않는다). 단 repair가 blocking 오류를 도입하면 그건 기존 validateEditor가 잡는다.

### 4.4 Repair 프롬프트 — `repairEditorSemanticWithLlm` (`orchestrator-public-article-judge.js`)

기존 지침 목록에 데스크 4축 교정 지침을 추가한다(validation 지침과 동급의 줄 추가):

- `desk_*` issue가 있으면, 해당 section prose를 **source/plan 범위 안에서** 수정: 대상 기술을 설명하고, 레이어를 구분하고, source 한계를 보존하고, 주체 혼동을 바로잡는다.
- **source fact / 새 근거를 만들지 마라**(기존 제약 재사용). plan/source에 없는 대상 설명을 합성하지 마라 — 그런 경우 prose를 과장 없이 두고 desk advisory로 남긴다.
- section 수/순서/headline/source/claims는 건드리지 마라(기존 제약 유지).

## 5. 산출물(artifact)·관측성

- judge artifact(`editor-public-article-judge-*.json`)에 데스크 issue가 P3로 함께 기록된다(기존 writer 재사용, 추가 파일 없음).
- 잔여 desk advisory는 generation-status에 `editor_desk_advisory[]`(section_index/field/reason)로 노출 → 발행은 되지만 리뷰어가 편집 약점을 본다.

## 6. 테스트 전략

기존 fixture-trust·골든 정책을 따른다. 새 단정이 **실제 드리프트를 잡는지** 자문한다(과잉 방어 테스트 금지).

- **contract/unit**
  - `publicArticleJudgePrompt`가 4축 지침을 포함한다.
  - `deskAdvisoryIssues`가 데스크 P3만 advisory로 분류하고, `publicArticleJudgeBlockingIssues`는 데스크 P3를 **포함하지 않는다**(non-blocking 보증).
  - 흐름: desk-only issue가 repair를 트리거한다 / 잔여 desk advisory가 `throw`하지 않고 editor를 반환한다 / 잔여 blocking은 기존대로 throw한다.
- **회귀 fixture(#700 회귀 케이스 기반)**
  - Linux media sensor patch: source 한계(RAW-only 등) 미보존 prose → `desk_source_limitations` P3.
  - ISP driver patch: Exynos/Samsung 적용을 근거 없이 암시 → `desk_subject_attribution`/`desk_layer_distinction` P3.
  - 대상 기술 미설명 generic prose → `desk_target_explanation` P3.
- **검증**: `npm.cmd run test`, `npm.cmd run validate` 통과. 게이트·발행안전 불변 확인.

## 7. 머지 전 필수 — 프로덕션 검증

LLM 동작 변경이므로 **로컬 테스트 통과만으로 머지하지 않는다.**

- ON/OFF parity(데스크 축 추가 전/후) 비교로 회귀 없음 확인.
- 실제 newsroom run에서 데스크 advisory가 합리적으로 발화하고, 발행 안정성(데스크 때문에 막히지 않음)이 유지되는지 확인.
- PR은 code-review까지 진행하되, 위 프로덕션 A/B 검증 전에는 머지하지 않는다.

## 8. 롤백

flag 없이도 안전하다(데스크 축은 advisory라 hard 동작 변화 0). 문제가 보이면 프롬프트의 데스크 지침과 트리거 OR 조건만 되돌리면 된다. 단일 PR, 좁은 surface.
