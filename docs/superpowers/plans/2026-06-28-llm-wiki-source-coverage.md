# llm-wiki 소스 커버리지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 `src/**/*.js`(461개)가 어떤 llm-wiki 모듈 노트의 `derived_from`에 매핑되도록 노트를 정비하고, 미커버 파일을 자동 감지하는 lint 체크를 추가한다.

**Architecture:** llm-wiki entity 노트를 모듈(디렉터리) 단위로 정비해 `derived_from`을 디렉터리 경로로 완전화하고, lint에 "소스 커버리지 Check 5"를 추가해 불변식(모든 .js가 커버됨)을 강제한다. 그래프 연결은 부산물이며 목표가 아니다.

**Tech Stack:** Node.js(CommonJS), 기존 llm-wiki-lint 스크립트(lint.js/verify.js/inventory.js), 마크다운 노트(UTF-8 no BOM).

**불변식:** 모든 `src/**/*.js`는 어떤 노트의 `derived_from`(파일 경로 또는 상위 디렉터리 prefix)에 포함된다.

**주의(조사로 확인된 사실):**
- `verify.js`의 `derived_from` 경로 존재 검증은 **인라인 `[...]` 형식만** 처리한다. → 신규/보강 노트는 모두 **인라인 형식**으로 작성한다(verify가 경로를 검증하도록).
- `lint.js` Check 5는 `inventory.js`의 `parseDerivedFrom`(인라인+멀티라인 둘 다)을 이식해 쓴다.
- 디렉터리 매칭은 `file === cp || file.startsWith(cp + '/')` — 단순 `startsWith(cp)`는 `src/generator/select`가 `selection`을 오탐한다.
- llm-wiki/는 gitignored지만 GitHub Wiki로 발행되고 lint-governed다. 노트는 PowerShell `Set-Content`/`Out-File`/`>`로 쓰지 말 것(BOM 손상). Write 도구만 사용.
- commit은 이 repo 규칙상 사용자가 요청할 때만. 각 task는 작성+검증까지만 한다.

---

## Task 1: lint.js에 소스 커버리지 Check 5 추가

**Files:**
- Modify: `.claude/skills/llm-wiki-lint/scripts/lint.js` (74행 직후, 76행 `const byType` 직전에 삽입)

- [ ] **Step 1: Check 5 코드 삽입**

`lint.js`의 74행(`}` — Check 4 종료) 다음, 76행(`const byType = {};`) 앞에 아래를 그대로 삽입한다:

```js
// 5) 소스 커버리지: src/**/*.js 는 모두 어떤 노트의 derived_from(파일 또는 상위 디렉터리)로 커버돼야 함
function parseDerivedFrom(fm) {
  const inline = fm.match(/derived_from:\s*\[([^\]]*)\]/);
  if (inline) return inline[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const block = fm.match(/derived_from:\s*\n((?:\s*-\s*.+\n?)+)/);
  if (block) return block[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  return [];
}
const srcJs = [];
(function walkSrc(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkSrc(p);
    else if (e.name.endsWith('.js')) srcJs.push(p.replace(/\\/g, '/'));
  }
})('src');
const covered = new Set();
for (const p of pages) {
  if (p.slug === 'log' || p.slug === 'AGENTS') continue;
  const fmm = p.text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmm) continue;
  for (const raw of parseDerivedFrom(fmm[1])) covered.add(raw.replace(/\/+$/, ''));
}
for (const file of srcJs) {
  let ok = false;
  for (const cp of covered) { if (file === cp || file.startsWith(cp + '/')) { ok = true; break; } }
  if (!ok) findings.push(['uncovered-src-file', file]);
}
```

- [ ] **Step 2: 실행해서 현재 미커버가 잡히는지 확인 (red)**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: `[uncovered-src-file]` 항목이 다수(약 340여 개 — prod 누락 133 + test 209 전부) 출력되고 exit code 1. (아직 노트를 안 만들었으니 정상)

---

## Task 2: 신규 entity 노트 7개 작성

**Files (Create):**
- `llm-wiki/entities/shared-common.md`
- `llm-wiki/entities/shared-tooling.md`
- `llm-wiki/entities/shared-evidence.md`
- `llm-wiki/entities/shared-collect.md`
- `llm-wiki/entities/shared-llm.md`
- `llm-wiki/entities/shared-domain.md`
- `llm-wiki/entities/generator-diagnostics.md`

- [ ] **Step 1: shared-common.md 작성 (완전 예시 — 나머지의 패턴)**

```markdown
---
type: entity
title: src/shared/common
tags: [layer, shared, runtime-config]
updated: 2026-06-28
derived_from: [src/shared/common/]
---

`src/shared/common`은 shared layer의 runtime config·artifact path·policy loader를 담는 하위 디렉터리다.

- 핵심 모듈: [runtime-config.js](../../src/shared/common/runtime-config.js), [artifact-paths.js](../../src/shared/common/artifact-paths.js).
- policy loader: [newsletter-policy.js](../../src/shared/common/newsletter-policy.js), [quality-gate-policy.js](../../src/shared/common/quality-gate-policy.js).
- 상위 layer 개요는 [[shared]], 정책 단일 출처는 [[config-driven-policy]]·[[newsletter-policy-json]] 참고.
```

