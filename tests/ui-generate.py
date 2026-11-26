"""Build synchronized Persian/English templates (development helper)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

template = '''<div id="controlPanelApplication" dir="rtl" data-language="fa">
<link rel="stylesheet" href="modules/{$module_name}/themes/default/css/mytel.css?v=2.1.0">
<link rel="stylesheet" href="modules/{$module_name}/themes/default/css/mytel-queue-controls.css?v=2.1.0">
<script type="text/x-handlebars" data-template-name="desktop">
{literal}
<div class="mytel-workspace containerAll">
  <header class="mytel-header">
    <a class="mytel-brand" href="https://mytel.one" target="_blank" rel="noopener noreferrer" aria-label="MyTel.one">
      <img src="modules/{/literal}{$module_name}{literal}/images/mytel-symbol.svg" alt="" width="61" height="30">
      <span class="mytel-wordmark" dir="ltr">mytel<span>.one</span></span>
      <span class="mytel-product-label">OPERATOR CONSOLE</span>
    </a>
    <div class="mytel-header-actions">
      <span class="mytel-connection" data-connection="connecting" role="status"><span class="mytel-status-dot"></span><span data-connection-label>در حال اتصال</span></span>
      <button type="button" class="mytel-icon-button" data-action="retry" aria-label="تازه‌سازی اطلاعات" title="تازه‌سازی اطلاعات"><span aria-hidden="true">↻</span></button>
    </div>
  </header>
  <div class="mytel-page-heading">
    <div><p class="mytel-eyebrow">فضای کار اپراتور</p><h1>مرکز کنترل تماس</h1><p class="mytel-description">وضعیت داخلی‌ها و صف‌های مرکز تلفن، در یک نگاه</p></div>
    <div class="mytel-update"><span class="mytel-live-dot"></span><span data-updated>در انتظار دریافت اطلاعات</span></div>
  </div>
  <div class="mytel-operator-controls"><div class="mytel-source-control"><label for="mytel-source-extension">My extension <select id="mytel-source-extension" data-operator-source aria-describedby="mytel-callback-note"><option value="">Choose extension</option></select></label><p id="mytel-callback-note">Calls ring your extension first. Your choice is saved for this account.</p></div><nav class="mytel-workspace-nav" aria-label="Workspace sections"><button type="button" data-action="jump-calls">Live calls</button><button type="button" data-action="jump-directory">Directory <kbd>Ctrl K</kbd></button></nav><details class="mytel-operator-tools" data-operator-tools hidden><summary>Operator tools</summary><div data-operator-tool-links></div><p>Advanced consoles open separately and may require their own login.</p></details></div>
  <p class="mytel-access-summary" data-access-summary></p>
  <div class="mytel-banner" data-banner role="status" hidden><span data-banner-text></span><button type="button" data-action="retry">تلاش دوباره</button></div>
  <section class="mytel-metrics" aria-label="خلاصه وضعیت مرکز تلفن">
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-green" aria-hidden="true">↗</span><div><span class="mytel-metric-label">داخلی آنلاین</span><strong data-metric="online">—</strong></div><span class="mytel-metric-caption">آماده ارتباط</span></div>
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-blue" aria-hidden="true">◉</span><div><span class="mytel-metric-label">داخلی در مکالمه</span><strong data-metric="busy">—</strong></div><span class="mytel-metric-caption">مکالمه فعال</span></div>
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-amber" aria-hidden="true">◷</span><div><span class="mytel-metric-label">تماس در انتظار</span><strong data-metric="waiting">—</strong></div><span class="mytel-metric-caption">در صف پاسخ‌گویی</span></div>
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-red" aria-hidden="true">↙</span><div><span class="mytel-metric-label">داخلی آفلاین</span><strong data-metric="offline">—</strong></div><span class="mytel-metric-caption">ثبت‌نشده</span></div>
  </section>
  <section class="mytel-live-calls mytel-surface" aria-labelledby="mytel-live-title">
    <div class="mytel-section-heading"><div><h2 id="mytel-live-title" tabindex="-1">Live calls <span class="mytel-call-count" data-live-count>—</span></h2><p>Live conversations and ringing calls across your PBX</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
    <div class="mytel-call-toolbar"><label class="mytel-search"><span aria-hidden="true">⌕</span><span class="mytel-visually-hidden">Search calls, callers or extensions</span><input type="search" id="mytel-call-search" placeholder="Search calls, callers or extensions…" autocomplete="off"></label><label class="mytel-call-state-label" for="mytel-call-state">Status <select id="mytel-call-state"><option value="all">All calls</option><option value="ringing">Ringing</option><option value="waiting">Waiting</option><option value="in-call">In call</option><option value="hold">On hold</option><option value="dialing">Dialing</option><option value="busy">Busy</option><option value="down">Down</option><option value="off-hook">Off hook</option><option value="pre-ring">Pre-ring</option><option value="reported">Other reported state</option><option value="unknown">Not reported</option></select></label></div>
    <div class="mytel-direction-filters" role="group" aria-label="Filter calls by direction"><button type="button" data-call-direction="all" aria-pressed="true">All <span data-direction-count="all">—</span></button><button type="button" data-call-direction="incoming" aria-pressed="false">Incoming <span data-direction-count="incoming">—</span></button><button type="button" data-call-direction="outgoing" aria-pressed="false">Outgoing <span data-direction-count="outgoing">—</span></button><button type="button" data-call-direction="internal" aria-pressed="false">Internal <span data-direction-count="internal">—</span></button><button type="button" data-call-direction="unknown" aria-pressed="false">Unknown <span data-direction-count="unknown">—</span></button></div>
    <div class="mytel-table-scroll"><table class="mytel-call-table"><thead><tr><th scope="col">Extension / channel</th><th scope="col">Caller</th><th scope="col">Connected party</th><th scope="col">Status</th><th scope="col">Direction</th><th scope="col">Elapsed</th><th scope="col">Queue</th><th scope="col"><span class="mytel-visually-hidden">Details</span></th></tr></thead><tbody data-live-call-rows></tbody></table></div>
    <p class="mytel-call-empty" data-live-empty role="status">Loading live calls…</p><div class="mytel-call-footnote"><span data-live-results></span><span>Elapsed includes ringing. Answered time is available in call details when reported.</span></div>
  </section>
  <div class="mytel-workspace-grid">
    <section class="mytel-directory mytel-surface" aria-labelledby="mytel-directory-title">
      <div class="mytel-section-heading"><div><h2 id="mytel-directory-title">داخلی‌ها</h2><p><span data-total>—</span> داخلی در مرکز تلفن</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
      <div class="mytel-directory-toolbar"><label class="mytel-search"><span aria-hidden="true">⌕</span><span class="mytel-visually-hidden">جستجوی نام یا شماره داخلی</span><input type="search" id="mytel-search" autocomplete="off" placeholder="جستجوی نام یا شماره داخلی…"></label><button type="button" class="mytel-secondary-button" data-action="groups" aria-pressed="false">گروه‌ها</button></div>
      <div class="mytel-directory-views"><div class="mytel-view-tabs" role="group" aria-label="Directory quickview"><button type="button" data-directory-view="all" aria-pressed="true">All extensions</button><button type="button" data-directory-view="favorites" aria-pressed="false">★ Favorites <span data-favorites-count>—</span></button></div><label for="mytel-team"><span class="mytel-visually-hidden">Team</span><select id="mytel-team"><option value="all">All teams</option></select></label><div class="mytel-display-switch" role="group" aria-label="Directory layout"><button type="button" data-directory-display="cards" aria-pressed="true" title="Card view">▦<span class="mytel-visually-hidden">Cards</span></button><button type="button" data-directory-display="list" aria-pressed="false" title="Compact list">☷<span class="mytel-visually-hidden">List</span></button></div></div>
      <div class="mytel-filters" role="group" aria-label="فیلتر وضعیت داخلی"><button type="button" data-filter="all" aria-pressed="true">همه <span data-filter-count="all">—</span></button><button type="button" data-filter="online" aria-pressed="false">آنلاین <span data-filter-count="online">—</span></button><button type="button" data-filter="busy" aria-pressed="false">در مکالمه <span data-filter-count="busy">—</span></button><button type="button" data-filter="offline" aria-pressed="false">آفلاین <span data-filter-count="offline">—</span></button></div>
      <div class="mytel-directory-feedback" data-directory-feedback role="status">در حال دریافت داخلی‌ها…</div>
      <div class="mytel-directory-panels">
      {{#view App.BaseSortableView}}
        {{#view App.PBXPanelView controllerBinding="extensions" class="mytel-extension-panel mytel-default-panel"}}
          <dt class="mytel-group-title">داخلی‌های مرکز تلفن</dt>
          <dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
        __AREAS__
      {{/view}}
      </div>
      <div class="mytel-directory-bottom"><span><span class="mytel-legend-dot available"></span> آماده <span class="mytel-legend-dot busy"></span> مکالمه <span class="mytel-legend-dot ringing"></span> زنگ <span class="mytel-legend-dot offline"></span> آفلاین</span><span data-results></span></div>
    </section>
    <aside class="mytel-side-column" aria-label="صف‌ها و منابع مرکز تلفن">
      <section class="mytel-surface mytel-queues"><div class="mytel-section-heading"><div><h2>صف‌های تماس <span class="mytel-call-count" data-queue-count>—</span></h2><p>پاسخ‌گویی و وضعیت کارشناسان</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
        {{#view App.BaseSortableView}}{{#view App.PBXPanelView controllerBinding="queues" class="mytel-resource-panel"}}{{#if finishedloading}}{{#each}}{{view App.QueueView class="QueueView-large"}}{{else}}<p class="mytel-empty">صفی برای نمایش وجود ندارد.</p>{{/each}}{{else}}<p class="mytel-empty">در حال دریافت صف‌ها…</p>{{/if}}{{/view}}{{/view}}
      </section>
      <section class="mytel-surface mytel-agents" aria-labelledby="mytel-agents-title"><div class="mytel-section-heading"><div><h2 id="mytel-agents-title">Live agents <span class="mytel-call-count" data-agent-count>—</span></h2><p>Queue membership, availability and pause state</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div><div data-agent-workspace><p class="mytel-empty">Waiting for agent data…</p></div></section>
      <section class="mytel-surface mytel-trunks"><div class="mytel-section-heading"><div><h2>IP trunks <span class="mytel-call-count" data-trunk-count>—</span></h2><p>Observed connection status and active channels</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>{{#view App.BaseSortableView}}{{#view App.PBXPanelView controllerBinding="iptrunks" class="mytel-resource-panel"}}{{#if finishedloading}}{{#each}}{{view App.IPTrunkView class="mytel-iptrunk-card"}}{{else}}<p class="mytel-empty mytel-empty-small">No trunks to display.</p>{{/each}}{{else}}<p class="mytel-empty mytel-empty-small">Waiting for trunk data…</p>{{/if}}{{/view}}{{/view}}</section>
      <section class="mytel-surface mytel-resources"><div class="mytel-section-heading"><div><h2>منابع مرکز تلفن</h2><p>ترانک‌ها، کنفرانس و پارک تماس</p></div></div>
        {{#view App.BaseSortableView}}
          {{#view App.PBXPanelView controllerBinding="conferences" class="mytel-resource-panel"}}<h3>کنفرانس‌ها</h3>{{#if finishedloading}}{{#each}}{{view App.ConferenceView class="ConferenceView-large"}}{{else}}<p class="mytel-empty mytel-empty-small">کنفرانسی تعریف نشده است.</p>{{/each}}{{/if}}{{/view}}
          {{#view App.PBXPanelView controllerBinding="parkinglots" class="mytel-resource-panel"}}<details class="mytel-parking-collapse"><summary><span>پارک تماس</span><span class="mytel-parking-count">{{#if finishedloading}}{{length}} slots{{else}}Loading…{{/if}}</span></summary>{{#if finishedloading}}<div class="parkinglots-list">{{#each}}{{view App.ParkinglotView class="ParkinglotView-large"}}{{else}}<p class="mytel-empty mytel-empty-small">پارک تماسی تعریف نشده است.</p>{{/each}}</div>{{/if}}</details>{{/view}}
          {{#view App.PBXPanelView controllerBinding="dahdi" class="mytel-resource-panel mytel-dahdi"}}{{#if length}}<h3>خطوط DAHDI</h3>{{#each}}{{view App.DAHDISpanView}}{{/each}}{{/if}}{{/view}}
        {{/view}}
      </section>
    </aside>
  </div>
  <dialog id="mytel-extension-inspector" class="mytel-inspector" aria-labelledby="mytel-inspector-title"><div class="mytel-inspector-heading"><div><p class="mytel-eyebrow">LIVE WORKSPACE</p><h2 id="mytel-inspector-title">Extension details</h2></div><button type="button" class="mytel-icon-button" data-action="close-inspector" aria-label="Close details">×</button></div><div data-inspector-content></div></dialog>
  <dialog id="mytel-advanced-dialog" class="mytel-advanced-dialog" aria-labelledby="mytel-advanced-title"><div class="mytel-advanced-heading"><div><h2 id="mytel-advanced-title">Advanced operator console</h2><p>Uses the installed console’s own login and licensed features. No credentials are forwarded.</p></div><button type="button" class="mytel-icon-button" data-action="close-advanced" aria-label="Close advanced console">×</button></div><div data-advanced-frame-host></div><div class="mytel-advanced-footer"><a data-advanced-fallback target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a><button type="button" class="mytel-secondary-button" data-action="close-advanced">Back to live calls</button></div></dialog>
  <footer class="mytel-footer"><span>MyTel Operation · Issabel</span><a href="https://mytel.one" target="_blank" rel="noopener noreferrer">mytel.one <span aria-hidden="true">↗</span></a></footer>
</div>
{/literal}
</script>

<script type="text/x-handlebars" data-template-name="extension">
{literal}
<div class="mytel-extension-body" {{bindAttr data-extension="extension" data-description="description" data-status="trunkstate"}}>
  <div class="mytel-extension-top"><span class="mytel-extension-number" dir="ltr">{{extension}}</span><span class="mytel-extension-state">{{#if registered}}آنلاین{{else}}آفلاین{{/if}}</span></div>
  <div class="mytel-extension-name">{{description}}</div>
  <div class="mytel-extension-activity">{{#each active}}<span class="monitor" {{bindAttr title="Channel"}}><span dir="ltr">{{remoteExten}}</span><time dir="ltr">{{formatSince}}</time></span>{{else}}<span class="mytel-idle-label">{{#if registered}}آماده ارتباط{{else}}ثبت‌نشده{{/if}}</span>{{/each}}</div>
  <div class="mytel-extension-tools"><button type="button" class="mytel-favorite-button" data-action="favorite" aria-pressed="false" aria-label="Add extension to favorites">☆</button><span class="phone-icon" title="برای برقراری تماس، آیکون تلفن را روی مقصد بکشید">{{view App.DraggablePhoneIconView iconBinding="view.extensionIcon"}}</span>{{#if unreadMail}}<span class="mytel-mail" title="پیام صوتی جدید">✉ {{NewMessages}}</span>{{/if}}<a class="pbxtooltip mytel-info" href="#" aria-label="جزئیات داخلی"><span aria-hidden="true">i</span><div>{{channel}}<br>{{description}}{{#if registered}}<br><span dir="ltr">{{ip}}</span>{{/if}}</div></a></div>
</div>
{/literal}
</script>

<script type="text/x-handlebars" data-template-name="queue">
{literal}
<div class="Queue-Container">
  <div class="mytel-queue-heading"><div><span class="mytel-queue-number" dir="ltr">{{extension}}</span><strong>{{description}}</strong></div><span class="mytel-waiting-badge">{{callers.length}} منتظر</span></div>
  <div class="queueParameters"><span class="answered">پاسخ‌شده: {{Completed}}</span><span class="abandoned">بی‌پاسخ: {{Abandoned}}</span></div>
  <div class="mytel-queue-summary" data-queue-metrics></div><p class="mytel-queue-period">Since last PBX statistics reset</p>
  <div class="Queue-Container-Agent-Client"><div class="Queue-Agents"><p class="mytel-empty mytel-empty-small">در حال دریافت کارشناسان…</p></div><div class="mytel-queue-callers"><h4>تماس‌های منتظر</h4>{{#each callers}}<div class="mytel-caller"><span aria-hidden="true">◷</span><span dir="ltr">{{CallerIDNum}}</span></div>{{else}}<p class="mytel-empty mytel-empty-small">تماسی در انتظار نیست.</p>{{/each}}</div></div>
</div>
{/literal}
</script>

<script type="text/x-handlebars" data-template-name="iptrunk">{literal}<div class="mytel-resource mytel-iptrunk"><span class="mytel-resource-icon" aria-hidden="true">⇄</span><div><strong dir="ltr">{{channel}}</strong><span class="mytel-resource-state">{{#if registered}}متصل{{else}}ثبت‌نشده{{/if}}</span><span class="mytel-resource-ip">{{#if ip}}{{ip}}{{else}}IP not reported{{/if}} · {{active.length}} active channels</span>{{#each active}}<span class="monitor" dir="ltr">{{CallerIDNum}} · {{formatSince}}</span>{{/each}}</div></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="conference">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">♧</span><div><strong>{{extension}} · {{description}}</strong><span>{{callers.length}} شرکت‌کننده {{#if callers}}· {{formatSince}}{{/if}}</span></div>{{view App.DroppableIconView icon="{/literal}modules/{$module_name}/images/conference.png{literal}"}}</div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="parkinglot">{literal}<div class="mytel-resource" {{bindAttr data-parking-slot="extension"}}><span class="mytel-resource-icon" aria-hidden="true">P</span><div><strong>پارک {{extension}}</strong><span data-parking-state>{{#if shortchannel}}{{shortchannel}} · {{formatTimeout}}{{else}}State not reported{{/if}}</span><span class="mytel-parking-guidance" data-parking-guidance></span><div data-parking-actions></div></div><img class="icon mytel-parking-static-icon" src="{/literal}modules/{$module_name}/images/parking.png{literal}" alt=""></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="dahdispan">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">⇄</span><div><strong dir="ltr">DAHDI/{{span}}</strong><span dir="ltr">{{formatChanRange}}</span></div></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="editable-title">{literal}{{#if editing}}{{view Ember.TextField valueBinding="description"}}<button type="button" {{action "save" bubbles=false}}>ذخیره</button>{{else}}<span>{{description}}</span><span class="mytel-group-count">{{length}}</span><button type="button" class="paneledittitle" {{action "edit" bubbles=false}}>ویرایش نام</button>{{/if}}{/literal}</script>
</div>
<script type="text/javascript">var arrLang_main = {$ARRLANG_MAIN}; var var_init = {$VAR_INIT};</script>
<script src="modules/{$module_name}/themes/default/js/mytel-ui.js?v=2.1.0" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-call-model.js?v=2.1.0" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-calls.js?v=2.1.0" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-queue-controls.js?v=2.1.0" defer></script>
'''

areas = []
for number in range(1, 10):
    areas.append('''{{#view App.PBXPanelView controllerBinding="areaN" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}'''.replace('areaN', 'area' + str(number)))
template = template.replace('__AREAS__', '\n'.join(areas))

translations = {
    'تازه‌سازی اطلاعات': 'Refresh status', 'در حال اتصال': 'Connecting',
    'فضای کار اپراتور': 'OPERATOR WORKSPACE', 'مرکز کنترل تماس': 'Call control center',
    'وضعیت داخلی‌ها و صف‌های مرکز تلفن، در یک نگاه': 'Your extensions and call queues, at a glance',
    'در انتظار دریافت اطلاعات': 'Waiting for data', 'تلاش دوباره': 'Retry connection',
    'خلاصه وضعیت مرکز تلفن': 'PBX status overview', 'داخلی آنلاین': 'Online extensions',
    'آماده ارتباط': 'Available', 'داخلی در مکالمه': 'Extensions in call',
    'مکالمه فعال': 'Active conversation', 'تماس در انتظار': 'Calls waiting',
    'در صف پاسخ‌گویی': 'Waiting for an agent', 'داخلی آفلاین': 'Offline extensions',
    'ثبت‌نشده': 'Unregistered', 'داخلی‌ها': 'Extensions', 'داخلی در مرکز تلفن': 'extensions in your PBX',
    'جستجوی نام یا شماره داخلی…': 'Search name or extension…',
    'جستجوی نام یا شماره داخلی': 'Search name or extension', 'گروه‌ها': 'Groups',
    'فیلتر وضعیت داخلی': 'Filter extensions by status', 'در مکالمه': 'In call',
    'همه': 'All', 'آنلاین': 'Online', 'آفلاین': 'Offline',
    'در حال دریافت داخلی‌ها…': 'Loading extensions…', 'داخلی‌های مرکز تلفن': 'PBX extensions',
    'داخلی را به این گروه بکشید.': 'Drag an extension into this group.',
    'صف‌ها و منابع مرکز تلفن': 'Queues and PBX resources', 'صف‌های تماس': 'Call queues',
    'پاسخ‌گویی و وضعیت کارشناسان': 'Queue activity and agent availability',
    'صفی برای نمایش وجود ندارد.': 'No queues to display.', 'در حال دریافت صف‌ها…': 'Loading queues…',
    'منابع مرکز تلفن': 'PBX resources', 'ترانک‌ها، کنفرانس و پارک تماس': 'Trunks, conferences and parking',
    'ترانک‌های IP': 'IP trunks', 'ترانکی برای نمایش وجود ندارد.': 'No trunks to display.',
    'کنفرانس‌ها': 'Conferences', 'کنفرانسی تعریف نشده است.': 'No conferences configured.',
    'پارک تماسی تعریف نشده است.': 'No parking slots configured.', 'پارک تماس': 'Call parking',
    'خطوط DAHDI': 'DAHDI lines', 'مشغول': 'Busy', 'آماده': 'Ready',
    'برای برقراری تماس، آیکون تلفن را روی مقصد بکشید': 'Drag the phone icon onto a destination to place a call', 'پیام صوتی جدید': 'New voicemail',
    'جزئیات داخلی': 'Extension details', 'بی‌پاسخ': 'Abandoned', 'پاسخ‌شده': 'Answered',
    'در حال دریافت کارشناسان…': 'Loading agents…', 'تماس‌های منتظر': 'Waiting callers',
    'تماسی در انتظار نیست.': 'No callers waiting.', 'شرکت‌کننده': 'participants',
    'ویرایش نام': 'Rename', 'ذخیره': 'Save', 'متصل': 'Connected', 'منتظر': 'waiting',
    'مکالمه': 'In call', 'زنگ': 'Ringing', 'آزاد': 'Available', 'پارک ': 'Park ',
}
for variant, language in [('control_panel', 'fa'), ('control_panel_en', 'en')]:
    output = template
    if language == 'en':
        output = output.replace('dir="rtl" data-language="fa"', 'dir="ltr" data-language="en"')
        for source in sorted(translations, key=len, reverse=True):
            output = output.replace(source, translations[source])
    (ROOT / variant / 'themes/default/panel.tpl').write_text(output, encoding='utf-8', newline='\n')
