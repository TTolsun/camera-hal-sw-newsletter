'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBoundedFetchClient } = require('../../../collect/bounded-fetch-client');

function countingChunkedResponse(chunks, counter, status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    pull(controller) {
      if (counter.pulled >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[counter.pulled]));
      counter.pulled += 1;
    }
  });
  return new Response(body, { status });
}

test('stops reading once the request limit is reached and discards the partial body', async () => {
  const counter = { pulled: 0 };
  const client = createBoundedFetchClient({
    fetchImpl: async () => countingChunkedResponse(Array.from({ length: 20 }, () => 'x'.repeat(1024)), counter)
  });
  const result = await client.fetchBounded('https://claude.com/blog/oversized', { maxBytes: 4096 });
  assert.equal(result.truncated, true);
  assert.equal(result.body, '', '잘린 본문은 파싱하지 못하게 비운다');
  assert.equal(result.limitedBy, 'request');
  assert.equal(result.error, 'truncated_at_byte_limit');
  assert.ok(counter.pulled < 20, '예산에 걸리면 남은 청크를 더 당기지 않는다');
});

test('a body that exactly fills the budget is not reported as truncated', async () => {
  const counter = { pulled: 0 };
  const client = createBoundedFetchClient({
    fetchImpl: async () => countingChunkedResponse(Array.from({ length: 4 }, () => 'x'.repeat(1024)), counter)
  });
  const result = await client.fetchBounded('https://claude.com/blog/exact', { maxBytes: 4096 });
  assert.equal(result.truncated, false);
  assert.equal(result.receivedBytes, 4096);
});

test('labels the source-run limit when it is the binding one', async () => {
  const counter = { pulled: 0 };
  const client = createBoundedFetchClient({
    maxBytesPerSourceRun: 4096,
    fetchImpl: async () => countingChunkedResponse(Array.from({ length: 20 }, () => 'x'.repeat(1024)), counter)
  });
  const result = await client.fetchBounded('https://claude.com/blog/x', { maxBytes: 4096 });
  assert.equal(result.limitedBy, 'source-run', '남은 예산과 요청 상한이 같은 경계면 실제로 끊은 것은 소스 누적 상한이다');
});

test('does not send a request once the source budget is exhausted', async () => {
  let calls = 0;
  const client = createBoundedFetchClient({
    maxBytesPerSourceRun: 2048,
    fetchImpl: async () => {
      calls += 1;
      return countingChunkedResponse(Array.from({ length: 4 }, () => 'x'.repeat(1024)), { pulled: 0 });
    }
  });
  await client.fetchBounded('https://claude.com/blog/a', { maxBytes: 4096 });
  const second = await client.fetchBounded('https://claude.com/blog/b', { maxBytes: 4096 });
  assert.equal(second.sourceBudgetExhausted, true);
  assert.equal(second.attempts, 0);
  assert.equal(calls, 1, '예산이 다 차면 요청 자체를 보내지 않는다');
  assert.equal(second.limitedBy, 'source-run',
    '소스 예산이 원인인 skip은 limitedBy도 source-run이라고 말해야 한다 — 안 그러면 이 결과를 그대로 ' +
    '베끼는 호출자(예: skipped_article_budget)가 limitedBy 빈 문자열을 보고한다');
});

