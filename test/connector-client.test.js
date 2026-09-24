/**
 * Tests for shared/connector-client.js — the native messaging client for ProxlyConnector.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ConnectorClient, HOST_NAME } = require(path.join(__dirname, '..', 'chrome', 'shared', 'connector-client.js'));

/** Timers that only move when the test says so. */
function fakeTimers() {
  let now = 0;
  const queue = [];
  return {
    setTimeout(fn, ms) {
      const timer = { at: now + ms, fn, cancelled: false };
      queue.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cancelled = true;
    },
    advance(ms) {
      now += ms;
      const due = queue.filter((timer) => !timer.cancelled && timer.at <= now).sort((a, b) => a.at - b.at);
      for (const timer of due) {
        timer.cancelled = true;
        timer.fn();
      }
    }
  };
}

/** A runtime whose ports answer with `reply(message)`; returning undefined means "no answer". */
function fakeRuntime({ reply = (message) => ({ v: 1, id: message.id, decision: 'passthrough' }), missingHost = false } = {}) {
  const runtime = { lastError: undefined, sent: [], ports: [] };
  runtime.connectNative = (name) => {
    assert.strictEqual(name, HOST_NAME);
    if (missingHost) throw new Error('Specified native messaging host not found.');
    const onMessage = [];
    const onDisconnect = [];
    const port = {
      closed: false,
      onMessage: { addListener: (fn) => onMessage.push(fn) },
      onDisconnect: { addListener: (fn) => onDisconnect.push(fn) },
      postMessage(message) {
        runtime.sent.push(message);
        const answer = reply(message);
        if (answer) Promise.resolve().then(() => onMessage.forEach((fn) => fn(answer)));
      },
      disconnect() {
        port.closed = true;
      },
      deliver: (answer) => onMessage.forEach((fn) => fn(answer)),
      drop: () => onDisconnect.forEach((fn) => fn())
    };
    runtime.ports.push(port);
    return port;
  };
  return runtime;
}

test('a passthrough answer comes back as passthrough, with the request well formed', async () => {
  const runtime = fakeRuntime();
  const client = new ConnectorClient({ runtime, timers: fakeTimers() });

  assert.strictEqual(await client.decide('https://example.com/'), 'passthrough');
  assert.deepStrictEqual(runtime.sent[0], {
    v: 1, id: 1, type: 'decide', url: 'https://example.com/', allowPassthrough: true
  });
});

test('a reroute answer comes back as reroute', async () => {
  const runtime = fakeRuntime({ reply: (message) => ({ v: 1, id: message.id, decision: 'reroute' }) });
  assert.strictEqual(await new ConnectorClient({ runtime, timers: fakeTimers() }).decide('https://x.test/'), 'reroute');
});

test('no answer within the timeout counts as reroute', async () => {
  const timers = fakeTimers();
  const client = new ConnectorClient({ runtime: fakeRuntime({ reply: () => undefined }), timers });
  const decision = client.decide('https://x.test/');
  timers.advance(150);
  assert.strictEqual(await decision, 'reroute');
});

test('a missing connector means reroute, and hello reports nothing', async () => {
  const client = new ConnectorClient({ runtime: fakeRuntime({ missingHost: true }), timers: fakeTimers() });
  assert.strictEqual(await client.decide('https://x.test/'), 'reroute');
  assert.strictEqual(await client.hello(), null);
});

test('a dropped connection answers reroute and the next request reconnects', async () => {
  const runtime = fakeRuntime({ reply: () => undefined });
  const client = new ConnectorClient({ runtime, timers: fakeTimers() });
  const decision = client.decide('https://x.test/');
  runtime.ports[0].drop();
  assert.strictEqual(await decision, 'reroute');

  client.decide('https://y.test/');
  assert.strictEqual(runtime.ports.length, 2);
});

test('answers are matched to requests by id, whatever their order', async () => {
  const runtime = fakeRuntime({ reply: () => undefined });
  const client = new ConnectorClient({ runtime, timers: fakeTimers() });
  const first = client.decide('https://a.test/');
  const second = client.decide('https://b.test/');

  runtime.ports[0].deliver({ v: 1, id: 2, decision: 'passthrough' });
  runtime.ports[0].deliver({ v: 1, id: 1, decision: 'reroute' });

  assert.strictEqual(await first, 'reroute');
  assert.strictEqual(await second, 'passthrough');
});

test('the connection closes after the idle period and reopens on demand', async () => {
  const timers = fakeTimers();
  const runtime = fakeRuntime();
  const client = new ConnectorClient({ runtime, timers, idleMs: 1000 });

  await client.decide('https://x.test/');
  timers.advance(1000);
  assert.strictEqual(runtime.ports[0].closed, true);

  await client.decide('https://y.test/');
  assert.strictEqual(runtime.ports.length, 2);
});

test('hello reports the connector version and the calling browser', async () => {
  const runtime = fakeRuntime({
    reply: (message) => ({ v: 1, id: message.id, connectorVersion: 1, browser: 'com.google.Chrome' })
  });
  const client = new ConnectorClient({ runtime, timers: fakeTimers() });
  assert.deepStrictEqual(await client.hello(), { connectorVersion: 1, browser: 'com.google.Chrome' });
});

test('chrome and firefox ship identical connector clients', () => {
  const read = (browser) => fs.readFileSync(path.join(__dirname, '..', browser, 'shared', 'connector-client.js'), 'utf8');
  assert.strictEqual(read('firefox'), read('chrome'));
});
