# 🛠️ 운영 안내

> **한 줄 요약** — 자주 하는 운영 작업(수동 실행, PR review, release, artifact review)만 짧게 정리한 문서입니다.

이 문서는 자주 하는 운영 작업만 짧게 정리합니다. 전체 pipeline과 gate(검증 관문) 계약은 [NEWSROOM_WORKFLOW.md](../NEWSROOM_WORKFLOW.md)를 기준으로 확인하세요.

> 💡 Gemini/LLM prompt 위치와 stage별 목적은 [Newsroom LLM Prompt Reference](./NEWSROOM_LLM_PROMPTS.md)를 확인합니다.

## 🚀 Manual High-Quality Run

수동으로 고품질 호를 생성할 때의 절차입니다.

- GitHub Actions에서 `Newsletters 03 - Editor PR` (`.github/workflows/newsletters-03-editor-pr.yml`)을 고르고 `Run workflow`를 실행합니다.
- Stage 2/3 manual run의 `newsletter_date`는 선택 입력(optional)입니다. 비워두면 workflow 실행 시점의 KST 날짜(`YYYY-MM-DD`)로 정해지고, 정해진 날짜는 workflow log에 출력됩니다.
- 특정 날짜를 다시 생성하려면 `newsletter_date`만 입력합니다. candidate artifact는 이제 path input으로 받지 않습니다. 대신 `merged-candidates.json` → `manual-candidates.json` → legacy `candidates.json` 순서로 자동 선택합니다.
- Stage 3 manual final generation의 기본 입력은 `llm_model=""`입니다. 이 기본 실행은 code default stage model을 primary로 씁니다.

> ⚠️ Gemini Pro 계열 모델명은 `llm_model`, `llm_fallback_models`, stage별 model variable 어디에 넣어도 `doctor:config` 단계에서 실패합니다.

- 실행이 끝나면 `cost-report.md`, `summary-cache-report.md`, `retry-history.md`에서 비용과 retry(재시도) 범위를 확인합니다.

## 🔎 PR Review Flow

PR을 검토할 때는 상단 요약부터 본 뒤 필요하면 artifact로 내려갑니다.

- PR body의 새 editor-facing 요약은 [Newsroom PR Report 읽는 법](./NEWSROOM_PR_REPORT.md)을 기준으로 확인합니다.
- `01`, `02`, `03` PR은 모두 상단의 `최종 판단`, `이번 PR 요약`, `반드시 확인할 항목`, `주요 결과`를 먼저 봅니다. PR body에는 원본 key/value report를 길게 붙이지 않습니다. `상세 report`에는 artifact 경로(pointer)와 최소한의 원인만 적습니다.
- `final_publish_ready=false`는 AI 자동 발행 기준을 충족하지 못했다는 뜻입니다. `review_publication_ready=true`이고 `homepage_visible_after_merge=true`인 PR은 편집장이 merge해서 공개 승인할 수 있습니다.
- `diagnostics_only=true`인 PR은 public newsletter files가 없습니다. 그래서 merge해도 홈페이지에 표시되지 않습니다. PR body의 missing public files reason(공개 파일이 없는 이유)을 먼저 확인합니다.

> 📌 `Site 01 - Validate Site and Images` (`.github/workflows/site-01-validate.yml`)는 quality/fact-check 문제는 차단하지 않는 알림(non-blocking annotation)으로 보고하고, structural validation(구조 검증)만 차단(blocking)으로 처리합니다.

<details>
<summary>PR body에서 확인할 항목 자세히 보기</summary>

- PR body에서 `final_publish_ready`, `review_publication_ready`, `diagnostics_only`, article count, labels, selection diagnostics를 먼저 확인합니다.
- 더 자세한 맥락이 필요하면 `editor-in-chief-brief.md`, `quality-report.md`, `fact-check-report.md` 같은 artifact를 직접 봅니다. 이 세부 내용은 PR body에 다시 적지 않습니다.
- `fact-check-report.md`에 해결되지 않은(unresolved) `must_fix`가 있으면 발행 가능한 PR로 보지 않습니다.
- `quality-report.md`에서는 hard blocker(반드시 막아야 하는 문제)와 soft deduction(점수만 깎는 문제)을 나눠서 봅니다.
- source gap, duplicate source URL, missing action item, weak Camera HAL perspective는 발행 전에 고쳐야 합니다.

