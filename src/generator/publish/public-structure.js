const fs = require('fs');
const path = require('path');

const {
  validateRenderedIssueStructure
} = require('../quality/rendered-issue-structure');
const {
  validatePublicNewsletterArtifacts
} = require('../quality/public-newsletter');

// 디스크 존재 검사용 경로(articles/ 아래). data/newsletters.json의 html/md 필드에 저장되는
// 서빙 URL(newsletters/<date>/...)과는 구분된다.
const REQUIRED_PUBLIC_NEWSLETTER_FILES = [
  'articles/newsletters/${date}/newsletter.md',
  'articles/newsletters/${date}/index.html',
  'articles/data/newsletters.json'
];

const REQUIRED_PUBLIC_WEEKLY_FILES = [
  'articles/newsletters/${date}/newsletter.md',
  'articles/newsletters/${date}/index.html',
  'articles/newsletters/${date}/issue.json',
  'articles/data/newsletters-weekly.json'
];

// 주간호와 일간호는 같은 렌더러가 만들지만 계약이 다르다. 무엇이 다른지를 여기 한 곳에 모아
// 두면, 검사를 늘릴 때 두 레인 중 어느 쪽 규칙인지를 코드가 먼저 답한다(#905 작업 범위 1).
//
// 레인이 실제로 갈라지는 것은 세 가지뿐이다. 규칙을 하나씩 발행본에 돌려 본 결과다.
//
//  - 브리핑 줄 수: 일간만 정확한 개수를 요구한다. 주간호는 그 주 기사 수만큼 갖는다.
//  - root index.html: 저장소에 하나뿐이라 일간 레인이 이미 본다. 주간에서 또 보면 같은 오류가
//    두 번 보고된다.
//  - 인덱스 JSON 전수 검사: 같은 이유로 일간 레인에 맡긴다. 주간 레인까지 두 인덱스를 전 엔트리
//    순회하면, 과거 호 엔트리 하나가 어긋났을 때 이후 모든 실행의 주간 관측이 영구히 errors가
//    되고, 오류 절단(상위 5건) 때문에 현재 호의 실제 오류가 밀려난다.
//
// 콘텐츠 계약(validatePublicNewsletterArtifacts)은 주간 레인도 부른다. 처음에는 "일간 전용
// 규칙이라 오탐이 난다"고 보고 뺐는데, 발행된 주간호 19개에 돌려 보니 오류가 0건이었다.
// 규칙 내용도 레인 중립적이다 — 내부 상태 용어 유출 금지, 출처 링크 계약, 기사당 문단 수다.
//
// 그 검사에 넘기는 publicationMode·fallbackOnly는 지금 판정에 쓰이지 않는다(그 값을 받는
// allowedForbiddenTerms가 빈 Set을 돌려준다). 게다가 주간 issue.json이 갖는 필드는
// publish_mode라 여기서 읽는 publication_mode는 항상 undefined다. 나중에 그 파라미터가
// 살아나면 주간 레인은 기본 모드로만 돌게 되므로, 그때 이 자리를 다시 봐야 한다.
const DAILY_LANE = {
  id: 'daily',
  indexRelativePath: 'articles/data/newsletters.json',
  entryKey: entry => entry?.date,
  requiredFiles: REQUIRED_PUBLIC_NEWSLETTER_FILES,
  editorPathSegments: key => ['articles', 'content', 'newsroom', key, 'editor-draft.json'],
  checksRootIndex: true,
  checksPublicContentContract: true,
  validatesDataIndex: true,
  briefingBulletCount: 3
};

