// AndroidX Gerrit REST 응답을 흉내 내는 테스트 도우미. 2026-11-20에 실측한 응답 모양(목록은
// o=CURRENT_REVISION/CURRENT_FILES/CURRENT_COMMIT, diff는 content[].b)을 최소 필드만 남겨 직접 만든
// synthetic 입력이다. generated artifact를 복사한 fixture가 아니고, 테스트는 실제 네트워크를 부르지 않는다.

const GERRIT_PREFIX = ")]}'\n";
const QUIRK_DIR = 'camera/camera-camera2/src/main/java/androidx/camera/camera2/compat/quirk';

function quirkPath(className, extension = 'kt') {
  return `${QUIRK_DIR}/${className}.${extension}`;
}

// files: { 경로: Gerrit 파일 상태 객체 }. 상태가 없으면 수정(M)이다.
function gerritChange({ number, subject, submitted, files = {}, message, updated, moreChanges } = {}) {
  const change = {
    project: 'platform/frameworks/support',
    status: 'MERGED',
    subject,
    _number: number,
    submitted,
    updated: updated || submitted,
    current_revision: `rev${number}`,
    revisions: {
      [`rev${number}`]: {
        files,
        commit: { message: message === undefined ? `${subject}\n\nChange-Id: I${number}\n` : message }
      }
    }
  };
  if (moreChanges) change._more_changes = true;
  return change;
}

function listResponse(changes) {
  return `${GERRIT_PREFIX}${JSON.stringify(changes)}`;
}

// 삭제 줄이 있으면 옛 쪽(a)과 새 쪽(b)이 함께 있는 replace 블록으로 만든다.
function diffResponse(addedLines, removedLines = []) {
  return `${GERRIT_PREFIX}${JSON.stringify({
    change_type: 'MODIFIED',
    content: [{ ab: ['context line'] }, removedLines.length > 0 ? { a: removedLines, b: addedLines } : { b: addedLines }, { skip: 40 }]
  })}`;
}

// changes: 목록 응답에 실을 변경들. diffs: { 변경 번호: 추가 줄 배열 또는 { added, removed } } (없으면 그 diff 조회는 404로 던진다).
// 호출된 URL은 calls에 쌓는다.
function fakeGerritFetch({ changes = [], diffs = {}, listError = null, listText = null } = {}) {
  const calls = [];
  async function fetchTextImpl(url) {
    calls.push(url);
    if (url.includes('/changes/?q=')) {
      if (listError) throw listError;
      return listText === null ? listResponse(changes) : listText;
    }
    const match = /\/changes\/(\d+)\/revisions\/current\/files\/[^/]+\/diff$/.exec(url);
    if (match && Object.prototype.hasOwnProperty.call(diffs, match[1])) {
      const diff = diffs[match[1]];
      return Array.isArray(diff) ? diffResponse(diff) : diffResponse(diff.added, diff.removed);
    }
    throw new Error('404 Not Found');
  }
  fetchTextImpl.calls = calls;
  return fetchTextImpl;
}

module.exports = {
  GERRIT_PREFIX,
  QUIRK_DIR,
  diffResponse,
  fakeGerritFetch,
  gerritChange,
  listResponse,
  quirkPath
};
