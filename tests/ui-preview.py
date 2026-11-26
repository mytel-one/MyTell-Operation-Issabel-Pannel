"""Build a local synthetic workspace using the release templates, CSS and JS.

All mutations are intercepted by a mock, gated by explicit fixture permissions.
Use ?role=operator for action tests; the default is a read-only observer.
"""
from pathlib import Path
import html
import json
import re
import time

ROOT = Path(__file__).resolve().parents[1]
tpl = (ROOT / 'control_panel_en/themes/default/panel.tpl').read_text(encoding='utf-8')
desktop = re.search(r'data-template-name="desktop">(.*?)</script>', tpl, re.S).group(1)
desktop = desktop.replace('{literal}', '').replace('{/literal}', '').replace('{$module_name}', 'control_panel')
now = int(time.time())

def leg(channel, uid, linked, caller, connected, age, direction=None, state='Up', hold=False, **extra):
    return dict(Channel=channel, Uniqueid=uid, Linkedid=linked, CallerIDNum=caller, CallerIDName='Example caller',
                ConnectedLineNum=connected, ConnectedLineName='Example destination', Since=now-age,
                ChannelStateDesc=state, answered_at=now-age+10 if state=='Up' else None, on_hold=hold,
                direction=direction, Context='from-internal', Extension=connected, Application='Dial',
                AppData=None, Readformat='ulaw', Writeformat='ulaw', **extra)

phones = [dict(extension=str(201+i), description=name, registered=i not in (3,6), trunkstate='Down',active=[],
               tech='PJSIP',ip='192.0.2.'+str(i+1),NewMessages=0,channel='PJSIP/'+str(201+i))
          for i,name in enumerate(['Reception','Alex Morgan','Sales and customer experience','Accounting',
                                   'Management','Technical support','Head office','Customer success'])]
phones[1]['active']=[
    leg('PJSIP/202-000000a','1700000000.100','1700000000.100','+12025550104','202',142,'incoming',
        actions=dict(transfer=True,consult=True,park=False,pickup=False)),
    leg('PJSIP/202-000000b','1700000000.102','1700000000.102','202','205',35,'internal',
        actions=dict(transfer=True,consult=True,park=True,pickup=False,park_return_extension='205'))]
phones[2]['active']=[leg('PJSIP/203-000000d','1700000000.104','1700000000.104','+12025550105','203',12,
                         'incoming',state='Ringing',hold=None,actions=dict(transfer=False,consult=False,park=False,pickup=True))]
phones[4]['active']=[leg('PJSIP/205-000000c','1700000000.103','1700000000.102','202','205',34,'internal',
                         actions=dict(transfer=True,consult=True,park=True,pickup=False,park_return_extension='202'))]
phones[7]['active']=[leg('PJSIP/208-000000e','1700000000.105','1700000000.105','208','+12025550106',360,
                         'outgoing',hold=True,actions=dict(transfer=True,consult=True,park=False,pickup=False))]
for phone in phones:
    phone['trunkstate']='Ringing' if any(call['ChannelStateDesc']=='Ringing' for call in phone['active']) else 'Up' if phone['active'] else 'Down'

def card(phone):
    activity=''.join('<span class="monitor" title="'+html.escape(call['Channel'])+'"><span dir="ltr">'+html.escape(call['CallerIDNum'] if call['CallerIDNum']!=phone['extension'] else call['ConnectedLineNum'])+'</span><time dir="ltr">02:10</time></span>' for call in phone['active'])
    if not activity: activity='<span class="mytel-idle-label">'+('No active call' if phone['registered'] else 'Unregistered')+'</span>'
    return f'''<div class="pbxelement ExtensionStyle {'pbxactive' if phone['registered'] else ''}" data-idattr="{phone['channel']}"><div class="mytel-extension-body"><div class="mytel-extension-top"><span class="mytel-extension-number" dir="ltr">{phone['extension']}</span><span class="mytel-extension-state">Online</span></div><div class="mytel-extension-name">{html.escape(phone['description'])}</div><div class="mytel-extension-activity">{activity}</div><div class="mytel-extension-tools"><button type="button" class="mytel-favorite-button" data-action="favorite" aria-pressed="false" aria-label="Add extension to favorites">☆</button><span class="phone-icon"><img src="../control_panel/images/phhonez0.png" alt=""></span><a class="pbxtooltip mytel-info" href="#" aria-label="Extension details"><span>i</span><div>{phone['channel']}<br>{html.escape(phone['description'])}</div></a></div></div></div>'''

