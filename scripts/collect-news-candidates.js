const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sourcesPath = path.join(root, 'docs', 'sources.md');

const CAMERA_KEYWORDS = [
  'camera', 'camerax', 'camera2', 'hal', 'image', 'capture', 'raw', 'raw10', 'raw12', 'raw14',
  'ultra hdr', 'hdr', 'dynamic range', 'stream', 'buffer', 'metadata', 'session', 'android'
];
const TECH_KEYWORDS = [
  'c++', 'cpp', 'clang', 'llvm', 'ndk', 'build', 'test', 'gtest', 'googletest', 'perfetto',
  'github', 'copilot', 'agent', 'ai', 'model', 'developer', 'tool', 'automation'
];

const FEED_HINTS = [
  {
    match: 'android-developers.googleblog.com',
    feed: 'https://android-developers.googleblog.com/feeds/posts/default?alt=rss'
  },
  {
    match: 'isocpp.org/blog',
    feed: 'https://isocpp.org/blog/rss/category/news'
  },
  {
    match: 'github.blog/changelog',
    feed: 'https://github.blog/changelog/feed/'
  },
  {
    match: 'developers.googleblog.com',
    feed: 'https://developers.googleblog.com/feeds/posts/default?alt=rss'
  },
  {
    match: 'openai.com/news',
    feed: 'https://openai.com/news/rss.xml'
  }
];

function kstDate(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function decode(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decode(match[1]) : '';
}

function parseSources() {
  if (!fs.existsSync(sourcesPath)) {
    throw new Error('Missing docs/sources.md');
  }
  const markdown = fs.readFileSync(sourcesPath, 'utf8');
  const sources = [];
  const regex = /^-\s+([^:]+):\s+(https?:\/\/\S+)/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    sources.push({ name: match[1].trim(), url: match[2].trim() });
  }
  if (sources.length === 0) {
    throw new Error('No sources found in docs/sources.md');
  }
  return sources;
}

function feedFor(url) {
  const hint = FEED_HINTS.find(item => url.includes(item.match));
  return hint ? hint.feed : null;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'camera-hal-sw-newsletter/1.0',
      'accept': 'text/html,application/rss+xml,application/xml,text/xml,*/*'
    }
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function parseRss(xml, source) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block => {
    const title = tag(block, 'title');
    const linkTag = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const link = tag(block, 'link') || (linkTag ? linkTag[1] : source.url);
    const date = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published');
    const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    return normalizeCandidate({
      source: source.name,
      sourceUrl: source.url,
      title,
      url: link,
      publishedAt: date,
      summary
    });
  }).filter(item => item.title && item.url);
}

function parseHtmlPage(html, source) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || source.name);
  const description = decode(
    (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) || [])[1] ||
    (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i) || [])[1] ||
    'RSS feed가 없는 공식 페이지입니다. 변경 이력 또는 release note 확인 후보로 사용합니다.'
  );
  return [normalizeCandidate({
    source: source.name,
    sourceUrl: source.url,
    title,
    url: source.url,
    publishedAt: '',
    summary: description
  })];
}

function normalizeCandidate(raw) {
  const text = `${raw.title} ${raw.summary}`.toLowerCase();
  const cameraHits = CAMERA_KEYWORDS.filter(keyword => text.includes(keyword)).length;
  const techHits = TECH_KEYWORDS.filter(keyword => text.includes(keyword)).length;
  const score = cameraHits * 3 + techHits;
  const category = cameraHits > 0 ? 'AOSP Camera Watch' : 'Tech Trend Radar';
  return {
    ...raw,
    title: decode(raw.title),
    summary: decode(raw.summary).slice(0, 500),
    relevanceScore: score,
    category,
    reason: buildReason(cameraHits, techHits)
  };
}