</details>

## 📦 Release Flow

발행 상태 라벨의 의미와 release 절차입니다.

- `publish-ready`: `has_ai_publish_ready=true`인 상태로, AI가 자동 발행할 수 있다는 뜻입니다.
- `review-only`: AI 자동 발행 기준에 못 미쳐 editor review(편집자 검토)가 필요하다는 넓은 신호입니다.
- `review-only-publication`: public files는 있지만 편집장 검토가 필요한 상태입니다.
- `diagnostics-only`: public files가 없어 공개 승인 대상이 아닌 상태입니다.

절차는 다음과 같습니다.

- 자동 발행 가능한 PR인지는 `publish-ready` 상태와 PR body의 `final_publish_ready=true`로 확인합니다.
- `needs-fix`와 `review-only-publication`이 함께 붙은 PR은, quality/fact-check annotation과 review artifact를 검토한 뒤 편집장이 merge해서 공개 승인합니다.
- `npm.cmd run test`와 `npm.cmd run validate`가 통과한 PR만 merge합니다.
- merge하면 GitHub Pages가 `main` 기준 public newsletter를 반영합니다.

> ⚠️ workflow는 generated issue를 `main`에 직접 push하거나 auto-merge하지 않습니다.

## 🏷️ Publication Quality Annotation

`annotate-publication-quality.js`는 어떤 public issue를 검사할지 입력에 따라 결정합니다.

- `node src/generator/publish/annotate-publication-quality.js --date YYYY-MM-DD`는 지정한 그 public issue만 검사합니다.
- 변경된 public issue의 date가 어떤 public issue와 매칭되면, `--latest`가 있어도 그 date만 검사합니다.
- 변경된 public issue가 없을 때 가장 최신 public issue 1개만 검사하려면 `node src/generator/publish/annotate-publication-quality.js --latest`를 명시해야 합니다.
- 명시한 target도, 변경된 public issue도 없으면, 조용히 최신본으로 넘어가지(fallback) 않고 실패합니다.
- 과거 issue 전체를 검사하는 것은 `node src/generator/publish/annotate-publication-quality.js --all`에서만 합니다.

## 🔬 Artifact Review Order

> 💡 artifact는 아래 순서로 보면 결론(PR body)에서 근거(상세 report)로 자연스럽게 내려갑니다.

1. PR body와 labels
2. `articles/content/newsroom/YYYY-MM-DD/editor-in-chief-brief.md`
3. `articles/content/newsroom/YYYY-MM-DD/fact-check-report.md`
4. `articles/content/newsroom/YYYY-MM-DD/quality-report.md`
5. `articles/content/newsroom/YYYY-MM-DD/retry-history.md`
6. `articles/content/newsroom/YYYY-MM-DD/selection-diagnostics.md`
7. `articles/content/newsroom/YYYY-MM-DD/selection-report.md`
8. `articles/newsletters/YYYY-MM-DD/newsletter.md`

> 📌 `shortlisted-candidates.json`과 `article-capsules.json`은 debug_heavy 등급이라 PR diff에 들어가지 않습니다. 대신 GitHub Actions artifact `newsroom-final-debug-<run_id>`에 보존됩니다.

<details>
<summary>Heavy Artifact 접근 방법</summary>

PR diff에서 `debug_heavy`/`transient_attempt` 등급 산출물(artifact)이 안 보이는 것은 의도된 동작입니다. 보려면 둘 중 하나를 합니다.

- Actions artifact `newsroom-final-debug-<run_id>`를 다운로드합니다.
- 또는 `articles/content/newsroom/YYYY-MM-DD/artifact-manifest.json`의 `retained_heavy_artifacts[]`를 봅니다. 각 항목에 `path`, `size`, `sha256`, `retention_grade`, `retention_location`이 적혀 있습니다.

</details>

## 🩺 소스 품질 진단

> 💡 후보가 부족한 원인을 source/parser/gate/source discovery 관점으로 보려면 [소스 품질 진단 리포트](./SOURCE_QUALITY_DIAGNOSIS.md)를 확인하세요. 이 리포트는 참고용(advisory) artifact라서 publish/readiness gate를 바꾸지 않습니다.

