/* MyTel operator workspace: presentation only; PBX requests remain in the controller. */
(function (global) {
    'use strict';

    function read(object, key, fallback) {
        var value = object && typeof object.get === 'function' ? object.get(key) : object && object[key];
        return value == null ? fallback : value;
    }

    function collection(controller) {
        if (!controller) return [];
        if (Array.isArray(controller)) return controller;
        var output = [];
        var length = read(controller, 'length', 0);
        for (var i = 0; i < length; i++) output.push(controller.objectAt(i));
        return output;
    }

    function normalize(value) {
        return String(value == null ? '' : value).toLowerCase()
            .replace(/[۰-۹]/g, function (digit) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)); })
            .replace(/[٠-٩]/g, function (digit) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)); })
            .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
            .replace(/[\u200c\u200e\u200f\u202a-\u202e]/g, '').trim();
    }

    function isRegistered(phone) {
        var registered = read(phone, 'registered', false);
        return registered === true || registered === 1 || registered === '1';
    }

    function phoneState(phone) {
        var active = collection(read(phone, 'active', []));
        var state = read(phone, 'trunkstate', '');
        if (state === 'Up' || active.some(function (call) { return read(call, 'ChannelStateDesc', '') === 'Up'; })) return 'busy';
        if (state === 'Ringing' || active.some(function (call) { return /^Ring/.test(read(call, 'ChannelStateDesc', '')); })) return 'ringing';
        return isRegistered(phone) ? 'online' : 'offline';
    }

    function matches(phone, query, filter) {
        var state = phoneState(phone);
        var statusMatches = filter === 'all' || (filter === 'busy' && state === 'busy') ||
            (filter === 'online' && isRegistered(phone)) || (filter === 'offline' && !isRegistered(phone));
        var searchable = normalize(read(phone, 'extension', '') + ' ' + read(phone, 'description', '') + ' ' + read(phone, 'channel', ''));
        return statusMatches && searchable.indexOf(normalize(query)) !== -1;
    }

    function summarize(phones, queues) {
        var result = {all: phones.length, online: 0, offline: 0, busy: 0, waiting: 0};
        phones.forEach(function (phone) {
            var state = phoneState(phone);
            result[isRegistered(phone) ? 'online' : 'offline']++;
            if (state === 'busy') result.busy++;
        });
        queues.forEach(function (queue) { result.waiting += collection(read(queue, 'callers', [])).length; });
        return result;
    }

    function sanitizePreferences(value) {
        value=value && typeof value==='object' && !Array.isArray(value)?value:{};
        var favorites=Array.isArray(value.favorites)?value.favorites:[];
        favorites=favorites.filter(function(item,index,array){return typeof item==='string' && /^[0-9*#]{1,40}$/.test(item) && array.indexOf(item)===index;}).slice(0,2000);
        return {favorites:favorites,view:value.view==='favorites'?'favorites':'all',team:/^(all|extensions|area[1-9])$/.test(value.team)?value.team:'all',display:value.display==='list'?'list':'cards'};
    }
    function preferenceScope() { return global.var_init && typeof global.var_init.OPERATOR_KEY==='string' && global.var_init.OPERATOR_KEY?global.var_init.OPERATOR_KEY:'session'; }
    function preferenceStore() { try{return preferenceScope()==='session'?global.sessionStorage:global.localStorage;}catch(ignore){return null;} }
    function access(action) { return !!(global.var_init && global.var_init.OPERATOR_ACCESS && global.var_init.OPERATOR_ACCESS[action]===true); }

    var api = {normalize: normalize, phoneState: phoneState, matches: matches, summarize: summarize,sanitizePreferences:sanitizePreferences,preferenceScope:preferenceScope,preferenceStore:preferenceStore,access:access};
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
    global.MyTelUI = api;
    var document = global.document;
    var query = '';
    var filter = 'all';
    var showGroups = false;
    var connection = 'connecting';
    var lastUpdated = 0;
    var started = Date.now();
    var connectionError = '';
    var tick = null;
    var initialized = false;
    var english = false;
    var preferences=sanitizePreferences(null);
    api.favoriteNumbers=function(){return preferences.favorites.slice();};
    var advancedTool=null;var advancedReturnFocus=null;
    function canEmbedTool(tool,url){return (tool.embed_url==='fop2/' || tool.embed_url==='/fop2/') && url.origin===global.location.origin && url.searchParams.get('menu')==='fop2app' && /\/index\.php$/.test(url.pathname);}
    function closeAdvanced(){var root=document.getElementById('controlPanelApplication');var dialog=root&&root.querySelector('#mytel-advanced-dialog');if(!dialog)return;var host=dialog.querySelector('[data-advanced-frame-host]');if(host)host.replaceChildren();if(dialog.open)dialog.close();if(advancedReturnFocus && advancedReturnFocus.isConnected)advancedReturnFocus.focus();}
    function openAdvanced(){
        if(!advancedTool)return;var root=document.getElementById('controlPanelApplication');var dialog=root&&root.querySelector('#mytel-advanced-dialog');if(!dialog)return;
        if(!dialog.open)advancedReturnFocus=document.activeElement;var host=dialog.querySelector('[data-advanced-frame-host]');host.replaceChildren();var frame=document.createElement('iframe');frame.title='Advanced operator console — separate login';frame.referrerPolicy='no-referrer';frame.allow='microphone; autoplay';frame.src=new URL('/fop2/',global.location.origin).href;host.appendChild(frame);var fallback=dialog.querySelector('[data-advanced-fallback]');fallback.href=advancedTool.url;
        if(!dialog.open)dialog.showModal();
    }
    function preferenceKey(){return 'mytel.directory.'+(global.module_name || 'control_panel')+'.'+preferenceScope();}
    function savePreferences(){try{var storage=preferenceStore();if(storage)storage.setItem(preferenceKey(),JSON.stringify(preferences));}catch(ignore){/* Preferences are optional. */}}

    function updateDirectoryViews(root,teams,phones,loaded){
        var directory=root.querySelector('.mytel-directory');if(directory)directory.setAttribute('data-display',preferences.display);
        var favorites=phones.filter(function(phone){return preferences.favorites.indexOf(String(read(phone,'extension','')))!==-1;}).length;
        text(root,'[data-favorites-count]',loaded?formatNumber(favorites):'—');
        Array.prototype.forEach.call(root.querySelectorAll('[data-directory-view]'),function(button){button.setAttribute('aria-pressed',button.getAttribute('data-directory-view')===preferences.view?'true':'false');});
        Array.prototype.forEach.call(root.querySelectorAll('[data-directory-display]'),function(button){button.setAttribute('aria-pressed',button.getAttribute('data-directory-display')===preferences.display?'true':'false');});
        var select=root.querySelector('#mytel-team');if(select){
            var signature=JSON.stringify(teams);
            if(select.getAttribute('data-teams')!==signature){select.replaceChildren();var all=document.createElement('option');all.value='all';all.textContent=phrase('همه تیم‌ها','All teams');select.appendChild(all);teams.forEach(function(team){var option=document.createElement('option');option.value=team.key;option.textContent=team.description+' ('+team.count+')';select.appendChild(option);});select.setAttribute('data-teams',signature);}
            if(preferences.team!=='all' && !teams.some(function(team){return team.key===preferences.team;}))preferences.team='all';select.value=preferences.team;select.disabled=!loaded;
        }
    }
    function updatePermissions(root){
        root.setAttribute('data-can-call',access('call')?'true':'false');root.setAttribute('data-can-layout',access('layout')?'true':'false');
        Array.prototype.forEach.call(root.querySelectorAll('.phone-icon'),function(icon){icon.setAttribute('aria-disabled',access('call')?'false':'true');icon.title=access('call')?'Drag the phone icon onto a destination to place a call.':'Call controls are read-only for this account.';});
        var allowed=['call','pickup','transfer','park','queues','membership','hangup'].filter(access);
        text(root,'[data-access-summary]',allowed.length?phrase('ابزارهای مجاز: ','Available actions: ')+allowed.map(function(value){return {call:'Call',pickup:'Pickup',transfer:'Transfer / consult',park:'Park',queues:'Pause / resume',membership:'Queue sign-in / sign-out',hangup:'End call'}[value];}).join(' · '):phrase('این حساب فقط امکان مشاهده دارد.','Monitoring only. Call controls are not permitted for this account.'));
        var accessSummary=root.querySelector('[data-access-summary]');if(accessSummary)accessSummary.hidden=allowed.length===7;
        Array.prototype.forEach.call(root.querySelectorAll('.paneledittitle'),function(button){button.hidden=!access('layout');});
        var organize=root.querySelector('[data-action=groups]');if(organize){organize.hidden=!access('layout');}
        if(typeof global.jQuery==='function'){
            var $=global.jQuery;
            ['.sortablepanelview','.lisortable'].forEach(function(selector){$(root).find(selector).each(function(){var element=$(this);if(element.hasClass('ui-sortable') && element.attr('data-access-layout')!==String(access('layout'))){element.sortable('option','disabled',!access('layout'));element.attr('data-access-layout',String(access('layout')));}});});
            $(root).find('.ui-draggable').each(function(){var element=$(this);if(element.attr('data-access-call')!==String(access('call'))){element.draggable('option','disabled',!access('call'));element.attr('data-access-call',String(access('call')));}});
            $(root).find('.ui-droppable').each(function(){var element=$(this);if(element.attr('data-access-drop')!==String(access('call'))){element.droppable('option','disabled',!access('call'));element.attr('data-access-drop',String(access('call')));}});
            $(root).find('.parkinglots-list .ui-droppable').each(function(){$(this).droppable('option','disabled',true);});
        }
        var tools=root.querySelector('[data-operator-tools]');var links=root.querySelector('[data-operator-tool-links]');
        if(tools && links && !links.hasAttribute('data-loaded')){var entries=global.var_init && Array.isArray(global.var_init.OPERATOR_TOOLS)?global.var_init.OPERATOR_TOOLS:[];entries.forEach(function(tool){try{if(!tool || typeof tool.url!=='string' || !tool.url.trim())return;var url=new URL(tool.url,global.location.href);if(!/^https?:$/.test(url.protocol) || url.username || url.password)return;if(canEmbedTool(tool,url)){advancedTool={url:url.href};var button=document.createElement('button');button.type='button';button.setAttribute('data-action','open-advanced');button.textContent=String(tool.label || 'Advanced console');links.appendChild(button);}else{var link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=String(tool.label || 'Operator tool');links.appendChild(link);}}catch(ignore){}});tools.hidden=!links.children.length;links.setAttribute('data-loaded','true');}
    }

    function phrase(fa, en) { return english ? en : fa; }
    function text(root, selector, value) {
        var element = root.querySelector(selector);
        if (element && element.textContent !== String(value)) element.textContent = value;
    }
    function formatNumber(value) { return Number(value).toLocaleString(english ? 'en-US' : 'fa-IR'); }
    function controller() { return global.debug_root || null; }
    function findParent(element, selector, stop) {
        while (element && element !== stop) {
            if (element.matches && element.matches(selector)) return element;
            element = element.parentElement;
        }
        return null;
    }

    function retry() {
        var current = controller();
        if (!current || read(current, 'permissionDenied', false) || current.stopping) { global.location.reload(); return; }
        if (current.longPoll) return;
        global.clearTimeout(current.reconnectTimer);
        connection = 'connecting';
        connectionError = '';
        current.pbxStatus();
        update();
    }

    function update() {
        var root = document.getElementById('controlPanelApplication');
        if (!root || !root.querySelector('.mytel-workspace')) return;
        english = root.getAttribute('data-language') === 'en';
        var current = controller();
        var loaded = current && read(read(current, 'extensions', null), 'finishedloading', false);
        if (current) {
            var state = read(current, 'connectionState', null);
            if (state) connection = state;
            else if (read(current, 'connected', false)) connection = 'connected';
            lastUpdated = read(current, 'lastUpdatedAt', lastUpdated);
        }
        var stale = lastUpdated > 0 && Date.now() - lastUpdated > 10000;
        if (connection === 'connected' && stale) connection = 'disconnected';
        root.setAttribute('data-state', connection);
        var badge = root.querySelector('.mytel-connection');
        if (badge) badge.setAttribute('data-connection', connection);
        var labels = {
            connecting: phrase('در حال اتصال', 'Connecting'),
            connected: phrase('اتصال زنده', 'Live connection'),
            disconnected: phrase('ارتباط قطع شده', 'Disconnected'),
            permission: phrase('ورود مجدد لازم است', 'Sign-in required')
        };
        text(root, '[data-connection-label]', labels[connection] || labels.connecting);
        var updated = phrase('در انتظار دریافت اطلاعات', 'Waiting for data');
        if (lastUpdated) updated = phrase('آخرین دریافت: ', 'Last update: ') + new Date(lastUpdated).toLocaleTimeString(english ? 'en-GB' : 'fa-IR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
        text(root, '[data-updated]', updated);
        var banner = root.querySelector('[data-banner]');
        var timedOut = !loaded && Date.now() - started > 10000;
        if (banner) {
            banner.hidden = connection === 'connected' && !stale || connection === 'connecting' && !timedOut;
            var message = phrase('ارتباط با مرکز تلفن قطع شده است. تلاش خودکار برای اتصال ادامه دارد.', 'The PBX connection is unavailable. Automatic retries will continue.');
            if (loaded) message += phrase(' اطلاعات نمایش‌داده‌شده مربوط به آخرین دریافت موفق است.', ' Displayed data is from the last successful update.');
            if (connection === 'permission') message = phrase('دسترسی به این نشست پایان یافته است. برای ادامه، دوباره وارد ایزابل شوید.', 'Your session is no longer authorized. Sign in to Issabel again to continue.');
            // Connection details can originate in a different backend language.
            // Keep the operator's message clear and in the selected UI language.
            if (connectionError && connection !== 'permission' &&
                (english ? !/[\u0600-\u06ff]/.test(connectionError) : /[\u0600-\u06ff]/.test(connectionError))) message += ' ' + connectionError;
            text(root, '[data-banner-text]', message);
            text(banner, '[data-action=retry]', connection === 'permission' ? phrase('ورود مجدد', 'Sign in again') : phrase('تلاش دوباره', 'Retry connection'));
        }
        var allPhones = [];var teamByChannel=Object.create(null);var teams=[];
        if (current) ['extensions', 'area1', 'area2', 'area3', 'area4', 'area5', 'area6', 'area7', 'area8', 'area9'].forEach(function (key) {
            var group=read(current,key,null);var members=collection(group);allPhones=allPhones.concat(members);members.forEach(function(phone){teamByChannel[read(phone,'channel','')]=key;});if(members.length)teams.push({key:key,description:read(group,'description',key==='extensions'?'Main directory':'Team '+key.replace('area','')),count:members.length});
        });
        updateDirectoryViews(root,teams,allPhones,loaded);updatePermissions(root);
        var queues = collection(read(current, 'queues', null));
        var totals = summarize(allPhones, queues);
        var byChannel = Object.create(null);
        allPhones.forEach(function (phone) { byChannel[read(phone, 'channel', '')] = phone; });
        var visible = 0;
        var cards = root.querySelectorAll('.ExtensionStyle');
        Array.prototype.forEach.call(cards, function (card) {
            var phone = byChannel[card.getAttribute('data-idattr')];
            if (!phone) { card.hidden = true; return; }
            var state = phoneState(phone);
            var number=String(read(phone,'extension',''));var favorite=preferences.favorites.indexOf(number)!==-1;
            var shown = matches(phone, query, filter) && (preferences.view==='all' || favorite) && (preferences.team==='all' || teamByChannel[read(phone,'channel','')]===preferences.team);
            card.hidden = !shown;
            if (shown) visible++;
            card.setAttribute('data-phone-state', state);
            card.setAttribute('data-registration', isRegistered(phone) ? 'online' : 'offline');
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-pressed', global.selectedContainer === card ? 'true' : 'false');
            var registrationName = isRegistered(phone) ? phrase('آنلاین', 'Online') : phrase('آفلاین', 'Offline');
            var activityName = {busy: phrase('در مکالمه', 'In call'), ringing: phrase('در حال زنگ', 'Ringing')}[state];
            var stateName = registrationName + (activityName ? ' · ' + activityName : '');
            card.setAttribute('aria-label', read(phone, 'extension', '') + ' ' + read(phone, 'description', '') + (english ? ', ' : '، ') + stateName);
            text(card, '.mytel-extension-state', stateName);
            var star=card.querySelector('[data-action=favorite]');if(star){star.setAttribute('aria-pressed',favorite?'true':'false');star.setAttribute('aria-label',(favorite?'Remove ':'Add ')+number+(favorite?' from favorites':' to favorites'));star.title=star.getAttribute('aria-label');star.textContent=favorite?'★':'☆';}
        });
        Array.prototype.forEach.call(root.querySelectorAll('.mytel-area-panel'), function (panel) {
            var count = panel.querySelectorAll('.ExtensionStyle:not([hidden])').length;
            panel.hidden = !showGroups && count === 0;
        });
        ['online', 'busy', 'waiting', 'offline'].forEach(function (key) { text(root, '[data-metric="' + key + '"]', loaded ? formatNumber(totals[key]) : '—'); });
        ['all', 'online', 'busy', 'offline'].forEach(function (key) { text(root, '[data-filter-count="' + key + '"]', loaded ? formatNumber(totals[key]) : '—'); });
        text(root, '[data-total]', loaded ? formatNumber(totals.all) : '—');
        text(root, '[data-queue-count]', loaded ? formatNumber(queues.length) : '—');
        text(root,'[data-trunk-count]',loaded?formatNumber(collection(read(current,'iptrunks',null)).length):'—');
        text(root, '[data-results]', loaded ? formatNumber(visible) + phrase(' از ', ' of ') + formatNumber(totals.all) + phrase(' داخلی', ' extensions') : '');
        var feedback = root.querySelector('[data-directory-feedback]');
        if (feedback) {
            feedback.hidden = loaded && visible > 0;
            var feedbackText = phrase('در حال دریافت داخلی‌ها…', 'Loading extensions…');
            if (loaded && totals.all === 0) feedbackText = phrase('هنوز داخلی‌ای برای نمایش وجود ندارد. داخلی‌های تعریف‌شده در ایزابل، اینجا نمایش داده می‌شوند.', 'No extensions to display yet. Extensions configured in Issabel will appear here.');
            else if(loaded && visible===0 && preferences.view==='favorites' && !allPhones.some(function(phone){return preferences.favorites.indexOf(String(read(phone,'extension','')))!==-1;}))feedbackText=phrase('برای افزودن داخلی به علاقه‌مندی‌ها، ستاره را انتخاب کنید.','No favorites yet. Choose All extensions and use the star to pin your frequent contacts.');
            else if (loaded && visible === 0) feedbackText = phrase('داخلی‌ای با این جستجو و فیلتر پیدا نشد. جستجو یا فیلتر وضعیت را تغییر دهید.', 'No extensions match your search and filter. Change the search or status filter.');
            else if (!loaded && connection === 'permission') feedbackText = labels.permission;
            else if (!loaded && (connection === 'disconnected' || timedOut)) feedbackText = phrase('اطلاعات داخلی‌ها دریافت نشد؛ وضعیت اتصال را بررسی کنید.', 'Extensions could not be loaded. Check the connection status.');
            if (feedback.textContent !== feedbackText) feedback.textContent = feedbackText;
        }
        Array.prototype.forEach.call(root.querySelectorAll('[data-action=retry]'), function (button) { button.disabled = !!(current && current.longPoll && connection !== 'permission'); });
    }

    function initialize() {
        if (initialized) return;
        var root = document.getElementById('controlPanelApplication');
        if (!root) return;
        initialized = true;
        try{var storage=preferenceStore();if(storage)preferences=sanitizePreferences(JSON.parse(storage.getItem(preferenceKey()) || 'null'));}catch(ignore){preferences=sanitizePreferences(null);}
        root.addEventListener('input', function (event) {
            if (event.target.id === 'mytel-search') { query = event.target.value; update(); }
        });
        root.addEventListener('click', function (event) {
            var target = findParent(event.target, '[data-action],[data-filter],[data-directory-view],[data-directory-display],a.pbxtooltip', root);
            if (!target) return;
            if (target.matches('a.pbxtooltip')) { event.preventDefault(); return; }
            if(target.hasAttribute('data-directory-view')){preferences.view=target.getAttribute('data-directory-view');savePreferences();update();return;}
            if(target.getAttribute('data-action')==='open-advanced'){openAdvanced();return;}
            if(target.getAttribute('data-action')==='close-advanced'){closeAdvanced();return;}
            if(target.getAttribute('data-action')==='jump-directory'){var field=root.querySelector('#mytel-search');if(field){field.focus();field.select();}return;}
            if(target.getAttribute('data-action')==='jump-calls'){var heading=root.querySelector('#mytel-live-title');if(heading){heading.scrollIntoView({block:'start',behavior:'auto'});heading.focus();}return;}
            if(target.hasAttribute('data-directory-display')){preferences.display=target.getAttribute('data-directory-display');savePreferences();update();return;}
            if(target.getAttribute('data-action')==='favorite'){var card=findParent(target,'.ExtensionStyle',root);if(card){var body=card.querySelector('.mytel-extension-number');var extension=body && body.textContent.trim();if(extension && /^[0-9*#]{1,40}$/.test(extension)){var position=preferences.favorites.indexOf(extension);if(position===-1)preferences.favorites.push(extension);else preferences.favorites.splice(position,1);savePreferences();update();}}event.stopPropagation();return;}
            if (target.hasAttribute('data-filter')) {
                filter = target.getAttribute('data-filter');
                Array.prototype.forEach.call(root.querySelectorAll('[data-filter]'), function (button) { button.setAttribute('aria-pressed', button === target ? 'true' : 'false'); });
                update();
            } else if (target.getAttribute('data-action') === 'retry') retry();
            else if (target.getAttribute('data-action') === 'groups') { showGroups = !showGroups; target.setAttribute('aria-pressed', showGroups ? 'true' : 'false'); update(); }
        });
        root.addEventListener('change',function(event){if(event.target.id==='mytel-team'){preferences.team=event.target.value;savePreferences();update();}});
        root.addEventListener('dblclick',function(event){if(!access('call') && findParent(event.target,'.phone-icon',root)){event.preventDefault();event.stopImmediatePropagation();}},true);
        root.addEventListener('close',function(event){if(event.target.id==='mytel-advanced-dialog' && !event.target.open){var host=event.target.querySelector('[data-advanced-frame-host]');if(host)host.replaceChildren();if(advancedReturnFocus && advancedReturnFocus.isConnected)advancedReturnFocus.focus();}},true);
        var advancedDialog=root.querySelector('#mytel-advanced-dialog');if(advancedDialog){advancedDialog.addEventListener('cancel',function(){var host=advancedDialog.querySelector('[data-advanced-frame-host]');if(host)host.replaceChildren();});if(global.MutationObserver)new global.MutationObserver(function(){if(!advancedDialog.open){var host=advancedDialog.querySelector('[data-advanced-frame-host]');if(host)host.replaceChildren();}}).observe(advancedDialog,{attributes:true,attributeFilter:['open']});}
        root.addEventListener('keydown', function (event) {
            if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k'){var search=root.querySelector('#mytel-search');if(search){event.preventDefault();search.focus();search.select();}}
            if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.ExtensionStyle')) { event.preventDefault(); event.target.click(); update(); }
            if (event.key === 'Escape' && event.target.id === 'mytel-search') { event.target.value = ''; query = ''; update(); }
        });
        tick = global.setInterval(update, 1000);
        update();
    }
    global.addEventListener('mytel:connection', function (event) {
        connection = event.detail.state;
        connectionError = event.detail.error || '';
        if (connection === 'connected') lastUpdated = Date.now();
        update();
    });
    global.addEventListener('mytel:snapshot', function () { lastUpdated = Date.now(); global.setTimeout(update, 0); });
    global.addEventListener('pagehide', function () { if (tick) global.clearInterval(tick); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
}(typeof window !== 'undefined' ? window : globalThis));
