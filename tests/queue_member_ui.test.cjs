const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
function browserFixture(api, allowed, late, membership) {
  let document;
  class Element {
    constructor(tag) { this.tagName=tag; this.children=[]; this.attributes={}; this.events={}; this.value=''; this._text=''; }
    set textContent(value) { this._text=String(value); this.children=[]; }
    get textContent() { return this._text+this.children.map(child=>child.textContent).join(' '); }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name,value) { this.attributes[name]=String(value); }
    getAttribute(name) { return this.attributes[name] == null ? null : this.attributes[name]; }
    addEventListener(name,callback) { this.events[name]=callback; }
    querySelectorAll(selector) {
      const result=[];
      const attribute=selector.match(/^\[([a-z-]+)\]$/);
      this.children.forEach(child=>{if(attribute&&child.getAttribute(attribute[1])!==null)result.push(child);result.push(...child.querySelectorAll(selector));});
      return result;
    }
    focus() { document.activeElement=this; }
  }
  const host=new Element('div'), count=new Element('span'), events={}, requests=[];
  host.appendChild(new Element('p')).textContent='Waiting for agent data…';
  let visible=!late;
  const source=new Element('select');source.value='101';const confirmations=[];
  document={readyState:'complete',activeElement:null,createElement:tag=>new Element(tag),querySelector:selector=>selector==='[data-agent-workspace]'?(visible?host:null):(selector==='[data-agent-count]'?count:(selector==='[data-operator-source]'?source:null))};
  const root={document,var_init:{CSRF_TOKEN:'synthetic-csrf',OPERATOR_ACCESS:{queues:allowed,membership:membership===true}},confirm(message){confirmations.push(message);return true;},setInterval(){},addEventListener(name,callback){if(!events[name])events[name]=[];events[name].push(callback);},jQuery:{ajax(options){
    const callbacks={}; const request={options,done(callback){callbacks.done=callback;return this;},fail(callback){callbacks.fail=callback;return this;},resolve(response){callbacks.done(response);},reject(){callbacks.fail();}};
    requests.push(request);return request;
  }}};
  api.mount(root);
  function emit(type,detail){(events[type]||[]).slice().forEach(callback=>callback({type,detail}));}
  function snapshot(paused, members, registered=true, includePhones=true) {
    emit('mytel:connection',{state:'connected'});
    emit('mytel:snapshot',{snapshot:true,pbxchanges:[...(includePhones?[{objtype:'phones',extension:'101',channel:'PJSIP/101',registered}]:[]),{objtype:'queues',extension:'6000',description:'Support',memberRefresh:members||[{Interface:'PJSIP/101',MemberName:'Synthetic agent',Status:'1',Paused:paused,Membership:'dynamic',InCall:'0'}]}]});
  }
  return {host,requests,snapshot,confirmations,setController:value=>{root.debug_root=value;},reveal:()=>{visible=true;},buttons:()=>host.querySelectorAll('[data-agent-key]'),membershipButtons:()=>host.querySelectorAll('[data-membership-action]')};
}
for (const variant of ['control_panel', 'control_panel_en']) {
  const filename = path.join(__dirname, '..', variant, 'themes/default/js/mytel-queue-controls.js');
  let api;
  try { api = require(filename); } catch (_) {}
  test(`${variant}: queue controls module is available`, () => assert.ok(api));
  if (!api) continue;
  test(`${variant}: each exact queue membership retains its observed pause state`, () => {
    const rows = api.normalizeQueues([
      {extension:'6000', description:'Support', memberRefresh:[{Interface:'PJSIP/101', MemberName:'Agent', Status:'1', Paused:'0'}]},
      {extension:'6001', description:'Sales', memberRefresh:[{Location:'PJSIP/101', Name:'Agent', Status:'1', Paused:'1'}]}
    ]);
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].key, rows[1].key);
    assert.equal(rows[0].state, 'Available');
    assert.equal(rows[0].paused, '0');
    assert.equal(rows[1].state, 'Paused');
    assert.equal(rows[1].paused, '1');
  });
  test(`${variant}: missing pause or member identity stays unknown and cannot be controlled`, () => {
    const row = api.normalizeQueues([{extension:'6000',memberRefresh:[{MemberName:'Unknown',Status:'0'}]}])[0];
    assert.equal(row.paused, null);
    assert.equal(row.state, 'Unknown');
    assert.equal(api.canControl(row,{queues:true},'connected',1000,1500,false),false);
  });
  test(`${variant}: queue access, fresh connection and known observed state are all required`, () => {
    const row=api.normalizeQueues([{extension:'6000',memberRefresh:[{Interface:'Local/101@from-queue/n',Status:'2',Paused:'0'}]}])[0];
    assert.equal(api.canControl(row,{queues:true},'connected',1000,1500,false),true);
    for (const args of [
      [row,{queues:false},'connected',1000,1500,false],
      [row,{},'connected',1000,1500,false],
      [row,{queues:'true'},'connected',1000,1500,false],
      [row,{queues:true},'disconnected',1000,1500,false],
      [row,{queues:true},'connected',1000,12000,false],
      [row,{queues:true},'connected',1000,1500,true]
    ]) assert.equal(api.canControl(...args),false);
  });
  test(`${variant}: busy or unavailable state is never shown as available`, () => {
    const rows=api.normalizeQueues([{extension:'6000',memberRefresh:[
      {Interface:'PJSIP/101',Status:'1',Paused:'0',InCall:'1'},
      {Interface:'PJSIP/102',Status:'5',Paused:'0'},
      {Interface:'PJSIP/103',Status:'1'}
    ]}]);
    assert.equal(rows[0].state,'In call');
    assert.equal(rows[1].state,'Unavailable');
    assert.equal(rows[2].state,'Unknown');
    assert.ok(rows.every(row=>row.state!=='Available'));
  });
  test(`${variant}: duplicate member events are deduplicated without merging distinct queues`, () => {
    const member={Interface:'PJSIP/101',Status:'1',Paused:'0'};
    const rows=api.normalizeQueues([{extension:'6000',memberRefresh:[member,member]},{extension:'6001',memberRefresh:[member]}]);
    assert.equal(rows.length,2);
    assert.equal(api.matchesSearch(rows[1],'6001'),true);
    assert.equal(api.matchesSearch(rows[1],'pjsip/101'),true);
    assert.equal(api.matchesSearch(rows[1],'missing'),false);
  });
  test(`${variant}: mounted observer surface has no queue mutation controls`,()=>{
    const fixture=browserFixture(api,false);fixture.snapshot('0');
    assert.equal(fixture.buttons().length,0);
    assert.match(fixture.host.textContent,/Read-only agent status/);
    assert.equal(fixture.requests.length,0);
    assert.ok(!fixture.host.textContent.includes('Waiting for agent data'));
  });
  test(`${variant}: agent surface mounts after Ember renders its template`,()=>{
    const fixture=browserFixture(api,true,true);
    fixture.reveal();fixture.snapshot('0');
    assert.equal(fixture.buttons().length,1);
    assert.equal(fixture.buttons()[0].disabled,false);
    assert.ok(!fixture.host.textContent.includes('Waiting for agent data'));
  });
  test(`${variant}: accepted request keeps observed state until PBX snapshot confirms`,()=>{
    const fixture=browserFixture(api,true);fixture.snapshot('0');
    const button=fixture.buttons()[0];assert.equal(button.disabled,false);button.events.click();button.events.click();
    assert.equal(fixture.requests.length,1);
    assert.deepEqual(fixture.requests[0].options.data,{menu:'control_panel',rawmode:'yes',action:'toggleQueueMemberPause',queue:'6000',interface:'PJSIP/101',paused:'1'});
    assert.equal(fixture.requests[0].options.headers['X-MyTel-CSRF'],'synthetic-csrf');
    fixture.requests[0].resolve({status:'success'});
    assert.match(fixture.host.textContent,/Available/);
    assert.equal(fixture.buttons()[0].disabled,true);
    fixture.snapshot('1');
    assert.equal(fixture.buttons()[0].textContent,'Resume');
    assert.equal(fixture.buttons()[0].disabled,false);
    assert.match(fixture.host.textContent,/confirmed by the PBX snapshot/);
  });
  test(`${variant}: lost acknowledgement requires a fresh snapshot before another action`,()=>{
    const fixture=browserFixture(api,true);fixture.snapshot('0');fixture.buttons()[0].events.click();
    fixture.requests[0].reject();
    assert.equal(fixture.buttons()[0].disabled,true);
    fixture.snapshot('0');
    assert.equal(fixture.buttons()[0].disabled,false);
    assert.equal(fixture.requests.length,1,'refresh never resends a mutation');
  });
  test(`${variant}: membership controls have a separate permission and refuse active or permanent members`,()=>{
    const row=api.normalizeQueues([{extension:'6000',memberRefresh:[{Interface:'PJSIP/101',Status:'1',Paused:'0',Membership:'dynamic',InCall:'0'}]}])[0];
    assert.equal(api.canLeave(row,{membership:true},'connected',1000,1500,false),true);
    assert.equal(api.canLeave(row,{queues:true},'connected',1000,1500,false),false);
    for(const override of [{membership:'static'},{membership:'realtime'},{membership:null},{inCall:true},{inCall:null},{status:'2'},{status:'0'}])
      assert.equal(api.canLeave({...row,...override},{membership:true},'connected',1000,1500,false),false);
    assert.equal(api.canJoin('6000','101',true,{membership:true},'connected',1000,1500,false),true);
    assert.equal(api.canJoin('6000','101',false,{membership:true},'connected',1000,1500,false),false);
    assert.equal(api.canJoin('6000','101',true,{membership:true},'connected',1000,1500,false,true),false);
  });
  test(`${variant}: dynamic sign-in confirms the choice and waits for the new observed membership`,()=>{
    const fixture=browserFixture(api,false,false,true);fixture.snapshot('0',[]);
    const join=fixture.membershipButtons().find(button=>button.getAttribute('data-membership-action')==='join');
    assert.equal(join.disabled,false);join.events.click();
    assert.equal(fixture.confirmations.length,1);
    assert.deepEqual(fixture.requests[0].options.data,{menu:'control_panel',rawmode:'yes',action:'joinQueueMember',queue:'6000',source:'101'});
    fixture.requests[0].resolve({status:'success',member_interface:'PJSIP/101'});
    assert.ok(!fixture.host.textContent.includes('Signed in to queue'));
    fixture.snapshot('0');
    assert.match(fixture.host.textContent,/Signed in to queue 6000, confirmed/);
  });
  test(`${variant}: dynamic sign-out keeps the row until the next snapshot removes it`,()=>{
    const fixture=browserFixture(api,false,false,true);fixture.snapshot('0');
    const leave=fixture.membershipButtons().find(button=>button.getAttribute('data-membership-action')==='leave');
    assert.equal(leave.disabled,false);leave.events.click();
    assert.equal(fixture.confirmations.length,1);
    assert.deepEqual(fixture.requests[0].options.data,{menu:'control_panel',rawmode:'yes',action:'leaveQueueMember',queue:'6000',interface:'PJSIP/101'});
    fixture.requests[0].resolve({status:'success',member_interface:'PJSIP/101'});
    assert.match(fixture.host.textContent,/Synthetic agent/);
    fixture.snapshot('0',[]);
    assert.ok(!fixture.host.textContent.includes('Synthetic agent'));
    assert.match(fixture.host.textContent,/Signed out of queue 6000, confirmed/);
  });
  test(`${variant}: unchanged snapshots retain agent controls for keyboard use`,()=>{
    const fixture=browserFixture(api,true,false,true);fixture.snapshot('0');
    const pause=fixture.buttons()[0], leave=fixture.membershipButtons().find(button=>button.getAttribute('data-membership-action')==='leave');
    fixture.snapshot('0');
    assert.equal(fixture.buttons()[0],pause);
    assert.equal(fixture.membershipButtons().find(button=>button.getAttribute('data-membership-action')==='leave'),leave);
  });
  test(`${variant}: an existing membership disables sign-in with an accurate reason`,()=>{
    const fixture=browserFixture(api,false,false,true);fixture.snapshot('0');
    const join=fixture.membershipButtons().find(button=>button.getAttribute('data-membership-action')==='join');
    assert.equal(join.disabled,true);
    assert.match(fixture.host.textContent,/already has a membership in queue 6000/);
    assert.ok(!fixture.host.textContent.includes('must be registered'));
  });
  test(`${variant}: registered source can be read from existing plain controller collections`,()=>{
    const fixture=browserFixture(api,false,false,true);
    fixture.setController({extensions:[{extension:'101',channel:'PJSIP/101',registered:true}]});
    fixture.snapshot('0',[],true,false);
    assert.equal(fixture.membershipButtons().find(button=>button.getAttribute('data-membership-action')==='join').disabled,false);
    assert.match(fixture.host.textContent,/Using My extension: 101/);
  });
}
