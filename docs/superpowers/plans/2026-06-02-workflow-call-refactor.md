# Workflow Call Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `newsroom-daily-auto-pr.yml`이 01/02/03 워크플로우를 `workflow_call`로 호출하도록 리팩터링해서 코드 중복을 제거한다.

**Architecture:** 01/02/03 워크플로우에 `workflow_call` 트리거를 추가한다. `workflow_dispatch`(수동) 시에는 기존처럼 PR을 생성하고, `workflow_call`(자동) 시에는 01/02가 결과물을 main에 직접 commit한다(PR 없음). 03은 항상 PR을 생성한다. `newsroom-daily-auto-pr.yml`은 세 워크플로우를 순서대로 호출하는 coordinator로 단순화된다.

**Tech Stack:** GitHub Actions (`workflow_call`, `uses:`, `secrets: inherit`), peter-evans/create-pull-request@v6

---

## File Map

| 파일 | 변경 유형 | 역할 |
|---|---|---|
| `.github/workflows/01-newsroom-manual-source-collect-pr.yml` | 수정 | `workflow_call` 추가, 자동 모드 시 main에 commit |
| `.github/workflows/02-newsroom-gemini-source-discovery-pr.yml` | 수정 | `workflow_call` 추가, 자동 모드 시 main에 commit |
| `.github/workflows/03-newsroom-final-pr.yml` | 수정 | `workflow_call` 추가, 항상 PR 생성 |
| `.github/workflows/newsroom-daily-auto-pr.yml` | 수정 | 인라인 로직 제거, 3개 workflow_call coordinator로 교체 |
| `tests/workflow/stage1-source-collect-workflow.test.js` | 수정 | `workflow_call` 트리거 및 auto-commit 단계 검증 추가 |
| `tests/workflow/stage3-final-newsroom-workflow.test.js` | 수정 | `workflow_call` 트리거 검증 추가 |
| `tests/workflow/daily-auto-workflow.test.js` | 신규 생성 | coordinator가 01/02/03을 올바르게 호출하는지 검증 |

---

## Task 1: 01 워크플로우에 `workflow_call` 추가

**Files:**
- Modify: `.github/workflows/01-newsroom-manual-source-collect-pr.yml`

### 배경
01은 현재 `workflow_dispatch`만 있으며 `peter-evans/create-pull-request`로 `newsroom-raw/${DATE}` 브랜치 PR을 생성한다. `workflow_call` 모드에서는 PR 없이 결과물을 main에 직접 commit해야 한다.

- [ ] **Step 1: `on:` 블록에 `workflow_call` 트리거와 workflow 출력 추가**

`.github/workflows/01-newsroom-manual-source-collect-pr.yml` 파일에서 `on:` 블록과 `jobs:` 사이에 다음을 추가한다:

```yaml
on:
  workflow_dispatch:
    inputs:
      newsletter_date:
        description: "Newsletter date in YYYY-MM-DD. Empty means today in KST."
        required: false
        type: string
      lookback_days:
        description: "How many days to look back when collecting news candidates."
        required: false
        default: "21"
        type: string
      manual_source_urls:
        description: "Optional ';'-separated http/https seed URLs. Empty uses content/collected-news/<date>/collection-intent.json if present."
        required: false
        default: ""
        type: string
  workflow_call:
    inputs:
      newsletter_date:
        description: "Newsletter date in YYYY-MM-DD. Empty means today in KST."
        required: false
        type: string
        default: ""
      lookback_days:
        description: "How many days to look back when collecting news candidates."
        required: false
        type: string
        default: "21"
    outputs:
      date:
        description: "Resolved newsletter date (YYYY-MM-DD)"
        value: ${{ jobs.create-raw-candidate-pr.outputs.date }}
```

- [ ] **Step 2: job에 `outputs` 블록 추가**

`jobs: create-raw-candidate-pr:` 아래 `runs-on:` 전에 추가:

```yaml
    outputs:
      date: ${{ steps.raw-meta.outputs.date }}
```

