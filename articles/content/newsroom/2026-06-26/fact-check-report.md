# 사실 검증 보고서 - 2026-06-26

## 상태

PASS

## 반드시 수정할 항목

- 없음

## 권장 수정

- 섹션 1: public_article.headline은 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 source title과 거의 동일합니다.
- 섹션 1: public_article.lead는 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 what_changed와 거의 동일합니다.
- 섹션 1: public_article.editorial_story.not_to_overclaim의 내용이 hal_signal_capsule.do_not_overstate와 유사하게 구체적인 HAL/API/메타데이터 계약에 대한 직접적인 영향이 없음을 명시하는 것이 좋습니다.
- 섹션 2: public_article.headline은 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 source title과 거의 동일합니다.
- 섹션 2: public_article.lead는 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 what_changed와 거의 동일합니다.
- 섹션 2: public_article.editorial_story.not_to_overclaim의 내용이 hal_signal_capsule.do_not_overstate와 유사하게 구체적인 HAL/API/메타데이터 계약에 대한 직접적인 영향이 없음을 명시하는 것이 좋습니다.
- 섹션 3: public_article.headline은 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 source title과 거의 동일합니다.
- 섹션 3: public_article.lead는 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 what_changed와 거의 동일합니다.
- 섹션 3: public_article.editorial_story.not_to_overclaim의 내용이 hal_signal_capsule.do_not_overstate와 유사하게 구체적인 HAL/API/메타데이터 계약에 대한 직접적인 영향이 없음을 명시하는 것이 좋습니다.
- 섹션 4: public_article.headline은 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 source title과 거의 동일합니다.
- 섹션 4: public_article.lead는 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성해야 합니다. 현재는 what_changed와 거의 동일합니다.
- 섹션 4: public_article.editorial_story.not_to_overclaim의 내용이 hal_signal_capsule.do_not_overstate와 유사하게 구체적인 HAL/API/메타데이터 계약에 대한 직접적인 영향이 없음을 명시하는 것이 좋습니다.

## 출처 공백

- 없음

## 최종 의견

모든 기사가 Linux 미디어 메일링 리스트의 제안 단계 패치를 다루고 있으며, Camera HAL/Driver 엔지니어에게 실질적인 영향을 미칠 수 있는 내용입니다. 각 기사의 사실 확인, 배경, HAL 관점 해석, 액션 아이템이 잘 구성되어 있습니다. 다만, public_article의 headline, lead, editorial_story.not_to_overclaim 필드에서 원문 또는 what_changed 내용을 그대로 복사하는 경향이 있어, Gemini가 자체적으로 재작성하도록 권장합니다. 이는 편집 정책의 'headline은 source title을 그대로 복사하지 말고, Gemini가 새로 작성하세요' 및 'not_to_overclaim은 해당 article의 source가 직접 뒷받침하지 않는 구체 경고를 새로 작성하세요' 조항을 더 잘 따르기 위함입니다. 현재는 _overclaim_guardrail_hints의 내용을 그대로 복사하고 있습니다. 이미지 후보는 있지만 선택되지 않아 fallback 이미지가 사용된 것은 허용됩니다.
