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

module.exports = {
  PUBLIC_CONTRACT_VERSIONS,
  STORY_CONTRACT_VERSIONS,
  isSupportedStoryContractVersion,
  publicContractVersionFor,
  storyContractVersionFromPublicContractVersion
};