- [ ] **Step 3: `env` 블록을 양쪽 트리거 모두 지원하도록 수정**

현재:
```yaml
    env:
      NEWSLETTER_DATE: ${{ github.event.inputs.newsletter_date }}
      LOOKBACK_DAYS: ${{ github.event.inputs.lookback_days || '21' }}
      NEWSROOM_MANUAL_SOURCE_URLS: ${{ github.event.inputs.manual_source_urls }}
```

변경 후:
```yaml
    env:
      NEWSLETTER_DATE: ${{ inputs.newsletter_date || github.event.inputs.newsletter_date || '' }}
      LOOKBACK_DAYS: ${{ inputs.lookback_days || github.event.inputs.lookback_days || '21' }}
      NEWSROOM_MANUAL_SOURCE_URLS: ${{ github.event.inputs.manual_source_urls || '' }}
```

- [ ] **Step 4: PR 관련 단계들에 `workflow_dispatch` 조건 추가**

"Prepare RAW pull request body" 단계에 `if` 추가:
```yaml
      - name: Prepare RAW pull request body
        id: pr-body
        if: github.event_name == 'workflow_dispatch'
```

"Ensure labels" 단계에 `if` 추가:
```yaml
      - name: Ensure labels
        if: github.event_name == 'workflow_dispatch'
        uses: actions/github-script@v7
```

"Create RAW candidate pull request" 단계에 `if` 추가:
```yaml
      - name: Create RAW candidate pull request
        id: cpr
        if: github.event_name == 'workflow_dispatch'
        uses: peter-evans/create-pull-request@v6
```

- [ ] **Step 5: auto-commit 단계 추가 ("Upload RAW debug artifacts" 바로 앞에)**

```yaml
      - name: Commit candidates to main (auto mode)
        if: github.event_name == 'workflow_call'
        run: |
          set -euo pipefail
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add content/collected-news/ content/source-events/ data/source-snapshots/ || true
          if git diff --cached --quiet; then
            echo "Nothing to commit."
          else
            git commit -m "chore(newsroom): collect raw candidates for ${{ steps.raw-meta.outputs.date }}"
            git push origin HEAD:main
          fi
```

- [ ] **Step 6: 테스트 실행해서 깨지는 게 없는지 확인**

```powershell
npm.cmd run test
```

Expected: 1277 tests pass

- [ ] **Step 7: commit**

```bash
git add .github/workflows/01-newsroom-manual-source-collect-pr.yml
git commit -m "feat(workflow): add workflow_call to 01 with auto-commit path"
```

---

## Task 2: 02 워크플로우에 `workflow_call` 추가

**Files:**
- Modify: `.github/workflows/02-newsroom-gemini-source-discovery-pr.yml`

### 배경
02는 현재 `workflow_dispatch`만 있으며 Gemini source discovery 결과물을 `newsroom-source-discovery/${DATE}` 브랜치 PR로 생성한다. `workflow_call` 모드에서는 main에 직접 commit한다.

- [ ] **Step 1: `on:` 블록에 `workflow_call` 트리거와 workflow 출력 추가**

```yaml
on:
  workflow_dispatch:
    inputs:
      newsletter_date:         # 기존 유지
      llm_provider:            # 기존 유지
      llm_model:               # 기존 유지
  workflow_call:
    inputs:
      newsletter_date:
        description: "Newsletter date in YYYY-MM-DD. Empty means today in KST."
        required: false
        type: string
        default: ""
    outputs:
      date:
        description: "Resolved newsletter date (YYYY-MM-DD)"
        value: ${{ jobs.create-source-discovery-pr.outputs.date }}
```

- [ ] **Step 2: job에 `outputs` 블록 추가**

`jobs: create-source-discovery-pr:` 아래 `runs-on:` 전에:
```yaml
    outputs:
      date: ${{ steps.resolve-newsletter-date.outputs.date }}
```

- [ ] **Step 3: `env` 블록 및 `Resolve newsletter date` 단계 수정**

