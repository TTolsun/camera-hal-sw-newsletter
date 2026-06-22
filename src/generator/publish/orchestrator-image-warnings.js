// 발행 orchestrator의 이미지 fallback 경고/오탐 정리 모음(#655).
// warnResolvedImageFallbacks는 렌더된 이슈 섹션의 resolvedImage가 fallback을 썼을 때 사람이
// 리뷰할 수 있도록 stderr 경고를 찍고, pruneResolvedFallbackImageFalsePositives는 fact-check가
// 이미 해소된 fallback 이미지를 must-fix로 잘못 잡은 항목을 제거한다. 둘 다 "이미지 fallback 진단"
// 이라는 한 역할로 묶인다. 의존성은 newsletter-renderer의 ensureArray와 fact-check-repair의
// pruneResolvedFallbackImageFactCheckItems(+root)뿐이라 god-file을 import하지 않는다(순환 없음).
// root는 god-file과 동일하게 process.cwd()로 load 시점에 한 번 파생한다.
const {
  ensureArray
} = require('../render/newsletter-renderer');
const {
  pruneResolvedFallbackImageFactCheckItems
} = require('../reporter/fact-check-repair');

const root = process.cwd();

function warnResolvedImageFallbacks(issue) {
  for (const section of ensureArray(issue.sections)) {
    const resolved = section.resolvedImage || {};
    if (!resolved.usedFallback) continue;
    console.warn([
      'Warning: article image fallback applied',
      `  section: ${section.category || 'unknown section'}`,
      `  article: ${section.headline || 'unknown article'}`,
      `  original: ${resolved.originalUrl || resolved.originalSrc || section.originalImage || 'n/a'}`,
      `  fallback: ${resolved.url || resolved.src}`,
      `  reason: ${resolved.reason || 'unknown'}`
    ].join('\n'));
  }
}

function pruneResolvedFallbackImageFalsePositives(factCheck, editor) {
  const result = pruneResolvedFallbackImageFactCheckItems(factCheck, editor, { root });
  if (result.removed.length > 0) {
    console.warn(`Pruned ${result.removed.length} resolved fallback image fact-check false positive(s).`);
  }
  return result.factCheck;
}

module.exports = {
  warnResolvedImageFallbacks,
  pruneResolvedFallbackImageFalsePositives
};
