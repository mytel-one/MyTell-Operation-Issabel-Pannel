const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../control_panel/themes/default/js/mytel-call-model.js');

const channel = (name, linked, unique, state='Up', since=100) => ({Channel:name,Linkedid:linked,Uniqueid:unique,ChannelStateDesc:state,Since:since,CallerIDNum:'201',ConnectedLineNum:'+12025550104'});

test('linked call legs are grouped once while different concurrent calls on one extension stay distinct', () => {
    const first=channel('PJSIP/201-a','1700000000.1','1700000000.1');
    const second=channel('PJSIP/202-b','1700000000.1','1700000000.2');
    const concurrent=channel('PJSIP/201-c','1700000000.3','1700000000.3','Ringing');
    const calls=model.collectCalls([{extension:'201',active:[first,concurrent]},{extension:'202',active:[second]}]);
    assert.equal(calls.length,2);
    assert.equal(calls[0].state,'ringing');
    assert.equal(calls[1].legs.length,2);
    assert.deepEqual(calls[1].extensions,['201','202']);
});

test('missing linked identifiers never merge unrelated calls and exact repeated channels are deduplicated', () => {
    const calls=model.collectCalls([{extension:'201',active:[channel('PJSIP/201-a','0','uid-a'),channel('PJSIP/201-b',null,'uid-b')]},{extension:'202',active:[channel('PJSIP/201-a','0','uid-a')]}]);
    assert.equal(calls.length,2);
    assert.equal(calls[0].legs.length,1);
    assert.equal(calls[1].legs.length,1);
    assert.equal(model.collectCalls([{extension:'201',active:[]}]).length,0);
});

test('full snapshots are authoritative, include unclassified channels and remove stale calls', () => {
    const snapshot=[{id:'linked:abc123',linkedid:'abc123',channels:[channel('Local/route;1','abc123','uid-1')],extensions:[],queue_ids:['600'],state:'Up',started_at:100}];
    const calls=model.collectCalls([{extension:'201',active:[channel('stale','old123','old123')]}],snapshot);
    assert.equal(calls.length,1);
    assert.equal(calls[0].legs[0].channel,'Local/route;1');
    assert.deepEqual(calls[0].queueIds,['600']);
    assert.equal(model.collectCalls([],[]).length,0);
});

test('unknown direction, answer time and hold information remain unknown', () => {
    const leg=model.normalizeLeg(channel('PJSIP/201-a','abc123','uid-1'));
    assert.equal(leg.direction,null);
    assert.equal(leg.answered,null);
    assert.equal(leg.hold,null);
    assert.equal(leg.started,100);
    const held=model.collectCalls([],[{id:'call1',channels:[{...channel('one','abc123','uid-1'),on_hold:true}],extensions:['201'],state:'Up'}]);
    assert.equal(held[0].state,'hold');
});

test('an answered PBX channel in QueueEntry is waiting for an agent, not an answered conversation', () => {
    const calls=model.collectCalls([],[{id:'queued',state:'Waiting',queue_ids:['600'],channels:[channel('PJSIP/trunk-a','abc123','uid-1','Up')],extensions:[]}]);
    assert.equal(calls[0].state,'waiting');
    assert.deepEqual(calls[0].queueIds,['600']);
});

test('call filtering searches parties, extension, caller name and queue with stable ordering', () => {
    const calls=model.collectCalls([],[
        {id:'second',channels:[channel('b','def123','uid-2','Up',200)],extensions:['202'],queue_ids:['600'],started_at:200},
        {id:'first',channels:[{...channel('a','abc123','uid-1','Up',100),CallerIDName:'Alex <script>alert(1)</script>'}],extensions:['201'],started_at:100}
    ]);
    assert.deepEqual(model.filterCalls(calls,'','all').map(call=>call.id),['first','second']);
    assert.equal(model.filterCalls(calls,'Alex','in-call').length,1);
    assert.equal(model.filterCalls(calls,'600','all').length,1);
    assert.equal(model.filterCalls(calls,'no-match','all').length,0);
    assert.equal(calls[0].legs[0].callerName,'Alex <script>alert(1)</script>');
});