const WEEKLY_LANE = {
  id: 'weekly',
  indexRelativePath: 'articles/data/newsletters-weekly.json',
  // 주간 항목에도 date가 있지만 그것은 주 시작일이다. 경로 대조가 키로 도는 이상 weeklyKey여야
  // 하고, date로 잡으면 html/md 경로 대조에서 깨진다.
  entryKey: entry => entry?.weeklyKey,
  requiredFiles: REQUIRED_PUBLIC_WEEKLY_FILES,
  editorPathSegments: key => ['articles', 'newsletters', key, 'issue.json'],
  checksRootIndex: false,
  checksPublicContentContract: true,
  validatesDataIndex: false,
  // 주간호는 그 주에 실린 기사 수만큼 브리핑 줄을 갖는다. 일간의 "정확히 3" 규칙을 겨누면
  // 정상 호가 오류로 잡힌다(2026-W37은 5줄). 비어 있지 않은지만 확인한다.
  briefingBulletCount: null
};

function readTextResult(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, text: '', error: null };
  }
  try {
    return { exists: true, text: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (error) {
    return { exists: true, text: '', error };
  }
}

function readJsonResult(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, value: null, error: null };
  }
  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null
    };
  } catch (error) {
    return { exists: true, value: null, error };
  }
}

function publicNewsletterPaths(date) {
  return [
    `articles/newsletters/${date}/index.html`,
    `articles/newsletters/${date}/newsletter.md`
  ];
}

function requiredPublicFiles(date, lane = DAILY_LANE) {
  return lane.requiredFiles.map(file => file.replaceAll('${date}', date));
}

function newsletterIndexDateStatus(root, date, lane = DAILY_LANE) {
  const dataPath = path.join(root, ...lane.indexRelativePath.split('/'));
  const result = readJsonResult(dataPath);
  if (!result.exists) {
    return { exists: false, hasDate: false, entry: null, pathsMatch: false, pathErrors: [], error: null };
  }
  if (result.error) {
    return { exists: true, hasDate: false, entry: null, pathsMatch: false, pathErrors: [], error: result.error };
  }
  if (!Array.isArray(result.value)) {
    return {
      exists: true,
      hasDate: false,
      entry: null,
      pathsMatch: false,
      pathErrors: [],
      error: new Error(`${lane.indexRelativePath} must contain an array`)
    };
  }
  const entry = result.value.find(item => lane.entryKey(item) === date) || null;
  const expectedHtml = `newsletters/${date}/index.html`;
  const expectedMd = `newsletters/${date}/newsletter.md`;
  const pathErrors = [];
  if (!entry) {
    pathErrors.push(`${lane.indexRelativePath} missing date entry ${date}`);
  } else {
    if (entry.html !== expectedHtml) pathErrors.push(`${lane.indexRelativePath} html path mismatch: ${entry.html || 'missing'}`);
    if (entry.md !== expectedMd) pathErrors.push(`${lane.indexRelativePath} md path mismatch: ${entry.md || 'missing'}`);
  }
  return {
    exists: true,
    hasDate: Boolean(entry),
    entry,
    pathsMatch: pathErrors.length === 0,
    pathErrors,
    error: null
  };
}

function publicFileStatuses(root, date, lane = DAILY_LANE) {
  return requiredPublicFiles(date, lane).map(relativePath => {
    const absolutePath = path.join(root, relativePath);
    const read = readTextResult(absolutePath);
    return {
      path: relativePath,
      exists: read.exists,
      nonEmpty: read.exists && String(read.text || '').trim().length > 0,
      error: read.error,
      text: read.text
    };
  });
}

