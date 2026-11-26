/* Evaluate on preview.html?state=connected&role=observer. */
async () => {
    const fixtureLocation=new URL(window.location.href);if(!['127.0.0.1','localhost'].includes(fixtureLocation.hostname) || fixtureLocation.pathname!=='/artifacts/ui/preview.html' || !Array.isArray(window.fixtureActionLog) || !window.var_init || window.var_init.CSRF_TOKEN!=='synthetic-fixture-only')throw new Error('This browser action test is restricted to the local synthetic fixture.');
    const checks=[];const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};await new Promise(resolve=>setTimeout(resolve,1200));
    assert(document.querySelector('[data-access-summary]').textContent.includes('Monitoring only'),'Observer account receives a clear read-only explanation');
    assert(document.querySelector('#controlPanelApplication').getAttribute('data-can-call')==='false' && [...document.querySelectorAll('.phone-icon')].every(icon=>icon.getAttribute('aria-disabled')==='true'),'Legacy phone drag controls are marked read-only');
    assert(document.querySelector('[data-action=groups]').hidden,'Layout organization is hidden without layout permission');
    document.querySelector('.ExtensionStyle[data-idattr="PJSIP/202"]').click();
    const dialog=document.querySelector('dialog');
    assert(!dialog.querySelector('[data-action=callback]') && !dialog.querySelector('[data-action=end-call]') && !dialog.querySelector('[data-control-kind=transfer]') && !dialog.querySelector('[data-control-kind=park]'),'Observer can inspect the live call without receiving mutation controls');
    dialog.querySelector('[data-action=close-inspector]').click();await new Promise(resolve=>setTimeout(resolve,0));
    document.querySelector('.ExtensionStyle[data-idattr="PJSIP/203"]').click();assert(!dialog.querySelector('[data-action=pickup-call]'),'Pickup capability alone cannot bypass account permission');dialog.querySelector('[data-action=close-inspector]').click();
    assert([...document.querySelectorAll('[data-agent-workspace] .mytel-agent-action')].every(button=>button.disabled || !button.getClientRects().length),'Agent module keeps queue memberships read-only for observers');
    assert(document.querySelectorAll('[data-live-call-rows] tr').length===5,'Observer still sees all observed calls');
    assert(!document.querySelector('[data-action=open-advanced]') && !document.querySelector('[data-advanced-frame-host] iframe'),'An observer without an authorized advanced-console tool receives no embed control');
    const forged=document.createElement('button');forged.dataset.action='open-advanced';document.querySelector('#controlPanelApplication').appendChild(forged);forged.click();forged.remove();assert(!document.querySelector('#mytel-advanced-dialog').open && !document.querySelector('[data-advanced-frame-host] iframe'),'A forged client-side click cannot create an unauthorized advanced-console iframe');
    assert(fixtureActionLog.length===0,'Observer interactions send no mutation requests');
    assert(!localStorage.getItem('mytel.directory.control_panel.fixture-observer') || !JSON.parse(localStorage.getItem('mytel.directory.control_panel.fixture-observer')).favorites.includes('201'),'Observer preferences do not inherit another account’s favorites');
    assert(document.documentElement.scrollWidth<=innerWidth,'Observer view has no horizontal page overflow');
    return {passed:checks.length,checks,viewport:[innerWidth,innerHeight]};
}
