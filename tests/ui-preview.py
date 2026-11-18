"""Create a clearly synthetic local-only visual fixture, never deployed by install.sh."""
from pathlib import Path
import html
import json
import re
import time

ROOT = Path(__file__).resolve().parents[1]
tpl = (ROOT / 'control_panel_en/themes/default/panel.tpl').read_text(encoding='utf-8')
desktop = re.search(r'data-template-name="desktop">(.*?)</script>', tpl, re.S).group(1)
desktop = desktop.replace('{literal}', '').replace('{/literal}', '').replace('{$module_name}', 'control_panel')
phones = [
    dict(extension='201', description='Reception', registered=True, trunkstate='Down', active=[]),
    dict(extension='202', description='Alex Morgan', registered=True, trunkstate='Up', active=[dict(ChannelStateDesc='Up')]),
    dict(extension='203', description='Sales and customer experience', registered=True, trunkstate='Ringing', active=[dict(ChannelStateDesc='Ringing')]),
    dict(extension='204', description='Accounting', registered=False, trunkstate='Down', active=[]),
    dict(extension='205', description='Management', registered=True, trunkstate='Down', active=[]),
    dict(extension='206', description='Technical support', registered=True, trunkstate='Down', active=[]),
    dict(extension='207', description='Head office', registered=False, trunkstate='Down', active=[]),
    dict(extension='208', description='Customer success', registered=True, trunkstate='Up', active=[dict(ChannelStateDesc='Up')]),
]
now = int(time.time())
def live_leg(channel_name, unique, linked, caller, connected, age, state='Up', held=False, answered_age=None):
    return dict(Channel=channel_name,Uniqueid=unique,Linkedid=linked,CallerIDNum=caller,CallerIDName='Example caller',ConnectedLineNum=connected,ConnectedLineName='Example destination',Since=now-age,ChannelStateDesc=state,answered_at=None if answered_age is None else now-answered_age,on_hold=held,direction=None,Context='from-internal',Extension=connected,Application='Dial',AppData='Synthetic fixture',Readformat='ulaw',Writeformat='ulaw')
phones[1]['active']=[live_leg('PJSIP/202-000000a','1700000000.100','1700000000.100','+12025550104','202',142,answered_age=128),live_leg('PJSIP/202-000000b','1700000000.102','1700000000.102','202','205',35,answered_age=20)]
phones[2]['active']=[live_leg('PJSIP/203-000000d','1700000000.104','1700000000.104','+12025550105','203',12,state='Ringing',held=None)]
phones[4]['active']=[live_leg('PJSIP/205-000000c','1700000000.103','1700000000.102','202','205',34,answered_age=20)]
phones[4]['trunkstate']='Up'
phones[7]['active']=[live_leg('PJSIP/208-000000e','1700000000.105','1700000000.105','+12025550106','208',360,held=True,answered_age=344)]
for phone in phones:
    for call in phone['active']:
        call['direction']={'1700000000.100':'incoming','1700000000.102':'internal','1700000000.104':'incoming','1700000000.105':'outgoing'}.get(call['Linkedid'])
