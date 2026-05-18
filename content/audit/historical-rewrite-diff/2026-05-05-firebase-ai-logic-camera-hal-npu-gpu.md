# Historical Rewrite Diff: 2026-05-05 Firebase AI Logic

## Scope

- Date: 2026-05-05
- Article slug: `firebase-ai-logic-camera-hal-npu-gpu`
- Cleanup issue: #108
- Rewrite status: `material_rewrite`

## Original Summary

The original article framed Firebase AI Logic and Gemini model support as a direct Camera HAL runtime signal. It said camera stream requirements could change, NPU/GPU/ISP load could shift, HAL would need to manage resource contention, AI results could be reinjected as camera metadata, and the team should measure frame drops, latency, thermal state, and device resource load with a Gemini app scenario.

## Rewritten Summary

The rewritten article treats Firebase AI Logic as an adjacent product-integration risk. It keeps the source-backed facts about hybrid inference and Gemini model availability, then asks the HAL team to first confirm whether a product path actually routes camera frames through Firebase AI Logic. Only if such a path exists should the team review camera input format, buffer boundaries, latency/power budget, privacy, and data path with app/framework owners.

## Removed Overclaim

- Removed the implication that Firebase AI Logic itself changes Camera HAL runtime contracts.
- Removed unsupported assumptions about NPU/GPU/ISP scheduling responsibility inside HAL.
- Removed the metadata reinjection scenario as an assumed HAL interface expansion.
- Removed Gemini Nano Banana, frame-drop, and thermal-measurement action items that were not directly supported by the cited source.

## Source-Backed Clarification

This rewrite is source-backed clarification only. It does not add new technical claims, benchmarks, API behavior, or HAL contract changes beyond the cited Firebase AI Logic / hybrid inference source.