test('charges the bytes a failed attempt already pulled', async () => {
  const encoder = new TextEncoder();
  let calls = 0;
  const client = createBoundedFetchClient({
    maxBytesPerSourceRun: 8192,
    retryDelayMs: 0,
    // 브리프 원안은 start()에서 enqueue 직후 동기적으로 error()를 호출했다. 그런데 async
    // fetchImpl을 거치는 실제 경로에서는 ReadableStream의 자동 선행 pull이 컨슈머가 read()를
    // 부르기 전에 먼저 발동해 매 경우 청크를 잃는다(Node 24 WHATWG Streams 실측, 5회 격리 재현).
    // pull()에서 1회차는 청크를 enqueue하고, 2회차에만 error()를 내는 순서형으로 바꿔
    // "이미 한 번 받은 뒤 실패" 시나리오를 실제로 만든다 — 이 파일의 countingChunkedResponse와
    // 같은 카운터-순서 패턴이다. 이 테스트가 관찰하는 계약(실패한 시도의 수신 바이트를 예산에
    // 가산한다)은 그대로다.
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        let pulled = false;
        return new Response(new ReadableStream({
          pull(controller) {
            if (!pulled) {
              pulled = true;
              controller.enqueue(encoder.encode('x'.repeat(4096)));
              return;
            }
            controller.error(new Error('socket hang up'));
          }
        }), { status: 200 });
      }
      // 두 번째 호출: 소스 누적 상한이 실제로 얼마나 남았는지 직접 드러낸다.
      // 첫 실패의 4096바이트가 예산에 반영됐다면 남은 예산은 4096이라, 여기서 보내는
      // 6000바이트 청크는 잘린다. 반영되지 않았다면(버그) 남은 예산이 여전히 8192라
      // 6000바이트가 안 잘리고 그대로 통과한다 — 이 차이로 "충전됐다"를 직접 검증한다.
      return countingChunkedResponse(['x'.repeat(6000)], { pulled: 0 });
    }
  });

  const failed = await client.fetchBounded('https://claude.com/blog/flaky', { maxBytes: 4096 });
  assert.equal(failed.ok, false,
    '이 시도는 실패해야 한다 — mock이 도중에 에러를 멈추면(예: 정상 종료로 바뀌면) 여기서 걸린다');
  assert.ok(failed.error, '실패한 시도의 error가 비어 있으면 안 된다');
  assert.ok(client.consumedBytes() >= 4096,
    '실패한 시도가 이미 읽은 바이트를 예산에 안 태우면 실패가 잦은 호스트에서 상한이 무제한이 된다');

  const second = await client.fetchBounded('https://claude.com/blog/next', { maxBytes: 100000 });
  assert.equal(second.truncated, true,
    '첫 실패의 4096바이트가 예산에 반영되지 않았다면 남은 예산이 8192로 남아 6000바이트 청크가 안 잘린다');
  assert.equal(second.limitedBy, 'source-run',
    '두 번째 호출을 실제로 끊은 것이 소스 누적 상한임을 확인한다(요청 상한 100000은 여유가 크다)');
});

test('retries a 503 once but never a 404', async () => {
  let calls = 0;
  const retrying = createBoundedFetchClient({
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response('', { status: 503 })
        : countingChunkedResponse(['ok'], { pulled: 0 });
    }
  });
  const ok = await retrying.fetchBounded('https://claude.com/blog/flaky');
  assert.equal(ok.attempts, 2);
  assert.equal(ok.ok, true);

  let notFoundCalls = 0;
  const notFound = createBoundedFetchClient({
    retryDelayMs: 0,
    fetchImpl: async () => {
      notFoundCalls += 1;
      return new Response('', { status: 404 });
    }
  });
  const missing = await notFound.fetchBounded('https://claude.com/blog/gone');
  assert.equal(notFoundCalls, 1);
  assert.equal(missing.error, 'http_404');
});

// --- POST 지원 (#880) -------------------------------------------------------
// Qualcomm 보안 게시판은 목록을 POST 검색 API로만 내주고, 그 API는 content-type이
// application/json이면 500을 돌려준다. 아래 네 테스트가 그 경로에 필요한 계약을 고정한다.