directory='<div class="mytel-directory-panels"><div class="lisortable">'
for key,name,members in [('extensions','Front desk',phones[:4]),('area1','Support team',phones[4:])]:
    directory+='<li class="pbxpanel mytel-extension-panel '+('mytel-default-panel' if key=='extensions' else 'mytel-area-panel')+'"><dt>'+name+'</dt><dd><div class="Extensions-List"><div class="sortablepanelview">'+''.join(card(phone) for phone in members)+'</div></div></dd></li>'
directory+='</div></div>'
start=desktop.index('<div class="mytel-directory-panels">');end=desktop.index('<div class="mytel-directory-bottom">')
desktop=desktop[:start]+directory+desktop[end:]

sidebar='''<aside class="mytel-side-column">
<section class="mytel-surface mytel-queues"><div class="mytel-section-heading"><div><h2>Call queues <span data-queue-count>—</span></h2><p>Queue activity and agent availability</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div><div class="mytel-resource-panel"><div class="Queue-Container" data-idattr="QUEUE/600"><div class="mytel-queue-heading"><div><span class="mytel-queue-number">600</span><strong>Customer care</strong></div><span class="mytel-waiting-badge">2 waiting</span></div><div class="mytel-queue-summary" data-queue-metrics></div><p class="mytel-queue-period">Since last PBX statistics reset</p><div class="Queue-Container-Agent-Client"><div class="Queue-Agents"><span><strong>Agents</strong></span><div class="agent-container"><span class="circle green"></span><span>201 · Reception</span></div><div class="agent-container"><span class="circle orange"></span><span>202 · Alex Morgan</span></div></div><div class="mytel-queue-callers"><h4>Waiting callers</h4><div class="mytel-caller">+12025550107</div><div class="mytel-caller">+12025550108</div></div></div></div></div></section>
<section class="mytel-surface mytel-agents"><div class="mytel-section-heading"><div><h2>Live agents <span class="mytel-call-count" data-agent-count>—</span></h2><p>Queue membership, availability and pause state</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div><div data-agent-workspace></div></section>
<section class="mytel-surface mytel-trunks"><div class="mytel-section-heading"><div><h2>IP trunks <span class="mytel-call-count" data-trunk-count>—</span></h2><p>Observed connection status and active channels</p></div><span class="mytel-data-status" data-freshness>Waiting for data</span></div><div class="mytel-resource-panel"><div class="pbxelement mytel-iptrunk-card pbxactive"><div class="mytel-resource mytel-iptrunk"><span class="mytel-resource-icon">⇄</span><div><strong>PJSIP/example-trunk</strong><span class="mytel-resource-state">Connected</span><span class="mytel-resource-ip">192.0.2.30 · 1 active channel</span></div></div></div><div class="pbxelement mytel-iptrunk-card"><div class="mytel-resource mytel-iptrunk"><span class="mytel-resource-icon">⇄</span><div><strong>PJSIP/example-backup</strong><span class="mytel-resource-state">Unregistered</span></div></div></div></div></section>
<section class="mytel-surface mytel-resources"><div class="mytel-resource-panel"><h3>Conferences</h3><p class="mytel-empty mytel-empty-small">No conferences configured.</p></div><div class="mytel-resource-panel"><details class="mytel-parking-collapse"><summary><span>Call parking</span><span class="mytel-parking-count">2 slots</span></summary><div class="parkinglots-list"><div class="pbxelement" data-idattr="PARKLOT/71" data-parking-slot="71"><div class="mytel-resource"><span class="mytel-resource-icon">P</span><div><strong>Park 71</strong><span data-parking-state>Occupied</span><span data-parking-guidance></span><div data-parking-actions></div></div><img class="mytel-parking-static-icon" src="../control_panel/images/parking.png" alt=""></div></div><div class="pbxelement" data-idattr="PARKLOT/72" data-parking-slot="72"><div class="mytel-resource"><span class="mytel-resource-icon">P</span><div><strong>Park 72</strong><span data-parking-state>Available</span><span data-parking-guidance></span><div data-parking-actions></div></div></div></div></details></div></section>
</aside>'''
start=desktop.index('<aside class="mytel-side-column"');end=desktop.index('</aside>',start)+len('</aside>')
desktop=desktop[:start]+sidebar+desktop[end:]
desktop=desktop.replace('modules/control_panel/','../control_panel/')

