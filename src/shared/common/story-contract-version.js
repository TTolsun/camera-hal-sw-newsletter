// Story 계약의 버전 패밀리 표.
//
// 한 아티팩트에는 계약 버전 마커가 셋 있다.
//
//   issue.public_contract_version        'story-v1' | 'story-v2'
//   issue.generation_contract_version    1 | 2
//   section.public_article.story_contract_version  1 | 2
//
// 셋은 항상 같은 버전을 가리켜야 한다. 하나라도 다르면 그 아티팩트가 어느 계약으로
// 만들어졌는지 판정할 수 없고, 렌더·품질 재계산이 서로 다른 계약을 가정하게 된다
// (PR #643이 같은 형태의 혼합 stamp 버그였다).
//
// 표를 generator가 아니라 shared에 두는 이유: 계약 검증(generator/reporter)과 도메인
// 정규화(shared/domain)가 같은 표를 봐야 하는데 shared는 generator를 import할 수 없다
// (check:layer-direction). 두 곳에 같은 매핑을 복사하면 한쪽만 바뀌는 드리프트가 난다.

// 이 표에서 값을 **빼는** 것은 코드만 되돌리는 일이 아니다. 발행된 인덱스 엔트리에 그
// 버전이 stamp돼 있으면 인덱스 검증이 그 엔트리들을 전부 거부한다(무관한 호의 발행까지
// 막힌다). 값을 빼려면 articles/data/newsletters.json backfill이 선행돼야 한다.
const STORY_CONTRACT_VERSIONS = Object.freeze([1, 2]);

const PUBLIC_CONTRACT_VERSION_PREFIX = 'story-v';

function publicContractVersionFor(storyContractVersion) {
  return `${PUBLIC_CONTRACT_VERSION_PREFIX}${storyContractVersion}`;
}

const PUBLIC_CONTRACT_VERSIONS = Object.freeze(
  STORY_CONTRACT_VERSIONS.map(publicContractVersionFor)
);

// 'story-v2' → 2. 표에 없는 값은 0(=버전 없음)이다. 파싱해서 아무 숫자나 받아들이면
// 미지원 버전이 지원되는 것처럼 보인다.
function storyContractVersionFromPublicContractVersion(value) {
  const normalized = String(value == null ? '' : value).trim();
  const index = PUBLIC_CONTRACT_VERSIONS.indexOf(normalized);
  return index === -1 ? 0 : STORY_CONTRACT_VERSIONS[index];
}

function isSupportedStoryContractVersion(value) {
  return STORY_CONTRACT_VERSIONS.includes(Number(value));
}

// 본문을 문단 배열(body_paragraphs)이 아니라 단일 markdown(body_markdown)으로 담는
// 계약 버전인가. 계약 정규화(normalizeBodyField)·도메인 정규화·렌더 분기가 같은 질문을
// 하므로 임계값을 각자 들고 있으면 버전이 늘 때 한쪽만 고쳐져 정규화한 필드와 렌더가
// 읽는 필드가 갈린다. 그 세 곳은 전부 이 술어를 쓴다.
const BODY_MARKDOWN_MIN_CONTRACT_VERSION = 2;

function usesBodyMarkdown(storyContractVersion) {
  return Number(storyContractVersion) >= BODY_MARKDOWN_MIN_CONTRACT_VERSION;
}

// v1은 인덱스에 적지 않는 기본값이다.
const DEFAULT_PUBLIC_CONTRACT_VERSION = PUBLIC_CONTRACT_VERSIONS[0];