test('queue longest wait is derived from known observations and marks incomplete data', () => {
    assert.deepEqual(model.queueSummary({Completed:12,Abandoned:3,callers:[{Wait:20},{QueueSince:70},{}]},100),{answered:12,abandoned:3,waiting:3,longest:30,partial:true,averageHold:null,strategy:null});
    assert.equal(model.queueSummary({callers:[]},100).longest,0);
    assert.equal(model.queueSummary({callers:[{}]},100).longest,null);
});

test('callback action requires valid different source and destination extensions', () => {
    assert.deepEqual(model.callbackPayload('201','202'),{action:'callExtension',source:'201',target:'202'});
    assert.throws(()=>model.callbackPayload('201','201'));
    assert.throws(()=>model.callbackPayload('201\r\nAction: Hangup','202'));
    assert.throws(()=>model.callbackPayload('','202'));
});

test('durations handle long calls, unavailable data and client clock skew', () => {
    assert.equal(model.duration(3661),'01:01:01');
    assert.equal(model.duration(null),'Not reported');
    assert.equal(model.duration(-5),'00:00');
});

test('reported busy, down and off-hook states remain visible rather than becoming missing data', () => {
    for (const [reported,expected] of [['Busy','busy'],['Down','down'],['OffHook','off-hook']]) {
        assert.equal(model.collectCalls([],[{id:reported,state:reported,channels:[{ChannelStateDesc:reported}]}])[0].state,expected);
    }
});

test('queue membership matches exact endpoints and Local destinations without prefix collisions', () => {
    const phone={extension:'201',channel:'PJSIP/201'};
    const queues=[{extension:'600',description:'Support',memberRefresh:[
        {Interface:'PJSIP/2010',Status:'1'},
        {Interface:'Local/201@from-queue/n',StateInterface:'PJSIP/201',Status:'2',Paused:'1',CallsTaken:7,Penalty:1},
        {Interface:'PJSIP/201',Status:'1',Paused:false}
    ]}];
    const memberships=model.queueMemberships(queues,phone);
    assert.equal(memberships.length,2);
    assert.equal(memberships[0].paused,true);
    assert.equal(memberships[0].callsTaken,7);
    assert.equal(memberships[1].paused,false);
    assert.equal(model.queueMemberships([{extension:'601',memberRefresh:[{Interface:'Local/2010@from-queue/n'}]}],phone).length,0);
});

test('call direction uses explicit snapshot evidence and never guesses from caller numbers', () => {
    const calls=model.collectCalls([],[
        {id:'in',direction:'incoming',channels:[{...channel('one','abc123','uid-1'),direction:'incoming'}]},
        {id:'out',direction:'outgoing',channels:[channel('two','def123','uid-2')]},
        {id:'internal',direction:'internal',channels:[channel('three','ghi123','uid-3'),channel('four','ghi123','uid-4')]},
        {id:'unknown',direction:null,channels:[{...channel('five','jkl123','uid-5'),CallerIDNum:'+12025550104'}]},
        {id:'unsupported',direction:'inbound',channels:[channel('six','mno123','uid-6')]}
    ]);
    assert.deepEqual(model.directionTotals(calls),{all:5,incoming:1,outgoing:1,internal:1,unknown:2});
    assert.equal(calls.find(call=>call.id==='unknown').direction,null);
    assert.equal(calls.find(call=>call.id==='unsupported').direction,null);
    assert.equal(calls.find(call=>call.id==='in').legs[0].direction,'incoming');
    assert.equal(model.directionLabel(null),'Unknown');
    assert.equal(model.directionLabel('outgoing'),'Outgoing');
});

