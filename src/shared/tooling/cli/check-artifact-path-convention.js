const { checkArtifactPathConvention } = require('../validate/artifact-path-convention-check');

function main() {
  const result = checkArtifactPathConvention({ root: process.cwd() });

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning.path}: ${warning.reason}`);
    }
  }

  if (!result.ok) {
    console.error('artifact-path-convention: 커밋된 artifact-manifest.json이 자기 날짜의 경로 규약을 어겼다.');
    console.error('Remediation: 커밋된 매니페스트는 감사 기록이라 사후에 정규화하지 않는다. 새 매니페스트가 옛 규약으로 쓰였다면 생산자(write-artifact-manifest.js)를 고치고, 과거 매니페스트가 바뀌었다면 그 변경을 되돌린다.');
    console.error('');
    for (const violation of result.violations) {
      console.error(`  ${violation.label}: ${violation.key}[] "${violation.path}" — ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log(`artifact-path-convention: OK — ${result.checkedManifestCount} manifest(s) checked, ${result.warnings.length} warning(s), 0 violations.`);
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
