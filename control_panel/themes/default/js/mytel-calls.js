/* Live-call workspace and explicit operator actions. No automatic call mutations. */
(function (global) {
    'use strict';
    var model = global.MyTelCallModel;
    if (!model) return;
    var document = global.document;
    var snapshot = null;
    var calls = [];
    var phones = [];
    var callQuery = '';
    var callFilter = 'all';
    var directionFilter = 'all';
    var tableSignature = '';
    var inspectorSignature = '';
    var selection = null;
    var sourceExtension = '';
    var previousFocus = null;
    var timer = null;
    var requestInFlight = null;
    var actionResults = Object.create(null);
    var callDrafts=Object.create(null);
    var stateLabels = {'in-call':'In call',ringing:'Ringing',waiting:'Waiting',hold:'On hold',dialing:'Dialing',busy:'Busy',down:'Down','off-hook':'Off hook','pre-ring':'Pre-ring',reported:'Reported state',unknown:'Not reported'};
    function callStateLabel(call){return call.state==='reported' && call.reportedState?call.reportedState:stateLabels[call.state];}

    function node(tag, className, value) {
        var element = document.createElement(tag);
        if (className) element.className = className;
        if (value != null) element.textContent = String(value);
        return element;
    }
    function root() { return document.getElementById('controlPanelApplication'); }
    function controller() { return global.debug_root || null; }
    function selectionKey() { return selection?selection.type+':'+selection.id:''; }
    function actionState() {
        var key=selectionKey();
        if(requestInFlight && requestInFlight.key!==key)return {pending:true,message:'Another operator action is pending. Please wait.',kind:'pending'};
        return actionResults[key] || {pending:false,message:'',kind:''};
    }
    function saveAction(key,state) { actionResults[key]=state;var container=root();if(container)renderInspector(container,true); }
    function stableSignature(value) { return JSON.stringify(value,function(key,item){return key==='answeredSeconds'?undefined:item;}); }
    function currentTime() {
        if(!fresh() && model.get(controller(),'lastUpdatedAt',0)){
            var latest=snapshot || model.get(controller(),'latestSnapshot',null);
            return Number(model.get(latest,'generated_at',model.get(latest,'timestamp',model.get(controller(),'lastUpdatedAt',Date.now())/1000)));
        }
        return model.get(global.App && global.App.ticks,'tick500',Date.now())/1000;
    }
    function loaded() { return !!model.get(model.get(controller(),'extensions',null),'finishedloading',false); }
    function fresh() {
        var current = controller();
        return !!current && model.get(current,'connected',false) && Date.now()-model.get(current,'lastUpdatedAt',0)<10000;
    }
    function access(action){return !!(global.var_init && global.var_init.OPERATOR_ACCESS && global.var_init.OPERATOR_ACCESS[action]===true);}
    function sourceKey() { return 'mytel.operator.source.'+(global.module_name || 'control_panel')+'.'+(global.MyTelUI?global.MyTelUI.preferenceScope():'session'); }
    function preferenceStore(){try{return global.MyTelUI?global.MyTelUI.preferenceStore():global.sessionStorage;}catch(ignore){return null;}}
    function latestSnapshot(){return snapshot || model.get(controller(),'latestSnapshot',null);}
    function parkingLots(){var lots=model.get(latestSnapshot(),'parking_lots',[]);return Array.isArray(lots)?lots:[];}
    function legKey(leg){return String(leg.channel || '')+'|'+String(leg.uniqueid || '');}
    function findLeg(channel,uniqueid){var found=null;calls.forEach(function(call){call.legs.forEach(function(leg){if(leg.channel===channel && String(leg.uniqueid || '')===String(uniqueid || ''))found=leg;});});return found;}
    function registered(phone) { var value=model.get(phone,'registered',false); return value===true || value===1 || value==='1'; }
    function findPhone(extension) { return phones.filter(function (phone) { return String(model.get(phone,'extension',''))===String(extension); })[0] || null; }
    function appendPair(list, label, value, className) {
        list.appendChild(node('dt','',label));
        list.appendChild(node('dd',className || '',model.present(value)?value:'Not reported'));
    }
    function setText(element, value) { if (element && element.textContent!==String(value)) element.textContent=String(value); }
    function button(label, action, attributes) {
        var element=node('button','mytel-secondary-button',label);
        element.type='button'; element.setAttribute('data-action',action);
        Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key,attributes[key]); });
        return element;
    }
    function clock(started, className) {
        var element=node('time',className || 'mytel-call-clock',started==null?'Not reported':model.duration(currentTime()-started));
        if (started!=null) element.setAttribute('data-call-start',String(started));
        return element;
    }
    function tickClocks(container) {
        Array.prototype.forEach.call(container.querySelectorAll('[data-call-start]'),function (element) {
            setText(element,model.duration(currentTime()-Number(element.getAttribute('data-call-start'))));
        });
        var legs=[];calls.forEach(function(call){legs=legs.concat(call.legs);});
        Array.prototype.forEach.call(container.querySelectorAll('[data-answered-channel]'),function(element){var leg=legs.filter(function(candidate){return candidate.channel===element.getAttribute('data-answered-channel') && String(candidate.uniqueid || '')===element.getAttribute('data-answered-uniqueid');})[0];if(leg)setText(element,model.duration(leg.answeredSeconds));});
    }
    function collectPhones() {
        var output=[];
        ['extensions','area1','area2','area3','area4','area5','area6','area7','area8','area9'].forEach(function (key) {
            output=output.concat(model.list(model.get(controller(),key,null)));
        });
        return output;
    }
    function updateSource(container) {
        var selects=container.querySelectorAll('[data-operator-source]');
        var options=phones.map(function (phone) { return {number:String(model.get(phone,'extension','')),name:model.get(phone,'description',''),registered:registered(phone)}; });
        options=options.filter(function (option,index) { return options.findIndex(function (candidate) { return candidate.number===option.number; })===index; });
        options.sort(function (a,b) { return a.number.localeCompare(b.number,undefined,{numeric:true}); });
        var signature=JSON.stringify(options);
        Array.prototype.forEach.call(selects,function(select){if (select.getAttribute('data-options-signature')!==signature) {
            select.replaceChildren();
            var placeholder=node('option','',options.length?'Choose extension':'No extensions available'); placeholder.value=''; select.appendChild(placeholder);
            options.forEach(function (option) { var item=node('option','',option.number+' — '+option.name+(option.registered?'':' (offline)')); item.value=option.number; item.disabled=!option.registered; select.appendChild(item); });
            select.setAttribute('data-options-signature',signature);
        }
        if (sourceExtension && !findPhone(sourceExtension)) sourceExtension='';
        select.value=sourceExtension;
        select.disabled=!loaded() || options.length===0 || !!requestInFlight;});
    }
    function sourcePicker(){var box=node('label','mytel-inline-source','My extension');var select=node('select');select.id='mytel-inspector-source';select.setAttribute('data-operator-source','');box.appendChild(select);return box;}
    function draftFor(leg){var key=legKey(leg);if(!callDrafts[key])callDrafts[key]={query:'',target:'',lot:''};return callDrafts[key];}
    function updateControlForm(form,leg){
        var draft=draftFor(leg);var picker=form.querySelector('[data-role=transfer-target]');
        if(picker){var options=model.destinationOptions(phones,draft.query,leg.extension,global.MyTelUI&&global.MyTelUI.favoriteNumbers?global.MyTelUI.favoriteNumbers():[]);var signature=JSON.stringify(options.slice(0,80));if(picker.getAttribute('data-options')!==signature){picker.replaceChildren();var placeholder=node('option','','Choose destination');placeholder.value='';picker.appendChild(placeholder);options.slice(0,80).forEach(function(item){var option=node('option','',(item.favorite?'★ ':'')+item.extension+' — '+item.name+(item.registered?'':' (offline)'));option.value=item.extension;picker.appendChild(option);});picker.setAttribute('data-options',signature);}picker.value=draft.target;setText(form.querySelector('[data-destination-count]'),options.length>80?'Showing 80 of '+options.length+' matches. Refine your search.':options.length+' destination'+(options.length===1?'':'s'));}
        var canSend=fresh() && !requestInFlight;
        Array.prototype.forEach.call(form.querySelectorAll('[data-action=transfer-call],[data-action=consult-call]'),function(button){button.disabled=!canSend || !draft.target || !findPhone(draft.target) || String(draft.target)===String(leg.extension || '');});
        var park=form.querySelector('[data-action=park-call]');if(park)park.disabled=!canSend || !draft.lot || !parkingLots().some(function(lot){return String(lot.id)===String(draft.lot);});
    }
    function contextualControls(leg,card){
        var hasTransfer=access('transfer') && (leg.canTransfer || leg.canConsult);var lots=parkingLots();var hasPark=access('park') && leg.canPark && lots.length;
        if(access('pickup') && leg.canPickup){var pickup=button('Pick up ringing call','pickup-call',{'data-channel':leg.channel,'data-uniqueid':leg.uniqueid});pickup.classList.add('mytel-primary-button');var source=findPhone(sourceExtension);pickup.disabled=!fresh() || !!requestInFlight || !source || !registered(source) || sourceExtension===String(leg.extension || '');card.appendChild(pickup);card.appendChild(node('p','mytel-action-note',sourceExtension?'Rings your extension '+sourceExtension+' first. Answer it to pick up this exact ringing call.':'Choose your registered extension above to pick up this ringing call.'));}
        if(!hasTransfer && !hasPark)return;
        var form=node('div','mytel-context-controls');form.setAttribute('data-control-channel',leg.channel || '');form.setAttribute('data-control-uniqueid',leg.uniqueid || '');var draft=draftFor(leg);
        if(hasTransfer){var details=node('details','mytel-call-control');details.setAttribute('data-control-kind','transfer');details.appendChild(node('summary','','Transfer connected caller'));details.appendChild(node('p','mytel-action-note','Transfers the other party connected to extension '+leg.extension+'. This extension leaves the original call.'));var searchLabel=node('label','mytel-control-label','Destination');var search=node('input');search.type='search';search.placeholder='Find extension or name…';search.autocomplete='off';search.value=draft.query;search.setAttribute('data-role','transfer-search');searchLabel.appendChild(search);details.appendChild(searchLabel);var target=node('select','mytel-destination-select');target.size=4;target.setAttribute('aria-label','Destination extension');target.setAttribute('data-role','transfer-target');details.appendChild(target);details.appendChild(node('p','mytel-action-note',''));details.lastChild.setAttribute('data-destination-count','');var buttons=node('div','mytel-control-buttons');if(leg.canConsult){var consult=button('Consult first','consult-call');consult.classList.add('mytel-primary-button');buttons.appendChild(consult);}if(leg.canTransfer)buttons.appendChild(button('Transfer now','transfer-call'));details.appendChild(buttons);if(leg.canConsult)details.appendChild(node('p','mytel-action-note','Consult rings the destination. Complete or cancel using your phone’s configured transfer controls.'));form.appendChild(details);}
        if(hasPark){var parkDetails=node('details','mytel-call-control');parkDetails.setAttribute('data-control-kind','park');parkDetails.appendChild(node('summary','','Park this party'));parkDetails.appendChild(node('p','mytel-action-note','Parks this exact party'+(leg.parkReturnExtension?'; the PBX announces the slot to extension '+leg.parkReturnExtension+'.':'.')));var label=node('label','mytel-control-label','Parking lot');var select=node('select');select.setAttribute('data-role','parking-lot');var placeholder=node('option','','Choose parking lot');placeholder.value='';select.appendChild(placeholder);lots.forEach(function(lot){var option=node('option','',String(lot.name || lot.id)+(lot.start!=null && lot.end!=null?' · slots '+lot.start+'–'+lot.end:''));option.value=String(lot.id);select.appendChild(option);});if(lots.length===1 && !draft.lot)draft.lot=String(lots[0].id);select.value=draft.lot;label.appendChild(select);parkDetails.appendChild(label);parkDetails.appendChild(button('Park selected party','park-call'));form.appendChild(parkDetails);}
        card.appendChild(form);updateControlForm(form,leg);
    }
    function renderCallRows(container) {
        var filtered=model.filterCalls(calls,callQuery,callFilter,directionFilter);
        var totals=model.directionTotals(calls);
        Object.keys(totals).forEach(function(direction){setText(container.querySelector('[data-direction-count="'+direction+'"]'),loaded()?totals[direction]:'—');});
        var signature=stableSignature(filtered);
        var body=container.querySelector('[data-live-call-rows]');
        if (!body) return;
        if (signature!==tableSignature) {
            body.replaceChildren();
            filtered.forEach(function (call) {
                var row=node('tr');
                var extensionCell=node('td');
                extensionCell.appendChild(node('strong','',call.extensions.length?call.extensions.join(', '):'Unassigned channel'));
                extensionCell.appendChild(node('span','mytel-cell-secondary',(call.extensionNames.length?call.extensionNames.join(', ')+' · ':'')+call.legs.length+' channel'+(call.legs.length===1?'':'s')));
                row.appendChild(extensionCell);
                row.appendChild(node('td','mytel-number',call.caller || 'Not reported'));
                row.appendChild(node('td','mytel-number',call.connected || 'Not reported'));
                var stateCell=node('td'); stateCell.appendChild(node('span','mytel-call-state '+call.state,callStateLabel(call))); row.appendChild(stateCell);
                var directionCell=node('td');directionCell.appendChild(node('span','mytel-call-direction '+(call.direction || 'unknown'),model.directionLabel(call.direction)));row.appendChild(directionCell);
                var elapsed=node('td'); elapsed.appendChild(clock(call.started)); row.appendChild(elapsed);
                row.appendChild(node('td','mytel-number',call.queueIds.length?call.queueIds.join(', '):'Not reported'));
                var details=node('td'); details.appendChild(button('Details','inspect-call',{'data-call-id':call.id,'aria-label':'View call details for '+(call.extensions.join(', ') || call.caller || 'unassigned channel')})); row.appendChild(details);
                body.appendChild(row);
            });
            tableSignature=signature;
        }
        var empty=container.querySelector('[data-live-empty]');
        if (empty) {
            empty.hidden=filtered.length>0;
            setText(empty,!loaded()?'Waiting for live-call data…':calls.length===0?'No active calls. New calls will appear automatically.':'No calls match this search, status and direction filter.');
        }
        setText(container.querySelector('[data-live-count]'),loaded()?calls.length:'—');
        setText(container.querySelector('[data-live-results]'),loaded()?filtered.length+' of '+calls.length+' calls':'');
    }
    function queueMetrics(container) {
        var queues=model.list(model.get(controller(),'queues',null));
        queues.forEach(function (queue) {
            var id='QUEUE/'+model.get(queue,'extension','');
            var panels=container.querySelectorAll('[data-idattr]');
            var panel=Array.prototype.filter.call(panels,function (candidate) { return candidate.getAttribute('data-idattr')===id; })[0];
            var target=panel && panel.querySelector('[data-queue-metrics]');
            if (!target) return;
            var summary=model.queueSummary(queue,currentTime());
            var metrics=[['Answered',summary.answered],['Abandoned',summary.abandoned],['Waiting',summary.waiting],['Longest wait',summary.longest==null?'Not reported':model.duration(summary.longest)+(summary.partial?' *':'')]];
            var signature=JSON.stringify(metrics);
            if (target.getAttribute('data-summary')===signature) return;
            target.replaceChildren();
            metrics.forEach(function (metric) { var item=node('div'); item.appendChild(node('strong','',metric[1]==null?'Not reported':metric[1])); item.appendChild(node('span','',metric[0])); target.appendChild(item); });
            if(summary.partial) target.appendChild(node('p','mytel-summary-note','* Wait time is unavailable for some callers.'));
            target.setAttribute('data-summary',signature);
        });
    }
    function parkingGuidance(container){
        var slots=model.list(model.get(controller(),'parkinglots',[]));var bySlot=Object.create(null);slots.forEach(function(slot){bySlot[String(model.get(slot,'extension',''))]=slot;});
        Array.prototype.forEach.call(container.querySelectorAll('[data-parking-slot]'),function(element){var number=element.getAttribute('data-parking-slot');var slot=bySlot[number];var channel=model.get(slot,'Channel',null),uniqueid=model.get(slot,'Uniqueid',null);var known=model.get(latestSnapshot(),'parking_status_known',false)===true;var occupied=!!(channel && uniqueid && /^[0-9*#]{1,40}$/.test(number));var message=occupied?(fresh()&&known?'Dial '+number+' on your phone to retrieve this occupied slot.':'Last observed occupied. Reconnect before using the parking state.'):'';setText(element.querySelector('[data-parking-guidance]'),message);var status=element.querySelector('[data-parking-state]');if(status){var remaining=model.get(slot,'Remaining',null);setText(status,occupied?'Occupied'+(model.get(slot,'CallerIDNum',null)?' · '+model.get(slot,'CallerIDNum',''):'')+(remaining!=null?' · '+model.duration(remaining)+' remaining':''):known?'Available':'State not reported');element.setAttribute('data-occupied',occupied?'true':'false');}});
    }
    function callDetails(leg, container) {
        var card=node('section','mytel-inspector-call');card.setAttribute('data-channel-key',String(leg.channel || leg.uniqueid || 'unknown'));
        var heading=node('div','mytel-inspector-call-heading');
        heading.appendChild(node('h3','',leg.extension?'Extension '+leg.extension:'External party'));
        heading.appendChild(node('span','mytel-call-state',leg.state || 'Not reported'));
        card.appendChild(heading);
        var facts=node('dl','mytel-detail-grid');
        appendPair(facts,'Caller',leg.caller); appendPair(facts,'Caller name',leg.callerName);
        appendPair(facts,'Connected party',leg.connected); appendPair(facts,'Connected name',leg.connectedName);
        facts.appendChild(node('dt','','Channel elapsed')); var durationCell=node('dd');durationCell.appendChild(clock(leg.started)); facts.appendChild(durationCell);
        facts.appendChild(node('dt','','Answered time (PBX)')); var answered=node('dd');var answeredClock=leg.answered!=null?clock(leg.answered):node('time','',model.duration(leg.answeredSeconds));if(leg.answered==null){answeredClock.setAttribute('data-answered-channel',leg.channel || '');answeredClock.setAttribute('data-answered-uniqueid',leg.uniqueid || '');}answered.appendChild(answeredClock); facts.appendChild(answered);
        appendPair(facts,'On hold',leg.hold==null?null:leg.hold?'Yes':'No'); appendPair(facts,'Direction',model.directionLabel(leg.direction),'mytel-call-direction-value '+(leg.direction || 'unknown'));
        card.appendChild(facts);
        contextualControls(leg,card);
        var technical=node('details','mytel-channel-details');technical.appendChild(node('summary','','Channel details'));
        var metadata=node('dl','mytel-detail-grid');
        [['Channel',leg.channel],['Unique ID',leg.uniqueid],['Linked ID',leg.linkedid],['Bridge',leg.bridge],['Dialed number',leg.dnid],['Dialplan context',leg.context],['Dialplan destination',leg.destination],['Application',leg.application],['Application data',leg.appData],['Read codec',leg.readFormat],['Write codec',leg.writeFormat]].forEach(function (pair) { appendPair(metadata,pair[0],pair[1]); });
        technical.appendChild(metadata); card.appendChild(technical);
        var end=button('End this call','end-call',{'data-channel':leg.channel || '', 'data-uniqueid':leg.uniqueid || ''});
        end.classList.add('mytel-danger-button');
        end.disabled=!fresh() || !leg.channel || !leg.uniqueid || !!requestInFlight;
        if (!leg.channel || !leg.uniqueid) end.title='Unavailable: the PBX did not report a stable channel identifier.';
        if(access('hangup')){card.appendChild(end);card.appendChild(node('p','mytel-action-note','Ends only the observed channel identified in these details.'));}
        var fullCall=calls.filter(function(call){return call.legs.some(function(candidate){return candidate.channel===leg.channel && candidate.uniqueid===leg.uniqueid;});})[0];if(selection && selection.type==='extension' && fullCall && fullCall.legs.length>1)card.appendChild(button('Manage complete call','inspect-call',{'data-call-id':fullCall.id}));
        container.appendChild(card);
    }
    function renderInspector(container, force) {
        var dialog=container.querySelector('#mytel-extension-inspector');
        if (!dialog || !selection) return;
        var target=dialog.querySelector('[data-inspector-content]');
        var phone=selection.type==='extension'?findPhone(selection.id):null;
        var call=selection.type==='call'?calls.filter(function (item) { return item.id===selection.id; })[0]:null;
        var legs=phone?model.list(model.get(phone,'active',[])).map(function (input) { return model.normalizeLeg(input,model.get(phone,'extension',null)); }):call?call.legs:[];
        var memberships=phone?model.queueMemberships(model.list(model.get(controller(),'queues',null)),phone):[];
        var visibleAction=actionState();
        var signature=stableSignature({selection:selection,description:model.get(phone,'description',null),registered:phone&&registered(phone),ip:model.get(phone,'ip',null),tech:model.get(phone,'tech',null),deviceState:model.get(phone,'device_state',null),registrationBasis:model.get(phone,'registration_basis',null),legs:legs,lots:parkingLots(),access:global.var_init&&global.var_init.OPERATOR_ACCESS,memberships:memberships,call:call,source:sourceExtension,fresh:fresh(),action:visibleAction});
        if (!force && signature===inspectorSignature) return;
        inspectorSignature=signature;
        var openDetails=Array.prototype.map.call(target.querySelectorAll('.mytel-inspector-call details[open]'),function(details){return {channel:details.closest('.mytel-inspector-call').getAttribute('data-channel-key'),kind:details.getAttribute('data-control-kind') || 'technical'};});
        var focused=document.activeElement;var focusedChannel=focused && focused.closest('.mytel-inspector-call');
        var focusState=target.contains(focused)?{id:focused.id,role:focused.getAttribute('data-role'),action:focused.getAttribute('data-action'),kind:focused.closest('[data-control-kind]')&&focused.closest('[data-control-kind]').getAttribute('data-control-kind'),channel:focusedChannel && focusedChannel.getAttribute('data-channel-key'),summary:focused.tagName==='SUMMARY'}:null;
        target.replaceChildren();
        setText(dialog.querySelector('#mytel-inspector-title'),phone?'Extension '+model.get(phone,'extension',''):selection.type==='call'?'Live call details':'Extension details');
        var freshness=node('p','mytel-inspector-freshness',fresh()?'Live PBX data':'Last known data · reconnect before taking an action'); target.appendChild(freshness);
        if (!phone && !call) { target.appendChild(node('p','mytel-empty','This item is no longer present in the latest PBX data.')); return; }
        if(access('call') || access('pickup'))target.appendChild(sourcePicker());
        if (phone) {
            target.appendChild(node('h3','mytel-inspector-name',model.get(phone,'description','')));
            var facts=node('dl','mytel-detail-grid');
            appendPair(facts,'Registration',registered(phone)?'Registered':'Unregistered','mytel-registration-value '+(registered(phone)?'online':'offline')); appendPair(facts,'IP address',model.get(phone,'ip',null));
            appendPair(facts,'Device state',model.get(phone,'device_state',null));appendPair(facts,'Registration basis',model.get(phone,'registration_basis',null));
            appendPair(facts,'Technology',model.get(phone,'tech',null)); appendPair(facts,'Device channel',model.get(phone,'channel',null));
            appendPair(facts,'Active channels',legs.length); appendPair(facts,'New voicemail',model.get(phone,'NewMessages',null)); target.appendChild(facts);
            var callback=node('div','mytel-callback-controls');
            var source=findPhone(sourceExtension);
            var callButton=button('Call extension '+model.get(phone,'extension',''),'callback',{'data-target-extension':model.get(phone,'extension','')});
            callButton.classList.add('mytel-primary-button');
            callButton.disabled=!fresh() || !source || !registered(source) || !registered(phone) || sourceExtension===String(model.get(phone,'extension','')) || !!requestInFlight;
            if(access('call'))callback.appendChild(callButton);
            callback.appendChild(node('p','mytel-action-note',!access('call')?'Calling is not permitted for this account.':sourceExtension?'Rings your extension '+sourceExtension+' first, then connects to this extension.':'Choose your registered extension above to place a callback call.'));
            target.appendChild(callback);
            target.appendChild(node('h3','mytel-inspector-subtitle','Queue memberships ('+memberships.length+')'));
            if(!memberships.length)target.appendChild(node('p','mytel-action-note','No queue membership was reported for this extension.'));
            var memberLabels={'0':'Unknown','1':'Available','2':'In use','3':'Busy','4':'Invalid','5':'Unavailable','6':'Ringing','7':'Ringing / in use','8':'On hold'};
            memberships.forEach(function(member){var item=node('section','mytel-membership');item.appendChild(node('h4','','Queue '+member.queue+(member.description?' · '+member.description:'')));var facts=node('dl','mytel-detail-grid');appendPair(facts,'Agent status',memberLabels[String(member.status)] || member.status);appendPair(facts,'Paused',member.paused?'Yes'+(member.pausedReason?' · '+member.pausedReason:''):'No');appendPair(facts,'Calls taken',member.callsTaken);appendPair(facts,'Penalty',member.penalty);appendPair(facts,'In call',member.inCall==null?null:[true,1,'1'].indexOf(member.inCall)!==-1?'Yes':'No');appendPair(facts,'Last call',member.lastCall && member.lastCall>0?new Date(member.lastCall*1000).toLocaleString('en-GB'):null);item.appendChild(facts);item.appendChild(node('p','mytel-action-note','Counters since last PBX statistics reset.'));target.appendChild(item);});
        } else {
            var summary=node('dl','mytel-detail-grid');appendPair(summary,'Extensions',call.extensions.join(', '));appendPair(summary,'Status',callStateLabel(call));appendPair(summary,'Queue',call.queueIds.join(', '));appendPair(summary,'Direction',model.directionLabel(call.direction),'mytel-call-direction-value '+(call.direction || 'unknown'));target.appendChild(summary);
        }
        var feedback=node('p','mytel-action-feedback '+visibleAction.kind,visibleAction.pending?(visibleAction.message || 'Sending request…'):visibleAction.message);feedback.setAttribute('role','status');target.appendChild(feedback);
        target.appendChild(node('h3','mytel-inspector-subtitle','Active calls / channels ('+legs.length+')'));
        if (!legs.length) target.appendChild(node('p','mytel-empty','No active calls on this extension.'));
        legs.forEach(function (leg) { callDetails(leg,target); });
        updateSource(container);
        Array.prototype.forEach.call(target.querySelectorAll('.mytel-inspector-call'),function(card){var key=card.getAttribute('data-channel-key');openDetails.forEach(function(detail){if(detail.channel===key){var restored=detail.kind==='technical'?card.querySelector('.mytel-channel-details'):card.querySelector('[data-control-kind="'+detail.kind+'"]');if(restored)restored.open=true;}});if(focusState && key===focusState.channel){var area=focusState.kind?card.querySelector('[data-control-kind="'+focusState.kind+'"]'):card;var candidate=focusState.summary?area&&area.querySelector('summary'):focusState.role?card.querySelector('[data-role="'+focusState.role+'"]'):card.querySelector('[data-action="'+focusState.action+'"]');if(candidate && !candidate.disabled)candidate.focus();}});
        if(focusState && !focusState.channel && focusState.action){var restored=target.querySelector('[data-action="'+focusState.action+'"]');if(restored && !restored.disabled)restored.focus();}
        if(focusState && focusState.id){var restoredById=document.getElementById(focusState.id);if(restoredById && target.contains(restoredById) && !restoredById.disabled)restoredById.focus();}
    }
    function openInspector(type,id) {
        var container=root();var dialog=container && container.querySelector('#mytel-extension-inspector');if(!dialog)return;
        if(!dialog.open)previousFocus=document.activeElement;selection={type:type,id:String(id)};inspectorSignature='';
        renderInspector(container,true);
        if (!dialog.open) { if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open',''); }else dialog.querySelector('[data-action=close-inspector]').focus();
    }
    function sendAction(payload) {
        if (requestInFlight) return;
        var key=selectionKey();
        var privilege={callExtension:'call',pickupChannel:'pickup',transferChannel:'transfer',consultTransferChannel:'transfer',parkChannel:'park',hangupChannel:'hangup'}[payload.action];
        if(!privilege || !access(privilege)){saveAction(key,{pending:false,message:'This action is not permitted for your account.',kind:'error'});return;}
        if (!fresh()) { saveAction(key,{pending:false,message:'Reconnect to the PBX before taking an action.',kind:'error'});return; }
        if (!global.jQuery || !global.var_init || !global.var_init.CSRF_TOKEN) { saveAction(key,{pending:false,message:'This session cannot send actions. Reload and sign in again.',kind:'error'});return; }
        var request={key:key};requestInFlight=request;saveAction(key,{pending:true,message:'',kind:'pending'});
        payload.menu=global.module_name || 'control_panel';payload.rawmode='yes';
        global.jQuery.ajax({url:'index.php',type:'POST',data:payload,dataType:'json',timeout:10000,headers:{'X-MyTel-CSRF':global.var_init.CSRF_TOKEN}}).done(function (response) {
            response=response || {};
            if(requestInFlight===request)requestInFlight=null;
            var result={pending:false,message:response.status==='success'?(response.message || 'Request accepted by the PBX.'):(response.message || 'The PBX could not complete this action.'),kind:response.status==='success'?'success':'error'};
            if(response.status==='success' && payload.action==='callExtension')result.message='Call requested. Answer your extension first; the PBX will then call the destination.';
            if(response.status==='success' && payload.action==='pickupChannel')result.message='Pickup requested. Answer your extension to connect to this exact ringing call.';
            if(response.status==='success' && payload.action==='consultTransferChannel')result.message='Consult transfer requested. Complete or cancel using your phone’s configured transfer controls.';
            if(response.status==='success' && payload.action==='transferChannel')result.message='Transfer requested. Watch the live call status for the result.';
            if(response.status==='success' && payload.action==='parkChannel')result.message='Parking requested. Wait for the PBX slot announcement and the next live parking update.';
            saveAction(key,result);
        }).fail(function (request) {
            requestInFlight=null;
            saveAction(key,{pending:false,message:request.status===401 || request.status===403?'Your session is not authorized. Sign in again.':'The action could not be confirmed. Check the live status before retrying.',kind:'error'});
        });
    }
    function update() {
        var container=root();if(!container || !container.querySelector('.mytel-live-calls'))return;
        phones=collectPhones();
        var latest=snapshot || model.get(controller(),'latestSnapshot',null);
        calls=model.collectCalls(phones,latest && Array.isArray(latest.live_calls)?latest.live_calls:null);
        calls.forEach(function(call){call.extensionNames=call.extensions.map(function(extension){return model.get(findPhone(extension),'description','');}).filter(model.present);});
        updateSource(container);renderCallRows(container);queueMetrics(container);parkingGuidance(container);
        Array.prototype.forEach.call(container.querySelectorAll('[data-freshness]'),function (element) { setText(element,!loaded()?'Waiting for data':fresh()?'Live':'Last known data');element.setAttribute('data-fresh',fresh()?'true':'false'); });
        renderInspector(container,false);tickClocks(container);
    }
    function initialize() {
        var container=root();if(!container)return;
        container.classList.add('mytel-calls-ready');
        try { var storage=preferenceStore();sourceExtension=storage&&storage.getItem(sourceKey()) || ''; } catch(ignore) { /* Storage is optional. */ }
        container.addEventListener('input',function (event) { if(event.target.id==='mytel-call-search'){callQuery=event.target.value;update();}var form=event.target.closest('[data-control-channel]');if(form && event.target.getAttribute('data-role')==='transfer-search'){var leg=findLeg(form.getAttribute('data-control-channel'),form.getAttribute('data-control-uniqueid'));if(leg){var draft=draftFor(leg);draft.query=event.target.value;draft.target='';updateControlForm(form,leg);}} });
        container.addEventListener('change',function (event) {
            if(event.target.id==='mytel-call-state'){callFilter=event.target.value;update();}
            if(event.target.hasAttribute('data-operator-source')){sourceExtension=event.target.value;try{var storage=preferenceStore();if(storage)storage.setItem(sourceKey(),sourceExtension);}catch(ignore){}updateSource(container);renderInspector(container,true);}
            var form=event.target.closest('[data-control-channel]');if(form){var leg=findLeg(form.getAttribute('data-control-channel'),form.getAttribute('data-control-uniqueid'));if(leg){var draft=draftFor(leg);if(event.target.getAttribute('data-role')==='transfer-target')draft.target=event.target.value;if(event.target.getAttribute('data-role')==='parking-lot')draft.lot=event.target.value;updateControlForm(form,leg);}}
        });
        container.addEventListener('click',function (event) {
            var direction=event.target.closest('[data-call-direction]');
            if(direction && container.contains(direction)){directionFilter=direction.getAttribute('data-call-direction');Array.prototype.forEach.call(container.querySelectorAll('[data-call-direction]'),function(item){item.setAttribute('aria-pressed',item===direction?'true':'false');});update();return;}
            var action=event.target.closest('[data-action]');
            if(action && container.contains(action)) {
                var name=action.getAttribute('data-action');
                if(name==='inspect-call')openInspector('call',action.getAttribute('data-call-id'));
                else if(name==='close-inspector')container.querySelector('#mytel-extension-inspector').close();
                else if(name==='callback') { try{sendAction(model.callbackPayload(sourceExtension,action.getAttribute('data-target-extension')));}catch(error){saveAction(selectionKey(),{pending:false,message:error.message,kind:'error'});} }
                else if(name==='pickup-call'){try{var picked=findLeg(action.getAttribute('data-channel'),action.getAttribute('data-uniqueid'));if(!findPhone(sourceExtension) || !registered(findPhone(sourceExtension)))throw new Error('Choose a registered operator extension.');sendAction(model.pickupPayload(picked,sourceExtension));}catch(error){saveAction(selectionKey(),{pending:false,message:error.message,kind:'error'});}}
                else if(name==='transfer-call' || name==='consult-call' || name==='park-call'){
                    var form=action.closest('[data-control-channel]');try{var leg=form&&findLeg(form.getAttribute('data-control-channel'),form.getAttribute('data-control-uniqueid'));if(!leg)throw new Error('This call is no longer in the latest live data.');var draft=draftFor(leg);if(name==='park-call'){if(global.confirm('Park this exact party'+(leg.parkReturnExtension?' with slot announcement to extension '+leg.parkReturnExtension:'')+'?'))sendAction(model.parkPayload(leg,draft.lot,parkingLots()));}else{if(!findPhone(draft.target))throw new Error('Choose a destination from the configured directory.');if(name==='consult-call' || global.confirm('Transfer the other party connected to extension '+leg.extension+' to extension '+draft.target+'?'))sendAction(model.transferPayload(leg,draft.target,name==='consult-call'));}}catch(error){saveAction(selectionKey(),{pending:false,message:error.message,kind:'error'});}
                }
                else if(name==='end-call') {
                    var channel=action.getAttribute('data-channel');var uniqueid=action.getAttribute('data-uniqueid');
                    if(channel && uniqueid && global.confirm('End this observed call? This will disconnect the selected channel.'))sendAction({action:'hangupChannel',channel:channel,uniqueid:uniqueid});
                }
                return;
            }
            var card=event.target.closest('.ExtensionStyle');
            if(card && container.contains(card)){var id=card.getAttribute('data-idattr');var phone=phones.filter(function(item){return model.get(item,'channel','')===id;})[0];if(phone)openInspector('extension',model.get(phone,'extension',''));}
        });
        container.addEventListener('close',function(event){if(event.target.id==='mytel-extension-inspector' && !event.target.open){selection=null;inspectorSignature='';if(previousFocus && previousFocus.isConnected)previousFocus.focus();}},true);
        timer=global.setInterval(update,1000);update();
    }
    global.addEventListener('mytel:snapshot',function (event){snapshot=event.detail;global.setTimeout(update,0);});
    global.addEventListener('mytel:connection',function(){global.setTimeout(update,0);});
    global.addEventListener('pagehide',function(){if(timer)global.clearInterval(timer);});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
}(window));
