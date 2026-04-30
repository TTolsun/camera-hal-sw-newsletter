function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownLink(source) {
  const title = source.title || source.url || 'Source';
  return `- [${title}](${source.url})`;
}

function sourceListMarkdown(sources) {
  return ensureArray(sources).filter(source => source && source.url).map(markdownLink).join('\n');
}

function sourceListHtml(sources) {
  return ensureArray(sources)
    .filter(source => source && source.url)
    .map(source => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title || source.url)}</a></li>`)
    .join('');
}

function bulletsMarkdown(items) {
  return ensureArray(items).map(item => `- ${item}`).join('\n');
}

function bulletsHtml(items) {
  return ensureArray(items).map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function normalizedSections(issue) {
  const sections = ensureArray(issue.sections);
  return [
    { heading: '## 2. AOSP Camera Watch', htmlHeading: '2. AOSP Camera Watch', className: 'aosp', section: sections[0] },
    { heading: '## 3. Tech Trend Radar', htmlHeading: '3. Tech Trend Radar', className: 'trend', section: sections[1] },
    { heading: '## 4. 이번 주 C++ / AI 실전 팁', htmlHeading: '4. 이번 주 C++ / AI 실전 팁', className: 'tip', section: sections[2] }
  ];
}

function buildMarkdown(issue) {
  return `# ${issue.title}

${issue.summary}

## 1. 이번 주 3줄 브리핑

${bulletsMarkdown(issue.briefing)}

${normalizedSections(issue).map(({ heading, section }) => `${heading}

### ${section.headline}

**이번 주 확인한 사실**

${section.what_changed}

**배경지식**

${section.background}

**업무 관점 해석**

${section.why_it_matters}

**Camera HAL에서 확인해볼 아이템**

${bulletsMarkdown(section.camera_hal_checks)}

**Action Hints**

${bulletsMarkdown(section.action_hints)}

**Sources**

${sourceListMarkdown(section.sources)}
`).join('\n---\n\n')}

## 이번 주 Action Items

${bulletsMarkdown(issue.action_items)}

## References

${sourceListMarkdown(issue.references)}
`;
}

function buildHtml(issue) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(issue.title)}</title>
  <link rel="stylesheet" href="../../css/styles.css" />
</head>
<body>
  <main class="wrap">
    <header class="hero newsletter-hero">
      <p class="eyebrow">WEEKLY NEWSLETTER</p>
      <h1>${escapeHtml(issue.title)}</h1>
      <p class="subtitle">${escapeHtml(issue.summary)}</p>
      <div class="actions newsletter-actions">
        <a class="button" href="../../index.html">Archive로 돌아가기</a>
        <a class="button primary" href="newsletter.md">MD 원본 보기</a>
      </div>
    </header>

    <section class="section issue-briefing">
      <h2>1. 이번 주 3줄 브리핑</h2>
      <div class="card">
        <ul>${bulletsHtml(issue.briefing)}</ul>
      </div>
    </section>

${normalizedSections(issue).map(({ htmlHeading, className, section }) => `    <section class="section">
      <h2>${escapeHtml(htmlHeading)}</h2>
      <div class="card issue-section ${className}">
        <span class="issue-kicker">${escapeHtml(section.category)}</span>
        <h3>${escapeHtml(section.headline)}</h3>
        <p><strong>이번 주 확인한 사실</strong> ${escapeHtml(section.what_changed)}</p>
        <p><strong>배경지식</strong> ${escapeHtml(section.background)}</p>
        <p><strong>업무 관점 해석</strong> ${escapeHtml(section.why_it_matters)}</p>
        <p><strong>Camera HAL에서 확인해볼 아이템</strong></p>
        <ul>${bulletsHtml(section.camera_hal_checks)}</ul>
        <p><strong>Action Hints</strong></p>
        <ul>${bulletsHtml(section.action_hints)}</ul>
        <div class="source-list"><strong>Sources</strong><ul>${sourceListHtml(section.sources)}</ul></div>
      </div>
    </section>`).join('\n\n')}

    <section class="section">
      <h2>이번 주 Action Items</h2>
      <div class="card action-card"><ul>${bulletsHtml(issue.action_items)}</ul></div>
    </section>

    <section class="section">
      <h2>References</h2>
      <div class="card reference-list"><ul>${sourceListHtml(issue.references)}</ul></div>
    </section>
  </main>
</body>
</html>
`;
}

function buildFactCheckMarkdown(date, report) {
  const mustFix = ensureArray(report.must_fix);
  return `# Fact Check Report - ${date}

## Status

${report.status}

## Must Fix

${mustFix.length === 0 ? '- 없음' : mustFix.map(item => `- Location: ${item.location}
  - Problem: ${item.problem}
  - Suggestion: ${item.suggestion}
  - Source: ${item.source_url}`).join('\n')}

## Recommended Fixes

${ensureArray(report.recommended_fixes).length === 0 ? '- 없음' : bulletsMarkdown(report.recommended_fixes)}

## Source Gaps

${ensureArray(report.source_gaps).length === 0 ? '- 없음' : bulletsMarkdown(report.source_gaps)}

## Final Comment

${report.final_comment}
`;
}

function buildEditorChiefBrief(date, issue, factCheck) {
  const firstSection = ensureArray(issue.sections)[0] || {};
  const decision = factCheck.status === 'PASS' ? 'APPROVE' : 'REQUEST_CHANGES';
  return `# Editor-in-Chief Brief - ${date}

## 이번 호 핵심 메시지

${issue.summary}

## 메인으로 봐야 할 기사

${firstSection.headline || 'AOSP Camera Watch 항목을 우선 확인하세요.'}

## Camera HAL 실무 연결 포인트

${bulletsMarkdown(ensureArray(issue.action_items).slice(0, 5))}

## 검수 결과 요약

- Status: ${factCheck.status}
- Must fix count: ${ensureArray(factCheck.must_fix).length}
- Source gap count: ${ensureArray(factCheck.source_gaps).length}
- Comment: ${factCheck.final_comment}

## 편집장 확인 checklist

- [ ] 이번 호 핵심 메시지가 Camera HAL 업무와 직접 연결되는가?
- [ ] 주요 항목의 출처가 충분하고 과장 표현이 없는가?
- [ ] 검수 결과의 must_fix가 모두 해소되었는가?
- [ ] 팀에 공유해도 되는 action item으로 정리되었는가?

## 권장 판단

${decision}
`;
}

function buildReleaseQaReport(date, files, validateResult, factCheck, todoFound, emptySourceSections) {
  return `# Release QA Report - ${date}

## 생성 파일 목록

${files.map(file => `- ${file}`).join('\n')}

## validate-site.js 실행 결과

${validateResult}

## 남은 TODO 여부

${todoFound ? 'TODO 문자열이 남아 있습니다.' : '없음'}

## 출처 누락 여부

${emptySourceSections.length === 0 ? '없음' : emptySourceSections.map(section => `- ${section}`).join('\n')}

## Gemini 검수 결과

- Status: ${factCheck.status}
- Must fix count: ${ensureArray(factCheck.must_fix).length}
`;
}

module.exports = {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  ensureArray
};