script='''
const phones=__PHONES__;
const params=new URLSearchParams(location.search),fixtureMode=params.get('state')||'connected',operator=params.get('role')==='operator';
const noData=['loading','empty','error'].includes(fixtureMode),sourcePhones=noData?[]:phones.slice(0,4),teamPhones=noData?[]:phones.slice(4);
sourcePhones.finishedloading=!['loading','error'].includes(fixtureMode);sourcePhones.description='Front desk';teamPhones.finishedloading=sourcePhones.finishedloading;teamPhones.description='Support team';
const fixtureConnection=fixtureMode==='loading'?'connecting':['error','partial','disconnected'].includes(fixtureMode)?'disconnected':fixtureMode==='permission'?'permission':'connected';
const queueData={objtype:'queues',extension:'600',description:'Customer care',Completed:27,Abandoned:3,callers:[{Wait:35},{Wait:12}],memberRefresh:[{Interface:'PJSIP/201',MemberName:'Reception',Status:'1',Paused:'0',CallsTaken:11,Penalty:0,InCall:'0',Membership:'static',LastCall:0},{Interface:'PJSIP/202',MemberName:'Alex Morgan',Status:'2',Paused:'0',CallsTaken:8,Penalty:1,InCall:'1',Membership:'dynamic',LastCall:0},{Interface:'Local/205@from-queue/n',MemberName:'Management',StateInterface:'PJSIP/205',Status:'1',Paused:'1',PausedReason:'After-call work',CallsTaken:8,Penalty:0,InCall:'0',Membership:'dynamic',LastCall:0}]};
const queueList=noData?[]:[queueData];queueList.content=queueList;
const parked={extension:'71',Channel:'PJSIP/example-trunk-parked',Uniqueid:'1700000000.999',Parkinglot:'main',Since:Date.now()/1000-10,Timeout:45,Remaining:35,CallerIDNum:'+12025550109'};
window.debug_root={extensions:sourcePhones,area1:teamPhones,queues:queueList,iptrunks:noData?[]:[{channel:'PJSIP/example-trunk',registered:true},{channel:'PJSIP/example-backup',registered:false}],parkinglots:noData?[]:[parked,{extension:'72',Channel:null,Uniqueid:null,Parkinglot:'main'}],connected:fixtureConnection==='connected',permissionDenied:fixtureConnection==='permission',connectionState:fixtureConnection,lastUpdatedAt:noData&&fixtureMode!=='empty'?0:Date.now()-(['disconnected','partial'].includes(fixtureMode)?30000:0),pbxStatus(){location.search='?state=connected&role='+ (operator?'operator':'observer');}};
const rawChannels=phones.flatMap(phone=>phone.active.map(call=>({...call,local_extension:phone.extension})));
rawChannels.push({Channel:'PJSIP/example-trunk-000000f',Uniqueid:'1700000000.101',Linkedid:'1700000000.100',CallerIDNum:'+12025550104',ConnectedLineNum:'202',Since:Date.now()/1000-142,ChannelStateDesc:'Up',actions:{park:true,transfer:false,consult:false,pickup:false,park_return_extension:'202'},direction:'incoming',on_hold:false});
rawChannels.push({Channel:'Local/600-test;1',Uniqueid:'1700000000.106',Linkedid:'1700000000.106',CallerIDNum:'+12025550107',CallerIDName:'Example queued caller',Since:Date.now()/1000-35,ChannelStateDesc:'Up',queue_ids:['600'],Application:'Queue',on_hold:null,answered_at:null,direction:null,actions:{transfer:false,consult:false,park:false,pickup:false}});
const groups={};rawChannels.forEach(channel=>{const key='linked:'+channel.Linkedid,item=groups[key]||(groups[key]={id:key,linkedid:channel.Linkedid,channels:[],extensions:[],queue_ids:[],state:channel.ChannelStateDesc,started_at:channel.Since,direction:channel.direction||null});item.channels.push(channel);if(channel.local_extension&&!item.extensions.includes(channel.local_extension))item.extensions.push(channel.local_extension);if(channel.queue_ids)item.queue_ids.push(...channel.queue_ids);if(channel.on_hold===true)item.state='On hold';if(item.queue_ids.length)item.state='Waiting';item.started_at=Math.min(item.started_at,channel.Since);});
debug_root.latestSnapshot={snapshot:true,pbxchanges:noData?[]:[queueData],live_calls:noData?[]:Object.values(groups),parking_lots:noData?[]:[{id:'main',name:'Main parking',context:null,start:71,end:78,timeout:45}],parked_calls:noData?[]:[parked],parking_status_known:!noData,generated_at:debug_root.lastUpdatedAt/1000};
window.var_init={CSRF_TOKEN:'synthetic-fixture-only',OPERATOR_KEY:'fixture-'+(operator?'operator':'observer'),OPERATOR_ACCESS:{call:operator,pickup:operator,transfer:operator,park:operator,queues:operator,membership:operator,hangup:operator,layout:operator},OPERATOR_TOOLS:operator?[{label:'Call reports',url:'/index.php?menu=cdrreport'},{label:'Advanced console',url:'/index.php?menu=fop2app',embed_url:'fop2/'},{label:'Advanced console manager',url:'/index.php?menu=fop2manager'}]:[{label:'Call reports',url:'/index.php?menu=cdrreport'}]};
window.fixtureActionLog=[];
window.jQuery={ajax(options){const privileges={callExtension:'call',pickupChannel:'pickup',transferChannel:'transfer',consultTransferChannel:'transfer',parkChannel:'park',hangupChannel:'hangup',toggleQueueMemberPause:'queues',joinQueueMember:'membership',leaveQueueMember:'membership'};const allowed=var_init.OPERATOR_ACCESS[privileges[options.data.action]]===true&&options.headers&&options.headers['X-MyTel-CSRF']===var_init.CSRF_TOKEN;fixtureActionLog.push(options.data);return{done(callback){setTimeout(()=>callback(!allowed?{status:'error',message:'Synthetic fixture permission denied.'}:params.get('actions')==='error'?{status:'error',message:'Synthetic PBX action rejected for test.'}:{status:'success',message:'Synthetic request accepted; no real call was changed.',member_interface:options.data.action==='joinQueueMember'?'PJSIP/'+options.data.source:undefined}),300);return this;},fail(){return this;}};}};
if(noData)document.querySelector('.mytel-side-column').innerHTML='<section class="mytel-surface"><div class="mytel-section-heading"><h2>Call queues</h2></div><p class="mytel-empty">'+(fixtureMode==='empty'?'No queues to display.':'Waiting for PBX data…')+'</p></section>';
window.fixtureState=function(state){debug_root.connectionState=state;debug_root.connected=state==='connected';debug_root.permissionDenied=state==='permission';window.dispatchEvent(new CustomEvent('mytel:connection',{detail:{state}}));};
function fixtureSnapshot(){window.dispatchEvent(new CustomEvent('mytel:snapshot',{detail:debug_root.latestSnapshot}));}
setInterval(()=>{if(debug_root.connected){debug_root.lastUpdatedAt=Date.now();debug_root.latestSnapshot.generated_at=Date.now()/1000;fixtureSnapshot();}},1000);
document.addEventListener('click',event=>{const card=event.target.closest('.ExtensionStyle');if(card)window.selectedContainer=card;});
'''.replace('__PHONES__',json.dumps(phones,ensure_ascii=False))

