(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) api.mount(root);
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';
    function read(object, key) {
        return object && typeof object.get === 'function' ? object.get(key) : (object ? object[key] : null);
    }
    function sequence(value) {
        if (value && typeof value.toArray === 'function') return value.toArray();
        return Array.isArray(value) ? value : [];
    }
    function text(value) { return value == null ? '' : String(value); }
    function validIdentity(queue, member) {
        return /^[0-9]{1,40}$/.test(queue) && /^[A-Za-z][A-Za-z0-9_]{0,20}\/[A-Za-z0-9_.@;:+/%-]{1,220}$/.test(member);
    }
    function normalizeQueues(queues) {
        var rows = [], seen = Object.create(null);
        sequence(queues).forEach(function (queue) {
            var number = text(read(queue, 'extension'));
            var description = text(read(queue, 'description'));
            sequence(read(queue, 'memberRefresh')).forEach(function (member, index) {
                var identity = text(read(member, 'Interface') || read(member, 'Location'));
                var rawPaused = read(member, 'Paused');
                var paused = rawPaused === '0' || rawPaused === 0 ? '0' : (rawPaused === '1' || rawPaused === 1 ? '1' : null);
                var status = text(read(member, 'Status'));
                var state = 'Unknown', tone = 'unavailable';
                if (paused === '1') { state = 'Paused'; tone = 'paused'; }
                else if (paused === '0') {
                    var states = {'0':'Unknown','1':'Available','2':'In call','3':'Busy','4':'Invalid','5':'Unavailable','6':'Ringing','7':'Ringing / in call','8':'On hold'};
                    state = states[status] || 'Unknown';
                    if (status === '1' && text(read(member, 'InCall')) === '1') state = 'In call';
                    tone = state === 'Available' ? 'available' : (['In call','Busy','Ringing','Ringing / in call','On hold'].indexOf(state) >= 0 ? 'active' : 'unavailable');
                }
                var key = JSON.stringify([number, identity || 'unknown-' + index]);
                if (seen[key]) return;
                seen[key] = true;
                rows.push({key:key, queue:number, queueName:description, interface:identity,
                    name:text(read(member, 'MemberName') || read(member, 'Name') || identity || 'Unknown member'),stateInterface:text(read(member,'StateInterface')),
                    paused:paused, state:state, tone:tone, status:status,
                    membership:typeof read(member, 'Membership') === 'string' ? read(member, 'Membership').toLowerCase() : null,
                    inCall:read(member, 'InCall') === '0' || read(member, 'InCall') === 0 ? false : (read(member, 'InCall') === '1' || read(member, 'InCall') === 1 ? true : null)});
            });
        });
        return rows;
    }
    function matchesSearch(row, value) {
        var query = text(value).trim().toLowerCase();
        return !query || [row.name,row.interface,row.queue,row.queueName,row.state].join(' ').toLowerCase().indexOf(query) >= 0;
    }
    function canControl(row, access, state, snapshotAt, now, pending) {
        return !!(access && access.queues === true && state === 'connected' && snapshotAt > 0 &&
            now >= snapshotAt && now - snapshotAt < 10000 && !pending && row.paused !== null && validIdentity(row.queue, row.interface));
    }
    function canJoin(queue, source, registered, access, state, snapshotAt, now, pending, represented) {
        return !!(access && access.membership === true && state === 'connected' && snapshotAt > 0 &&
            now >= snapshotAt && now - snapshotAt < 10000 && !pending && !represented && registered === true &&
            /^[0-9]{1,40}$/.test(queue) && /^[0-9]{1,40}$/.test(source));
    }
    function canLeave(row, access, state, snapshotAt, now, pending) {
        return !!(access && access.membership === true && state === 'connected' && snapshotAt > 0 &&
            now >= snapshotAt && now - snapshotAt < 10000 && !pending && validIdentity(row.queue,row.interface) &&
            row.membership === 'dynamic' && row.inCall === false && ['1','4','5'].indexOf(row.status) >= 0);
    }
    function mount(root) {
        var document = root.document;
        var initialConnection = 'connecting';
        function start(initialEvent) {
            var host = document.querySelector('[data-agent-workspace]');
            if (!host || host.getAttribute('data-queue-mounted') === 'true') return;
            host.setAttribute('data-queue-mounted', 'true');
            host.textContent = '';
            var rows = [], observedQueues = [], observedPhones = [], snapshotAt = 0, state = initialConnection, pending = Object.create(null), feedback = '', queueSignature = '', listSignature = '';
            function element(tag, className, content) {
                var node = document.createElement(tag);
                if (className) node.className = className;
                if (content != null) node.textContent = content;
                return node;
            }
            var toolbar = element('div', 'mytel-agent-toolbar');
            var label = element('label', 'mytel-agent-search-label', 'Search agents');
            var input = element('input', 'mytel-agent-search');
            input.type = 'search'; input.placeholder = 'Name, interface or queue';
            input.setAttribute('aria-label', 'Search queue agents');
            label.appendChild(input); toolbar.appendChild(label);
            var joinBar = element('div','mytel-agent-membership-form');
            var queueLabel = element('label','mytel-agent-join-label','Queue');
            var queueSelect = element('select','mytel-agent-join-queue');
            queueSelect.setAttribute('aria-label','Queue to sign in to');
            queueLabel.appendChild(queueSelect);joinBar.appendChild(queueLabel);
            var joinButton = element('button','mytel-agent-action','Sign in to queue');
            joinButton.type='button';joinButton.setAttribute('data-membership-action','join');joinBar.appendChild(joinButton);
            var sourceNote=element('p','mytel-agent-source-note');joinBar.appendChild(sourceNote);
            var note = element('p', 'mytel-agent-note');
            var status = element('p', 'mytel-agent-feedback');
            status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
            var list = element('div', 'mytel-agent-list');
            host.appendChild(toolbar); host.appendChild(joinBar); host.appendChild(note); host.appendChild(status); host.appendChild(list);
            function access() { return (root.var_init && root.var_init.OPERATOR_ACCESS) || {}; }
            function sourceState() {
                var select=document.querySelector('[data-operator-source]');var extension=select?text(select.value):'';
                var candidates=observedPhones.slice();
                if(!candidates.some(function(phone){return text(read(phone,'extension'))===extension;})&&root.debug_root)
                    ['extensions','area1','area2','area3','area4','area5','area6','area7','area8','area9'].forEach(function(key){var collection=read(root.debug_root,key);candidates=candidates.concat(sequence(read(collection,'content')||collection));});
                var phone=candidates.filter(function(item){return text(read(item,'extension'))===extension;})[0];
                return {extension:extension,registered:!!phone&&[true,1,'1'].indexOf(read(phone,'registered'))>=0,interface:text(read(phone,'channel'))};
            }
            function sourceRepresented(queue,source){
                if(!/^[0-9]{1,40}$/.test(source.extension))return false;
                return rows.some(function(row){return row.queue===queue&&(
                    source.interface&&(row.interface===source.interface||row.stateInterface===source.interface)||
                    new RegExp('^Local/'+source.extension+'@[^/]+(?:/n)?$').test(row.interface)||
                    new RegExp('^hint:'+source.extension+'@(?:ext-local|from-internal)$').test(row.stateInterface));});
            }
            function render() {
                var now = Date.now(), allowed = access().queues === true, membershipAllowed=access().membership===true;
                var fresh = state === 'connected' && snapshotAt > 0 && now - snapshotAt < 10000;
                note.textContent = !allowed && !membershipAllowed ? 'Read-only agent status. Your Issabel account cannot change queue availability.' :
                    (!fresh ? 'Queue controls are read-only until a fresh PBX snapshot is available.' : 'Pause, resume or manage permitted dynamic memberships. Static and active memberships cannot sign out here.');
                joinBar.hidden=!membershipAllowed;
                var choices=observedQueues.map(function(queue){return {number:text(read(queue,'extension')),name:text(read(queue,'description'))};});
                var signature=JSON.stringify(choices);
                if(signature!==queueSignature){var selected=queueSelect.value;queueSelect.textContent='';choices.forEach(function(queue){var option=element('option','',queue.number+(queue.name?' · '+queue.name:''));option.value=queue.number;queueSelect.appendChild(option);});queueSelect.value=choices.some(function(queue){return queue.number===selected;})?selected:(choices[0]?choices[0].number:'');queueSignature=signature;}
                var source=sourceState();var joinKey='join:'+JSON.stringify([queueSelect.value,source.extension]);
                var represented=sourceRepresented(queueSelect.value,source);
                joinButton.disabled=!canJoin(queueSelect.value,source.extension,source.registered,access(),state,snapshotAt,now,!!pending[joinKey],represented);
                joinButton.textContent=pending[joinKey]?'Waiting for PBX…':'Sign in to queue';
                sourceNote.textContent=!choices.length?'No queues are present in this PBX snapshot.':!source.extension?'Choose My extension above before signing in.':represented?'Extension '+source.extension+' already has a membership in queue '+queueSelect.value+'.':source.registered?'Using My extension: '+source.extension:'My extension '+source.extension+' must be registered before sign-in.';
                status.textContent = feedback;
                var visible = rows.filter(function (row) { return matchesSearch(row, input.value); });
                var count = document.querySelector('[data-agent-count]');
                if (count) count.textContent = input.value ? visible.length + ' / ' + rows.length : String(rows.length);
                var nextSignature=JSON.stringify([visible,allowed,membershipAllowed,fresh,Object.keys(pending).map(function(key){return [key,pending[key].kind,!!pending[key].failed];})]);
                if(nextSignature===listSignature)return;
                listSignature=nextSignature;
                var focused = document.activeElement && document.activeElement.getAttribute('data-queue-focus');
                var scroll = list.scrollTop;
                list.textContent = '';
                if (!visible.length) list.appendChild(element('p', 'mytel-agent-empty', !snapshotAt ? 'Waiting for a PBX snapshot.' :
                    (rows.length ? 'No agents match this search.' : 'No queue members are present in this snapshot. Configure membership in Issabel.')));
                visible.forEach(function (row) {
                    var item = element('article', 'mytel-agent-row');
                    var identity = element('div', 'mytel-agent-identity');
                    identity.appendChild(element('strong', '', row.name));
                    identity.appendChild(element('span', 'mytel-agent-interface', row.interface || 'Interface unavailable'));
                    identity.appendChild(element('span','mytel-agent-type',row.membership?row.membership.charAt(0).toUpperCase()+row.membership.slice(1)+' membership':'Membership type unknown'));
                    item.appendChild(identity);
                    var queue = element('div', 'mytel-agent-queue');
                    queue.appendChild(element('span', '', row.queueName || 'Queue'));
                    queue.appendChild(element('strong', '', row.queue || 'Unknown'));
                    item.appendChild(queue);
                    item.appendChild(element('span', 'mytel-agent-state is-' + row.tone, row.state));
                    var actions=element('div','mytel-agent-actions');
                    if (allowed) {
                        var operation = pending[row.key];
                        var button = element('button', 'mytel-agent-action', operation ? (operation.failed ? 'Awaiting fresh state' : 'Waiting for PBX…') : (row.paused === null ? 'Unavailable' : (row.paused === '1' ? 'Resume' : 'Pause')));
                        button.type = 'button'; button.setAttribute('data-agent-key', row.key);
                        button.setAttribute('data-queue-focus','pause:'+row.key);
                        button.setAttribute('aria-label', (row.paused === '1' ? 'Resume ' : 'Pause ') + row.name + ' in queue ' + row.queue);
                        button.disabled = !canControl(row, access(), state, snapshotAt, now, !!operation);
                        button.addEventListener('click', function () { change(row); });
                        actions.appendChild(button);
                    }
                    if(membershipAllowed){
                        var leave=element('button','mytel-agent-action mytel-agent-signout',pending[row.key]?'Waiting for PBX…':'Sign out');
                        leave.type='button';leave.setAttribute('data-membership-action','leave');
                        leave.setAttribute('data-queue-focus','leave:'+row.key);
                        leave.setAttribute('aria-label','Sign '+row.name+' out of queue '+row.queue);
                        leave.disabled=!canLeave(row,access(),state,snapshotAt,now,!!pending[row.key]);
                        leave.title=row.membership==='dynamic'?'Only idle, explicitly dynamic members can sign out.':'Static and realtime membership is managed in Issabel.';
                        leave.addEventListener('click',function(){leaveMember(row);});actions.appendChild(leave);
                    }
                    if(!allowed&&!membershipAllowed)actions.appendChild(element('span','mytel-agent-readonly','Read only'));
                    item.appendChild(actions);
                    list.appendChild(item);
                });
                list.scrollTop = scroll;
                if (focused) Array.prototype.forEach.call(list.querySelectorAll('[data-queue-focus]'), function (button) {
                    if (button.getAttribute('data-queue-focus') === focused && !button.disabled) button.focus({preventScroll:true});
                });
            }
            function change(row) {
                if (!canControl(row, access(), state, snapshotAt, Date.now(), !!pending[row.key])) return;
                var jq = root.jQuery || root.$;
                if (!jq || !jq.ajax) { feedback = 'Queue controls are unavailable. Reload the panel.'; render(); return; }
                var desired = row.paused === '1' ? '0' : '1';
                send(row.key,{kind:'pause',desired:desired,queue:row.queue,interface:row.interface,started:Date.now()},
                    {menu:'control_panel',rawmode:'yes',action:'toggleQueueMemberPause',queue:row.queue,interface:row.interface,paused:desired});
            }
            function send(key,operation,payload){
                var jq=root.jQuery||root.$;
                if(!jq||!jq.ajax){feedback='Queue controls are unavailable. Reload the panel.';render();return;}
                pending[key]=operation;feedback='Sending queue request…';render();
                jq.ajax({url:'index.php', type:'POST', dataType:'json', timeout:7000,
                    headers:{'X-MyTel-CSRF':root.var_init && root.var_init.CSRF_TOKEN || ''},
                    data:payload
                }).done(function (response) {
                    if (!response || response.status !== 'success') {
                        if (pending[key]) pending[key].failed = true;
                        feedback = response && typeof response.message === 'string' ? response.message : 'The PBX did not confirm the request. Refresh before retrying.';
                    } else {
                        if(pending[key]&&typeof response.member_interface==='string')pending[key].interface=response.member_interface;
                        feedback = pending[key] ? 'PBX accepted the request. Waiting for the observed queue state.' : 'The PBX snapshot confirms the requested queue state.';
                        reconcile(false);
                    }
                    render();
                }).fail(function () {
                    if (pending[key]) pending[key].failed = true;
                    feedback = 'The queue request could not be confirmed. Refresh the live state before retrying.';
                    render();
                });
            }
            function reconcile(freshSnapshot){
                Object.keys(pending).forEach(function(key){
                    var operation=pending[key];var member=rows.filter(function(row){return row.queue===operation.queue&&row.interface===operation.interface;})[0];
                    var confirmed=operation.kind==='join'?!!member:(operation.kind==='leave'?!member:member&&member.paused===operation.desired);
                    if(confirmed){delete pending[key];feedback=(operation.kind==='join'?'Signed in to queue ':operation.kind==='leave'?'Signed out of queue ':(operation.desired==='1'?'Paused in queue ':'Resumed in queue '))+operation.queue+', confirmed by the PBX snapshot.';}
                    else if(operation.failed&&freshSnapshot){delete pending[key];
                        feedback = 'The PBX queue state has refreshed. The requested change was not confirmed.';
                    }
                });
            }
            function joinMember(){
                var source=sourceState(),queue=queueSelect.value,key='join:'+JSON.stringify([queue,source.extension]);
                if(!canJoin(queue,source.extension,source.registered,access(),state,snapshotAt,Date.now(),!!pending[key],sourceRepresented(queue,source)))return;
                if(!root.confirm('Sign extension '+source.extension+' in to queue '+queue+' as a dynamic agent?'))return;
                send(key,{kind:'join',queue:queue,source:source.extension,interface:null,started:Date.now()},
                    {menu:'control_panel',rawmode:'yes',action:'joinQueueMember',queue:queue,source:source.extension});
            }
            function leaveMember(row){
                if(!canLeave(row,access(),state,snapshotAt,Date.now(),!!pending[row.key]))return;
                if(!root.confirm('Sign '+row.name+' out of queue '+row.queue+'? This removes only this dynamic membership.'))return;
                send(row.key,{kind:'leave',queue:row.queue,interface:row.interface,started:Date.now()},
                    {menu:'control_panel',rawmode:'yes',action:'leaveQueueMember',queue:row.queue,interface:row.interface});
            }
            function observe(queues, timestamp, phones) {
                observedQueues=sequence(queues);rows = normalizeQueues(observedQueues); snapshotAt = timestamp;
                if(Array.isArray(phones))observedPhones=phones;
                reconcile(true);
                render();
            }
            input.addEventListener('input', render);
            queueSelect.addEventListener('change',render);joinButton.addEventListener('click',joinMember);
            root.addEventListener('mytel:snapshot', function (event) {
                var response = event.detail;
                if (!response || response.error || response.snapshot !== true || !Array.isArray(response.pbxchanges)) return;
                observe(response.pbxchanges.filter(function (row) { return row.objtype === 'queues'; }), Date.now(),response.pbxchanges.filter(function(row){return row.objtype==='phones';}));
            });
            root.addEventListener('mytel:connection', function (event) {
                state = event.detail && event.detail.state || 'disconnected'; render();
            });
            // The module may be added after the first snapshot finished.
            var controller = root.debug_root;
            if (controller) {
                state = read(controller, 'connectionState') || 'connecting';
                var collection = read(controller, 'queues');
                observe(sequence(read(collection,'content')||collection), Number(read(controller, 'lastUpdatedAt')) || 0);
            } else if (initialEvent && initialEvent.type === 'mytel:snapshot' && initialEvent.detail &&
                initialEvent.detail.snapshot === true && Array.isArray(initialEvent.detail.pbxchanges)) {
                observe(initialEvent.detail.pbxchanges.filter(function (row) { return row.objtype === 'queues'; }), Date.now(),initialEvent.detail.pbxchanges.filter(function(row){return row.objtype==='phones';}));
            } else render();
            root.setInterval(function () {
                var now = Date.now(), changed = false;
                Object.keys(pending).forEach(function (key) {
                    if (now - pending[key].started > 12000) {
                        delete pending[key]; changed = true;
                        feedback = 'The requested state has not been observed yet. Refresh before trying again.';
                    }
                });
                if (changed || snapshotAt) render();
            }, 1000);
        }
        // Ember renders the desktop template after DOMContentLoaded. Retry the
        // mount from real controller events so a late host never stays inert.
        root.addEventListener('mytel:connection', function (event) {
            initialConnection = event.detail && event.detail.state || 'disconnected';
            start(event);
        });
        root.addEventListener('mytel:snapshot', start);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }
    return {normalizeQueues:normalizeQueues, matchesSearch:matchesSearch, canControl:canControl, canJoin:canJoin, canLeave:canLeave, mount:mount};
}));
