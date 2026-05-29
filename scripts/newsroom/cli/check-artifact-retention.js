const { checkArtifactRetentionTracked } = require('../validate/artifact-retention-tracked-check');

function main() {
  const result = checkArtifactRetentionTracked({ root: process.cwd() });

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning.path}: ${warning.reason}`);
    }
  }

  if (!result.ok) {
    console.error('artifact-retention: the following files are graded debug_heavy or transient_attempt and must NOT be committed to Git.');
    console.error('Remediation: download from the GitHub Actions artifact newsroom-final-debug-<run_id> or see artifact-manifest.json -> retained_heavy_artifacts. Run `git rm` to remove them from tracking.');
    console.error('');
    for (const violation of result.violations) {
      console.error(`  ${violation.path}  [grade=${violation.grade}, group=${violation.group}]`);
    }
    process.exit(1);
  }

  console.log(`artifact-retention: OK — ${result.warnings.length} unknown-file warning(s), 0 violations.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`- ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main };