test('sends the method, body and content-type the caller asked for', async () => {
  let seenInit = null;
  let seenBodyText = null;
  const client = createBoundedFetchClient({
    fetchImpl: async (target, init) => {
      seenInit = init;
      // 실제 Request를 만들어, 이 init이 진짜 fetch에 그대로 통하는 모양인지까지 확인한다.
      seenBodyText = await new Request(target, init).text();
      return countingChunkedResponse(['{}'], { pulled: 0 });
    }
  });

  await client.fetchBounded('https://docs.qualcomm.com/search', {
    method: 'POST',
    body: '{"searchText":"camera"}',
    contentType: 'text/plain',
    accept: 'application/json'
  });

  assert.equal(seenBodyText, '{"searchText":"camera"}', '실제 Request가 이 본문을 그대로 실어야 한다');
  assert.equal(seenInit.method, 'POST');
  assert.equal(seenInit.body, '{"searchText":"camera"}');
  assert.equal(seenInit.headers['content-type'], 'text/plain',
    '서버가 이 값으로 요청을 거절하므로 호출자가 준 값을 그대로 보내야 한다');
  assert.equal(seenInit.headers.accept, 'application/json');
});

test('a plain fetch stays a GET with no body and no content-type', async () => {
  let seenInit = null;
  const client = createBoundedFetchClient({
    fetchImpl: async (_target, init) => {
      seenInit = init;
      return countingChunkedResponse(['ok'], { pulled: 0 });
    }
  });

  await client.fetchBounded('https://claude.com/blog/a');

  assert.equal(seenInit.method, 'GET');
  assert.equal('body' in seenInit, false, '본문 없는 요청에 body 키를 붙이지 않는다');
  assert.equal('content-type' in seenInit.headers, false);
});

test('folds an unsupported method into GET and drops the body with it', async () => {
  // 이 클라이언트가 낼 수 있는 메서드를 둘로 닫는다. 열려 있으면 상태를 바꾸는 요청이
  // 429·5xx 재시도를 타고 두 번 나갈 수 있다.
  //
  // stub이 실제 Request를 만든다. init만 들여다보는 stub은 이 계약을 못 지킨다 — GET에 body를
  // 남겨도 stub은 아무 불평 없이 응답을 돌려주지만 진짜 fetch는 요청을 만들지도 못하고
  // TypeError를 던진다("Request with GET/HEAD method cannot have body"). 그러면 접기의 결과가
  // GET 수행이 아니라 실패 결과가 된다.
  let seenMethod = null;
  let seenHasBody = null;
  const client = createBoundedFetchClient({
    fetchImpl: async (target, init) => {
      const request = new Request(target, init);
      seenMethod = request.method;
      seenHasBody = 'body' in init;
      return countingChunkedResponse(['ok'], { pulled: 0 });
    }
  });

  const result = await client.fetchBounded('https://claude.com/blog/a', { method: 'DELETE', body: 'x' });

  assert.equal(seenMethod, 'GET');
  assert.equal(seenHasBody, false, 'GET으로 접었으면 body도 함께 떨어져야 한다');
  assert.equal(result.ok, true, '접기의 결과는 실패가 아니라 정상 GET이어야 한다');
});

test('does not charge the request body to the receive budget', async () => {
  // maxBytesPerSourceRun은 파싱 대상(수신 본문) 크기의 상한이다. 보낸 바이트를 여기 섞으면
  // 큰 질의를 한 번 보내는 것만으로 그 소스의 수집이 멎는다.
  const client = createBoundedFetchClient({
    maxBytesPerSourceRun: 4096,
    fetchImpl: async () => countingChunkedResponse(['ok'], { pulled: 0 })
  });

  await client.fetchBounded('https://docs.qualcomm.com/search', {
    method: 'POST',
    body: 'x'.repeat(8192),
    contentType: 'text/plain'
  });

  assert.equal(client.consumedBytes(), 2, '수신한 2바이트만 예산에서 빠진다');
  assert.equal(client.remainingBytes(), 4094);
});

test('retries a 503 on a POST too', async () => {
  let calls = 0;
  const client = createBoundedFetchClient({
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response('', { status: 503 })
        : countingChunkedResponse(['ok'], { pulled: 0 });
    }
  });

  const result = await client.fetchBounded('https://docs.qualcomm.com/search', {
    method: 'POST', body: '{}', contentType: 'text/plain'
  });

  assert.equal(result.attempts, 2, '조회 질의는 GET과 같은 재시도를 받는다');
  assert.equal(result.ok, true);
});