states=' '.join('<a href="?state='+state+'&role=operator">'+label+'</a>' for state,label in [('connected','Operator'),('loading','Loading'),('empty','Empty'),('error','Error'),('disconnected','Stale'),('permission','Session')])+' <a href="?state=connected&role=observer">Observer</a> <a href="?state=connected&role=operator&actions=error">Action error</a>'
head='''<!doctype html><html lang="en" dir="ltr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MyTel synthetic UI test fixture</title><link rel="stylesheet" href="../control_panel/themes/default/css/mytel.css"><link rel="stylesheet" href="../control_panel/themes/default/css/mytel-queue-controls.css"><style>body{margin:0;padding:24px;background:#e9eef5}#fixture-notice{font:12px/1.5 Arial;color:#24354b;margin:0 0 10px}#fixture-states{font:12px/1.5 Arial;display:flex;flex-wrap:wrap;gap:15px;margin:0 0 15px}#fixture-states a{color:#176aac}@media(max-width:650px){body{padding:8px}}</style><p id="fixture-notice">SYNTHETIC LOCAL TEST DATA · ALL ACTIONS MOCKED · NOT A LIVE PBX</p><nav id="fixture-states">'''
output=head+states+'</nav><div id="controlPanelApplication" dir="ltr" data-language="en">'+desktop+'</div><script>'+script+'</script>'
for name in ['mytel-ui.js','mytel-call-model.js','mytel-calls.js','mytel-queue-controls.js']:
    output+='<script src="../control_panel/themes/default/js/'+name+'"></script>'
output+='<script>document.addEventListener("DOMContentLoaded",()=>{window.dispatchEvent(new CustomEvent("mytel:connection",{detail:{state:debug_root.connectionState}}));fixtureSnapshot();});</script></html>'
directory=ROOT/'artifacts/ui';directory.mkdir(parents=True,exist_ok=True)
(directory/'preview.html').write_text(output.replace('../control_panel/','../../control_panel/'),encoding='utf-8')
print(directory/'preview.html')
