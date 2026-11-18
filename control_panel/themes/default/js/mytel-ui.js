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

    var api = {normalize: normalize, phoneState: phoneState, matches: matches, summarize: summarize};
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
        var allPhones = [];
        if (current) ['extensions', 'area1', 'area2', 'area3', 'area4', 'area5', 'area6', 'area7', 'area8', 'area9'].forEach(function (key) {
            allPhones = allPhones.concat(collection(read(current, key, null)));
        });
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
            var shown = matches(phone, query, filter);
            card.hidden = !shown;
            if (shown) visible++;
            card.setAttribute('data-phone-state', state);
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-pressed', global.selectedContainer === card ? 'true' : 'false');
            var stateName = {online: phrase('آماده', 'Ready'), offline: phrase('آفلاین', 'Offline'), busy: phrase('در مکالمه', 'In call'), ringing: phrase('در حال زنگ', 'Ringing')}[state];
            card.setAttribute('aria-label', read(phone, 'extension', '') + ' ' + read(phone, 'description', '') + '، ' + stateName);
            text(card, '.mytel-extension-state', stateName);
        });
        Array.prototype.forEach.call(root.querySelectorAll('.mytel-area-panel'), function (panel) {
            var count = panel.querySelectorAll('.ExtensionStyle:not([hidden])').length;
            panel.hidden = !showGroups && count === 0;
        });
        ['online', 'busy', 'waiting', 'offline'].forEach(function (key) { text(root, '[data-metric="' + key + '"]', loaded ? formatNumber(totals[key]) : '—'); });
        ['all', 'online', 'busy', 'offline'].forEach(function (key) { text(root, '[data-filter-count="' + key + '"]', loaded ? formatNumber(totals[key]) : '—'); });
        text(root, '[data-total]', loaded ? formatNumber(totals.all) : '—');
        text(root, '[data-queue-count]', loaded ? formatNumber(queues.length) : '—');
        text(root, '[data-results]', loaded ? formatNumber(visible) + phrase(' از ', ' of ') + formatNumber(totals.all) + phrase(' داخلی', ' extensions') : '');
        var feedback = root.querySelector('[data-directory-feedback]');
        if (feedback) {
            feedback.hidden = loaded && visible > 0;
            var feedbackText = phrase('در حال دریافت داخلی‌ها…', 'Loading extensions…');
            if (loaded && totals.all === 0) feedbackText = phrase('هنوز داخلی‌ای برای نمایش وجود ندارد. داخلی‌های تعریف‌شده در ایزابل، اینجا نمایش داده می‌شوند.', 'No extensions to display yet. Extensions configured in Issabel will appear here.');
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
        root.addEventListener('input', function (event) {
            if (event.target.id === 'mytel-search') { query = event.target.value; update(); }
        });
        root.addEventListener('click', function (event) {
            var target = findParent(event.target, '[data-action],[data-filter],a.pbxtooltip', root);
            if (!target) return;
            if (target.matches('a.pbxtooltip')) { event.preventDefault(); return; }
            if (target.hasAttribute('data-filter')) {
                filter = target.getAttribute('data-filter');
                Array.prototype.forEach.call(root.querySelectorAll('[data-filter]'), function (button) { button.setAttribute('aria-pressed', button === target ? 'true' : 'false'); });
                update();
            } else if (target.getAttribute('data-action') === 'retry') retry();
            else if (target.getAttribute('data-action') === 'groups') { showGroups = !showGroups; target.setAttribute('aria-pressed', showGroups ? 'true' : 'false'); update(); }
        });
        root.addEventListener('keydown', function (event) {
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