cards = []
for phone in phones:
    phone['channel'] = 'PJSIP/' + phone['extension']
    phone['tech']='PJSIP'
    phone['ip']='192.0.2.'+str(int(phone['extension'][-2:]))
    phone['NewMessages']=0
    activity = '<span class="mytel-idle-label">آماده ارتباط</span>'
    if phone['active']:
        activity=''.join('<span class="monitor" title="'+html.escape(call['Channel'])+'"><span dir="ltr">'+html.escape(call['CallerIDNum'] if call['CallerIDNum']!=phone['extension'] else call['ConnectedLineNum'])+'</span><time dir="ltr">'+str((now-call['Since'])//60).zfill(2)+':'+str((now-call['Since'])%60).zfill(2)+'</time></span>' for call in phone['active'])
    elif not phone['registered']:
        activity = '<span class="mytel-idle-label">ثبت‌نشده</span>'
    cards.append(f'''<div class="pbxelement ExtensionStyle {'pbxactive' if phone['registered'] else ''}" data-idattr="{phone['channel']}"><div class="mytel-extension-body"><div class="mytel-extension-top"><span class="mytel-extension-number" dir="ltr">{phone['extension']}</span><span class="mytel-extension-state">آماده</span></div><div class="mytel-extension-name">{html.escape(phone['description'])}</div><div class="mytel-extension-activity">{activity}</div><div class="mytel-extension-tools"><span class="phone-icon"><img src="../control_panel/images/phhonez0.png" alt=""></span><a class="pbxtooltip mytel-info" href="#" aria-label="جزئیات داخلی"><span>i</span><div>{phone['channel']}<br>{html.escape(phone['description'])}</div></a></div></div></div>''')
directory = '<div class="mytel-directory-panels"><div class="lisortable"><li class="pbxpanel mytel-extension-panel mytel-default-panel"><dd><div class="Extensions-List"><div class="sortablepanelview">' + ''.join(cards) + '</div></div></dd></li></div></div>'
start = desktop.index('<div class="mytel-directory-panels">')
end = desktop.index('<div class="mytel-directory-bottom">')
desktop = desktop[:start] + directory + desktop[end:]
sidebar = '''<aside class="mytel-side-column"><section class="mytel-surface mytel-queues"><div class="mytel-section-heading"><div><h2>صف‌های تماس</h2><p>پاسخ‌گویی و وضعیت کارشناسان</p></div><span class="mytel-section-badge" data-queue-count>—</span></div><div class="mytel-resource-panel"><div class="Queue-Container"><div class="mytel-queue-heading"><div><span class="mytel-queue-number">600</span><strong>پاسخ‌گویی مشتریان</strong></div><span class="mytel-waiting-badge">۲ منتظر</span></div><div class="queueParameters"><span class="answered">پاسخ‌شده: ۲۷</span><span class="abandoned">بی‌پاسخ: ۳</span></div><div class="Queue-Container-Agent-Client"><div class="Queue-Agents"><span><strong>کارشناسان</strong></span><div class="agent-container"><span class="circle green"></span><span>۲۰۱ · پذیرش</span></div><div class="agent-container"><span class="circle orange"></span><span>۲۰۲ · علی کیانی</span></div><div class="agent-container"><span class="circle green"></span><span>۲۰۵ · مدیریت</span></div></div><div class="mytel-queue-callers"><h4>تماس‌های منتظر</h4><div class="mytel-caller"><span>◷</span><span dir="ltr">09123456789</span></div><div class="mytel-caller"><span>◷</span><span dir="ltr">02191018746</span></div></div></div></div></div></section><section class="mytel-surface mytel-resources"><div class="mytel-section-heading"><div><h2>منابع مرکز تلفن</h2><p>ترانک‌ها، کنفرانس و پارک تماس</p></div></div><div class="mytel-resource-panel"><h3>ترانک‌های IP</h3><div class="pbxelement"><div class="mytel-resource"><span class="mytel-resource-icon">⇄</span><div><strong dir="ltr">PJSIP/asiatech</strong><span>متصل</span></div></div></div></div><div class="mytel-resource-panel"><h3>کنفرانس‌ها</h3><p class="mytel-empty mytel-empty-small">کنفرانسی تعریف نشده است.</p></div><div class="mytel-resource-panel"><h3>پارک تماس</h3><div class="pbxelement"><div class="mytel-resource"><span class="mytel-resource-icon">P</span><div><strong>پارک ۷۰۱</strong><span>آزاد</span></div></div></div></div></section></aside>'''
start = desktop.index('<aside class="mytel-side-column"')
end = desktop.index('</aside>', start) + len('</aside>')
desktop = desktop[:start] + sidebar + desktop[end:]
desktop=desktop.replace('<div class="pbxelement"><div class="mytel-resource"><span class="mytel-resource-icon">⇄</span><div><strong dir="ltr">PJSIP/asiatech</strong><span>متصل</span></div></div></div>','<div class="pbxelement mytel-iptrunk-card pbxactive"><div class="mytel-resource mytel-iptrunk"><span class="mytel-resource-icon">⇄</span><div><strong dir="ltr">PJSIP/example-trunk</strong><span class="mytel-resource-state">Connected</span></div></div></div><div class="pbxelement mytel-iptrunk-card"><div class="mytel-resource mytel-iptrunk"><span class="mytel-resource-icon">⇄</span><div><strong dir="ltr">PJSIP/example-backup</strong><span class="mytel-resource-state">Unregistered</span></div></div></div>')
desktop=desktop.replace('<h3>پارک تماس</h3><div class="pbxelement"><div class="mytel-resource"><span class="mytel-resource-icon">P</span><div><strong>پارک ۷۰۱</strong><span>آزاد</span></div></div></div>','<details class="mytel-parking-collapse"><summary><span>Call parking</span><span class="mytel-parking-count">1 slot</span></summary><div class="parkinglots-list"><div class="pbxelement"><div class="mytel-resource"><span class="mytel-resource-icon">P</span><div><strong>Park 701</strong><span>Available</span></div><img class="icon" src="../control_panel/images/parking.png" alt="Call parking destination"></div></div></div></details>')
desktop = desktop.replace('modules/control_panel/', '../control_panel/')
desktop=desktop.replace('<div class="Queue-Container">','<div class="Queue-Container" data-idattr="QUEUE/600">').replace('<div class="Queue-Container-Agent-Client">','<div class="mytel-queue-summary" data-queue-metrics></div><p class="mytel-queue-period">Since last PBX statistics reset</p><div class="Queue-Container-Agent-Client">')
script = '''
const phones = __PHONES__;
const fixtureMode = new URLSearchParams(location.search).get('state') || 'connected';
const noData = ['loading','empty','error'].includes(fixtureMode);
const sourcePhones = noData ? [] : phones;
sourcePhones.finishedloading = !['loading','error'].includes(fixtureMode);
const fixtureConnection = fixtureMode === 'loading' ? 'connecting' : ['error','partial','disconnected'].includes(fixtureMode) ? 'disconnected' : fixtureMode === 'permission' ? 'permission' : 'connected';
const queueData={extension:'600',description:'Customer care',Completed:27,Abandoned:3,callers:[{Wait:35},{Wait:12}],memberRefresh:[{Interface:'PJSIP/201',Status:'1',Paused:'0',CallsTaken:11,Penalty:0,InCall:'0',LastCall:0},{Interface:'PJSIP/202',Status:'2',Paused:'0',CallsTaken:8,Penalty:1,InCall:'1',LastCall:0},{Interface:'Local/205@from-queue/n',StateInterface:'PJSIP/205',Status:'2',Paused:'1',PausedReason:'After-call work',CallsTaken:8,Penalty:0,InCall:'1',LastCall:0}]};
window.debug_root = {extensions: sourcePhones, queues:noData?[]:[queueData], connected:fixtureConnection==='connected', permissionDenied:fixtureConnection==='permission',connectionState:fixtureConnection, lastUpdatedAt:noData && fixtureMode!=='empty' ? 0 : Date.now()-(['disconnected','partial'].includes(fixtureMode)?30000:0), pbxStatus(){location.search='?state=connected';}};
const rawChannels=phones.flatMap(phone=>phone.active.map(call=>({...call,local_extension:phone.extension})));
rawChannels.push({Channel:'Local/600-test;1',Uniqueid:'1700000000.106',Linkedid:'1700000000.106',CallerIDNum:'+12025550107',CallerIDName:'Example queued caller',Since:Date.now()/1000-35,ChannelStateDesc:'Up',queue_ids:['600'],Application:'Queue',on_hold:null,answered_at:null,direction:null});
const groups={};rawChannels.forEach(channel=>{const key='linked:'+channel.Linkedid;const item=groups[key]||(groups[key]={id:key,linkedid:channel.Linkedid,channels:[],extensions:[],queue_ids:[],state:channel.ChannelStateDesc,started_at:channel.Since,direction:channel.direction || null});item.channels.push(channel);if(channel.local_extension&&!item.extensions.includes(channel.local_extension))item.extensions.push(channel.local_extension);if(channel.queue_ids)item.queue_ids.push(...channel.queue_ids);if(channel.on_hold===true)item.state='On hold';if(item.queue_ids.length)item.state='Waiting';item.started_at=Math.min(item.started_at,channel.Since);});
debug_root.latestSnapshot={live_calls:noData?[]:Object.values(groups)};
window.var_init={CSRF_TOKEN:'synthetic-fixture-only'};
window.fixtureActionLog=[];
window.jQuery={ajax(options){fixtureActionLog.push(options.data);return{done(callback){setTimeout(()=>callback(new URLSearchParams(location.search).get('actions')==='error'?{status:'error',message:'Synthetic PBX action rejected for test.'}:{status:'success',message:'Synthetic request accepted; no real call was changed.'}),300);return this;},fail(){return this;}};}};
if(noData){document.querySelector('.mytel-side-column').innerHTML='<section class="mytel-surface"><div class="mytel-section-heading"><h2>Call queues</h2></div><p class="mytel-empty">'+(fixtureMode==='empty'?'No queues to display.':'Waiting for PBX data…')+'</p></section>';}
window.fixtureState = function(state){debug_root.connectionState=state;debug_root.connected=state==='connected';debug_root.permissionDenied=state==='permission';window.dispatchEvent(new CustomEvent('mytel:connection',{detail:{state}}));};
setInterval(()=>{if(debug_root.connected)debug_root.lastUpdatedAt=Date.now();},1000);
document.addEventListener('click',e=>{const card=e.target.closest('.ExtensionStyle');if(card)window.selectedContainer=card;});
'''.replace('__PHONES__', json.dumps(phones, ensure_ascii=False))
for source, target in {'صف‌های تماس':'Call queues','پاسخ‌گویی و وضعیت کارشناسان':'Queue activity and agent availability','پاسخ‌گویی مشتریان':'Customer care','۲ منتظر':'2 waiting','پاسخ‌شده: ۲۷':'Answered: 27','بی‌پاسخ: ۳':'Abandoned: 3','کارشناسان':'Agents','۲۰۱ · پذیرش':'201 · Reception','۲۰۲ · علی کیانی':'202 · Alex Morgan','۲۰۵ · مدیریت':'205 · Management','تماس‌های منتظر':'Waiting callers','منابع مرکز تلفن':'PBX resources','ترانک‌ها، کنفرانس و پارک تماس':'Trunks, conferences and parking','ترانک‌های IP':'IP trunks','متصل':'Connected','کنفرانس‌ها':'Conferences','کنفرانسی تعریف نشده است.':'No conferences configured.','پارک تماس':'Call parking','پارک ۷۰۱':'Park 701','آزاد':'Available','آماده ارتباط':'Available','ثبت‌نشده':'Unregistered','آماده':'Ready','جزئیات داخلی':'Extension details','09123456789':'+12025550104','02191018746':'+12025550105','PJSIP/asiatech':'PJSIP/example-trunk'}.items():
    desktop = desktop.replace(source,target)
states = ' '.join(f'<a href="?state={state}">{label}</a>' for state,label in [('connected','Populated'),('loading','Loading'),('empty','Empty'),('error','Error'),('disconnected','Partial / stale'),('permission','Permission')])+' <a href="?state=connected&actions=error">Action error</a>'
output = '<!doctype html><html lang="en" dir="ltr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MyTel synthetic UI test fixture</title><link rel="stylesheet" href="../control_panel/themes/default/css/mytel.css"><style>body{margin:0;padding:24px;background:#e9eef5}#fixture-notice{font:12px/1.5 Arial;color:#24354b;direction:ltr;margin:0 0 10px}#fixture-states{font:12px/1.5 Arial;display:flex;flex-wrap:wrap;gap:15px;margin:0 0 15px}#fixture-states a{color:#176aac}@media(max-width:650px){body{padding:8px}}</style><p id="fixture-notice">SYNTHETIC LOCAL TEST DATA · NOT A LIVE PBX</p><nav id="fixture-states">'+states+'</nav><div id="controlPanelApplication" dir="ltr" data-language="en">' + desktop + '</div><script>' + script + '</script><script src="../control_panel/themes/default/js/mytel-ui.js"></script><script src="../control_panel/themes/default/js/mytel-call-model.js"></script><script src="../control_panel/themes/default/js/mytel-calls.js"></script></html>'
artifact_path = ROOT / 'artifacts/ui'
artifact_path.mkdir(parents=True, exist_ok=True)
(artifact_path / 'preview.html').write_text(output.replace('../control_panel/', '../../control_panel/'), encoding='utf-8')
print(artifact_path / 'preview.html')