function rootIndexContractErrors(root) {
  const indexPath = path.join(root, 'index.html');
  const read = readTextResult(indexPath);
  if (!read.exists) return ['root index.html missing'];
  if (read.error) return [`root index.html unreadable: ${read.error.message}`];
  const html = read.text;
  const checks = [
    { label: "fetch('data/newsletters-weekly.json')", pattern: /fetch\(\s*['"]data\/newsletters(?:-weekly)?\.json['"]/ },
    { label: 'loadNewsletters', pattern: /\bloadNewsletters\b/ },
    { label: 'featured-card', pattern: /featured-card/ },
    { label: 'latest-grid', pattern: /latest-grid/ }
  ];
  return checks
    .filter(check => !check.pattern.test(html))
    .map(check => `root index.html missing ${check.label} contract`);
}

function structureStatusForLane(root, date, lane) {
  const statuses = publicFileStatuses(root, date, lane);
  const errors = [];
  for (const status of statuses) {
    if (!status.exists) errors.push(`missing required public file: ${status.path}`);
    else if (status.error) errors.push(`unreadable required public file: ${status.path}: ${status.error.message}`);
    else if (!status.nonEmpty) errors.push(`empty required public file: ${status.path}`);
  }

  const newsletterMd = statuses.find(item => item.path.endsWith('/newsletter.md'));
  const newsletterHtml = statuses.find(item => item.path.endsWith('/index.html'));
  const dataIndex = newsletterIndexDateStatus(root, date, lane);
  if (!dataIndex.exists) {
    errors.push(`missing ${lane.indexRelativePath}`);
  } else if (dataIndex.error) {
    errors.push(`invalid ${lane.indexRelativePath}: ${dataIndex.error.message}`);
  } else {
    errors.push(...dataIndex.pathErrors);
  }

  if (lane.checksRootIndex) {
    errors.push(...rootIndexContractErrors(root));
  }

  if (newsletterMd?.nonEmpty && newsletterHtml?.nonEmpty) {
    const editorResult = readJsonResult(path.join(root, ...lane.editorPathSegments(date)));
    const structural = validateRenderedIssueStructure({
      date,
      editor: editorResult.error ? null : editorResult.value,
      markdown: newsletterMd.text,
      html: newsletterHtml.text,
      root,
      validateDataIndex: lane.validatesDataIndex,
      briefingBulletCount: lane.briefingBulletCount
    });
    if (!structural.ok) {
      errors.push(...structural.errors.map(error => `structural: ${error}`));
    }
    if (lane.checksPublicContentContract) {
      const publicErrors = validatePublicNewsletterArtifacts({
        markdown: newsletterMd.text,
        html: newsletterHtml.text,
        markdownLabel: `newsletters/${date}/newsletter.md`,
        htmlLabel: `newsletters/${date}/index.html`,
        publicationMode: editorResult.error ? '' : editorResult.value?.publication_mode,
        fallbackOnly: editorResult.error ? false : editorResult.value?.fallback_only === true
      });
      errors.push(...publicErrors.map(error => `public contract: ${error}`));
    }
  }

  const requiredFilesExist = statuses.every(status => status.exists);
  const requiredFilesNonEmpty = statuses.every(status => status.nonEmpty);
  return {
    ok: errors.length === 0,
    errors,
    dataIndex,
    requiredFilesExist,
    requiredFilesNonEmpty,
    statuses
  };
}

function publicNewsletterStructureStatus(root, date) {
  return structureStatusForLane(root, date, DAILY_LANE);
}

// 독자가 홈과 아카이브에서 실제로 여는 페이지는 주간호다. 발행 시점에 그 페이지를 검사하는
// 경로가 없어서, 렌더가 만든 결과가 계약을 지키는지 확인되지 않은 채 나갔다(#905).
//
// 이 함수를 부르는 자리는 반드시 repair 이후여야 한다. newsroom:repair-images가 주간 3종과
// newsletters-weekly.json의 article_images를 다시 쓰므로, 그 전에 이미지 계약을 판정하면
// repair가 곧 바인딩할 임시 상태를 최종으로 오판한다.
function weeklyNewsletterStructureStatus(root, weeklyKey) {
  return structureStatusForLane(root, weeklyKey, WEEKLY_LANE);
}

module.exports = {
  DAILY_LANE,
  REQUIRED_PUBLIC_NEWSLETTER_FILES,
  REQUIRED_PUBLIC_WEEKLY_FILES,
  WEEKLY_LANE,
  newsletterIndexDateStatus,
  publicNewsletterPaths,
  publicNewsletterStructureStatus,
  requiredPublicFiles,
  rootIndexContractErrors,
  weeklyNewsletterStructureStatus
};
