const fs = require('fs');
const path = require('path');

const {
  validateRenderedIssueStructure
} = require('../validate/rendered-issue-structure');

const REQUIRED_PUBLIC_NEWSLETTER_FILES = [
  'newsletters/${date}/newsletter.md',
  'newsletters/${date}/index.html',
  'data/newsletters.json'
];

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
    `newsletters/${date}/index.html`,
    `newsletters/${date}/newsletter.md`
  ];
}

function requiredPublicFiles(date) {
  return REQUIRED_PUBLIC_NEWSLETTER_FILES.map(file => file.replaceAll('${date}', date));
}

function newsletterIndexDateStatus(root, date) {
  const dataPath = path.join(root, 'data', 'newsletters.json');
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
      error: new Error('data/newsletters.json must contain an array')
    };
  }
  const entry = result.value.find(item => item?.date === date) || null;
  const expectedHtml = `newsletters/${date}/index.html`;
  const expectedMd = `newsletters/${date}/newsletter.md`;
  const pathErrors = [];
  if (!entry) {
    pathErrors.push(`data/newsletters.json missing date entry ${date}`);
  } else {
    if (entry.html !== expectedHtml) pathErrors.push(`data/newsletters.json html path mismatch: ${entry.html || 'missing'}`);
    if (entry.md !== expectedMd) pathErrors.push(`data/newsletters.json md path mismatch: ${entry.md || 'missing'}`);
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

function publicFileStatuses(root, date) {
  return requiredPublicFiles(date).map(relativePath => {
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
    { label: "fetch('data/newsletters.json')", pattern: /fetch\(\s*['"]data\/newsletters\.json['"]/ },
    { label: 'loadNewsletters', pattern: /\bloadNewsletters\b/ },
    { label: 'latest-card', pattern: /latest-card/ },
    { label: 'archive-list', pattern: /archive-list/ }
  ];
  return checks
    .filter(check => !check.pattern.test(html))
    .map(check => `root index.html missing ${check.label} contract`);
}

function publicNewsletterStructureStatus(root, date) {
  const statuses = publicFileStatuses(root, date);
  const errors = [];
  for (const status of statuses) {
    if (!status.exists) errors.push(`missing required public file: ${status.path}`);
    else if (status.error) errors.push(`unreadable required public file: ${status.path}: ${status.error.message}`);
    else if (!status.nonEmpty) errors.push(`empty required public file: ${status.path}`);
  }

  const newsletterMd = statuses.find(item => item.path.endsWith('/newsletter.md'));
  const newsletterHtml = statuses.find(item => item.path.endsWith('/index.html'));
  const dataIndex = newsletterIndexDateStatus(root, date);
  if (!dataIndex.exists) {
    errors.push('missing data/newsletters.json');
  } else if (dataIndex.error) {
    errors.push(`invalid data/newsletters.json: ${dataIndex.error.message}`);
  } else {
    errors.push(...dataIndex.pathErrors);
  }

  if (newsletterHtml?.text && !/<a\s+[^>]*href=["'](?:\.\/)?newsletter\.md["']/i.test(newsletterHtml.text)) {
    errors.push(`Newsletter HTML missing newsletter.md link: newsletters/${date}/index.html`);
  }

  errors.push(...rootIndexContractErrors(root));

  if (newsletterMd?.nonEmpty && newsletterHtml?.nonEmpty) {
    const editorResult = readJsonResult(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'));
    const structural = validateRenderedIssueStructure({
      date,
      editor: editorResult.error ? null : editorResult.value,
      markdown: newsletterMd.text,
      html: newsletterHtml.text,
      root
    });
    if (!structural.ok) {
      errors.push(...structural.errors.map(error => `structural: ${error}`));
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

module.exports = {
  REQUIRED_PUBLIC_NEWSLETTER_FILES,
  newsletterIndexDateStatus,
  publicNewsletterPaths,
  publicNewsletterStructureStatus,
  requiredPublicFiles,
  rootIndexContractErrors
};
