'use strict';

// lore.kernel.org(public-inbox) 메시지에서 패치 시리즈 키를 파생한다 (2026-W31 갭 감사 A1).
//
// 카메라 검색 atom 피드(#806)는 시리즈 조각([PATCH N/M])과 답장(Re:)을 개별 엔트리로 돌려준다.
// 조각마다 후보를 만들면 per-source 캡(MAX_CANDIDATES_PER_SOURCE)이 같은 시리즈 조각으로 소진돼
// 수집 창이 최근 며칠로 재절단된다(2026-W31 실측: 8슬롯이 시리즈 3개 조각+답장으로 소진, 창 앞쪽
// 4일의 SM8750/Kaanapali CAMSS 시리즈가 통째 탈락). patchwork와 달리 lore에는 서버가 주는 시리즈
// id가 없으므로 message-id 명명 규약에서 파생해 collapseSeriesRepresentatives가 작동하게 한다.
//
// 시리즈 조각의 thr:in-reply-to는 커버레터를 가리키므로 부모 message-id를 먼저 본다. 그러면
// 커버레터(자기 URL 파생)와 조각(부모 URL 파생)이 같은 키로 묶인다.

const LORE_URL_PATTERN = /^https?:\/\/lore\.kernel\.org\//i;

// b4 스타일 message-id (예: 20260724-sk5jn5-v2-0-871d3b9a2e47@oss.qualcomm.com)
// = <날짜8자리>-<슬러그>-v<리비전>-<조각번호>-<해시>@<도메인>. 조각번호만 시리즈 안에서 변한다.
const B4_MESSAGE_ID_PATTERN = /^(\d{8}-.+-v\d+)-\d+-([a-z0-9]+@.+)$/i;

// git format-patch/send-email 스타일 (예: 20260726214401.19042-1-j@metarealtyinc.ca)
// = <타임스탬프>.<pid>-<조각번호>-<발신자>@<도메인>. 조각번호만 변한다.
const SEND_EMAIL_MESSAGE_ID_PATTERN = /^(\d+\.\d+)-\d+-(.+)$/;

function loreMessageId(url) {
  if (!LORE_URL_PATTERN.test(String(url || ''))) return '';
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments.length >= 2 ? segments[segments.length - 1] : '';
  } catch {
    return '';
  }
}

function seriesKeyFromMessageId(messageId) {
  const b4 = messageId.match(B4_MESSAGE_ID_PATTERN);
  if (b4) return `${b4[1]}-${b4[2]}`;
  const sendEmail = messageId.match(SEND_EMAIL_MESSAGE_ID_PATTERN);
  if (sendEmail) return `${sendEmail[1]}-${sendEmail[2]}`;
  return '';
}

function deriveLoreSeriesId({ url, inReplyTo } = {}) {
  for (const messageUrl of [inReplyTo, url]) {
    const key = seriesKeyFromMessageId(loreMessageId(messageUrl));
    if (key) return key;
  }
  return null;
}

// lore 답장(Re:)은 시리즈의 리드가 될 수 없다. 답장까지 후보로 만들면 캡 슬롯과 reserve를
// 답장이 차지한다(2026-W31 실측: reserve 3석 중 2석이 "Re:" 답장). 원본 패치는 같은 제목
// 토큰으로 검색 피드에 함께 들어오므로 답장을 버려도 시리즈 신호는 유지된다.
function isLoreReplyItem({ url, title } = {}) {
  return LORE_URL_PATTERN.test(String(url || '')) && /^\s*re\s*:/i.test(String(title || ''));
}

module.exports = {
  deriveLoreSeriesId,
  isLoreReplyItem
};
