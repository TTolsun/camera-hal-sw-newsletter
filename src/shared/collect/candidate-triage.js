// 수집 후보 LLM 1차 선별(#1258, 2026-10-07 결정).
//
// 예전에는 relevance 하한(키워드 점수 30) -> 소스 우선순위·키워드 점수 정렬 -> 상위 50건으로 잘랐다.
// 키워드 개수는 기사의 실무 가치를 재지 못한다: 2026-10-05 실행에서 이 두 단계로 약 300건이 LLM
// 판단 전에 사라졌고(relevance 219, 전역 상한 80), 그 안에는 Claude Sonnet 5.5 출시 글과 LWN·
// Collabora 카메라 글이 있었다. 반대로 대명사 "its"가 Camera ITS로 잡힌 고객 사례 글은 살아남았다.
//
// 이 모듈은 전역 상한 자리를 LLM 판단으로 바꾼다. 경계는 다음과 같다.
// - LLM은 "어느 후보를 다음 단계로 넘길지"만 고른다. main 자격(source binding, dated evidence,
//   버킷, cap/floor)은 그대로 결정론 코드가 정한다(#724 coverage 권한 경계). 여기서 고른 후보도
//   이후 selection에서 똑같은 규칙을 받는다.
// - LLM이 없는 환경(키 없음, 호출 실패, 응답 형식 오류)에서는 예전 키워드 순서 결과를 그대로 쓴다.
//   수집이 LLM 때문에 멈추지 않는다.
// - LLM이 상한보다 적게 고르면 남은 자리는 키워드 순서로 채운다. 한 호의 입력량이 실행마다 크게
//   흔들리지 않게 한다.
// - 프롬프트 크기를 묶기 위해 판단 풀은 MAX_TRIAGE_POOL건(키워드 순서 상위)으로 자른다.

const MAX_TRIAGE_POOL = 400;
const SUMMARY_PREVIEW_LENGTH = 280;

const TRIAGE_MODES = Object.freeze({
  ALL_FIT: 'all_fit',
  LLM: 'llm',
  KEYWORD_FALLBACK: 'keyword_fallback'
});

const SYSTEM_INSTRUCTION = [
  'You triage news candidates for a weekly newsletter read by Camera HAL software engineers.',
  'Their work: AOSP Camera framework and Camera HAL, camera kernel drivers, V4L2 and libcamera, ISP and image sensors,',
  'SoC camera and multimedia platforms, Android camera/media APIs, and the C++ and AI developer tools they use daily',
  '(compilers, sanitizers, profilers, coding agents, and major AI model releases from official vendors).',
  'Pick the candidates that give this reader the most practical value this week: concrete changes they may need to act on,',
  'test, or understand. Skip customer case studies, funding or partnership announcements, general business news,',
  'and items unrelated to camera, multimedia, platform, or developer tooling work.',
  'Judge by meaning, not by keyword overlap. Return candidate ids only from the given list, most valuable first.'
].join(' ');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    selected: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          reason: { type: 'STRING' }
        },
        required: ['id']
      }
    }
  },
  required: ['selected']
};

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function candidateKey(candidate) {
  return text(candidate.url) || text(candidate.title);
}

function candidateDate(candidate) {
  return text(candidate.publishedAt || candidate.published_date).slice(0, 10);
}

function triageItems(pool) {
  return pool.map((candidate, index) => ({
    id: `c${index + 1}`,
    source: text(candidate.source_name || candidate.source || candidate.source_id),
    source_priority: text(candidate.source_priority),
    published: candidateDate(candidate),
    title: text(candidate.title),
    summary: text(candidate.summary).slice(0, SUMMARY_PREVIEW_LENGTH)
  }));
}

function buildTriagePrompt(items, maxFinal) {
  return [
    `Select up to ${maxFinal} candidates. Return fewer if fewer are worth reading.`,
    'Candidates (JSON lines):',
    ...items.map(item => JSON.stringify(item))
  ].join('\n');
}

// LLM 응답에서 쓸 수 있는 선택만 남긴다: 목록에 있는 id, 중복 없이, 상한까지.
function parseTriageSelection(response, items, maxFinal) {
  const known = new Map(items.map((item, index) => [item.id, index]));
  const seen = new Set();
  const picks = [];
  for (const entry of Array.isArray(response?.selected) ? response.selected : []) {
    const id = text(entry?.id);
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    picks.push({ index: known.get(id), reason: text(entry?.reason).slice(0, 200) });
    if (picks.length >= maxFinal) break;
  }
  return picks;
}

