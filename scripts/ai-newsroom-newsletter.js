const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-5-mini';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!apiKey) {
  fail('Missing OPENAI_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.');
}

function kstDate(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function sourceListMarkdown(sources) {
  return ensureArray(sources)
    .map(source => `- [${source.title || source.url}](${source.url})`)
    .join('\n');
}

function sourceListHtml(sources) {
  return ensureArray(sources)
    .map(source => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title || source.url)}</a></li>`)
    .join('');
}

function bulletsMarkdown(items) {
  return ensureArray(items).map(item => `- ${item}`).join('\n');
}

function bulletsHtml(items) {
  return ensureArray(items).map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getJsonFromText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error('Model did not return valid JSON.');
  }
}

async function callOpenAI(stage, instructions, input) {
  const body = {
    model,
    input: [
      {
        role: 'system',
        content: instructions
      },
      {
        role: 'user',
        content: input
      }
    ],
    tools: [
      { type: 'web_search_preview' }
    ],
    text: {
      format: {
        type: 'json_object'
      }
    }
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    fail(`[${stage}] OpenAI API failed: ${response.status}\n${errorText}`);
  }

  const data = await response.json();
  const outputText = data.output_text || ensureArray(data.output)
    .flatMap(item => ensureArray(item.content))
    .filter(content => content.type === 'output_text' || content.type === 'text')
    .map(content => content.text)
    .join('\n');

  if (!outputText) {
    fail(`[${stage}] Empty model output.`);
  }

  return getJsonFromText(outputText);
}

function buildMarkdown(issue) {
  const sections = ensureArray(issue.sections);
  const references = ensureArray(issue.references);
  return `# ${issue.title}\n\n${issue.summary}\n\n## 1. 이번 주 3줄 브리핑\n\n${bulletsMarkdown(issue.briefing)}\n\n${sections.map((section, index) => {
    const heading = index === 0 ? '## 2. AOSP Camera Watch' : index === 1 ? '## 3. Tech Trend Radar' : '## 4. 이번 주 C++ / AI 실전 팁';
    return `${heading}\n\n### ${section.headline}\n\n**무슨 내용인가** ${section.what_changed}\n\n**배경지식** ${section.background}\n\n**Camera HAL에서는 왜 중요한가** ${section.why_it_matters}\n\n**Camera HAL에서 확인해볼 아이템**\n\n${bulletsMarkdown(section.camera_hal_checks)}\n\n**이번 주 Action Hint**\n\n${bulletsMarkdown(section.action_hints)}\n\n**Sources**\n\n${sourceListMarkdown(section.sources)}\n`;
  }).join('\n')}\n## 이번 주 Action Items\n\n${bulletsMarkdown(issue.action_items)}\n\n## References\n\n${sourceListMarkdown(references)}\n`;
}

