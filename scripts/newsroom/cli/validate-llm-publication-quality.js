const fs = require('fs');
const path = require('path');
const {
  callLlmJson,
  getLlmDiagnostics
} = require('../llm/llm-client');
const {
  newsroomDir,
  newsroomRelPath
} = require('../common/artifact-paths');

const string = { type: 'STRING' };

const issueSchema = {
  type: 'OBJECT',
  properties: {
    field: string,
    severity: string,
    reason: string,
    suggested_fix: string
  },
  required: ['field', 'severity', 'reason']
};

const publicationQualitySchema = {
  type: 'OBJECT',
  properties: {
    date: string,
    overall_pass: { type: 'BOOLEAN' },
    summary: string,
    issues: {
      type: 'ARRAY',
      items: issueSchema
    }
  },
  required: ['date', 'overall_pass', 'summary', 'issues']
};

const ALLOWED_ISSUE_SEVERITIES = new Set(['P1', 'P2', 'P3']);

const root = process.cwd();
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');

function fail(message) {
  throw new Error(message);
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function normalizeDate(value) {
  const date = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function targetDate() {
  if (fs.existsSync(newsletterDatePath)) {
    const date = normalizeDate(fs.readFileSync(newsletterDatePath, 'utf8'));
    if (!date) fail('.tmp/newsletter-date.txt must contain YYYY-MM-DD.');
    return date;
  }
  if (process.env.REQUIRE_NEWSLETTER_DATE_FILE === '1') {
    fail('Missing .tmp/newsletter-date.txt for post-generation LLM validation.');
  }
  return normalizeDate(process.env.NEWSLETTER_DATE);
}

function truncate(value, maxLength = 20000) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[truncated ${text.length - maxLength} chars]`;
}

function htmlText(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function newsletterEntry(date) {
  const dataPath = path.join(root, 'data', 'newsletters.json');
  const entries = readJsonIfExists(dataPath);
  if (!Array.isArray(entries)) return null;
  return entries.find(item => item?.date === date) || null;
}

function promptFor(date, artifacts) {
  return [
    'Post-generation public newsletter quality judge input JSON:',
    JSON.stringify({
      date,
      instruction: [
        'Judge the final rendered public newsletter artifacts, not intermediate editor drafts.',
        'Do not fail solely because final_publish_ready=false, review_publication_ready=true, or publication_mode=fallback_public.',
        'For fallback_public / review_only_public output, pass when the public issue is clearly disclosed, source-linked, coherent, and does not overstate Camera HAL impact.',
        'Return P1 or P2 only for issues that should block creating the review PR. Use P3 for non-blocking polish.'
      ],
      newsletter_entry: artifacts.entry,
      generation_status: artifacts.statusSummary,
      markdown: truncate(artifacts.markdown),
      html_text: truncate(htmlText(artifacts.html), 12000)
    }, null, 2)
  ].join('\n');
}

function systemInstruction() {
  return [
    'You are the post-generation quality judge for the Camera HAL / SW newsletter.',
    'Evaluate only the final public Markdown/HTML artifacts.',
    'Focus on public readability, source disclosure, overclaim risk, fallback/review-only disclosure, and whether the issue is safe to send to editor review.',
    'Do not rewrite the article. Return JSON only.'
  ].join('\n');
}

function normalizeSeverity(value) {
  const severity = String(value || '').trim().toUpperCase();
  return severity || 'P2';
}

function normalizeReport(raw = {}, date) {
  return {
    schemaVersion: 1,
    date: normalizeDate(raw.date) || date,
    overall_pass: raw.overall_pass === true,
    summary: String(raw.summary || '').trim(),
    issues: Array.isArray(raw.issues)
      ? raw.issues.map(issue => ({
        field: String(issue?.field || 'public_artifacts').trim(),
        severity: normalizeSeverity(issue?.severity),
        reason: String(issue?.reason || '').trim(),
        suggested_fix: String(issue?.suggested_fix || '').trim()
      })).filter(issue => issue.reason)
      : [],
    llm_diagnostics: getLlmDiagnostics()
  };
}

function blockingIssues(report) {
  return report.issues.filter(issue => {
    const severity = normalizeSeverity(issue.severity);
    return severity === 'P1' || severity === 'P2' || !ALLOWED_ISSUE_SEVERITIES.has(severity);
  });
}

function renderMarkdown(report) {
  const lines = [
    `# LLM Publication Quality Report - ${report.date}`,
    '',
    `- overall_pass: ${String(report.overall_pass)}`,
    `- blocking_issue_count: ${blockingIssues(report).length}`,
    `- summary: ${report.summary || 'n/a'}`,
    '',
    '## Issues',
    ''
  ];
  if (report.issues.length === 0) {
    lines.push('- none');
  } else {
    for (const issue of report.issues) {
      lines.push(`- ${issue.severity} ${issue.field}: ${issue.reason}${issue.suggested_fix ? ` Suggested fix: ${issue.suggested_fix}` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function validateLlmPublicationQuality(options = {}) {
  const date = options.date || targetDate();
  if (!date) {
    console.log('No post-generation newsletter date selected; skipped LLM publication quality validation.');
    return null;
  }

  const markdownPath = path.join(root, 'newsletters', date, 'newsletter.md');
  const htmlPath = path.join(root, 'newsletters', date, 'index.html');
  const statusPath = path.join(newsroomDir(root, date), 'generation-status.json');
  const markdown = readTextIfExists(markdownPath);
  const html = readTextIfExists(htmlPath);
  if (!markdown) fail(`Missing public Markdown artifact: newsletters/${date}/newsletter.md`);
  if (!html) fail(`Missing public HTML artifact: newsletters/${date}/index.html`);

  const status = readJsonIfExists(statusPath) || {};
  const statusSummary = {
    status: status.status || '',
    final_publish_ready: status.final_publish_ready ?? null,
    review_publication_ready: status.review_publication_ready ?? null,
    public_state: status.public_state || '',
    run_mode: status.run_mode || '',
    publication_mode: status.publication_mode || '',
    fallback_only: status.fallback_only ?? null,
    fallback_public_ready: status.fallback_public_ready ?? null,
    homepage_badge: status.homepage_badge || ''
  };
  const raw = await callLlmJson(
    'post-generation public quality judge',
    systemInstruction(),
    promptFor(date, {
      markdown,
      html,
      entry: newsletterEntry(date),
      statusSummary
    }),
    publicationQualitySchema
  );
  const report = normalizeReport(raw, date);
  const reportPath = path.join(newsroomDir(root, date), 'llm-publication-quality-report.json');
  const markdownReportPath = path.join(newsroomDir(root, date), 'llm-publication-quality-report.md');
  writeJson(reportPath, report);
  writeText(markdownReportPath, renderMarkdown(report));

  const blockers = blockingIssues(report);
  if (report.overall_pass !== true || blockers.length > 0) {
    const details = blockers.map(issue => `${issue.severity} ${issue.field}: ${issue.reason}`).join('\n');
    fail(`LLM publication quality validation failed for ${date}.${details ? `\n${details}` : ''}`);
  }

  console.log(`LLM publication quality validation passed for ${date}.`);
  console.log(`Wrote ${newsroomRelPath(date, 'llm-publication-quality-report.json')}`);
  return report;
}

if (require.main === module) {
  validateLlmPublicationQuality().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  blockingIssues,
  normalizeReport,
  promptFor,
  validateLlmPublicationQuality
};
