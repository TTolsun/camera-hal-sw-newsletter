const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKstDate(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function item(title, source, url) {
  return { title, source, url };
}

function makeNewsletter(date) {
  const title = `Camera HAL SW Newsletter - ${date}`;
  const summary = 'Android Camera, CameraX, AI agent, C++ tooling 흐름을 Camera HAL 관점에서 자동 생성한 주간 브리핑입니다.';
  const sources = [
    item('Android CameraX release notes', 'Android Developers', 'https://developer.android.com/jetpack/androidx/releases/camera'),
    item('Android platform release notes', 'Android Developers', 'https://developer.android.com/about/versions'),
    item('AOSP Camera HAL documentation', 'AOSP', 'https://source.android.com/docs/core/camera/camera3'),
    item('GitHub Changelog', 'GitHub', 'https://github.blog/changelog/'),
    item('ISO C++ Blog', 'ISO C++', 'https://isocpp.org/blog'),
    item('Clang release notes', 'LLVM', 'https://releases.llvm.org/'),
    item('Perfetto documentation', 'Perfetto', 'https://perfetto.dev/docs/')
  ];

  const md = `# ${title}

${summary}

## 1. 이번 주 3줄 브리핑

- Android Camera / CameraX 변화는 HAL의 capability, stream 조합, metadata 정합성 관점에서 확인합니다.
- AI agent와 개발 도구 변화는 코드 리뷰, 로그 분석, 테스트 생성 workflow에 붙일 수 있는지 봅니다.
- C++ tooling 변화는 lifetime, callback ownership, warning baseline 관리와 연결해 봅니다.

## 2. AOSP Camera Watch

### Android Camera / CameraX 업데이트 흐름

**배경지식** Camera HAL 입장에서 Android Camera 업데이트는 API 이름보다 request/result metadata, stream 조합, buffer lifecycle에 어떤 영향을 주는지가 더 중요합니다. 앱과 framework가 새 기능을 더 쉽게 요구할수록 HAL은 capability와 실제 동작의 일관성을 더 꼼꼼히 맞춰야 합니다.

**이번 주 확인한 신호**

- CameraX release note와 Android platform release note를 우선 확인합니다.
- AOSP Camera HAL 문서 기준으로 request/result, stream, metadata 영향도를 다시 점검합니다.

**Camera HAL에서 확인해볼 아이템**

- Capability dump와 실제 request/result metadata가 서로 모순되지 않는지 확인합니다.
- Preview, video, still capture 동시 조합에서 stream reconfiguration 실패가 없는지 봅니다.
- CameraX sample app 기준으로 앱이 보는 지원 기능과 HAL 내부 capability를 비교합니다.

**Sources**

- [Android CameraX release notes](https://developer.android.com/jetpack/androidx/releases/camera)
- [Android platform release notes](https://developer.android.com/about/versions)
- [AOSP Camera HAL documentation](https://source.android.com/docs/core/camera/camera3)

## 3. Tech Trend Radar

### AI agent / 개발 생산성 도구 흐름

**배경지식** AI 도구는 단순 질의응답보다 코드 리뷰, 로그 요약, 테스트 초안 생성처럼 workflow에 붙는 방향으로 이동하고 있습니다. Camera HAL처럼 로그가 길고 조건 조합이 많은 영역에서는 AI 출력보다 입력 형식, 근거 표, 검증 checklist가 더 중요합니다.

**이번 주 확인한 신호**

- GitHub Changelog에서 AI coding, review, automation 관련 변화를 확인합니다.
- AI agent를 CI에 붙일 경우 비용, 실패율, 사람이 고친 비율을 같이 봐야 합니다.

**Camera HAL에서 확인해볼 아이템**

- 로그 분석 prompt에는 timestamp, frame number, thread, 근거 log line을 표로 요구합니다.
- 코드 리뷰 prompt에는 CODING_RULES, HAL contract, concurrency, performance 항목을 고정 rubric으로 넣습니다.
- AI agent를 CI에 붙일 경우 실행 시간, 실패율, 사람이 수정한 비율을 함께 기록합니다.

**Sources**

- [GitHub Changelog](https://github.blog/changelog/)
- [Perfetto documentation](https://perfetto.dev/docs/)

## 4. 이번 주 C++ / AI 실전 팁

### Callback lifetime과 자동 리뷰 prompt를 같이 점검하기

**배경지식** Camera HAL C++ 코드에서는 callback, lambda capture, std::function, 참조 멤버가 섞이기 쉽습니다. 특히 생성자 option에서 받은 callback을 저장하는 구조는 복사 저장인지 참조 저장인지가 명확해야 합니다.

**이번 주 확인한 신호**

- ISO C++ Blog와 Clang release notes에서 C++ tooling, warning, static analysis 관련 변화를 확인합니다.

**Camera HAL에서 확인해볼 아이템**

- 생성자 option으로 전달된 callback이 객체 수명보다 오래 살아야 하는지 확인합니다.
- const reference로 저장한 값이 temporary 또는 stack object를 참조하지 않는지 봅니다.
- AI 리뷰 prompt에 callback ownership, lambda capture, reference member lifetime을 우선 점검하라고 명시합니다.

**Sources**

- [ISO C++ Blog](https://isocpp.org/blog)
- [Clang release notes](https://releases.llvm.org/)

## 이번 주 Action Items

- CameraX release note에서 target device에 영향 있는 항목을 하나 골라 capability와 비교합니다.
- AI 로그 분석 prompt template을 팀 공통 문서로 하나 추가합니다.
- callback lifetime 관련 warning/review checklist를 C++ 리뷰 항목에 추가합니다.

## References

${sources.map(s => `- [${s.title}](${s.url})`).join('\n')}
`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="../../css/styles.css" />
</head>
<body>
  <main class="wrap">
    <header class="hero newsletter-hero">
      <p class="eyebrow">WEEKLY NEWSLETTER</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(summary)}</p>
      <div class="actions newsletter-actions">
        <a class="button" href="../../index.html">Archive로 돌아가기</a>
        <a class="button primary" href="newsletter.md">MD 원본 보기</a>
      </div>
    </header>

    <section class="section issue-briefing">
      <h2>1. 이번 주 3줄 브리핑</h2>
      <div class="card">
        <ul>
          <li>Android Camera / CameraX 변화는 HAL의 capability, stream 조합, metadata 정합성 관점에서 확인합니다.</li>
          <li>AI agent와 개발 도구 변화는 코드 리뷰, 로그 분석, 테스트 생성 workflow에 붙일 수 있는지 봅니다.</li>
          <li>C++ tooling 변화는 lifetime, callback ownership, warning baseline 관리와 연결해 봅니다.</li>
        </ul>
      </div>
    </section>

    <section class="section">
      <h2>2. AOSP Camera Watch</h2>
      <div class="card issue-section aosp">
        <span class="issue-kicker">AOSP CAMERA WATCH</span>
        <h3>Android Camera / CameraX 업데이트 흐름</h3>
        <p><strong>배경지식</strong> Camera HAL 입장에서 Android Camera 업데이트는 API 이름보다 request/result metadata, stream 조합, buffer lifecycle에 어떤 영향을 주는지가 더 중요합니다.</p>
        <p><strong>Camera HAL에서 확인해볼 아이템</strong></p>
        <ul>
          <li>Capability dump와 실제 request/result metadata가 서로 모순되지 않는지 확인합니다.</li>
          <li>Preview, video, still capture 동시 조합에서 stream reconfiguration 실패가 없는지 봅니다.</li>
          <li>CameraX sample app 기준으로 앱이 보는 지원 기능과 HAL 내부 capability를 비교합니다.</li>
        </ul>
        <div class="source-list"><strong>Sources</strong><ul><li><a href="https://developer.android.com/jetpack/androidx/releases/camera">Android CameraX release notes</a></li><li><a href="https://developer.android.com/about/versions">Android platform release notes</a></li><li><a href="https://source.android.com/docs/core/camera/camera3">AOSP Camera HAL documentation</a></li></ul></div>
      </div>
    </section>

    <section class="section">
      <h2>3. Tech Trend Radar</h2>
      <div class="card issue-section trend">
        <span class="issue-kicker">TECH TREND RADAR</span>
        <h3>AI agent / 개발 생산성 도구 흐름</h3>
        <p><strong>배경지식</strong> AI 도구는 코드 리뷰, 로그 요약, 테스트 초안 생성처럼 workflow에 붙는 방향으로 이동하고 있습니다.</p>
        <p><strong>Camera HAL에서 확인해볼 아이템</strong></p>
        <ul>
          <li>로그 분석 prompt에는 timestamp, frame number, thread, 근거 log line을 표로 요구합니다.</li>
          <li>코드 리뷰 prompt에는 CODING_RULES, HAL contract, concurrency, performance 항목을 고정 rubric으로 넣습니다.</li>
          <li>AI agent를 CI에 붙일 경우 실행 시간, 실패율, 사람이 수정한 비율을 함께 기록합니다.</li>
        </ul>
        <div class="source-list"><strong>Sources</strong><ul><li><a href="https://github.blog/changelog/">GitHub Changelog</a></li><li><a href="https://perfetto.dev/docs/">Perfetto documentation</a></li></ul></div>
      </div>
    </section>

    <section class="section">
      <h2>4. 이번 주 C++ / AI 실전 팁</h2>
      <div class="card issue-section tip">
        <span class="issue-kicker">C++ / AI TIP</span>
        <h3>Callback lifetime과 자동 리뷰 prompt를 같이 점검하기</h3>
        <p><strong>배경지식</strong> Camera HAL C++ 코드에서는 callback, lambda capture, std::function, 참조 멤버가 섞이기 쉽습니다.</p>
        <p><strong>Camera HAL에서 확인해볼 아이템</strong></p>
        <ul>
          <li>생성자 option으로 전달된 callback이 객체 수명보다 오래 살아야 하는지 확인합니다.</li>
          <li>const reference로 저장한 값이 temporary 또는 stack object를 참조하지 않는지 봅니다.</li>
          <li>AI 리뷰 prompt에 callback ownership, lambda capture, reference member lifetime을 우선 점검하라고 명시합니다.</li>
        </ul>
        <div class="source-list"><strong>Sources</strong><ul><li><a href="https://isocpp.org/blog">ISO C++ Blog</a></li><li><a href="https://releases.llvm.org/">Clang release notes</a></li></ul></div>
      </div>
    </section>

    <section class="section">
      <h2>이번 주 Action Items</h2>
      <div class="card action-card"><ul><li>CameraX release note에서 target device에 영향 있는 항목을 하나 골라 capability와 비교합니다.</li><li>AI 로그 분석 prompt template을 팀 공통 문서로 하나 추가합니다.</li><li>callback lifetime 관련 warning/review checklist를 C++ 리뷰 항목에 추가합니다.</li></ul></div>
    </section>

    <section class="section">
      <h2>References</h2>
      <div class="card reference-list"><ul>${sources.map(s => `<li><a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a></li>`).join('')}</ul></div>
    </section>
  </main>
</body>
</html>
`;

  return { title, summary, md, html };
}

function main() {
  const forcedDate = process.env.NEWSLETTER_DATE;
  const date = forcedDate || formatKstDate(new Date());
  const issue = makeNewsletter(date);
  const dir = path.join(root, 'newsletters', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'newsletter.md'), issue.md, 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), issue.html, 'utf8');

  let newsletters = [];
  if (fs.existsSync(dataPath)) {
    newsletters = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }

  const entry = {
    date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL', 'Android', 'C++', 'AI']
  };

  newsletters = newsletters.filter(item => item.date !== date);
  newsletters.unshift(entry);
  newsletters.sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(dataPath, `${JSON.stringify(newsletters, null, 2)}\n`, 'utf8');
  console.log(`Generated newsletter: ${date}`);
}

main();