현재 env:
```yaml
      NEWSLETTER_DATE: ${{ github.event.inputs.newsletter_date }}
```

변경 후:
```yaml
      NEWSLETTER_DATE: ${{ inputs.newsletter_date || github.event.inputs.newsletter_date || '' }}
```

`Resolve newsletter date` 단계의 env도 수정:
```yaml
        env:
          INPUT_NEWSLETTER_DATE: ${{ inputs.newsletter_date || github.event.inputs.newsletter_date || '' }}
```

- [ ] **Step 4: PR 관련 단계들에 `workflow_dispatch` 조건 추가**

"Prepare source discovery pull request body" 단계에 `if` 추가:
```yaml
      - name: Prepare source discovery pull request body
        id: pr-body
        if: github.event_name == 'workflow_dispatch'
```

"Ensure labels" 단계에 `if` 추가:
```yaml
      - name: Ensure labels
        if: github.event_name == 'workflow_dispatch'
        uses: actions/github-script@v7
```

"Create source discovery pull request" 단계에 `if` 추가:
```yaml
      - name: Create source discovery pull request
        id: cpr
        if: github.event_name == 'workflow_dispatch'
        uses: peter-evans/create-pull-request@v6
```

- [ ] **Step 5: auto-commit 단계 추가 ("Upload source discovery debug artifacts" 바로 앞에)**

```yaml
      - name: Commit discovery artifacts to main (auto mode)
        if: github.event_name == 'workflow_call'
        run: |
          set -euo pipefail
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add content/collected-news/ content/newsroom/ || true
          if git diff --cached --quiet; then
            echo "Nothing to commit."
          else
            git commit -m "chore(newsroom): source discovery artifacts for ${{ steps.resolve-newsletter-date.outputs.date }}"
            git push origin HEAD:main
          fi
```

- [ ] **Step 6: 테스트 실행**

```powershell
npm.cmd run test
```

Expected: 1277 tests pass

- [ ] **Step 7: commit**

```bash
git add .github/workflows/02-newsroom-gemini-source-discovery-pr.yml
git commit -m "feat(workflow): add workflow_call to 02 with auto-commit path"
```

---

## Task 3: 03 워크플로우에 `workflow_call` 추가

**Files:**
- Modify: `.github/workflows/03-newsroom-final-pr.yml`

### 배경
03은 항상 PR을 생성한다 (수동/자동 모두). `workflow_call` 트리거만 추가하고 env var를 양쪽 트리거에서 읽도록 수정한다.

- [ ] **Step 1: `on:` 블록에 `workflow_call` 트리거 추가**

03의 기존 `on: workflow_dispatch: inputs:` 를 유지하고 아래 추가:

```yaml
  workflow_call:
    inputs:
      newsletter_date:
        description: "Newsletter date in YYYY-MM-DD. Empty means today in KST."
        required: false
        type: string
        default: ""
```

- [ ] **Step 2: `concurrency.group` 수정**

현재:
```yaml
  group: newsroom-final-${{ github.event.inputs.newsletter_date || 'auto-kst-today' }}
```

변경 후:
```yaml
  group: newsroom-final-${{ inputs.newsletter_date || github.event.inputs.newsletter_date || 'auto-kst-today' }}
```

- [ ] **Step 3: 모든 `github.event.inputs.newsletter_date` 참조를 양쪽 트리거 지원으로 수정**

파일에서 `github.event.inputs.newsletter_date` 를 `inputs.newsletter_date || github.event.inputs.newsletter_date || ''` 로 교체.

`NEWSLETTER_DATE` env:
```yaml
      NEWSLETTER_DATE: ${{ inputs.newsletter_date || github.event.inputs.newsletter_date || '' }}
```

`Resolve newsletter date` 단계의 env:
```yaml
        env:
          INPUT_NEWSLETTER_DATE: ${{ inputs.newsletter_date || github.event.inputs.newsletter_date || '' }}
```

