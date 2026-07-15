/* ha-client.js - Home Assistant connection layer.
   Primary transport: WebSocket (live state + subscriptions).
   Fallback: REST over mozSystem XHR (polling) when the socket is down.
   ES5-safe (KaiOS 2.5 / Gecko 48). */
(function (global) {
  'use strict';

  var MAX_BACKOFF = 30000;
  var BASE_BACKOFF = 1000;
  var REST_POLL_INTERVAL = 10000;

  function HAClient(config) {
    this.baseUrl = HAConfig.normalizeBaseUrl(config.baseUrl);
    this.token = config.token;
    this.wsAddr = HAConfig.wsUrl(config.baseUrl);

    this.ws = null;
    this.authenticated = false;
    this.stopped = false;
    this.msgId = 1;
    this.pending = {}; // id -> {resolve, reject}
    this.entities = {}; // entity_id -> state object
    this.listeners = {}; // event -> [cb]
    this.backoff = BASE_BACKOFF;
    this.reconnectTimer = null;
    this.pollTimer = null;
    this.status = 'offline';
    this.usingRest = false;
  }

  /* ---- tiny event emitter ---- */
  HAClient.prototype.on = function (evt, cb) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(cb);
    return this;
  };

  HAClient.prototype.emit = function (evt, data) {
    var cbs = this.listeners[evt];
    if (!cbs) return;
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](data); } catch (e) {}
    }
  };

  HAClient.prototype.setStatus = function (status, reason) {
    this.status = status;
    this.emit('status', { status: status, reason: reason || '', usingRest: this.usingRest });
  };

  /* ---- lifecycle ---- */
  HAClient.prototype.start = function () {
    this.stopped = false;
    this.connectWs();
  };

  HAClient.prototype.stop = function () {
    this.stopped = true;
    this.clearTimers();
    this.authenticated = false;
    if (this.ws) {
      try { this.ws.onclose = null; this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.rejectAllPending('Client stopped');
  };

  HAClient.prototype.clearTimers = function () {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  };

  /* ---- WebSocket transport ---- */
  HAClient.prototype.connectWs = function () {
    var self = this;
    if (this.stopped) return;
    this.setStatus('connecting');

    var ws;
    try {
      ws = new WebSocket(this.wsAddr);
    } catch (e) {
      this.scheduleReconnect();
      this.startRestFallback();
      return;
    }
    this.ws = ws;

    ws.onmessage = function (ev) { self.onWsMessage(ev); };

    ws.onerror = function () {
      // onclose will follow and handle reconnect.
    };

    ws.onclose = function () {
      self.authenticated = false;
      self.rejectAllPending('Socket closed');
      if (self.stopped) return;
      self.setStatus('offline', 'disconnected');
      self.scheduleReconnect();
      self.startRestFallback();
    };
  };

  HAClient.prototype.onWsMessage = function (ev) {
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }

    switch (msg.type) {
      case 'auth_required':
        // SECURITY-REVIEW: token sent only to the user-configured HA host.
        this.wsSendRaw({ type: 'auth', access_token: this.token });
        break;

      case 'auth_ok':
        this.onAuthenticated();
        break;

      case 'auth_invalid':
        // Bad token: do not keep retrying blindly.
        this.stopped = true;
        this.clearTimers();
        this.setStatus('offline', 'auth_invalid');
        this.emit('auth_invalid', msg.message || 'Invalid access token');
        break;

      case 'result':
        this.resolvePending(msg);
        break;

      case 'event':
        this.onEvent(msg.event);
        break;

      case 'pong':
        break;
    }
  };

  HAClient.prototype.onAuthenticated = function () {
    var self = this;
    this.authenticated = true;
    this.backoff = BASE_BACKOFF;
    this.usingRest = false;
    this.stopRestFallback();
    this.setStatus('online');

    this.command({ type: 'get_states' }).then(function (states) {
      self.ingestStates(states);
      self.emit('states', self.entities);
    }, function () {});

    this.command({ type: 'subscribe_events', event_type: 'state_changed' })
      .then(function () {}, function () {});
  };

  HAClient.prototype.onEvent = function (event) {
    if (!event || event.event_type !== 'state_changed') return;
    var data = event.data || {};
    var entityId = data.entity_id;
    if (!entityId) return;
    if (data.new_state) {
      this.entities[entityId] = data.new_state;
    } else {
      delete this.entities[entityId];
    }
    this.emit('state_changed', { entityId: entityId, state: data.new_state || null });
  };

  HAClient.prototype.ingestStates = function (states) {
    if (!states || !states.length) return;
    for (var i = 0; i < states.length; i++) {
      var s = states[i];
      if (s && s.entity_id) this.entities[s.entity_id] = s;
    }
  };

  HAClient.prototype.wsSendRaw = function (obj) {
    if (!this.ws) return false;
    try { this.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
  };

  // Send a command that expects a `result` response; returns a Promise.
  HAClient.prototype.command = function (msg) {
    var self = this;
    if (!this.authenticated || !this.ws) {
      return Promise.reject(new Error('Not connected'));
    }
    var id = this.msgId++;
    msg.id = id;
    return new Promise(function (resolve, reject) {
      self.pending[id] = { resolve: resolve, reject: reject };
      if (!self.wsSendRaw(msg)) {
        delete self.pending[id];
        reject(new Error('Send failed'));
      }
    });
  };

  HAClient.prototype.resolvePending = function (msg) {
    var p = this.pending[msg.id];
    if (!p) return;
    delete this.pending[msg.id];
    if (msg.success) {
      p.resolve(msg.result);
    } else {
      var err = new Error((msg.error && msg.error.message) || 'Command failed');
      p.reject(err);
    }
  };

  HAClient.prototype.rejectAllPending = function (reason) {
    for (var id in this.pending) {
      if (this.pending.hasOwnProperty(id)) {
        try { this.pending[id].reject(new Error(reason)); } catch (e) {}
      }
    }
    this.pending = {};
  };

  HAClient.prototype.scheduleReconnect = function () {
    var self = this;
    if (this.stopped || this.reconnectTimer) return;
    var delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    this.reconnectTimer = setTimeout(function () {
      self.reconnectTimer = null;
      self.connectWs();
    }, delay);
  };

  /* ---- REST fallback (polling) ---- */
  HAClient.prototype.startRestFallback = function () {
    var self = this;
    if (this.stopped || this.pollTimer || this.authenticated) return;
    this.usingRest = true;
    this.pollOnce();
    this.pollTimer = setInterval(function () { self.pollOnce(); }, REST_POLL_INTERVAL);
  };

  HAClient.prototype.stopRestFallback = function () {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.usingRest = false;
  };

  HAClient.prototype.pollOnce = function () {
    var self = this;
    if (this.authenticated) { this.stopRestFallback(); return; }
    HAXhr.request({
      method: 'GET',
      url: this.baseUrl + '/api/states',
      token: this.token
    }).then(function (states) {
      if (self.authenticated) return; // WS won the race
      self.ingestStates(states);
      self.setStatus('online', 'rest');
      self.emit('states', self.entities);
    }, function (err) {
      self.setStatus('offline', err && err.message);
      if (err && (err.status === 401 || err.status === 403)) {
        self.stopped = true;
        self.clearTimers();
        self.emit('auth_invalid', 'Invalid access token');
      }
    });
  };

  /* ---- commands ---- */
  HAClient.prototype.getEntities = function () {
    return this.entities;
  };

  // callService(domain, service, serviceData) -> Promise.
  // Uses WebSocket when authenticated, otherwise REST.
  HAClient.prototype.callService = function (domain, service, serviceData) {
    var self = this;
    if (this.authenticated) {
      return this.command({
        type: 'call_service',
        domain: domain,
        service: service,
        service_data: serviceData || {}
      });
    }
    return HAXhr.request({
      method: 'POST',
      url: this.baseUrl + '/api/services/' + domain + '/' + service,
      token: this.token,
      body: serviceData || {}
    }).then(function (res) {
      // REST returns changed states; refresh cache opportunistically.
      if (res && res.length) {
        self.ingestStates(res);
        self.emit('states', self.entities);
      }
      return res;
    });
  };

  // Static: verify a URL + token combo via REST GET /api/. Returns Promise.
  HAClient.testConnection = function (baseUrl, token) {
    return HAXhr.request({
      method: 'GET',
      url: HAConfig.normalizeBaseUrl(baseUrl) + '/api/',
      token: token,
      timeout: 10000
    });
  };

  global.HAClient = HAClient;
})(window);