// 발행 인덱스에 남길 계약 버전을 정한다. 이 엔트리는 발행 때마다 통째로 교체되므로,
// 규칙을 잘못 잡으면 한 번의 재발행으로 기록이 사라진다.
//
//  - 이슈가 마커를 안 들고 오면 **기존 기록을 보존한다.** 이 파이프라인에서 마커가 빠질 수
//    있다는 건 orchestrator-targeted-repair.js의 `public_contract_version !== undefined`
//    가드가 실증한다. 부재를 v1로 단정하면 재발행 한 번에 story-v2가 조용히 강등된다.
//  - 지원 목록 밖 값은 쓰지 않고 throw한다. 쓰면 같은 저장소의 인덱스 검증기가 자기가 쓴
//    파일을 거부해, 커밋된 인덱스가 오염되고 이후 실행마다 전체 엔트리 스캔이 실패한다.
//  - 기록된 버전을 더 낮은 버전으로 덮어쓰는 것도 throw한다. 강등은 backfill을 동반한
//    의도적 작업이지 발행의 부산물이 아니다.
//
// newsletterKey는 그 인덱스 엔트리를 사람이 찾아갈 식별자다 — daily 인덱스에서는 날짜
// (YYYY-MM-DD), weekly 인덱스에서는 weekly 키(YYYY-Wnn). 판정에는 쓰지 않고 throw 메시지
// 표기에만 쓴다.
function resolveIndexContractVersion(newsletterKey, issue, previousEntry) {
  const declared = String(issue?.public_contract_version || '').trim();
  const previous = String(previousEntry?.public_contract_version || '').trim();

  if (declared && !PUBLIC_CONTRACT_VERSIONS.includes(declared)) {
    throw new Error(
      `Refusing to index newsletter ${newsletterKey} with unsupported public_contract_version "${declared}" ` +
      `(supported: ${PUBLIC_CONTRACT_VERSIONS.join(', ')})`
    );
  }
  // 보존값도 지원 목록을 통과해야 한다. 안 그러면 인덱스에 이미 미지원 값이 있을 때
  // 마커 없는 재발행이 그 값을 검증 없이 다시 써서, 자기 validator가 거부할 파일을 만든다.
  // 버전 표에서 값을 뺀 뒤 backfill 하려는 상황에서 재발행이 복구를 방해하기도 한다.
  if (previous && !PUBLIC_CONTRACT_VERSIONS.includes(previous)) {
    throw new Error(
      `Refusing to reindex newsletter ${newsletterKey}: recorded public_contract_version "${previous}" ` +
      `is not supported (supported: ${PUBLIC_CONTRACT_VERSIONS.join(', ')})`
    );
  }
  if (!declared) return previous;
  if (previous && PUBLIC_CONTRACT_VERSIONS.indexOf(declared) < PUBLIC_CONTRACT_VERSIONS.indexOf(previous)) {
    throw new Error(
      `Refusing to downgrade newsletter ${newsletterKey} contract version from "${previous}" to "${declared}"`
    );
  }
  return declared;
}

// 인덱스 엔트리에 펼쳐 넣을 계약 버전 필드. 기록할 값이 없거나 기본값(v1)이면 빈 객체다 —
// v1을 적으면 기존 발행분과 엔트리 모양이 갈린다.
//
// 인덱스는 둘이다: daily articles/data/newsletters.json(publish 레이어가 쓴다)과
// 홈·아카이브가 실제로 fetch하는 weekly articles/data/newsletters-weekly.json(render
// 레이어가 쓴다). render는 publish를 import할 수 없으므로(check:layer-direction) 판정을
// 두 writer가 공유하려면 여기(shared)에 있어야 한다. 판정을 각자 들고 있으면 보존·미지원
// 거부·강등 거부 규칙이 한쪽만 바뀌는 드리프트가 난다.
function indexContractVersionField(newsletterKey, issue, previousEntry) {
  const resolved = resolveIndexContractVersion(newsletterKey, issue, previousEntry);
  if (!resolved || resolved === DEFAULT_PUBLIC_CONTRACT_VERSION) return {};
  return { public_contract_version: resolved };
}

module.exports = {
  PUBLIC_CONTRACT_VERSIONS,
  STORY_CONTRACT_VERSIONS,
  indexContractVersionField,
  isSupportedStoryContractVersion,
  publicContractVersionFor,
  storyContractVersionFromPublicContractVersion,
  usesBodyMarkdown
};