LLM override 단계의 env (workflow_call 시 빈 값으로 처리됨):
```yaml
        env:
          INPUT_LLM_PROVIDER: ${{ github.event.inputs.llm_provider || 'default' }}
          INPUT_LLM_MODEL: ${{ github.event.inputs.llm_model || '' }}
          INPUT_LLM_FALLBACK_MODELS: ${{ github.event.inputs.llm_fallback_models || '' }}
```

- [ ] **Step 4: 테스트 실행**

```powershell
npm.cmd run test
```

Expected: 1277 tests pass

- [ ] **Step 5: commit**

```bash
git add .github/workflows/03-newsroom-final-pr.yml
git commit -m "feat(workflow): add workflow_call to 03 newsletter generator"
```

---

## Task 4: `newsroom-daily-auto-pr.yml`을 coordinator로 교체

**Files:**
- Modify: `.github/workflows/newsroom-daily-auto-pr.yml`

### 배경
현재 436줄짜리 인라인 로직을 3개의 workflow_call 호출로 교체한다. `on:` 블록(`schedule`, `workflow_dispatch`)과 `permissions`, `concurrency`는 유지한다.

- [ ] **Step 1: `newsroom-daily-auto-pr.yml`의 `jobs:` 블록 전체를 coordinator로 교체**

`jobs:` 섹션을 다음으로 교체:

```yaml
jobs:
  collect:
    uses: ./.github/workflows/01-newsroom-manual-source-collect-pr.yml
    with:
      newsletter_date: ${{ github.event.inputs.newsletter_date || '' }}
    secrets: inherit

  discover:
    needs: collect
    uses: ./.github/workflows/02-newsroom-gemini-source-discovery-pr.yml
    with:
      newsletter_date: ${{ needs.collect.outputs.date }}
    secrets: inherit

  generate:
    needs: [collect, discover]
    uses: ./.github/workflows/03-newsroom-final-pr.yml
    with:
      newsletter_date: ${{ needs.collect.outputs.date }}
    secrets: inherit
```

`on:`, `permissions:`, `concurrency:` 블록은 그대로 유지.

- [ ] **Step 2: 테스트 실행**

```powershell
npm.cmd run test
```

Expected: 1277 tests pass (workflow YAML 구조 테스트가 이 단계에서 깨질 수 있음 — Task 5에서 수정)

- [ ] **Step 3: commit (테스트 실패해도 일단 commit)**

```bash
git add .github/workflows/newsroom-daily-auto-pr.yml
git commit -m "refactor(workflow): replace inline logic with workflow_call coordinator"
```

---

## Task 5: 테스트 업데이트

**Files:**
- Modify: `tests/workflow/stage1-source-collect-workflow.test.js`
- Modify: `tests/workflow/stage3-final-newsroom-workflow.test.js`
- Create: `tests/workflow/daily-auto-workflow.test.js`

### 배경
기존 테스트가 새 워크플로우 구조를 검증하도록 업데이트하고, coordinator 워크플로우 전용 테스트를 신규 추가한다.

- [ ] **Step 1: `stage1-source-collect-workflow.test.js` 업데이트**

파일: `tests/workflow/stage1-source-collect-workflow.test.js`

현재 테스트 파일에 다음 테스트를 추가한다:

```javascript
test('01 workflow accepts workflow_call trigger for auto mode', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsroom-manual-source-collect-pr.yml'), 'utf8');

  assert.match(stage1, /^\s*workflow_call:/m);
  assert.match(stage1, /value: \$\{\{ jobs\.create-raw-candidate-pr\.outputs\.date \}\}/);
  assert.match(stage1, /Commit candidates to main \(auto mode\)/);
  assert.match(stage1, /github\.event_name == 'workflow_call'/);
  assert.match(stage1, /github\.event_name == 'workflow_dispatch'/);
  assert.match(stage1, /git push origin HEAD:main/);
});
```

- [ ] **Step 2: `stage3-final-newsroom-workflow.test.js` 업데이트**