- [ ] **Step 2: 나머지 6개 작성 (같은 패턴, 아래 표대로)**

각 노트: frontmatter 5필드(인라인 `derived_from`, `updated: 2026-06-28`), 본문은 **해당 디렉터리를 먼저 확인**(`node -e` 또는 Read로 `ls`)한 뒤 shared-common 예시처럼 "역할 1~2줄 + 주요 파일 2~3개 마크다운 링크 + 관련 `[[wikilink]]`"로 작성한다. 추측 금지 — 실제 파일을 보고 쓴다.

| slug | title | tags | derived_from | 주요 책임(확인 기준) |
|---|---|---|---|---|
| shared-tooling | src/shared/tooling | [layer, shared, tooling] | [src/shared/tooling/] | check-*/validate/test entrypoint |
| shared-evidence | src/shared/evidence | [layer, shared, evidence] | [src/shared/evidence/] | linked-evidence 추출·해소·resolver(resolvers/ 하위) |
| shared-collect | src/shared/collect | [layer, shared, collect] | [src/shared/collect/] | source page/RSS parsing·candidate collection 공통 |
| shared-llm | src/shared/llm | [layer, shared, llm] | [src/shared/llm/] | model-policy·LLM provider 공통 |
| shared-domain | src/shared/domain | [layer, shared, domain] | [src/shared/domain/] | 도메인 모델·분류 규칙(aosp-camera-scope 등) |
| generator-diagnostics | src/generator/diagnostics | [layer, generator, diagnostics] | [src/generator/diagnostics/] | 생성 실패 분류·진단 |

- [ ] **Step 3: 실행해서 prod 누락이 줄었는지 확인**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: `uncovered-src-file`에서 `src/shared/common|tooling|evidence|collect|llm|domain`, `src/generator/diagnostics` 파일이 사라짐. (test와 아직 보강 안 한 모듈은 여전히 남음)

---

## Task 3: test 노트 2개 작성

**Files (Create):**
- `llm-wiki/entities/generator-test.md`
- `llm-wiki/entities/shared-test.md`

(discovery test는 Task 4에서 `discovery.md`의 `src/discovery/` 매핑이 함께 커버하므로 별도 노트 불필요.)

- [ ] **Step 1: shared-test.md 작성 (완전 예시)**

```markdown
---
type: entity
title: src/shared/test
tags: [test, shared]
updated: 2026-06-28
derived_from: [src/shared/test/]
---

`src/shared/test`는 shared layer의 단위·계약·워크플로 테스트와 fixture를 담는다.

- 하위 구성은 `unit/`, `contract/`, `workflow/`, `fixtures/` 등으로 나뉜다(실제 디렉터리 확인 후 명시).
- 대상 코드: [[shared]] 및 그 하위(`[[shared-common]]`·`[[shared-collect]]` 등).
```

- [ ] **Step 2: generator-test.md 작성 (같은 패턴)**

frontmatter `title: src/generator/test`, `tags: [test, generator]`, `derived_from: [src/generator/test/]`. 본문은 `src/generator/test/` 하위(contract/newsroom/unit 등) 확인 후 대상 모듈([[generator-publish]] 등)을 wikilink로 묶어 작성.

- [ ] **Step 3: 확인**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: `src/shared/test`, `src/generator/test` 파일이 `uncovered-src-file`에서 사라짐.

---

## Task 4: 기존 노트 derived_from 보강 (디렉터리 인라인화)

**Files (Modify):** 아래 노트들의 frontmatter `derived_from`만 디렉터리 인라인 형식으로 교체. 본문은 그대로 둔다.

- [ ] **Step 1: 각 노트의 derived_from 교체**

| 파일 | 새 derived_from (인라인) |
|---|---|
| `llm-wiki/entities/generator-publish.md` | `[src/generator/publish/]` |
| `llm-wiki/entities/generator-reporter.md` | `[src/generator/reporter/]` |
| `llm-wiki/entities/generator-quality.md` | `[src/generator/quality/]` |
| `llm-wiki/entities/generator-render.md` | `[src/generator/render/]` |
| `llm-wiki/entities/generator-validate.md` | `[src/generator/validate/]` |
| `llm-wiki/entities/generator-select.md` | `[src/generator/select/]` |
| `llm-wiki/entities/generator-editor.md` | `[src/generator/editor/]` |
| `llm-wiki/entities/generator-repair.md` | `[src/generator/repair/]` |
| `llm-wiki/entities/discovery.md` | `[src/discovery/]` |
| `llm-wiki/entities/collector.md` | `[src/collector/]` |

주의: `discovery.md`의 `[src/discovery/]`는 `src/discovery/test/`까지 포함한다(discovery test 커버). `collector.md`에서 기존에 잘못 들어간 `src/shared/cli/collect-news-candidates.js`는 제거한다(그 파일은 shared.md가 커버).

- [ ] **Step 2: updated 날짜 갱신**

수정한 각 노트의 `updated:`를 `2026-06-28`로 바꾼다(lint이 YYYY-MM-DD 형식 강제).

