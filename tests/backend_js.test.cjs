const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const variant of ['control_panel', 'control_panel_en']) {
  const source = fs.readFileSync(path.join(__dirname, '..', variant, 'themes/default/js/javascript.js'), 'utf8');
  const context = vm.createContext({memberStatus: () => ({circleHTML: '<i></i>', statusImage: ''})});
  const helpersStart = source.indexOf('function mytelEscapeHTML');
  if (helpersStart >= 0) vm.runInContext(source.slice(helpersStart, source.indexOf('//Retain', helpersStart) > -1 ? source.indexOf('//Retain', helpersStart) : source.indexOf('// Retain', helpersStart)), context);
  vm.runInContext(source.slice(source.indexOf('function generateAgentHTML'), source.indexOf('// Queue member states')), context);
  test(`${variant}: queue member text cannot inject HTML`, () => {
    const html = context.generateAgentHTML({Name: '<img src=x onerror=alert(1)>', Location: '100" onmouseover="alert(1)', Status: '1', Paused: '0'});
    assert.ok(!html.includes('<img'), html);
    assert.ok(!html.includes('data-member-number="100" onmouseover='), html);
    assert.ok(html.includes('&lt;img'), html);
  });
  test(`${variant}: queue member location is escaped as visible text`, () => {
    const html = context.generateAgentHTML({Name: 'Operator', Location: '<img src=x onerror=alert(1)>', Status: '1', Paused: '0'});
    assert.ok(!html.includes('<img'), html);
    assert.ok(html.includes('&lt;img'), html);
  });
  test(`${variant}: Ember array helpers do not crash the unused legacy table resize handler`, () => {
    // Issabel's colResizable 1.5 iterates its table Array with for..in. Ember
    // adds enumerable Array helpers, which the legacy handler mistakes for tables.
    const isolated = vm.createContext({});
    vm.runInContext(`
      var window = {};
      var document = {getElementById: function () { return {}; }, querySelector: function () { return null; }};
      var unrelatedResizes = 0;
      var handlers = {'resize.other': function () { unrelatedResizes++; }};
      Array.prototype.emberHelper = function () {};
      var legacyTables = [];
      handlers['resize.JColResizer'] = function () {
        for (var key in legacyTables) legacyTables[key].removeClass('JColResizer');
      };
      function $() { return {off: function (name) { delete handlers[name]; }}; }
    `, isolated);
    const start = source.indexOf('function mytelIsolateLegacyTableResize');
    if (start >= 0) {
      vm.runInContext(source.slice(start, source.indexOf('function mytelEscapeHTML', start)), isolated);
      vm.runInContext('mytelIsolateLegacyTableResize();', isolated);
    }
    assert.doesNotThrow(() => vm.runInContext('Object.keys(handlers).forEach(function (name) { handlers[name](); });', isolated));
    assert.equal(isolated.unrelatedResizes, 1, 'other resize handlers remain active');
  });
  test(`${variant}: extension selection reads named attributes regardless of DOM attribute order`, () => {
    const card = {id: 'ember100', style: {}};
    const attrs = [{value: '100', nodeValue:'100'}, {value:'PJSIP/100'}, {value:'pbxactive ExtensionStyle'}];
    attrs.getNamedItem = name => ({id: {value:'ember100'}, class:{value:'pbxactive ExtensionStyle'}, 'data-idattr':{value:'PJSIP/100'}})[name];
    const selection = vm.createContext({document:{getElementById: () => card}, selectedContainer:null, selectedExtension:null, selectedTech:null, line1:null, line2:null});
    vm.runInContext(source.slice(source.indexOf('function selectExtension('), source.indexOf('document.addEventListener("click"', source.indexOf('function selectExtension('))), selection);
    selection.selectExtension(attrs, {});
    assert.equal(selection.selectedExtension, '100');
    assert.equal(selection.selectedContainer, card);
  });
}