test('direction filters combine with call status and search while preserving grouped call totals', () => {
    const calls=model.collectCalls([],[
        {id:'incoming',direction:'incoming',state:'Ringing',channels:[channel('one','abc123','uid-1','Ringing')],extensions:['201']},
        {id:'outgoing',direction:'outgoing',channels:[channel('two','def123','uid-2')],extensions:['202']},
        {id:'unknown',direction:null,channels:[channel('three','ghi123','uid-3')],extensions:['203']}
    ]);
    assert.deepEqual(model.filterCalls(calls,'201','ringing','incoming').map(call=>call.id),['incoming']);
    assert.equal(model.filterCalls(calls,'','in-call','incoming').length,0);
    assert.deepEqual(model.filterCalls(calls,'','all','unknown').map(call=>call.id),['unknown']);
    assert.equal(model.filterCalls(calls,'','all','outgoing').length,1);
});

test('contextual call controls require explicit capabilities and exact observed identities', () => {
    const leg=model.normalizeLeg({...channel('PJSIP/202-a','abc123','uid-2'),local_extension:'202',actions:{transfer:true,consult:true,park:true,pickup:true,park_return_extension:'201'}});
    assert.deepEqual(model.transferPayload(leg,'205',false),{action:'transferChannel',channel:'PJSIP/202-a',uniqueid:'uid-2',target:'205'});
    assert.equal(model.transferPayload(leg,'205',true).action,'consultTransferChannel');
    assert.deepEqual(model.parkPayload(leg,'main',[{id:'main'}]),{action:'parkChannel',channel:'PJSIP/202-a',uniqueid:'uid-2',lot:'main'});
    assert.equal(model.pickupPayload(leg,'201').source,'201');
    assert.throws(()=>model.transferPayload(leg,'202',false));
    assert.throws(()=>model.parkPayload(leg,'invented',[{id:'main'}]));
    assert.throws(()=>model.pickupPayload(leg,'202'));
    assert.throws(()=>model.transferPayload({...leg,channel:'PJSIP/202\r\nAction: Hangup'},'205',false));
    assert.throws(()=>model.transferPayload({...leg,canTransfer:false},'205',false));
    assert.throws(()=>model.parkPayload({...leg,canPark:false},'main',[{id:'main'}]));
});

test('destination search uses configured contacts, preserves offline evidence and prioritizes favorites', () => {
    const options=model.destinationOptions([{extension:'1000',description:'Sales',registered:true},{extension:'201',description:'Reception',registered:false},{extension:'202',description:'Operator',registered:true},{extension:'205',description:'Sales lead <script>',registered:true}],'sales','202',['205']);
    assert.deepEqual(options.map(item=>item.extension),['205','1000']);
    assert.equal(options[0].name,'Sales lead <script>');
    assert.equal(model.destinationOptions([{extension:'201',description:'Reception',registered:false}],'','',[])[0].registered,false);
    assert.equal(model.destinationOptions([{extension:'202',description:'Operator'}],'','202',[]).length,0);
});

test('missing or string-valued capability flags never create actionable controls', () => {
    const leg=model.normalizeLeg({...channel('one','abc123','uid-1'),actions:{transfer:'true',park:1,pickup:'1'}});
    assert.equal(leg.canTransfer,false);assert.equal(leg.canPark,false);assert.equal(leg.canPickup,false);assert.equal(leg.canConsult,false);
});

test('a verified local ringing leg remains visible when the PBX has already answered the trunk',()=>{
    const calls=model.collectCalls([],[{id:'incoming',state:'Up',channels:[{Channel:'PJSIP/trunk-a',ChannelStateDesc:'Up'},{Channel:'PJSIP/201-b',local_extension:'201',ChannelStateDesc:'Ringing'}]}]);
    assert.equal(calls[0].state,'ringing');
    const unrelated=model.collectCalls([],[{id:'other',state:'Up',channels:[{Channel:'PJSIP/201-a',local_extension:'201',ChannelStateDesc:'Up'},{Channel:'PJSIP/trunk-b',ChannelStateDesc:'Ringing'}]}]);
    assert.equal(unrelated[0].state,'in-call');
});