- [ ] **Step 3: 확인**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: 위 모듈들의 파일이 `uncovered-src-file`에서 사라짐.

---

## Task 5: shared.md의 작은 하위 디렉터리 흡수

**Files (Modify):** `llm-wiki/entities/shared.md`

- [ ] **Step 1: derived_from 교체**

6행의 `derived_from`을 아래로 교체(common/tooling/evidence/collect/llm/domain은 신규 전용 노트가 커버하므로 제외, 작은 하위만 흡수):

```
derived_from: [src/shared/adapters/llm/, src/shared/cli/, src/shared/render/, src/shared/sources/, src/shared/validate/, src/shared/config/newsletter-policy.json, src/shared/data/news-sources.json, src/AGENTS.md]
```

- [ ] **Step 2: 본문에 hub wikilink 추가 + updated 갱신**

본문 끝의 "관련 페이지" 문장에 신규 하위 노트를 묶는다(탐색용):
`관련 페이지: [[shared-common]], [[shared-tooling]], [[shared-evidence]], [[shared-collect]], [[shared-llm]], [[shared-domain]], [[shared-test]], [[pipeline]].`
`updated:`를 `2026-06-28`로.

- [ ] **Step 3: 확인**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: `src/shared/adapters|cli|render|sources|validate` 파일이 `uncovered-src-file`에서 사라짐 → 이 시점에 `uncovered-src-file`이 **0개**여야 한다.

---

## Task 6: index.md에 신규 노트 9개 등록

**Files (Modify):** `llm-wiki/index.md` (`## Entities` 섹션, 33행 `[[github-workflows]]` 줄 다음)

- [ ] **Step 1: 9개 등록 줄 추가**

`## Entities` 섹션 끝에 아래를 추가(형식 엄수: `- [[slug]] — 한 줄 요약.`):

```markdown
- [[shared-common]] — shared layer의 runtime config·artifact path·policy loader 하위 디렉터리.
- [[shared-tooling]] — check-*/validate/test entrypoint를 담는 tooling 하위 디렉터리.
- [[shared-evidence]] — linked-evidence 추출·해소·resolver 하위 디렉터리.
- [[shared-collect]] — source parsing·candidate collection 공통 로직 하위 디렉터리.
- [[shared-llm]] — model-policy·LLM provider 공통 로직 하위 디렉터리.
- [[shared-domain]] — 도메인 모델·분류 규칙 하위 디렉터리.
- [[generator-diagnostics]] — 생성 실패 분류·진단 하위 디렉터리.
- [[generator-test]] — generator layer 테스트(contract/newsroom/unit) 디렉터리.
- [[shared-test]] — shared layer 테스트·fixture 디렉터리.
```

`index.md`의 `updated:`도 `2026-06-28`로 갱신.

- [ ] **Step 2: 확인 (orphan·not-in-index 0)**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: `orphan-page`, `not-in-index` 0. (index 등록이 wikilink 인바운드를 제공해 orphan도 해결)

---

## Task 7: 전체 무결성 검증

**Files:** 없음(검증만)

- [ ] **Step 1: lint 전체 통과 확인**

Run: `node .claude/skills/llm-wiki-lint/scripts/lint.js`
Expected: `findings: 0` 그리고 `OK: 기계 검사 통과`. exit 0. (uncovered-src-file·orphan·not-in-index·broken-wikilink·broken-repo-link·frontmatter 모두 0)

- [ ] **Step 2: verify 통과 확인 (derived_from 경로 존재·BOM 없음)**

Run: `node .claude/skills/llm-wiki-lint/scripts/verify.js`
Expected: `OK: all frontmatter present, all derived_from paths exist, no BOM`. exit 0.

- [ ] **Step 3: 불변식 재확인 (커버리지 0 + 파일 수)**

Run: `node .claude/skills/llm-wiki-lint/scripts/inventory.js` (선택 — 매핑 점검)
Run (PowerShell): `(Get-ChildItem -Path src -Recurse -Filter *.js | Measure-Object).Count`
Expected: 461. lint Step 1에서 `uncovered-src-file` 0이면 461개 전부 커버됨.

- [ ] **Step 4: 인코딩 게이트**

Run: `npm.cmd run check:encoding`
Expected: 통과(신규 .md가 UTF-8 no BOM).

- [ ] **Step 5: (선택) 커밋 — 사용자 승인 시에만**

llm-wiki/는 gitignored라 git에 안 잡힌다. 추적 대상은 `.claude/skills/llm-wiki-lint/scripts/lint.js`(Check 5)와 이 plan/spec 문서. 사용자가 커밋을 요청하면 진행한다.

---

## 완료 기준 (Definition of Done)

- `lint.js`에 Check 5 추가, `node lint.js` → findings 0
- `node verify.js` → OK
- 신규 entity 7 + test 2 = 9개 노트 작성, 기존 10개 노트 보강, shared.md/index.md 갱신
- 모든 `src/**/*.js` 461개가 어떤 노트의 derived_from으로 커버됨(uncovered 0)
- 향후 새 .js 추가 시 lint이 자동으로 누락을 잡음(드리프트 관리 달성)
