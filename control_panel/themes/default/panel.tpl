<div id="controlPanelApplication" dir="rtl" data-language="fa">
<link rel="stylesheet" href="modules/{$module_name}/themes/default/css/mytel.css?v=2.0.1">
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
  <div class="mytel-operator-controls"><label for="mytel-source-extension">My extension <select id="mytel-source-extension" aria-describedby="mytel-callback-note"><option value="">Choose extension</option></select></label><p id="mytel-callback-note">Callback calls ring your extension first.</p></div>
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
      <div class="mytel-filters" role="group" aria-label="فیلتر وضعیت داخلی"><button type="button" data-filter="all" aria-pressed="true">همه <span data-filter-count="all">—</span></button><button type="button" data-filter="online" aria-pressed="false">آنلاین <span data-filter-count="online">—</span></button><button type="button" data-filter="busy" aria-pressed="false">در مکالمه <span data-filter-count="busy">—</span></button><button type="button" data-filter="offline" aria-pressed="false">آفلاین <span data-filter-count="offline">—</span></button></div>
      <div class="mytel-directory-feedback" data-directory-feedback role="status">در حال دریافت داخلی‌ها…</div>
      <div class="mytel-directory-panels">
      {{#view App.BaseSortableView}}
        {{#view App.PBXPanelView controllerBinding="extensions" class="mytel-extension-panel mytel-default-panel"}}
          <dt class="mytel-group-title">داخلی‌های مرکز تلفن</dt>
          <dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
        {{#view App.PBXPanelView controllerBinding="area1" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area2" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area3" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area4" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area5" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area6" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area7" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area8" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area9" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">داخلی را به این گروه بکشید.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
      {{/view}}
      </div>
      <div class="mytel-directory-bottom"><span><span class="mytel-legend-dot available"></span> آماده <span class="mytel-legend-dot busy"></span> مکالمه <span class="mytel-legend-dot ringing"></span> زنگ <span class="mytel-legend-dot offline"></span> آفلاین</span><span data-results></span></div>
    </section>
    <aside class="mytel-side-column" aria-label="صف‌ها و منابع مرکز تلفن">
      <section class="mytel-surface mytel-queues"><div class="mytel-section-heading"><div><h2>صف‌های تماس <span class="mytel-call-count" data-queue-count>—</span></h2><p>پاسخ‌گویی و وضعیت کارشناسان</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
        {{#view App.BaseSortableView}}{{#view App.PBXPanelView controllerBinding="queues" class="mytel-resource-panel"}}{{#if finishedloading}}{{#each}}{{view App.QueueView class="QueueView-large"}}{{else}}<p class="mytel-empty">صفی برای نمایش وجود ندارد.</p>{{/each}}{{else}}<p class="mytel-empty">در حال دریافت صف‌ها…</p>{{/if}}{{/view}}{{/view}}
      </section>
      <section class="mytel-surface mytel-resources"><div class="mytel-section-heading"><div><h2>منابع مرکز تلفن</h2><p>ترانک‌ها، کنفرانس و پارک تماس</p></div></div>
        {{#view App.BaseSortableView}}
          {{#view App.PBXPanelView controllerBinding="iptrunks" class="mytel-resource-panel"}}<h3>ترانک‌های IP</h3>{{#if finishedloading}}{{#each}}{{view App.IPTrunkView class="mytel-iptrunk-card"}}{{else}}<p class="mytel-empty mytel-empty-small">ترانکی برای نمایش وجود ندارد.</p>{{/each}}{{/if}}{{/view}}
          {{#view App.PBXPanelView controllerBinding="conferences" class="mytel-resource-panel"}}<h3>کنفرانس‌ها</h3>{{#if finishedloading}}{{#each}}{{view App.ConferenceView class="ConferenceView-large"}}{{else}}<p class="mytel-empty mytel-empty-small">کنفرانسی تعریف نشده است.</p>{{/each}}{{/if}}{{/view}}
          {{#view App.PBXPanelView controllerBinding="parkinglots" class="mytel-resource-panel"}}<details class="mytel-parking-collapse"><summary><span>پارک تماس</span><span class="mytel-parking-count">{{#if finishedloading}}{{length}} slots{{else}}Loading…{{/if}}</span></summary>{{#if finishedloading}}<div class="parkinglots-list">{{#each}}{{view App.ParkinglotView class="ParkinglotView-large"}}{{else}}<p class="mytel-empty mytel-empty-small">پارک تماسی تعریف نشده است.</p>{{/each}}</div>{{/if}}</details>{{/view}}
          {{#view App.PBXPanelView controllerBinding="dahdi" class="mytel-resource-panel mytel-dahdi"}}{{#if length}}<h3>خطوط DAHDI</h3>{{#each}}{{view App.DAHDISpanView}}{{/each}}{{/if}}{{/view}}
        {{/view}}
      </section>
    </aside>
  </div>
  <dialog id="mytel-extension-inspector" class="mytel-inspector" aria-labelledby="mytel-inspector-title"><div class="mytel-inspector-heading"><div><p class="mytel-eyebrow">LIVE WORKSPACE</p><h2 id="mytel-inspector-title">Extension details</h2></div><button type="button" class="mytel-icon-button" data-action="close-inspector" aria-label="Close details">×</button></div><div data-inspector-content></div></dialog>
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
  <div class="mytel-extension-tools"><span class="phone-icon" title="برای برقراری تماس، آیکون تلفن را روی مقصد بکشید">{{view App.DraggablePhoneIconView iconBinding="view.extensionIcon"}}</span>{{#if unreadMail}}<span class="mytel-mail" title="پیام صوتی جدید">✉ {{NewMessages}}</span>{{/if}}<a class="pbxtooltip mytel-info" href="#" aria-label="جزئیات داخلی"><span aria-hidden="true">i</span><div>{{channel}}<br>{{description}}{{#if registered}}<br><span dir="ltr">{{ip}}</span>{{/if}}</div></a></div>
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

<script type="text/x-handlebars" data-template-name="iptrunk">{literal}<div class="mytel-resource mytel-iptrunk"><span class="mytel-resource-icon" aria-hidden="true">⇄</span><div><strong dir="ltr">{{channel}}</strong><span class="mytel-resource-state">{{#if registered}}متصل{{else}}ثبت‌نشده{{/if}}</span>{{#each active}}<span class="monitor" dir="ltr">{{CallerIDNum}} · {{formatSince}}</span>{{/each}}</div></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="conference">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">♧</span><div><strong>{{extension}} · {{description}}</strong><span>{{callers.length}} شرکت‌کننده {{#if callers}}· {{formatSince}}{{/if}}</span></div>{{view App.DroppableIconView icon="{/literal}modules/{$module_name}/images/conference.png{literal}"}}</div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="parkinglot">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">P</span><div><strong>پارک {{extension}}</strong><span>{{#if shortchannel}}{{shortchannel}} · {{formatTimeout}}{{else}}آزاد{{/if}}</span></div>{{view App.DroppableIconView icon="{/literal}modules/{$module_name}/images/parking.png{literal}"}}</div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="dahdispan">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">⇄</span><div><strong dir="ltr">DAHDI/{{span}}</strong><span dir="ltr">{{formatChanRange}}</span></div></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="editable-title">{literal}{{#if editing}}{{view Ember.TextField valueBinding="description"}}<button type="button" {{action "save" bubbles=false}}>ذخیره</button>{{else}}<span>{{description}}</span><span class="mytel-group-count">{{length}}</span><button type="button" class="paneledittitle" {{action "edit" bubbles=false}}>ویرایش نام</button>{{/if}}{/literal}</script>
</div>
<script type="text/javascript">var arrLang_main = {$ARRLANG_MAIN}; var var_init = {$VAR_INIT};</script>
<script src="modules/{$module_name}/themes/default/js/mytel-ui.js?v=2.0.1" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-call-model.js?v=2.0.1" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-calls.js?v=2.0.1" defer></script>
