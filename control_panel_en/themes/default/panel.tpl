<div id="controlPanelApplication" dir="ltr" data-language="en">
<link rel="stylesheet" href="modules/{$module_name}/themes/default/css/mytel.css?v=2.0.0">
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
      <span class="mytel-connection" data-connection="connecting" role="status"><span class="mytel-status-dot"></span><span data-connection-label>Connecting</span></span>
      <button type="button" class="mytel-icon-button" data-action="retry" aria-label="Refresh status" title="Refresh status"><span aria-hidden="true">↻</span></button>
    </div>
  </header>
  <div class="mytel-page-heading">
    <div><p class="mytel-eyebrow">OPERATOR WORKSPACE</p><h1>Call control center</h1><p class="mytel-description">Your extensions and call queues, at a glance</p></div>
    <div class="mytel-update"><span class="mytel-live-dot"></span><span data-updated>Waiting for data</span></div>
  </div>
  <div class="mytel-operator-controls"><label for="mytel-source-extension">My extension <select id="mytel-source-extension" aria-describedby="mytel-callback-note"><option value="">Choose extension</option></select></label><p id="mytel-callback-note">Callback calls ring your extension first.</p></div>
  <div class="mytel-banner" data-banner role="status" hidden><span data-banner-text></span><button type="button" data-action="retry">Retry connection</button></div>
  <section class="mytel-metrics" aria-label="PBX status overview">
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-green" aria-hidden="true">↗</span><div><span class="mytel-metric-label">Online extensions</span><strong data-metric="online">—</strong></div><span class="mytel-metric-caption">Available</span></div>
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-blue" aria-hidden="true">◉</span><div><span class="mytel-metric-label">Extensions in call</span><strong data-metric="busy">—</strong></div><span class="mytel-metric-caption">Active conversation</span></div>
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-amber" aria-hidden="true">◷</span><div><span class="mytel-metric-label">Calls waiting</span><strong data-metric="waiting">—</strong></div><span class="mytel-metric-caption">Waiting for an agent</span></div>
    <div class="mytel-metric"><span class="mytel-metric-icon mytel-red" aria-hidden="true">↙</span><div><span class="mytel-metric-label">Offline extensions</span><strong data-metric="offline">—</strong></div><span class="mytel-metric-caption">Unregistered</span></div>
  </section>
  <section class="mytel-live-calls mytel-surface" aria-labelledby="mytel-live-title">
    <div class="mytel-section-heading"><div><h2 id="mytel-live-title" tabindex="-1">Live calls <span class="mytel-call-count" data-live-count>—</span></h2><p>Live conversations and ringing calls across your PBX</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
    <div class="mytel-call-toolbar"><label class="mytel-search"><span aria-hidden="true">⌕</span><span class="mytel-visually-hidden">Search calls, callers or extensions</span><input type="search" id="mytel-call-search" placeholder="Search calls, callers or extensions…" autocomplete="off"></label><label class="mytel-call-state-label" for="mytel-call-state">Status <select id="mytel-call-state"><option value="all">All calls</option><option value="ringing">Ringing</option><option value="waiting">Waiting</option><option value="in-call">In call</option><option value="hold">On hold</option><option value="dialing">Dialing</option><option value="busy">Busy</option><option value="down">Down</option><option value="off-hook">Off hook</option><option value="pre-ring">Pre-ring</option><option value="reported">Other reported state</option><option value="unknown">Not reported</option></select></label></div>
    <div class="mytel-table-scroll"><table class="mytel-call-table"><thead><tr><th scope="col">Extension / channel</th><th scope="col">Caller</th><th scope="col">Connected party</th><th scope="col">Status</th><th scope="col">Elapsed</th><th scope="col">Queue</th><th scope="col"><span class="mytel-visually-hidden">Details</span></th></tr></thead><tbody data-live-call-rows></tbody></table></div>
    <p class="mytel-call-empty" data-live-empty role="status">Loading live calls…</p><div class="mytel-call-footnote"><span data-live-results></span><span>Elapsed includes ringing. Answered time is available in call details when reported.</span></div>
  </section>
  <div class="mytel-workspace-grid">
    <section class="mytel-directory mytel-surface" aria-labelledby="mytel-directory-title">
      <div class="mytel-section-heading"><div><h2 id="mytel-directory-title">Extensions</h2><p><span data-total>—</span> extensions in your PBX</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
      <div class="mytel-directory-toolbar"><label class="mytel-search"><span aria-hidden="true">⌕</span><span class="mytel-visually-hidden">Search name or extension</span><input type="search" id="mytel-search" autocomplete="off" placeholder="Search name or extension…"></label><button type="button" class="mytel-secondary-button" data-action="groups" aria-pressed="false">Groups</button></div>
      <div class="mytel-filters" role="group" aria-label="Filter extensions by status"><button type="button" data-filter="all" aria-pressed="true">All <span data-filter-count="all">—</span></button><button type="button" data-filter="online" aria-pressed="false">Online <span data-filter-count="online">—</span></button><button type="button" data-filter="busy" aria-pressed="false">In call <span data-filter-count="busy">—</span></button><button type="button" data-filter="offline" aria-pressed="false">Offline <span data-filter-count="offline">—</span></button></div>
      <div class="mytel-directory-feedback" data-directory-feedback role="status">Loading extensions…</div>
      <div class="mytel-directory-panels">
      {{#view App.BaseSortableView}}
        {{#view App.PBXPanelView controllerBinding="extensions" class="mytel-extension-panel mytel-default-panel"}}
          <dt class="mytel-group-title">PBX extensions</dt>
          <dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
        {{#view App.PBXPanelView controllerBinding="area1" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area2" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area3" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area4" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area5" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area6" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area7" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area8" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
{{#view App.PBXPanelView controllerBinding="area9" class="mytel-extension-panel mytel-area-panel"}}
          {{view App.EditableTitleView}}<dd><div class="Extensions-List">{{#if finishedloading}}{{#view App.SortablePanelView}}{{#each}}{{view App.ExtensionView}}{{else}}<p class="mytel-empty mytel-empty-small">Drag an extension into this group.</p>{{/each}}{{/view}}{{/if}}</div></dd>
        {{/view}}
      {{/view}}
      </div>
      <div class="mytel-directory-bottom"><span><span class="mytel-legend-dot available"></span> Ready <span class="mytel-legend-dot busy"></span> In call <span class="mytel-legend-dot ringing"></span> Ringing <span class="mytel-legend-dot offline"></span> Offline</span><span data-results></span></div>
    </section>
    <aside class="mytel-side-column" aria-label="Queues and PBX resources">
      <section class="mytel-surface mytel-queues"><div class="mytel-section-heading"><div><h2>Call queues <span class="mytel-call-count" data-queue-count>—</span></h2><p>Queue activity and agent availability</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div>
        {{#view App.BaseSortableView}}{{#view App.PBXPanelView controllerBinding="queues" class="mytel-resource-panel"}}{{#if finishedloading}}{{#each}}{{view App.QueueView class="QueueView-large"}}{{else}}<p class="mytel-empty">No queues to display.</p>{{/each}}{{else}}<p class="mytel-empty">Loading queues…</p>{{/if}}{{/view}}{{/view}}
      </section>
      <section class="mytel-surface mytel-resources"><div class="mytel-section-heading"><div><h2>PBX resources</h2><p>Trunks, conferences and parking</p></div></div>
        {{#view App.BaseSortableView}}
          {{#view App.PBXPanelView controllerBinding="iptrunks" class="mytel-resource-panel"}}<h3>IP trunks</h3>{{#if finishedloading}}{{#each}}{{view App.IPTrunkView}}{{else}}<p class="mytel-empty mytel-empty-small">No trunks to display.</p>{{/each}}{{/if}}{{/view}}
          {{#view App.PBXPanelView controllerBinding="conferences" class="mytel-resource-panel"}}<h3>Conferences</h3>{{#if finishedloading}}{{#each}}{{view App.ConferenceView class="ConferenceView-large"}}{{else}}<p class="mytel-empty mytel-empty-small">No conferences configured.</p>{{/each}}{{/if}}{{/view}}
          {{#view App.PBXPanelView controllerBinding="parkinglots" class="mytel-resource-panel"}}<h3>Call parking</h3>{{#if finishedloading}}<div class="parkinglots-list">{{#each}}{{view App.ParkinglotView class="ParkinglotView-large"}}{{else}}<p class="mytel-empty mytel-empty-small">No parking slots configured.</p>{{/each}}</div>{{/if}}{{/view}}
          {{#view App.PBXPanelView controllerBinding="dahdi" class="mytel-resource-panel mytel-dahdi"}}{{#if length}}<h3>DAHDI lines</h3>{{#each}}{{view App.DAHDISpanView}}{{/each}}{{/if}}{{/view}}
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
  <div class="mytel-extension-top"><span class="mytel-extension-number" dir="ltr">{{extension}}</span><span class="mytel-extension-state">{{#if registered}}{{#if active}}Busy{{else}}Ready{{/if}}{{else}}Offline{{/if}}</span></div>
  <div class="mytel-extension-name">{{description}}</div>
  <div class="mytel-extension-activity">{{#each active}}<span class="monitor" {{bindAttr title="Channel"}}><span dir="ltr">{{remoteExten}}</span><time dir="ltr">{{formatSince}}</time></span>{{else}}<span class="mytel-idle-label">{{#if registered}}Available{{else}}Unregistered{{/if}}</span>{{/each}}</div>
  <div class="mytel-extension-tools"><span class="phone-icon" title="Drag the phone icon onto a destination to place a call">{{view App.DraggablePhoneIconView iconBinding="view.extensionIcon"}}</span>{{#if unreadMail}}<span class="mytel-mail" title="New voicemail">✉ {{NewMessages}}</span>{{/if}}<a class="pbxtooltip mytel-info" href="#" aria-label="Extension details"><span aria-hidden="true">i</span><div>{{channel}}<br>{{description}}{{#if registered}}<br><span dir="ltr">{{ip}}</span>{{/if}}</div></a></div>
</div>
{/literal}
</script>

<script type="text/x-handlebars" data-template-name="queue">
{literal}
<div class="Queue-Container">
  <div class="mytel-queue-heading"><div><span class="mytel-queue-number" dir="ltr">{{extension}}</span><strong>{{description}}</strong></div><span class="mytel-waiting-badge">{{callers.length}} waiting</span></div>
  <div class="queueParameters"><span class="answered">Answered: {{Completed}}</span><span class="abandoned">Abandoned: {{Abandoned}}</span></div>
  <div class="mytel-queue-summary" data-queue-metrics></div><p class="mytel-queue-period">Since last PBX statistics reset</p>
  <div class="Queue-Container-Agent-Client"><div class="Queue-Agents"><p class="mytel-empty mytel-empty-small">Loading agents…</p></div><div class="mytel-queue-callers"><h4>Waiting callers</h4>{{#each callers}}<div class="mytel-caller"><span aria-hidden="true">◷</span><span dir="ltr">{{CallerIDNum}}</span></div>{{else}}<p class="mytel-empty mytel-empty-small">No callers waiting.</p>{{/each}}</div></div>
</div>
{/literal}
</script>

<script type="text/x-handlebars" data-template-name="iptrunk">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">⇄</span><div><strong dir="ltr">{{channel}}</strong><span>{{#if registered}}Connected{{else}}Unregistered{{/if}}</span>{{#each active}}<span class="monitor" dir="ltr">{{CallerIDNum}} · {{formatSince}}</span>{{/each}}</div></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="conference">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">♧</span><div><strong>{{extension}} · {{description}}</strong><span>{{callers.length}} participants {{#if callers}}· {{formatSince}}{{/if}}</span></div>{{view App.DroppableIconView icon="{/literal}modules/{$module_name}/images/conference.png{literal}"}}</div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="parkinglot">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">P</span><div><strong>Park {{extension}}</strong><span>{{#if shortchannel}}{{shortchannel}} · {{formatTimeout}}{{else}}Available{{/if}}</span></div>{{view App.DroppableIconView icon="{/literal}modules/{$module_name}/images/parking.png{literal}"}}</div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="dahdispan">{literal}<div class="mytel-resource"><span class="mytel-resource-icon" aria-hidden="true">⇄</span><div><strong dir="ltr">DAHDI/{{span}}</strong><span dir="ltr">{{formatChanRange}}</span></div></div>{/literal}</script>
<script type="text/x-handlebars" data-template-name="editable-title">{literal}{{#if editing}}{{view Ember.TextField valueBinding="description"}}<button type="button" {{action "save" bubbles=false}}>Save</button>{{else}}<span>{{description}}</span><span class="mytel-group-count">{{length}}</span><button type="button" class="paneledittitle" {{action "edit" bubbles=false}}>Rename</button>{{/if}}{/literal}</script>
</div>
<script type="text/javascript">var arrLang_main = {$ARRLANG_MAIN}; var var_init = {$VAR_INIT};</script>
<script src="modules/{$module_name}/themes/default/js/mytel-ui.js?v=2.0.0" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-call-model.js?v=2.0.0" defer></script>
<script src="modules/{$module_name}/themes/default/js/mytel-calls.js?v=2.0.0" defer></script>
