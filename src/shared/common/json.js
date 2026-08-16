// side-effect: filesystem read/write
const fs = require('fs');
const path = require('path');

function readJsonIfExists(filePath) {
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

// 손상되면 파이프라인을 멈추는 state 파일은 부분 기록을 남기면 안 된다. 임시 파일에 다 쓴 뒤
// rename으로 갈아끼워, 실행이 중간에 끊겨도 잘린 JSON이 정본 자리에 남지 않게 한다.
function writeJsonAtomic(filePath, value, options = {}) {
  const writeFileSync = options.writeFileSync || fs.writeFileSync;
  const renameSync = options.renameSync || fs.renameSync;
  const unlinkSync = options.unlinkSync || fs.unlinkSync;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // Preserve the original write/rename failure.
    }
    throw error;
  }
}

module.exports = { readJsonIfExists, writeJsonAtomic };
