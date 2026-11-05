/**
 * One multiplexed realtime WebSocket per signed-in session.
 *
 * Before this module every screen that wanted live events opened its own socket:
 * the global notification listener, the chat thread and the navigation screen each
 * called `subscribeRealtime()`, so a single passenger on the chat screen held three
 * WebSocket connections, requested three single-use tickets (`POST /realtime/ticket`
 * is consumed with Redis `getDel`) and ran three independent reconnect loops that
 * could disagree about whether the passenger was looking at live data.
 *
 * This channel keeps exactly one socket, fans every accepted frame out to all
 * listeners, and publishes one connection status that screens can show honestly.
 * The socket is opened by the first subscriber and closed by the last one leaving,
 * so signing out or leaving the live screen never leaks a connection.
 */

export type RealtimeStatus = 'connecting' | 'online' | 'reconnecting' | 'closed';

/** Structural socket so the channel can be tested without a browser. */
export interface RealtimeSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: (code?: number, reason?: string) => void;
}

export interface RealtimeChannelOptions<E> {
  /** Single-use ticket; must be re-requested for every connection attempt. */
  fetchTicket: () => Promise<string>;
  /** Builds the ws/wss URL for a ticket. */
  socketUrl: (ticket: string) => string;
  /** Opens the socket; injectable so tests can count connections. */
  createSocket: (url: string) => RealtimeSocket;
  /** Parses a frame and returns null for malformed or unlisted event types. */
  parseEvent: (raw: unknown) => E | null;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  /**
   * Browser signals that mean "network may be back, do not wait for the backoff
   * timer" (the `online` event, tab becoming visible). Returns its own teardown.
   */
  addReconnectSignal?: (retryNow: () => void) => () => void;
}

export interface RealtimeChannel<E> {
  subscribe(onEvent: (event: E) => void): () => void;
  /**
   * Status changes plus the current status immediately on registration: a screen
   * that opens while the shared socket is already online must still learn that it
   * is online, because that is its cue to reconcile REST history with live frames.
   */
  onStatus(listener: (status: RealtimeStatus) => void): () => void;
  status(): RealtimeStatus;
  /** Diagnostics only: how many listeners and how many live sockets exist. */
  subscriberCount(): number;
  socketCount(): number;
  /** Force the channel down (used by tests and by a hard logout). */
  shutdown(): void;
}

export function createRealtimeChannel<E>(options: RealtimeChannelOptions<E>): RealtimeChannel<E> {
  const baseRetryDelayMs = Math.max(1, options.baseRetryDelayMs ?? 1_000);
  const maxRetryDelayMs = Math.max(baseRetryDelayMs, options.maxRetryDelayMs ?? 30_000);
  const listeners = new Set<(event: E) => void>();
  const statusListeners = new Set<(status: RealtimeStatus) => void>();

  let status: RealtimeStatus = 'closed';
  let socket: RealtimeSocket | null = null;
  let attemptInFlight = false;
  let attemptCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = baseRetryDelayMs;
  let releaseReconnectSignal: (() => void) | null = null;

  const setStatus = (next: RealtimeStatus) => {
    if (status === next) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  };

  const clearRetryTimer = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const open = async () => {
    if (listeners.size === 0 || socket !== null || attemptInFlight) return;
    attemptInFlight = true;
    attemptCount += 1;
    setStatus(attemptCount === 1 ? 'connecting' : 'reconnecting');
    let ticket: string;
    try {
      ticket = await options.fetchTicket();
    } catch {
      attemptInFlight = false;
      scheduleRetry();
      return;
    }
    attemptInFlight = false;
    // The last subscriber may have left while the ticket was in flight.
    if (listeners.size === 0) { setStatus('closed'); return; }
    const next = options.createSocket(options.socketUrl(ticket));
    socket = next;
    next.onopen = () => {
      if (socket !== next) return;
      attemptCount = 0;
      retryDelayMs = baseRetryDelayMs;
      setStatus('online');
    };
    next.onmessage = (event) => {
      if (socket !== next) return;
      let parsed: E | null;
      try {
        parsed = options.parseEvent(event.data);
      } catch {
        // A throwing parser must not kill the shared channel for every other screen.
        return;
      }
      if (parsed === null) return;
      for (const listener of [...listeners]) listener(parsed);
    };
    // onerror is always followed by onclose in browsers; reconnect is driven there.
    next.onerror = () => { /* handled by onclose */ };
    next.onclose = () => {
      if (socket !== next) return;
      socket = null;
      scheduleRetry();
    };
  };

  function scheduleRetry() {
    if (listeners.size === 0) { setStatus('closed'); return; }
    if (retryTimer) return;
    setStatus('reconnecting');
    const delay = retryDelayMs;
    retryDelayMs = Math.min(maxRetryDelayMs, delay * 2);
    retryTimer = setTimeout(() => { retryTimer = null; void open(); }, delay);
  }

  const retryNow = () => {
    if (listeners.size === 0 || socket !== null || attemptInFlight) return;
    clearRetryTimer();
    retryDelayMs = baseRetryDelayMs;
    void open();
  };

  const ensureReconnectSignal = () => {
    if (releaseReconnectSignal || !options.addReconnectSignal) return;
    releaseReconnectSignal = options.addReconnectSignal(retryNow);
  };

  const shutdown = () => {
    clearRetryTimer();
    releaseReconnectSignal?.();
    releaseReconnectSignal = null;
    const current = socket;
    socket = null;
    attemptInFlight = false;
    current?.close(1000, 'realtime channel closed');
    setStatus('closed');
  };

  return {
    subscribe(onEvent) {
      listeners.add(onEvent);
      ensureReconnectSignal();
      if (listeners.size === 1) {
        attemptCount = 0;
        retryDelayMs = baseRetryDelayMs;
        void open();
      }
      return () => {
        listeners.delete(onEvent);
        if (listeners.size === 0) shutdown();
      };
    },
    onStatus(listener) {
      statusListeners.add(listener);
      listener(status);
      return () => { statusListeners.delete(listener); };
    },
    status: () => status,
    subscriberCount: () => listeners.size,
    socketCount: () => (socket === null ? 0 : 1),
    shutdown,
  };
}

/**
 * Human copy for the connection state. Passengers get a sentence, never a socket
 * code or the word "WebSocket"; the phrasing is deliberately the same on every
 * screen so the state does not look like three different things.
 */
export function realtimeStatusLabel(status: RealtimeStatus): string {
  if (status === 'online') return '· онлайн';
  if (status === 'closed') return '· офлайн, історія збережена';
  return '· з’єднання відновлюється';
}

export function realtimeStatusTone(status: RealtimeStatus): 'online' | 'retrying' | 'offline' {
  if (status === 'online') return 'online';
  if (status === 'closed') return 'offline';
  return 'retrying';
}
