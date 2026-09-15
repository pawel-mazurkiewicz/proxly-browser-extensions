/**
 * Native messaging client for ProxlyConnector.
 *
 * Keeps one connection per background page, matches answers to requests by id, and answers 'reroute'
 * — the extension's behaviour before the connector existed — whenever the connector is missing, slow or
 * disconnects. The runtime and timers are injected so tests can drive it.
 */

const ProxlyConnectorClient = (() => {
  const HOST_NAME = 'com.chillaid.proxly';
  const PROTOCOL_VERSION = 1;

  class ConnectorClient {
    /**
     * @param {object} options
     * @param {object} options.runtime chrome.runtime, or a fake with connectNative
     * @param {number} [options.timeoutMs=150] how long a decision may take before it counts as 'reroute'
     * @param {number} [options.idleMs=300000] close the connection after this long without requests
     * @param {object} [options.timers] setTimeout and clearTimeout
     */
    constructor({ runtime, timeoutMs = 150, idleMs = 300000, timers = globalThis }) {
      this.runtime = runtime;
      this.timeoutMs = timeoutMs;
      this.idleMs = idleMs;
      this.timers = timers;
      this.port = null;
      this.nextId = 1;
      this.pending = new Map();
      this.idleTimer = null;
    }

    /** Resolves to 'passthrough' or 'reroute'; never rejects. */
    async decide(url) {
      const reply = await this.request({ type: 'decide', url, allowPassthrough: true });
      return reply && reply.decision === 'passthrough' ? 'passthrough' : 'reroute';
    }

    /** Resolves to { connectorVersion, browser }, or null when the connector cannot be reached. */
    async hello() {
      const reply = await this.request({ type: 'hello' }, 1000);
      return reply && typeof reply.connectorVersion === 'number'
        ? { connectorVersion: reply.connectorVersion, browser: reply.browser || null }
        : null;
    }

    request(body, timeoutMs = this.timeoutMs) {
      return new Promise((resolve) => {
        const port = this.connect();
        if (!port) {
          resolve(null);
          return;
        }
        const id = this.nextId++;
        const timer = this.timers.setTimeout(() => this.settle(id, null), timeoutMs);
        this.pending.set(id, { resolve, timer });
        try {
          port.postMessage({ v: PROTOCOL_VERSION, id, ...body });
        } catch (_) {
          this.disconnect();
          return;
        }
        this.scheduleIdleClose();
      });
    }

    connect() {
      if (this.port) return this.port;
      let port;
      try {
        port = this.runtime.connectNative(HOST_NAME);
      } catch (_) {
        return null;
      }
      port.onMessage.addListener((reply) => {
        if (reply && typeof reply.id === 'number') this.settle(reply.id, reply);
      });
      port.onDisconnect.addListener(() => {
        // Reading lastError keeps Chrome from logging "Unchecked runtime.lastError".
        void this.runtime.lastError;
        if (this.port === port) this.port = null;
        this.settleAll();
      });
      this.port = port;
      return port;
    }

    settle(id, reply) {
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      this.timers.clearTimeout(entry.timer);
      entry.resolve(reply);
    }

    settleAll() {
      for (const id of [...this.pending.keys()]) this.settle(id, null);
    }

    scheduleIdleClose() {
      if (this.idleTimer) this.timers.clearTimeout(this.idleTimer);
      this.idleTimer = this.timers.setTimeout(() => this.disconnect(), this.idleMs);
    }

    disconnect() {
      if (this.idleTimer) {
        this.timers.clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
      const port = this.port;
      this.port = null;
      if (port) {
        try {
          port.disconnect();
        } catch (_) {
          // Already gone.
        }
      }
      this.settleAll();
    }
  }

  return { ConnectorClient, HOST_NAME };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxlyConnectorClient;
}
