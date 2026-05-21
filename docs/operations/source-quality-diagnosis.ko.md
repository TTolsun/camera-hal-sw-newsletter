# 소스 품질 진단 리포트 운영 안내

`source-quality-diagnosis`는 후보 부족 원인을 source, parser, gate, source discovery 관점으로 묶어 보여주는 advisory report입니다. 이 리포트는 publish gate, selection policy, source registry, extractor, LLM prompt를 변경하지 않습니다.

## 실행

표준 명령은 다음과 같습니다.

```bash
npm run report:source-quality-diagnosis -- --date YYYY-MM-DD
```

Windows PowerShell 로컬 실행에서는 다음 명령을 사용할 수 있습니다.

```powershell
npm.cmd run report:source-quality-diagnosis -- --date YYYY-MM-DD
```

`--date`가 없으면 `NEWSLETTER_DATE`, `.tmp/newsletter-date.txt`, 오늘 KST 순서로 날짜를 결정합니다.

## 입력과 출력

필수 입력은 실제 사용된 candidate input artifact와 `shortlisted-candidates.json`입니다. Candidate input은 다음 순서로 고릅니다.

1. `generation-status.candidate_input.candidate_artifact`
2. `content/collected-news/YYYY-MM-DD/merged-candidates.json`
3. `content/collected-news/YYYY-MM-DD/manual-candidates.json`
4. legacy `content/collected-news/YYYY-MM-DD/candidates.json`

선택 입력은 있으면 사용하고, 없으면 `warnings`에 기록한 뒤 partial report를 생성합니다.

- `content/newsroom/YYYY-MM-DD/selection-report.json`
- `content/newsroom/YYYY-MM-DD/generation-status.json`
- `content/newsroom/YYYY-MM-DD/source-effectiveness-report.json`
- `content/newsroom/YYYY-MM-DD/source-quality-report.json`
- `content/newsroom/YYYY-MM-DD/source-discovery-feedback-report.json`
- `content/collected-news/YYYY-MM-DD/merged-candidate-manifest.json`
- `content/newsroom/YYYY-MM-DD/evidence-pack-summary.json`

출력은 다음 위치에 생성됩니다.

- `content/newsroom/YYYY-MM-DD/source-quality-diagnosis.json`
- `content/newsroom/YYYY-MM-DD/source-quality-diagnosis.md`

## 해석 기준

JSON field와 enum은 CI/test가 읽는 machine contract이므로 영어를 유지합니다. Markdown report와 PR body는 한국어 label을 사용합니다.

- `actual_news_shortage`: 실제 뉴스 부족
- `parser_extraction_failure`: 파서 추출 실패
- `source_gap_risk`: 소스 풀 부족 위험
- `taxonomy_missing`: 분류 체계 누락
- `fallback_only_composition`: Fallback 기사만 남음
- `duplicate_or_noop_source_discovery`: Source discovery 중복 또는 무효

각 true diagnosis flag는 `diagnosis_reasons`에 최소 하나의 판단 근거와 source artifact reference를 남깁니다. `warnings`에는 optional artifact 누락, partial diagnosis, contract drift 같은 advisory issue를 남깁니다.

## 운영 원칙

- 이 report는 advisory artifact입니다. 생성 실패나 warning은 publish/readiness 판정에 영향을 주지 않습니다.
- PR body에는 `소스 품질 진단 / Source Quality Diagnosis` 섹션이 표시됩니다.
- report artifact가 없거나 invalid JSON이면 PR body는 warning을 표시하고, publish/readiness gate가 영향받지 않는다는 점을 명시합니다.