## 📬 메일 구독 (provider-hosted)

메일 구독은 외부 newsletter provider가 담당합니다. 이 저장소는 구독 진입점과 provider 설정만 관리합니다.

- 구독자 email, unsubscribe, bounce, delivery, analytics는 전부 provider가 관리합니다.
- 저장소·workflow artifact·generated site data에는 구독자 email을 저장하지 않습니다.
- 매주 발송은 provider의 발행/예약 기능으로 합니다. GitHub Actions는 구독자에게 메일을 보내지 않습니다.

설정 파일은 `config/subscription.json` 하나이고, 배포할 때 `assemble-site.js`가 site root의 `/config/subscription.json`으로 복사합니다.

| field | 값 | 뜻 |
| --- | --- | --- |
| `schemaVersion` | `1` | 현재 스키마 버전입니다. |
| `enabled` | `true`/`false` | 구독 CTA를 켤지 정합니다. 저장소 기본값은 `false`입니다. |
| `provider` | `beehiiv` | 지금 지원하는 provider입니다. |
| `mode` | `hosted_link` | provider가 호스팅하는 구독 페이지로 보내는 방식입니다. |
| `subscribeUrl` | 절대 https URL | provider의 hosted subscribe page 주소입니다. |

CTA는 `enabled=true`이고 `subscribeUrl`이 실제 https 주소일 때만 켜집니다. 그 전까지는 홈의 구독 섹션이 "지원예정" 상태로만 보이고, 아카이브·뉴스레터 상세 페이지의 구독 섹션은 아예 보이지 않으며, 푸터에는 `구독 (지원예정)` 노트가 그대로 남습니다. 빈 `href`를 가진 죽은 링크는 어느 표면에도 만들지 않습니다.

### 구독을 켜는 절차

1. provider(beehiiv)에서 publication을 만들고 hosted subscribe page 주소를 확인합니다.
2. `config/subscription.json`에서 `subscribeUrl`을 그 주소로 채우고 `enabled`를 `true`로 바꿉니다.
3. `npm.cmd run validate:site`를 돌립니다. 이 검증은 `enabled=true`일 때 `subscribeUrl`이 placeholder나 local/dev 주소가 아닌 절대 https URL인지 확인합니다.
4. PR로 merge합니다. 설정 파일만 바뀌어도 `site-02-deploy` workflow가 배포를 실행합니다.
5. 배포 뒤 홈·아카이브·뉴스레터 상세 페이지의 Subscribe 버튼과, 아카이브·뉴스레터 상세 페이지 푸터의 `구독` 링크가 provider 주소로 가는지 확인합니다.

> ⚠️ `enabled`를 `true`로 두고 `subscribeUrl`을 비우면 `validate:site`가 실패합니다. 되돌릴 때는 `enabled`를 `false`로 바꾸면 되고, `subscribeUrl`은 비워도 그대로 둬도 됩니다.

판정 로직은 두 곳에 있습니다. 홈은 `index.html`의 인라인 loader가, 아카이브와 뉴스레터 상세 페이지는 공용 스크립트 `articles/assets/js/subscription-cta.js`가 씁니다. 판정 기준은 같고, 두 표면의 차이는 둘뿐입니다.

- 꺼져 있을 때 홈의 구독 섹션은 "지원예정" 상태로 보이지만, 아카이브·뉴스레터 상세 페이지의 구독 섹션은 아예 보이지 않습니다. 홈은 구독을 알리는 자리이고, 나머지 두 표면은 읽는 흐름을 끊지 않는 것이 우선이기 때문입니다.
- 푸터 `구독` 링크는 공용 스크립트를 로드하는 아카이브·뉴스레터 상세 페이지에만 생깁니다. 홈 푸터는 `구독 (지원예정)` 노트로 남고, 홈에서의 진입점은 그 위의 구독 섹션입니다.

계약은 `validate-site.js`의 subscription 검사, `src/shared/test/workflow/subscription-cta.test.js`, `src/generator/test/contract/newsletter-renderer.test.js`가 잠급니다.