function buildReason(cameraHits, techHits) {
  if (cameraHits > 0 && techHits > 0) return 'Camera HAL 관점과 개발 생산성 관점 모두에서 검토할 가치가 있습니다.';
  if (cameraHits > 0) return 'Android Camera, CameraX, HAL contract, stream/buffer/metadata 영향 가능성이 있습니다.';
  if (techHits > 0) return 'C++, AI, GitHub, 빌드/테스트/자동화 생산성 관점에서 검토할 가치가 있습니다.';
  return '공식 출처이지만 Camera HAL 연결성은 편집자가 추가 판단해야 합니다.';
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function withinLookback(candidate, now, lookbackDays) {
  const date = parseDate(candidate.publishedAt);
  if (!date) return true;
  const ageMs = now.getTime() - date.getTime();
  return ageMs >= 0 && ageMs <= lookbackDays * 24 * 60 * 60 * 1000;
}

function dedupe(candidates) {
  const seen = new Set();
  const result = [];
  for (const item of candidates) {
    const key = item.url.replace(/[?#].*$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mdEscape(value = '') {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function markdown(date, candidates, failures, lookbackDays) {
  const groups = candidates.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const lines = [];
  lines.push(`# News Candidates - ${date}`);
  lines.push('');
  lines.push('이 Issue는 GitHub Action이 `docs/sources.md`의 공식 출처를 기준으로 무료 수집한 뉴스 후보입니다. OpenAI API는 사용하지 않았습니다. 돈을 아끼기 위해 기계가 링크 줍기만 하는, 꽤 건전한 노동 분업입니다.');
  lines.push('');
  lines.push(`- Lookback: 최근 ${lookbackDays}일 기준`);
  lines.push(`- Candidate count: ${candidates.length}`);
  lines.push('- Next step: 이 후보 목록을 ChatGPT에 붙여넣고 뉴스레터 Markdown/HTML을 편집합니다.');
  lines.push('');
  lines.push('## ChatGPT 편집 요청 프롬프트');
  lines.push('');
  lines.push('```text');
  lines.push(`Camera HAL SW Newsletter ${date} 발행용 기사로 편집해줘.`);
  lines.push('아래 GitHub Action 수집 후보를 기반으로 작성하고, 부족한 부분은 공식 출처를 우선 확인해줘.');
  lines.push('조건: 한국어, Camera HAL 엔지니어 대상, AOSP/CameraX/C++/AI 포함, 각 주요 뉴스마다 배경지식과 Camera HAL에서 확인해볼 아이템 포함, 마지막에 References 포함.');
  lines.push('산출물: newsletter.md, index.html, fact-check-report.md, editor-in-chief-brief.md, release-qa-report.md');
  lines.push('```');
  lines.push('');

  for (const [category, items] of Object.entries(groups)) {
    lines.push(`## ${category}`);
    lines.push('');
    lines.push('| Score | Source | Title | Published | Why it matters | Link |');
    lines.push('|---:|---|---|---|---|---|');
    for (const item of items) {
      lines.push(`| ${item.relevanceScore} | ${mdEscape(item.source)} | ${mdEscape(item.title)} | ${mdEscape(item.publishedAt || '확인 필요')} | ${mdEscape(item.reason)} | [link](${item.url}) |`);
    }
    lines.push('');
  }

  lines.push('## Raw Candidates');
  lines.push('');
  for (const [index, item] of candidates.entries()) {
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push('');
    lines.push(`- Source: ${item.source}`);
    lines.push(`- Published: ${item.publishedAt || '확인 필요'}`);
    lines.push(`- Link: ${item.url}`);
    lines.push(`- Category: ${item.category}`);
    lines.push(`- Relevance Score: ${item.relevanceScore}`);
    lines.push(`- Summary: ${item.summary || '요약 없음'}`);
    lines.push(`- Selection reason: ${item.reason}`);
    lines.push('');
  }

  lines.push('## Collector Failures');
  lines.push('');
  if (failures.length === 0) {
    lines.push('- 없음');
  } else {
    for (const failure of failures) {
      lines.push(`- ${failure.source}: ${failure.message}`);
    }
  }
  lines.push('');
  lines.push('## Editor-in-Chief Checklist');
  lines.push('');
  lines.push('- [ ] 후보가 공식 출처 기반인가?');
  lines.push('- [ ] Camera HAL 관점 해석이 가능한가?');
  lines.push('- [ ] 단순 제품 홍보나 일반 IT 뉴스는 제외했는가?');
  lines.push('- [ ] 최종 뉴스레터에 출처와 References가 남아 있는가?');
  lines.push('- [ ] 발행 전 `01 - Manual Newsletter Publish`와 `02 - Validate Site`를 통과했는가?');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();
  const lookbackDays = Number(process.env.LOOKBACK_DAYS || 21);
  const now = new Date();
  const sources = parseSources();
  const failures = [];
  let candidates = [];

  for (const source of sources) {
    try {
      const feed = feedFor(source.url);
      const target = feed || source.url;
      const text = await fetchText(target);
      const parsed = feed ? parseRss(text, source) : parseHtmlPage(text, source);
      candidates.push(...parsed);
    } catch (error) {
      failures.push({ source: source.name, message: error.message });
    }
  }

  candidates = dedupe(candidates)
    .filter(item => withinLookback(item, now, lookbackDays))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 40);

  if (candidates.length === 0) {
    throw new Error('No news candidates collected. Check docs/sources.md or network access.');
  }

  const outDir = path.join(root, 'collected-news', date);
  const newsroomDir = path.join(root, 'newsroom', date);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });

  fs.writeFileSync(path.join(outDir, 'candidates.json'), JSON.stringify({ date, lookbackDays, candidates, failures }, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(newsroomDir, 'news-candidates.md'), markdown(date, candidates, failures, lookbackDays), 'utf8');
  fs.writeFileSync(path.join(root, '.tmp', 'news-candidate-date.txt'), date, 'utf8');

  console.log(`Collected ${candidates.length} candidates for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
