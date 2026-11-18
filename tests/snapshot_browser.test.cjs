// Isolated polling/reconciliation regressions; no network, Ember or PBX needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(variant) {
  const source = fs.readFileSync(path.join(__dirname, '..', variant, 'themes/default/js/javascript.js'), 'utf8');
  const start = source.indexOf('        pbxStatus: function()');
  const end = source.indexOf('localizarControladorExtension:', start);
  assert.ok(start >= 0 && end > start, 'actual snapshot controller methods exist');
  let now = 10000;
  const requests = [];
  const timers = new Map();
  const states = [];
  const received = [];
  let serial = 0;
  const context = vm.createContext({
    module_name: 'control_panel',
    mytelReportConnection(controller, state) {
      states.push(state);
      controller.lastState = state;
      if (state === 'connected') controller.lastUpdatedAt = now;
    },
    mytelEmit() {},
    contarElementos() {},
    verificar_error_session: response => !response || response.statusResponse !== 'ERROR_SESSION',
    Date: {now: () => now},
    setTimeout(callback, delay) { const id = ++serial; timers.set(id, {callback, delay}); return id; },
    clearTimeout: id => timers.delete(id),
    $: {ajax(options) {
      const callbacks = {};
      const request = {
        options,
        done(callback) { callbacks.done = callback; return this; },
        fail(callback) { callbacks.fail = callback; return this; },
        always(callback) { callbacks.always = callback; return this; },
        resolve(value) { callbacks.done(value); callbacks.always(); },
        reject(status = 0, reason = 'error') { callbacks.fail({status}, reason); callbacks.always(); },
        abort() { this.aborted = true; this.reject(0, 'abort'); }
      };
      requests.push(request);
      return request;
    }}
  });
  const controller = vm.runInContext('({' + source.slice(start, end) + '})', context);
  Object.assign(controller, {
    stopping: false,
    longPoll: null,
    get(key) { return this[key]; },
    manejarRespuestaStatus(response) { received.push(JSON.parse(JSON.stringify(response))); }
  });
  return {controller, requests, timers, states, received, advance: milliseconds => { now += milliseconds; }};
}

function snapshot(size = 100) {
  const phones = Array.from({length: size}, (_, i) => ({
    objtype: 'phones', changetype: 'create', channel: 'PJSIP/' + (1000 + i),
    extension: String(1000 + i), description: 'Synthetic operator ' + i,
    current_area: 'Extension', registered: true,
    active: i === 0 ? [
      {Channel: 'PJSIP/1000-00000001', CallerIDNum: '900001', ChannelStateDesc: 'Up', Since: 100},
      {Channel: 'PJSIP/1000-00000002', CallerIDNum: '900002', ChannelStateDesc: 'Ringing', Since: 105}
    ] : []
  }));
  phones.push({objtype: 'queues', changetype: 'create', extension: '6000', callers: Array.from({length: 10}, (_, i) => ({
    Channel: 'Local/synthetic-' + i + ';1', CallerIDNum: String(900010 + i), Position: i + 1, QueueSince: 90 + i
  }))});
  return {snapshot: true, timestamp: 120, pbxchanges: phones};
}

for (const variant of ['control_panel', 'control_panel_en']) {
  test(`${variant}: one in-flight request and a one-second start cadence`, () => {
    const h = harness(variant);
    h.controller.pbxStatus();
    h.controller.pbxStatus();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].options.timeout, 7000);
    assert.equal(h.requests[0].options.data.action, 'pbxSnapshot');
    assert.equal(h.requests[0].options.data.serverevents, undefined);
    h.advance(450);
    h.requests[0].resolve(snapshot());
    assert.equal(h.controller.longPoll, null);
    assert.equal(h.timers.size, 1);
    const timer = [...h.timers.values()][0];
    assert.equal(timer.delay, 550);
    timer.callback();
    assert.equal(h.requests.length, 2);
    assert.equal(h.states.at(-1), 'connected');
  });

  test(`${variant}: complete snapshots retain unchanged models and remove ended calls, callers and objects`, () => {
    const h = harness(variant);
    h.controller.manejarRespuestaSnapshot(snapshot());
    assert.equal(h.received[0].pbxchanges.length, 101);
    assert.equal(h.received[0].pbxchanges[0].active.length, 2);
    assert.equal(h.received[0].pbxchanges[100].callers.length, 10);
    h.controller.manejarRespuestaSnapshot(snapshot());
    assert.equal(h.received[1].pbxchanges.length, 0, 'identical snapshot does not rebuild cards');
    const next = snapshot(99);
    next.pbxchanges[0].active = [];
    next.pbxchanges[99].callers = [];
    h.controller.manejarRespuestaSnapshot(next);
    const changes = h.received[2].pbxchanges;
    assert.equal(changes.length, 3);
    assert.deepEqual(changes.find(item => item.channel === 'PJSIP/1000').active, []);
    assert.deepEqual(changes.find(item => item.extension === '6000').callers, []);
    assert.ok(changes.some(item => item.changetype === 'delete' && item.key === 'PJSIP/1099'));
  });

  test(`${variant}: failed or malformed responses retain prior display and retry after three seconds`, () => {
    for (const failure of ['network', 'invalid-json-shape', 'backend-error']) {
      const h = harness(variant);
      h.controller.manejarRespuestaSnapshot(snapshot());
      h.controller.lastUpdatedAt = 9000;
      h.controller.pbxStatus();
      if (failure === 'network') h.requests[0].reject(0, 'timeout');
      if (failure === 'invalid-json-shape') h.requests[0].resolve({snapshot: true});
      if (failure === 'backend-error') h.requests[0].resolve({snapshot: true, error: 'synthetic failure', pbxchanges: []});
      assert.equal(h.received.length, 1, failure + ': previous display remains untouched');
      assert.equal(h.states.at(-1), 'disconnected');
      assert.equal([...h.timers.values()][0].delay, 3000);
    }
  });

  test(`${variant}: access denial stops retries and shutdown aborts without starting another request`, () => {
    const denied = harness(variant);
    denied.controller.pbxStatus();
    denied.requests[0].reject(403);
    assert.equal(denied.controller.stopping, true);
    assert.equal(denied.timers.size, 0);
    assert.equal(denied.states.at(-1), 'permission');
    const closed = harness(variant);
    closed.controller.pbxStatus();
    closed.controller.pbxStatus_shutdown();
    assert.equal(closed.requests[0].aborted, true);
    assert.equal(closed.timers.size, 0);
    closed.controller.pbxStatus();
    assert.equal(closed.requests.length, 1);
  });
}
