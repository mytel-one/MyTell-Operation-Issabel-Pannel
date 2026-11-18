/* Run this function with browser evaluate on the synthetic connected fixture. */
async () => {
    if (!['127.0.0.1', 'localhost'].includes(location.hostname) ||
        !location.pathname.endsWith('/artifacts/ui/preview.html') ||
        !Array.isArray(window.fixtureActionLog) || typeof window.fixtureState !== 'function') {
        throw new Error('These action tests run only on the local synthetic fixture.');
    }
    const results=[];
    const assert=(condition,message)=>{if(!condition)throw new Error(message);results.push(message);};
    const pause=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
    await pause(1200);
    const root=document.querySelector('#controlPanelApplication');
    assert(document.querySelectorAll('[data-live-call-rows] tr').length===5,'Five conversations include a two-leg call, simultaneous calls and an unassigned queued channel');
    assert(document.querySelectorAll('.mytel-call-state.waiting').length===1,'Explicit queue waiting state takes precedence over the PBX channel Up state');
    const source=document.querySelector('#mytel-source-extension');source.value='201';source.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('.ExtensionStyle[data-idattr="PJSIP/202"]').click();
    const dialog=document.querySelector('#mytel-extension-inspector');
    assert(dialog.open,'Clicking an extension opens its accessible inspector');
    assert(dialog.querySelectorAll('.mytel-inspector-call').length===2,'Inspector keeps every active call on a multi-call extension');
    let details=dialog.querySelector('details');details.open=true;let summary=details.querySelector('summary');summary.focus();
    const firstRowControl=document.querySelector('[data-live-call-rows] button');
    debug_root.extensions[1].active.forEach(call=>call.answered_seconds=(call.answered_seconds||0)+1);
    debug_root.latestSnapshot.live_calls.forEach(call=>call.channels.forEach(channel=>channel.answered_seconds=(channel.answered_seconds||0)+1));
    window.dispatchEvent(new CustomEvent('mytel:snapshot',{detail:debug_root.latestSnapshot}));await pause(80);
    assert(document.activeElement===summary && details.open,'Clock-only updates preserve inspector focus and expanded channel details');
    assert(document.querySelector('[data-live-call-rows] button')===firstRowControl,'Clock-only updates preserve table controls');
    debug_root.extensions[1].description='Alex Morgan — updated';window.dispatchEvent(new CustomEvent('mytel:snapshot',{detail:debug_root.latestSnapshot}));await pause(80);
    details=dialog.querySelector('details');summary=details.querySelector('summary');
    assert(details.open && document.activeElement===summary,'Actual model updates restore the focused control and expanded channel details');
    window.__mytelXssProbe=0;const hostile='<img src=x onerror="window.__mytelXssProbe=1">';
    debug_root.extensions[1].active[0].CallerIDName=hostile;
    window.dispatchEvent(new CustomEvent('mytel:snapshot',{detail:debug_root.latestSnapshot}));await pause(80);
    assert(dialog.textContent.includes(hostile) && window.__mytelXssProbe===0 && !dialog.querySelector('img[src=x]'),'Caller-controlled text remains text and cannot create executable markup');
    const before=fixtureActionLog.length;
    dialog.querySelector('[data-action=callback]').click();
    assert(dialog.querySelector('[data-action=callback]').disabled,'Pending callback disables repeated submissions');
    dialog.querySelector('[data-action=close-inspector]').click();await pause(0);
    document.querySelector('.ExtensionStyle[data-idattr="PJSIP/205"]').click();
    const second=dialog.querySelector('[data-action=callback]');
    assert(second.disabled,'Closing and reopening another extension cannot bypass the in-flight action lock');
    second.click();assert(fixtureActionLog.length===before+1,'Only one callback request is sent while a request is pending');
    await pause(400);
    assert(!dialog.querySelector('.mytel-action-feedback').textContent.includes('Call requested'),'Action results stay associated with the requested extension');
    dialog.querySelector('[data-action=close-inspector]').click();await pause(0);
    document.querySelector('.ExtensionStyle[data-idattr="PJSIP/202"]').click();
    assert(dialog.querySelector('.mytel-action-feedback').textContent.includes('Call requested'),'The requested extension retains its action result');
    const originalConfirm=window.confirm;window.confirm=()=>true;
    dialog.querySelectorAll('[data-action=end-call]')[1].click();window.confirm=originalConfirm;
    const ended=fixtureActionLog[fixtureActionLog.length-1];
    assert(ended.action==='hangupChannel' && ended.channel==='PJSIP/202-000000b' && ended.uniqueid==='1700000000.102','Ending one of multiple calls sends its exact observed channel and unique ID');
    await pause(400);
    dialog.querySelector('[data-action=close-inspector]').click();
    const input=document.querySelector('#mytel-call-search');input.value='+12025550105';input.dispatchEvent(new Event('input',{bubbles:true}));
    assert(document.querySelectorAll('[data-live-call-rows] tr').length===1,'Global call search filters by remote caller');
    input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
    const status=document.querySelector('#mytel-call-state');status.value='hold';status.dispatchEvent(new Event('change',{bubbles:true}));
    assert(document.querySelectorAll('[data-live-call-rows] tr').length===1,'Call status filter isolates the actually reported hold state');
    status.value='all';status.dispatchEvent(new Event('change',{bubbles:true}));
    debug_root.latestSnapshot.live_calls=[];window.dispatchEvent(new CustomEvent('mytel:snapshot',{detail:debug_root.latestSnapshot}));await pause(80);
    assert(document.querySelectorAll('[data-live-call-rows] tr').length===0 && !document.querySelector('[data-live-empty]').hidden,'A complete empty snapshot removes stale rows and shows the empty state');
    return {passed:results.length,checks:results,viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth};
}
