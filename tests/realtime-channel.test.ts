import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRealtimeChannel,
  realtimeStatusLabel,
  realtimeStatusTone,
  type RealtimeSocket,
  type RealtimeStatus,
} from '../src/services/realtimeChannel';

type Frame = { type: string; data: unknown };

const ALLOWED_TYPES = new Set(['conversation.message.created', 'journey.updated', 'trip.updated']);

interface Harness {
  sockets: FakeSocket[];
  tickets: string[];
  channel: ReturnType<typeof createRealtimeChannel<Frame>>;
  statuses: RealtimeStatus[];
  retryNow: () => void;
}

class FakeSocket implements RealtimeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closeCall: { code?: number; reason?: string } | null = null;

  constructor(readonly url: string) {}

  open() { this.onopen?.(); }
  drop() { this.onclose?.(); }
  send(frame: Frame | string) {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
  }

  close(code?: number, reason?: string) {
    this.closeCall = { code, reason };
    // Browsers fire `close` asynchronously; the channel must not treat its own
    // shutdown as a disconnect and start a reconnect loop.
    this.onclose?.();
  }
}

const tick = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function harness(options: { ticketFailure?: boolean } = {}): Harness {
  const sockets: FakeSocket[] = [];
  const tickets: string[] = [];
  const statuses: RealtimeStatus[] = [];
  let retryNow: () => void = () => { /* replaced below */ };
  let ticketSeq = 0;

  const channel = createRealtimeChannel<Frame>({
    fetchTicket: async () => {
      if (options.ticketFailure) throw new Error('401 no session');
      ticketSeq += 1;
      const ticket = `t${ticketSeq}`;
      tickets.push(ticket);
      return ticket;
    },
    socketUrl: (ticket) => `ws://api.test/realtime?ticket=${ticket}`,
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    parseEvent: (raw) => {
      try {
        const event = JSON.parse(String(raw)) as Frame;
        // Mirrors production: only listed passenger-facing types survive; anything
        // else — heartbeats, unknown services, garbage — must not reach screens.
        return typeof event?.type === 'string' && ALLOWED_TYPES.has(event.type) ? event : null;
      } catch {
        return null;
      }
    },
    baseRetryDelayMs: 5,
    maxRetryDelayMs: 20,
    addReconnectSignal: (fn) => { retryNow = fn; return () => { /* no teardown state to check */ }; },
  });

  channel.onStatus((status) => statuses.push(status));
  return { sockets, tickets, channel, statuses, retryNow: () => retryNow() };
}

test('three screens share a single socket, ticket and fan-out', async () => {
  const h = harness();
  const global: Frame[] = [];
  const chat: Frame[] = [];
  const navigation: Frame[] = [];

  const offGlobal = h.channel.subscribe((event) => global.push(event));
  const offChat = h.channel.subscribe((event) => chat.push(event));
  const offNavigation = h.channel.subscribe((event) => navigation.push(event));
  await tick();

  assert.equal(h.sockets.length, 1, 'exactly one WebSocket for the session');
  assert.equal(h.tickets.length, 1, 'one single-use ticket, not three');
  assert.deepEqual(h.sockets[0].url, 'ws://api.test/realtime?ticket=t1');

  h.sockets[0].open();
  assert.equal(h.channel.status(), 'online');
  assert.equal(h.channel.socketCount(), 1);
  assert.equal(h.channel.subscriberCount(), 3);

  const message: Frame = { type: 'conversation.message.created', data: { id: 'm1' } };
  h.sockets[0].send(message);
  assert.deepEqual(global, [message]);
  assert.deepEqual(chat, [message]);
  assert.deepEqual(navigation, [message], 'every listener sees the same frame');

  offGlobal(); offChat(); offNavigation();
  assert.equal(h.sockets[0].closeCall?.code, 1000, 'the last listener closes the socket');
  assert.equal(h.channel.status(), 'closed');
  assert.equal(h.channel.socketCount(), 0);
});

test('a closing channel does not schedule a reconnect and does not leak sockets', async () => {
  const h = harness();
  const off = h.channel.subscribe(() => { /* fan-out target under test elsewhere */ });
  await tick();
  assert.equal(h.sockets.length, 1);
  h.sockets[0].open();

  off();
  await tick(30);
  assert.equal(h.sockets.length, 1, 'no reconnect after the session stopped listening');
  assert.equal(h.tickets.length, 1, 'no ticket burned after shutdown');
  assert.equal(h.channel.status(), 'closed');
});