function reportEntry(candidate, extra = {}) {
  return {
    source_id: text(candidate.source_id),
    title: text(candidate.title),
    url: text(candidate.url),
    ...extra
  };
}

/**
 * 판단 풀에서 다음 단계로 넘길 후보를 고른다.
 *
 * @param {object[]} pool 판단 대상. 소스별 상한까지 적용한 목록이며 키워드 순서로 정렬돼 있어야 한다.
 * @param {object} options
 * @param {number} options.maxFinal 넘길 최대 건수.
 * @param {object[]} options.keywordFallback LLM을 못 쓸 때 쓰는 예전 결과(키워드 하한·순서·상한 적용).
 * @param {Function|null} options.callLlm (systemInstruction, prompt, schema) => Promise<json>. 없으면 폴백.
 * @returns {Promise<{candidates: object[], report: object}>}
 */
async function triageCandidatePool(pool, { maxFinal, keywordFallback, callLlm = null } = {}) {
  const usable = Array.isArray(pool) ? pool : [];
  const fallback = Array.isArray(keywordFallback) ? keywordFallback : usable.slice(0, maxFinal);
  const baseReport = { pool_size: usable.length, max_final: maxFinal };

  const triagePool = usable.slice(0, MAX_TRIAGE_POOL);
  const fallbackResult = reason => ({
    candidates: fallback,
    report: {
      ...baseReport,
      mode: TRIAGE_MODES.KEYWORD_FALLBACK,
      failure_reason: reason,
      selected_count: fallback.length,
      filled_by_keyword_count: fallback.length
    }
  });

  // LLM이 없으면 풀 크기와 상관없이 예전 결과를 그대로 쓴다(relevance 하한 포함).
  if (typeof callLlm !== 'function') return fallbackResult('llm_unavailable');
  if (usable.length <= maxFinal) {
    return {
      candidates: usable,
      report: { ...baseReport, mode: TRIAGE_MODES.ALL_FIT, selected_count: usable.length, filled_by_keyword_count: 0 }
    };
  }

  const items = triageItems(triagePool);
  let picks;
  try {
    const response = await callLlm(SYSTEM_INSTRUCTION, buildTriagePrompt(items, maxFinal), RESPONSE_SCHEMA);
    picks = parseTriageSelection(response, items, maxFinal);
  } catch (error) {
    return fallbackResult(`llm_call_failed: ${text(error?.message).slice(0, 300)}`);
  }
  if (picks.length === 0) return fallbackResult('llm_selected_nothing');

  // 채움은 URL로 겹침을 판단하고, 판단 풀에 있는 후보만 쓴다. 폴백 목록은 relevance 하한을 건 뒤
  // 시리즈 접기와 소스별 상한을 따로 다시 적용해 만들므로, 풀에 없는 후보(같은 소스의 9번째 글,
  // 같은 시리즈의 다른 패치)가 들어 있을 수 있다. 그대로 채우면 소스별 상한과 시리즈 접기가 깨진다.
  const picked = picks.map(pick => triagePool[pick.index]);
  const pickedUrls = new Set(picked.map(candidateKey));
  const poolUrls = new Set(triagePool.map(candidateKey));
  const filled = fallback
    .filter(candidate => poolUrls.has(candidateKey(candidate)) && !pickedUrls.has(candidateKey(candidate)))
    .slice(0, maxFinal - picks.length);
  const selected = [...picked, ...filled];
  const selectedUrls = new Set(selected.map(candidateKey));

  return {
    candidates: selected,
    report: {
      ...baseReport,
      mode: TRIAGE_MODES.LLM,
      triage_pool_size: triagePool.length,
      selected_count: selected.length,
      llm_selected_count: picks.length,
      filled_by_keyword_count: filled.length,
      llm_selected: picks.map(pick => reportEntry(triagePool[pick.index], { reason: pick.reason })),
      keyword_filled: filled.map(candidate => reportEntry(candidate)),
      // 탈락 목록 전체는 candidates.json을 수십 KB 키우므로 건수만 남긴다.
      not_selected_count: usable.filter(candidate => !selectedUrls.has(candidateKey(candidate))).length
    }
  };
}

module.exports = {
  MAX_TRIAGE_POOL,
  TRIAGE_MODES,
  buildTriagePrompt,
  parseTriageSelection,
  triageCandidatePool
};