function buildHtml(issue) {
  const sections = ensureArray(issue.sections);
  const classNames = ['aosp', 'trend', 'tip'];
  const headings = ['2. AOSP Camera Watch', '3. Tech Trend Radar', '4. 이번 주 C++ / AI 실전 팁'];
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

${sections.map((section, index) => `    <section class="section">
      <h2>${escapeHtml(headings[index] || `Section ${index + 2}`)}</h2>
      <div class="card issue-section ${classNames[index] || 'trend'}">
        <span class="issue-kicker">${escapeHtml(section.category || headings[index] || 'NEWS')}</span>
        <h3>${escapeHtml(section.headline)}</h3>
        <p><strong>무슨 내용인가</strong> ${escapeHtml(section.what_changed)}</p>
        <p><strong>배경지식</strong> ${escapeHtml(section.background)}</p>
        <p><strong>Camera HAL에서는 왜 중요한가</strong> ${escapeHtml(section.why_it_matters)}</p>
        <p><strong>Camera HAL에서 확인해볼 아이템</strong></p>
        <ul>${bulletsHtml(section.camera_hal_checks)}</ul>
        <p><strong>이번 주 Action Hint</strong></p>
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

function writeNewsroomArtifact(date, name, content) {
  const dir = path.join(root, 'newsroom', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

async function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();
  const todayContext = `Newsletter date: ${date}\nTimezone: Asia/Seoul\nAudience: Samsung Camera HAL / Android Camera / C++ engineers.`;

  const reporter = await callOpenAI(
    'reporter',
    `너는 Camera HAL SW Newsletter의 기자다. 최신 뉴스를 수집하라. 반드시 JSON만 출력한다. 출력 형식: {"candidates":[{"title":"","source":"","published_date":"","url":"","summary":"","camera_hal_relevance_score":1,"relevance_reason":"","impact_areas":["request/result","metadata","stream","buffer","performance","test","debugging"]}]}. 공식 문서와 신뢰 가능한 출처를 우선한다.`,
    `${todayContext}\n\nAndroid Camera, CameraX, AOSP Camera, C++, LLVM/Clang, AI Agent, 개발 생산성 도구의 최신 뉴스를 찾아라. Camera HAL 엔지니어에게 의미 있는 후보만 8~12개로 추려라.`
  );

  writeNewsroomArtifact(date, 'news-candidates.md', `# News Candidates - ${date}\n\n${ensureArray(reporter.candidates).map((c, i) => `## ${i + 1}. ${c.title}\n\n- 출처: ${c.source}\n- 날짜: ${c.published_date}\n- 링크: ${c.url}\n- 관련도: ${c.camera_hal_relevance_score}\n- 영향 영역: ${ensureArray(c.impact_areas).join(', ')}\n- 요약: ${c.summary}\n- 판단 이유: ${c.relevance_reason}\n`).join('\n')}`);

  const editor = await callOpenAI(
    'editor',
    `너는 Camera HAL SW Newsletter의 편집자다. 기자 후보를 바탕으로 한국어 뉴스레터 초안을 작성한다. 반드시 JSON만 출력한다. 출력 형식: {"title":"","summary":"","briefing":["","",""],"sections":[{"category":"AOSP Camera Watch|Tech Trend Radar|C++ / AI Practical Tip","headline":"","what_changed":"","background":"","why_it_matters":"","camera_hal_checks":[""],"action_hints":[""],"sources":[{"title":"","url":""}]}],"action_items":[""],"references":[{"title":"","url":""}]}. sections는 정확히 3개, briefing은 정확히 3개다. 사실과 해석을 구분하고 과장하지 않는다.`,
    `${todayContext}\n\n기자 후보 JSON:\n${JSON.stringify(reporter, null, 2)}\n\nCamera HAL 엔지니어가 10분 안에 읽고 바로 업무 관점으로 생각할 수 있게 초안을 작성하라.`
  );

  writeNewsroomArtifact(date, 'editor-draft.md', buildMarkdown(editor));

  const checker = await callOpenAI(
    'fact-checker',
    `너는 Camera HAL SW Newsletter의 1차 검수자다. 초안의 사실성, 출처, 과장 여부를 검토한다. 반드시 JSON만 출력한다. 출력 형식: {"status":"PASS|NEEDS_FIX","must_fix":[{"location":"","problem":"","suggestion":"","source_url":""}],"recommended_fixes":[""],"source_gaps":[""],"final_comment":""}. 문장을 예쁘게 고치지 말고 사실 오류와 출처 누락을 잡아라.`,
    `${todayContext}\n\n초안 JSON:\n${JSON.stringify(editor, null, 2)}\n\n출처가 주장을 뒷받침하는지 검토하라.`
  );

  writeNewsroomArtifact(date, 'fact-check-report.md', `# Fact Check Report - ${date}\n\n## Status\n\n${checker.status}\n\n## Must Fix\n\n${ensureArray(checker.must_fix).map(item => `- 위치: ${item.location}\n  - 문제: ${item.problem}\n  - 제안: ${item.suggestion}\n  - 근거: ${item.source_url}`).join('\n')}\n\n## Recommended Fixes\n\n${bulletsMarkdown(checker.recommended_fixes)}\n\n## Source Gaps\n\n${bulletsMarkdown(checker.source_gaps)}\n\n## Final Comment\n\n${checker.final_comment}\n`);

  const chief = await callOpenAI(
    'chief-editor-brief',
    `너는 편집장에게 보고하는 보좌관이다. 김경환 편집장이 빠르게 판단할 수 있게 승인 요청 요약을 만든다. 반드시 JSON만 출력한다. 출력 형식: {"main_message":"","why_this_issue_matters":"","editor_in_chief_checklist":[""],"recommended_decision":"APPROVE|REQUEST_CHANGES","notes_for_kh":[""]}.`,
    `${todayContext}\n\n초안 JSON:\n${JSON.stringify(editor, null, 2)}\n\n검수 결과:\n${JSON.stringify(checker, null, 2)}\n\n편집장 김경환이 PR에서 볼 승인 요청 요약을 만들어라.`
  );

  writeNewsroomArtifact(date, 'editor-in-chief-brief.md', `# Editor-in-Chief Brief - ${date}\n\n## Main Message\n\n${chief.main_message}\n\n## Why This Issue Matters\n\n${chief.why_this_issue_matters}\n\n## Checklist\n\n${bulletsMarkdown(chief.editor_in_chief_checklist)}\n\n## Recommended Decision\n\n${chief.recommended_decision}\n\n## Notes for 김경환\n\n${bulletsMarkdown(chief.notes_for_kh)}\n\n## Approval Command\n\n\`/approve-newsletter\`\n\n## Change Request Command\n\n\`/request-change\`\n`);

  const newsletterDir = path.join(root, 'newsletters', date);
  fs.mkdirSync(newsletterDir, { recursive: true });
  fs.writeFileSync(path.join(newsletterDir, 'newsletter.md'), buildMarkdown(editor), 'utf8');
  fs.writeFileSync(path.join(newsletterDir, 'index.html'), buildHtml(editor), 'utf8');

  let newsletters = readJsonIfExists(dataPath, []);
  const entry = {
    date,
    title: editor.title,
    summary: editor.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL', 'Android', 'C++', 'AI']
  };
  newsletters = newsletters.filter(item => item.date !== date);
  newsletters.unshift(entry);
  newsletters.sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(dataPath, `${JSON.stringify(newsletters, null, 2)}\n`, 'utf8');

  const releaseQa = {
    status: 'READY_FOR_EDITOR_IN_CHIEF_REVIEW',
    checked: [
      'newsletter.md generated',
      'index.html generated',
      'data/newsletters.json updated',
      'newsroom artifacts generated',
      'final validation should run with scripts/validate-site.js'
    ]
  };
  writeNewsroomArtifact(date, 'release-qa-report.md', `# Release QA Report - ${date}\n\n## Status\n\n${releaseQa.status}\n\n## Checked\n\n${bulletsMarkdown(releaseQa.checked)}\n`);

  console.log(`AI newsroom newsletter generated for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