test('a dropped socket reconnects with a fresh ticket and reports reconnecting', async () => {
  const h = harness();
  const off = h.channel.subscribe(() => { /* received via fan-out */ });
  await tick();
  h.sockets[0].open();
  assert.ok(h.statuses.includes('online'));

  // The server closes the socket (ticket expiry, restart, network drop).
  h.sockets[0].drop();
  assert.equal(h.channel.status(), 'reconnecting', 'the passenger is told the truth while retrying');
  await tick(30);

  assert.equal(h.sockets.length, 2, 'the channel reconnected on its own');
  assert.equal(h.tickets.length, 2, 'each attempt consumes its own single-use ticket');
  assert.equal(h.sockets[1].url, 'ws://api.test/realtime?ticket=t2');

  h.sockets[1].open();
  assert.equal(h.channel.status(), 'online');
  const seen: Frame[] = [];
  h.channel.subscribe((event) => seen.push(event));
  await tick();
  assert.equal(h.sockets.length, 2, 'a new screen joins the live socket instead of opening its own');
  h.sockets[1].send({ type: 'trip.updated', data: {} });
  assert.equal(seen.length, 1);
  off();
});

test('a late subscriber learns the current status immediately, so the chat can reconcile history', async () => {
  const h = harness();
  const offGlobal = h.channel.subscribe(() => { /* notifications already open the socket */ });
  await tick();
  h.sockets[0].open();

  const chatStatuses: RealtimeStatus[] = [];
  const offChat = h.channel.subscribe(() => { /* messages */ });
  h.channel.onStatus((status) => chatStatuses.push(status));

  assert.deepEqual(chatStatuses, ['online'], 'registration reports the live state, not "closed"');
  assert.equal(h.sockets.length, 1);
  offChat(); offGlobal();
});

test('malformed and unparseable frames never break the shared channel', async () => {
  const h = harness();
  const received: Frame[] = [];
  const off = h.channel.subscribe((event) => received.push(event));
  await tick();
  h.sockets[0].open();

  h.sockets[0].send('{not json');
  h.sockets[0].send(JSON.stringify({ type: 'heartbeat' }));
  assert.equal(received.length, 0, 'garbage and unknown frames are dropped');

  h.sockets[0].send({ type: 'journey.updated', data: { state: 'READY' } });
  assert.equal(received.length, 1, 'the channel survived them');
  assert.equal(h.channel.status(), 'online');
  off();
});

test('a failing ticket request retries instead of dying silently', async () => {
  const h = harness({ ticketFailure: true });
  const off = h.channel.subscribe(() => { /* nothing arrives in this test */ });
  await tick(30);
  assert.equal(h.sockets.length, 0);
  assert.equal(h.channel.status(), 'reconnecting', 'no auth session is a visible state, not a silent one');
  off();
});

test('the browser online signal retries immediately instead of waiting for backoff', async () => {
  const h = harness();
  const off = h.channel.subscribe(() => { /* fan-out */ });
  await tick();
  h.sockets[0].open();
  h.sockets[0].drop();
  assert.equal(h.channel.status(), 'reconnecting');

  h.retryNow();
  await tick();
  assert.equal(h.sockets.length, 2, 'retried without waiting for the timer');
  h.sockets[1].open();
  assert.equal(h.channel.status(), 'online');
  off();
});

test('passenger-facing status copy stays human and never shows a socket code', () => {
  assert.equal(realtimeStatusLabel('online'), '· онлайн');
  assert.equal(realtimeStatusLabel('closed'), '· офлайн, історія збережена');
  assert.equal(realtimeStatusLabel('connecting'), '· з’єднання відновлюється');
  assert.equal(realtimeStatusLabel('reconnecting'), '· з’єднання відновлюється');
  assert.equal(realtimeStatusTone('connecting'), 'retrying');
  assert.equal(realtimeStatusTone('reconnecting'), 'retrying');
  assert.equal(realtimeStatusTone('online'), 'online');
  assert.equal(realtimeStatusTone('closed'), 'offline');
});
