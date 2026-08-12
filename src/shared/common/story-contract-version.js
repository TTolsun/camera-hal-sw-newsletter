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

module.exports = {
  PUBLIC_CONTRACT_VERSIONS,
  STORY_CONTRACT_VERSIONS,
  isSupportedStoryContractVersion,
  publicContractVersionFor,
  storyContractVersionFromPublicContractVersion,
  usesBodyMarkdown
};
