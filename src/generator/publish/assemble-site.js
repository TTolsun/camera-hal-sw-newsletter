// GitHub Pages Actions 배포용 정적 사이트 조립기(#262 phase 6).
//
// 저장소 루트에는 index.html만 남고, 그 외 모든 공개 출력물은 articles/ 아래에 있다.
// 이 스크립트는 _site/ 디렉터리를 다음과 같이 구성해 서빙 URL을 보존한다:
//   _site/index.html        <- 루트 index.html
//   _site/<...>             <- articles/<...> 전체 내용(루트로 평탄화)
//   _site/.nojekyll         <- Jekyll 처리 비활성화
//
// 결과적으로 서빙 URL(/, /newsletters/..., /content/..., /css/..., /assets/...,
// /data/newsletters.json, /sitemap.xml, /robots.txt, /archive.html 등)은 이동 전과 동일하다.
//
// 파일 복사와 배포 셸의 공통 footer 링크 보강만 수행한다(네트워크/API 호출 없음).
// import 가능하며 CLI로도 실행된다.

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = 'articles';
const ROOT_INDEX = 'index.html';
const AI_ENGINEERING_PAGE = path.join('learning', 'ai-engineering', 'index.html');
const AI_ENGINEERING_LABEL = 'AI Engineering Lab';

// index.html이 fetch하지만 articles/ 밖(저장소 config/)에 있는 서빙 파일.
// 이동 전 site root에서 /config/subscription.json으로 서빙되었으므로 parity를 위해 함께 복사한다.
// 항목을 추가하면 .github/workflows/site-02-deploy.yml의 push.paths에도 같이 넣어야 그 파일만
// 바뀐 머지가 배포를 깨운다. 두 목록의 정합성은 site-02-deploy-workflow.test.js가 강제한다.
const EXTRA_SERVED_FILES = [
  path.join('config', 'subscription.json')
];

function copyDirContents(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirContents(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      // 심볼릭 링크는 대상 파일을 그대로 복사한다(배포물에 링크를 남기지 않는다).
      fs.copyFileSync(fs.realpathSync(srcPath), destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function posixPath(value) {
  return String(value).split(path.sep).join('/');
}

// 과거 newsletter HTML은 생성 산출물 보존 정책상 footer 링크 하나를 위해 다시 쓰지 않는다.
// 대신 배포용 사본에만 공통 리소스 링크를 보강한다. 새 renderer가 이미 링크를 출력하는
// 페이지는 기대 상대경로로 정규화만 하며 중복 링크를 만들지 않는다.
function withLearningFooterLink(html, href) {
  const input = String(html || '');
  const footerMatch = input.match(/<footer\b[^>]*\bclass=(['"])[^'"]*\bsite-footer\b[^'"]*\1[^>]*>[\s\S]*?<\/footer>/i);
  if (!footerMatch) return input;

  const newline = input.includes('\r\n') ? '\r\n' : '\n';
  const link = `<a class="footer-link" href="${href}">${AI_ENGINEERING_LABEL}</a>`;
  const existingLink = /<a\s+class=(['"])footer-link\1\s+href=(['"])[^'"]*\2>AI Engineering Lab<\/a>/i;
  const resourceTitle = /^([ \t]*)<span class="footer-col-title">리소스<\/span>/m;
  const footerOpening = /^<footer\b[^>]*>/i;
  let footer = footerMatch[0];

  if (existingLink.test(footer)) {
    footer = footer.replace(existingLink, link);
  } else if (resourceTitle.test(footer)) {
    footer = footer.replace(resourceTitle, (line, indent) => `${line}${newline}${indent}${link}`);
  } else {
    footer = footer.replace(
      footerOpening,
      opening => `${opening}${newline}    <div class="content-wrap legacy-footer-resources">${newline}      ${link}${newline}    </div>`
    );
  }

  return `${input.slice(0, footerMatch.index)}${footer}${input.slice(footerMatch.index + footerMatch[0].length)}`;
}

function addLearningFooterLinks(outDir) {
  const learningPage = path.join(outDir, AI_ENGINEERING_PAGE);
  let updated = 0;

  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') continue;

      const before = fs.readFileSync(file, 'utf8');
      const href = posixPath(path.relative(path.dirname(file), learningPage)) || 'index.html';
      const after = withLearningFooterLink(before, href);
      if (after === before) continue;
      fs.writeFileSync(file, after, 'utf8');
      updated += 1;
    }
  }

  visit(outDir);
  return updated;
}

function assembleSite({ root = process.cwd(), out } = {}) {
  if (!out) throw new Error('assembleSite requires an output directory (out)');
  const outDir = path.resolve(root, out);

  // 깨끗한 출력물을 위해 기존 _site를 비운다.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const copied = [];

  const rootIndexPath = path.join(root, ROOT_INDEX);
  if (!fs.existsSync(rootIndexPath)) {
    throw new Error(`assembleSite: root ${ROOT_INDEX} is required but missing`);
  }
  fs.copyFileSync(rootIndexPath, path.join(outDir, ROOT_INDEX));
  copied.push(ROOT_INDEX);

  const articlesDir = path.join(root, ARTICLES_DIR);
  if (!fs.existsSync(articlesDir)) {
    throw new Error(`assembleSite: ${ARTICLES_DIR}/ is required but missing`);
  }
  copyDirContents(articlesDir, outDir);
  copied.push(`${ARTICLES_DIR}/**`);

  for (const relPath of EXTRA_SERVED_FILES) {
    const srcPath = path.join(root, relPath);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(outDir, relPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied.push(relPath);
    }
  }

  const footerLinksUpdated = addLearningFooterLinks(outDir);

  // GitHub Pages가 _ 로 시작하는 디렉터리/파일을 Jekyll로 처리하지 않도록 한다.
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');

  return { outDir, copied, footerLinksUpdated };
}

function parseArgs(argv) {
  const args = { out: '_site' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) {
      args.out = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const result = assembleSite({ root: process.cwd(), out: args.out });
  console.log(`Assembled static site into ${result.outDir} (${result.copied.join(', ')}).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  assembleSite,
  withLearningFooterLink,
  addLearningFooterLinks,
  EXTRA_SERVED_FILES
};
