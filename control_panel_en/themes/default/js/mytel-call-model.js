/* Pure adapters for actual AMI data. Missing data remains unknown. */
(function (global) {
    'use strict';
    function get(object, key, fallback) {
        var value = object && typeof object.get === 'function' ? object.get(key) : object && object[key];
        return value == null ? fallback : value;
    }
    function list(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        var output = [];
        for (var i = 0; i < get(value, 'length', 0); i++) output.push(value.objectAt(i));
        return output;
    }
    function present(value) {
        return value != null && !/^(?:|unknown|<unknown>|null|undefined)$/i.test(String(value));
    }
    function number(value) {
        return value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
    }
    function validId(value) { return present(value) && String(value) !== '0' && /^[a-zA-Z0-9_.:-]{3,128}$/.test(String(value)); }
    function normalizeDirection(value) { return ['incoming','outgoing','internal'].indexOf(value)!==-1?value:null; }
    function directionLabel(value) { return {incoming:'Incoming',outgoing:'Outgoing',internal:'Internal'}[value] || 'Unknown'; }
    function normalizeLeg(input, extension) {
        var caller = get(input, 'CallerIDNum', null);
        var connected = get(input, 'ConnectedLineNum', null);
        var actions=get(input,'actions',{});
        return {
            channel: get(input, 'Channel', null), uniqueid: get(input, 'Uniqueid', get(input, 'uniqueid', null)),
            linkedid: get(input, 'Linkedid', get(input, 'linkedid', null)), extension: extension || get(input, 'local_extension',get(input, 'localExtension', get(input, 'ownext', null))),
            caller: present(caller) ? String(caller) : null, callerName: get(input, 'CallerIDName', null),
            connected: present(connected) ? String(connected) : null, connectedName: get(input, 'ConnectedLineName', null),
            state: get(input, 'ChannelStateDesc', null), started: number(get(input, 'Since', get(input, 'started_at', null))),
            answered: number(get(input, 'answered_at', null)), answeredSeconds: number(get(input, 'answered_seconds', null)),
            hold: get(input, 'on_hold', null), direction: normalizeDirection(get(input, 'direction', null)),
            bridge: get(input, 'BridgeID', null), context: get(input, 'Context', null),
            destination: get(input, 'Extension', null), application: get(input, 'Application', null),
            appData: get(input, 'AppData', null), dnid: get(input, 'DNID', null),
            readFormat: get(input, 'Readformat', null), writeFormat: get(input, 'Writeformat', null),
            canTransfer:get(actions,'transfer',false)===true,canConsult:get(actions,'consult',false)===true,canPark:get(actions,'park',false)===true,canPickup:get(actions,'pickup',false)===true,
            parkReturnExtension:get(actions,'park_return_extension',get(input,'park_return_extension',null))
        };
    }
    function stateFor(legs, reported) {
        if (/wait|queue/i.test(String(reported || ''))) return 'waiting';
        if(legs.some(function(leg){return leg.extension!=null && /^Ring/i.test(leg.state || '');}))return 'ringing';
        if (legs.some(function (leg) { return leg.hold === true; })) return 'hold';
        if (legs.some(function (leg) { return leg.state === 'Up'; })) return 'in-call';
        if (legs.some(function (leg) { return /^Ring/i.test(leg.state || ''); })) return 'ringing';
        var state = String(reported || '').toLowerCase();
        if (/hold/.test(state)) return 'hold';
        if (/^(up|in-call|answered|connected)$/.test(state)) return 'in-call';
        if (/ring/.test(state)) return 'ringing';
        if (/wait|queue/.test(state)) return 'waiting';
        if (/dial/.test(state)) return 'dialing';
        if (state==='busy') return 'busy';
        if (state==='down') return 'down';
        if (/off.?hook/.test(state)) return 'off-hook';
        if (/pre.?ring/.test(state)) return 'pre-ring';
        if (present(reported)) return 'reported';
        return 'unknown';
    }
    function uniqueStrings(values) {
        return values.filter(function (value, index, array) { return present(value) && array.indexOf(value) === index; }).map(String);
    }
    function finishCall(call) {
        call.extensions = uniqueStrings(call.extensions).sort(function (a,b) { return a.localeCompare(b, undefined, {numeric:true}); });
        call.queueIds = uniqueStrings(call.queueIds);
        call.state = stateFor(call.legs, call.reportedState);
        var started = call.legs.map(function (leg) { return leg.started; }).filter(function (value) { return value != null; });
        if (call.started == null && started.length) call.started = Math.min.apply(null, started);
        call.caller = call.legs.map(function (leg) { return leg.caller; }).filter(present)[0] || null;
        call.connected = call.legs.map(function (leg) { return leg.connected; }).filter(present)[0] || null;
        call.direction = normalizeDirection(call.direction);
        return call;
    }
    function collectCalls(phones, liveCalls) {
        if (Array.isArray(liveCalls)) return liveCalls.map(function (input, index) {
            var legs = list(get(input, 'channels', [])).map(function (leg) { return normalizeLeg(leg); });
            return finishCall({id: String(get(input,'id','snapshot:'+index)), linkedid:get(input,'linkedid',null), legs:legs,
                extensions:list(get(input,'extensions',[])), queueIds:list(get(input,'queue_ids',[])),
                reportedState:get(input,'state',null), started:number(get(input,'started_at',null)), direction:get(input,'direction',null)});
        }).sort(compareCalls);
        var groups = Object.create(null);
        var seen = Object.create(null);
        phones.forEach(function (phone, phoneIndex) {
            var extension = get(phone,'extension',null);
            list(get(phone,'active',[])).forEach(function (input, index) {
                var leg = normalizeLeg(input,extension);
                var key = validId(leg.linkedid) ? 'linked:'+leg.linkedid : validId(leg.uniqueid) ? 'unique:'+leg.uniqueid : present(leg.channel) ? 'channel:'+leg.channel : 'unidentified:'+phoneIndex+':'+index;
                if (!groups[key]) groups[key] = {id:key,linkedid:leg.linkedid,legs:[],extensions:[],queueIds:[],started:null,direction:leg.direction};
                var identity = present(leg.channel) ? String(leg.channel) : validId(leg.uniqueid) ? 'unique:'+leg.uniqueid : key;
                if (!seen[key+'|'+identity]) { groups[key].legs.push(leg); seen[key+'|'+identity] = true; }
                groups[key].extensions.push(extension);
            });
        });
        return Object.keys(groups).map(function (key) { return finishCall(groups[key]); }).sort(compareCalls);
    }
    function compareCalls(a,b) {
        var priority = {ringing:0,waiting:1,hold:2,'in-call':3,dialing:4,busy:5,'off-hook':6,'pre-ring':7,down:8,reported:9,unknown:10};
        return priority[a.state]-priority[b.state] || (a.started == null ? Infinity:a.started)-(b.started == null ? Infinity:b.started) || a.id.localeCompare(b.id);
    }
    function filterCalls(calls, query, state, direction) {
        var normalize = global.MyTelUI ? global.MyTelUI.normalize : function (value) { return String(value).toLowerCase().trim(); };
        var search = normalize(query || '');
        return calls.filter(function (call) {
            var haystack = [call.id,call.caller,call.connected].concat(call.extensions,call.extensionNames || [],call.queueIds);
            call.legs.forEach(function (leg) { haystack.push(leg.channel,leg.callerName,leg.connectedName,leg.destination); });
            var directionMatches=!direction || direction==='all' || (direction==='unknown' ? call.direction==null : call.direction===direction);
            return directionMatches && (!state || state==='all' || call.state===state) && normalize(haystack.join(' ')).indexOf(search)!==-1;
        }).sort(compareCalls);
    }
    function directionTotals(calls) {
        var totals={all:calls.length,incoming:0,outgoing:0,internal:0,unknown:0};
        calls.forEach(function(call){totals[normalizeDirection(call.direction) || 'unknown']++;});
        return totals;
    }
    function duration(seconds) {
        var value = number(seconds);
        if (value == null) return 'Not reported';
        value = Math.max(0,Math.floor(value));
        var hours = Math.floor(value/3600);
        var minutes = Math.floor(value%3600/60);
        var remainder = value%60;
        return (hours ? String(hours).padStart(2,'0')+':' : '') + String(minutes).padStart(2,'0')+':'+String(remainder).padStart(2,'0');
    }
    function queueSummary(queue, now) {
        var waits = list(get(queue,'callers',[])).map(function (caller) {
            var wait = number(get(caller,'Wait',null));
            if (wait != null) return Math.max(0,wait);
            var since = number(get(caller,'QueueSince',get(caller,'Since',null)));
            return since == null ? null : Math.max(0,now-since);
        });
        var known = waits.filter(function (wait) { return wait != null; });
        return {answered:number(get(queue,'Completed',null)), abandoned:number(get(queue,'Abandoned',null)), waiting:waits.length,
            longest:known.length?Math.max.apply(null,known):waits.length===0?0:null, partial:known.length!==waits.length,
            averageHold:number(get(queue,'Holdtime',null)), strategy:get(queue,'Strategy',null)};
    }
    function callbackPayload(source,target) {
        if (!/^[0-9*#]{1,40}$/.test(String(source)) || !/^[0-9*#]{1,40}$/.test(String(target)) || String(source)===String(target)) throw new Error('Choose different, valid source and destination extensions.');
        return {action:'callExtension',source:String(source),target:String(target)};
    }
    function observedIdentity(leg){
        if(!leg || typeof leg.channel!=='string' || typeof leg.uniqueid!=='string' || !leg.channel || !leg.uniqueid || leg.channel.length>256 || leg.uniqueid.length>128 || /[\r\n\0]/.test(leg.channel+leg.uniqueid))throw new Error('This call no longer has a usable channel identity. Refresh its live status.');
        return {channel:leg.channel,uniqueid:leg.uniqueid};
    }
    function transferPayload(leg,target,consult){
        if(consult?!leg.canConsult:!leg.canTransfer)throw new Error('Transfer is not available for this call.');
        if(!/^[0-9*#]{1,40}$/.test(String(target)) || String(target)===String(leg.extension || ''))throw new Error('Choose a different configured destination extension.');
        var identity=observedIdentity(leg);return {action:consult?'consultTransferChannel':'transferChannel',channel:identity.channel,uniqueid:identity.uniqueid,target:String(target)};
    }
    function parkPayload(leg,lot,parkingLots){
        if(!leg.canPark)throw new Error('Parking is not available for this call.');
        if(!Array.isArray(parkingLots) || !parkingLots.some(function(item){return String(item.id)===String(lot);}))throw new Error('Choose a parking lot reported by this PBX.');
        var identity=observedIdentity(leg);return {action:'parkChannel',channel:identity.channel,uniqueid:identity.uniqueid,lot:String(lot)};
    }
    function pickupPayload(leg,source){
        if(!leg.canPickup)throw new Error('Pickup is not available for this ringing call.');
        if(!/^[0-9*#]{1,40}$/.test(String(source)) || String(source)===String(leg.extension || ''))throw new Error('Choose a different registered operator extension to pick up this call.');
        var identity=observedIdentity(leg);return {action:'pickupChannel',channel:identity.channel,uniqueid:identity.uniqueid,source:String(source)};
    }
    function destinationOptions(phones,query,exclude,favorites){
        var normalize=global.MyTelUI?global.MyTelUI.normalize:function(value){return String(value).toLowerCase().trim();};var search=normalize(query || '');favorites=favorites || [];
        return phones.filter(function(phone){return String(get(phone,'extension',''))!==String(exclude || '') && normalize(get(phone,'extension','')+' '+get(phone,'description','')).indexOf(search)!==-1;}).map(function(phone){return {extension:String(get(phone,'extension','')),name:String(get(phone,'description','')),registered:[true,1,'1'].indexOf(get(phone,'registered',false))!==-1,favorite:favorites.indexOf(String(get(phone,'extension','')))!==-1};}).sort(function(a,b){return Number(b.favorite)-Number(a.favorite) || a.extension.localeCompare(b.extension,undefined,{numeric:true});});
    }
    function queueMemberships(queues,phone) {
        var extension=String(get(phone,'extension',''));
        var channel=String(get(phone,'channel',''));
        var output=[];
        queues.forEach(function(queue){
            list(get(queue,'memberRefresh',[])).forEach(function(member){
                var endpoint=String(get(member,'Interface',''));
                var stateEndpoint=String(get(member,'StateInterface',''));
                var local=/^Local\/([^@/]+)@[^/]+(?:\/n)?$/.exec(endpoint);
                if(endpoint!==channel && stateEndpoint!==channel && !(local && local[1]===extension))return;
                output.push({queue:String(get(queue,'extension','')),description:get(queue,'description',null),status:get(member,'Status',null),
                    paused:[true,1,'1'].indexOf(get(member,'Paused',false))!==-1,pausedReason:get(member,'PausedReason',null),callsTaken:get(member,'CallsTaken',null),
                    penalty:get(member,'Penalty',null),inCall:get(member,'InCall',null),lastCall:number(get(member,'LastCall',null))});
            });
        });
        return output;
    }
    var api = {get:get,list:list,present:present,normalizeLeg:normalizeLeg,collectCalls:collectCalls,filterCalls:filterCalls,duration:duration,queueSummary:queueSummary,callbackPayload:callbackPayload,queueMemberships:queueMemberships,normalizeDirection:normalizeDirection,directionLabel:directionLabel,directionTotals:directionTotals,observedIdentity:observedIdentity,transferPayload:transferPayload,parkPayload:parkPayload,pickupPayload:pickupPayload,destinationOptions:destinationOptions};
    if (typeof module!=='undefined' && module.exports) module.exports=api;
    else global.MyTelCallModel=api;
}(typeof window!=='undefined'?window:globalThis));