`split newsroom workflows preserve #88 stage boundaries` 테스트 안에 다음 assertion 추가:

```javascript
  assert.match(stage1, /^\s*workflow_call:/m);
  assert.match(stage2, /^\s*workflow_call:/m);
  assert.match(stage3, /^\s*workflow_call:/m);
```

위치: line 250번대의 기존 assertion들 뒤, `assert.doesNotMatch(stage1, /^\s*schedule:/m)` 근처에 추가.

- [ ] **Step 3: `daily-auto-workflow.test.js` 신규 생성**

`tests/workflow/daily-auto-workflow.test.js` 파일 생성:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('daily auto PR coordinator calls 01 02 03 via workflow_call', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const coordinator = fs.readFileSync(path.join(workflowDir, 'newsroom-daily-auto-pr.yml'), 'utf8');

  // 세 sub-workflow를 uses:로 호출한다
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/01-newsroom-manual-source-collect-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/02-newsroom-gemini-source-discovery-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/03-newsroom-final-pr\.yml/);

  // 인라인 로직이 없다 (coordinator가 직접 npm run collect/generate를 실행하지 않음)
  assert.doesNotMatch(coordinator, /npm run collect/);
  assert.doesNotMatch(coordinator, /npm run generate/);
  assert.doesNotMatch(coordinator, /npm run test/);

  // 03 generate는 01과 02 모두에 의존한다
  assert.match(coordinator, /needs:\s*\[collect,\s*discover\]/);

  // schedule 트리거는 coordinator에만 있다
  assert.match(coordinator, /^\s*schedule:/m);
  assert.match(coordinator, /cron: "0 0 \* \* \*"/);

  // secrets를 상속한다
  assert.match(coordinator, /secrets:\s*inherit/);
});
```

- [ ] **Step 4: 테스트 실행해서 모두 통과 확인**

```powershell
npm.cmd run test
```

Expected: 1280 tests pass (3개 신규 추가)

- [ ] **Step 5: commit**

```bash
git add tests/workflow/stage1-source-collect-workflow.test.js
git add tests/workflow/stage3-final-newsroom-workflow.test.js
git add tests/workflow/daily-auto-workflow.test.js
git commit -m "test(workflow): add workflow_call and coordinator structure assertions"
```

---

## Task 6: 통합 검증 및 push

- [ ] **Step 1: 전체 validate 실행**

```powershell
npm.cmd run validate
```

Expected: 모든 검증 통과

- [ ] **Step 2: 최종 테스트**

```powershell
npm.cmd run test
```

Expected: 전체 pass

- [ ] **Step 3: push**

```bash
git push origin main
```

- [ ] **Step 4: GitHub Actions에서 수동으로 `newsroom-daily-auto-pr.yml` 실행**

```bash
gh workflow run newsroom-daily-auto-pr.yml --repo TTolsun/camera-hal-sw-newsletter
```

실행 로그에서 `collect` → `discover` → `generate` 세 job이 순서대로 실행되는지 확인한다.

---

## 자기 검토

**Spec coverage:**
- [x] 01/02/03에 `workflow_call` 추가 → Task 1, 2, 3
- [x] `workflow_dispatch` 시 기존 PR 동작 유지 → Task 1~3의 `if: github.event_name` 조건
- [x] `workflow_call` 시 01/02 auto-commit → Task 1, 2의 auto-commit 단계
- [x] 03은 항상 PR 생성 → Task 3 (동작 변경 없음)
- [x] coordinator로 교체 → Task 4
- [x] 테스트 업데이트 → Task 5

**주의사항:**
- Task 4 실행 전에 Task 1~3이 반드시 완료되어야 한다 (01/02/03에 `workflow_call` 없으면 coordinator가 실패)
- `secrets: inherit`은 GEMINI_API_KEY 등 모든 secret을 하위 workflow에 전달한다
- 01의 auto-commit이 main에 push되면 `validate-site.yml`이 트리거된다 (중간 상태지만 site validation에는 영향 없음)
