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
});

test('charges the bytes a failed attempt already pulled', async () => {
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
      const encoder = new TextEncoder();
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
  });
  await client.fetchBounded('https://claude.com/blog/flaky', { maxBytes: 4096 });
  assert.ok(client.consumedBytes() >= 4096,
    '실패한 시도가 이미 읽은 바이트를 예산에 안 태우면 실패가 잦은 호스트에서 상한이 무제한이 된다');
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
