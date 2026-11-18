const test = require('node:test');
const assert = require('node:assert/strict');
const ui = require('../control_panel/themes/default/js/mytel-ui.js');

test('search accepts Persian and Arabic extension digits and Arabic letter variants', () => {
    const phone = {extension: '201', description: 'علی کیانی', channel: 'PJSIP/201', registered: true};
    assert.equal(ui.matches(phone, '۲۰۱', 'all'), true);
    assert.equal(ui.matches(phone, '٢٠١', 'online'), true);
    assert.equal(ui.matches(phone, 'علي كياني', 'all'), true);
    assert.equal(ui.matches(phone, '202', 'all'), false);
});

test('status filters distinguish offline, available, ringing and actual conversations', () => {
    const available = {registered: true, active: []};
    const offline = {registered: false, active: []};
    const ringing = {registered: true, active: [{ChannelStateDesc: 'Ringing'}]};
    const busy = {registered: true, active: [{ChannelStateDesc: 'Up'}]};
    assert.equal(ui.phoneState(available), 'online');
    assert.equal(ui.phoneState(offline), 'offline');
    assert.equal(ui.phoneState(ringing), 'ringing');
    assert.equal(ui.phoneState(busy), 'busy');
    assert.equal(ui.matches(ringing, '', 'busy'), false);
    assert.equal(ui.matches(ringing, '', 'online'), true);
    assert.equal(ui.matches(busy, '', 'online'), true);
    assert.equal(ui.matches(offline, '', 'online'), false);
});

test('metrics count current models and queued callers without counting call legs twice', () => {
    const phones = [
        {registered: true, active: []},
        {registered: true, active: [{ChannelStateDesc: 'Up'}, {ChannelStateDesc: 'Up'}]},
        {registered: false, active: []},
        {registered: true, active: [{ChannelStateDesc: 'Ringing'}]}
    ];
    assert.deepEqual(ui.summarize(phones, [{callers: [{}, {}]}, {callers: [{}]}]), {all: 4, online: 3, offline: 1, busy: 1, waiting: 3});
    assert.deepEqual(ui.summarize([], []), {all: 0, online: 0, offline: 0, busy: 0, waiting: 0});
});

test('search and counters work with Ember models and zero-valued extensions', () => {
    const phone = {get: key => ({extension: 0, description: null, registered: 1, trunkstate: 'Up', active: []}[key])};
    assert.equal(ui.matches(phone, '۰', 'busy'), true);
    assert.equal(ui.matches(phone, 'unknown', 'all'), false);
    assert.equal(ui.summarize([phone], []).busy, 1);
});

test('the English and Persian UI behavior bundles stay identical', () => {
    const fs = require('node:fs');
    assert.equal(fs.readFileSync(require.resolve('../control_panel/themes/default/js/mytel-ui.js'), 'utf8'), fs.readFileSync(require.resolve('../control_panel_en/themes/default/js/mytel-ui.js'), 'utf8'));
});

test('registration counts stay accurate even when an unregistered device retains a call', () => {
    const phone = {registered: false, active: [{ChannelStateDesc: 'Up'}]};
    assert.equal(ui.phoneState(phone), 'busy');
    assert.equal(ui.matches(phone, '', 'online'), false);
    assert.equal(ui.matches(phone, '', 'offline'), true);
    assert.deepEqual(ui.summarize([phone], []), {all: 1, online: 0, offline: 1, busy: 1, waiting: 0});
});
