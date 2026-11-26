<?php
// Real service against deterministic PBX boundaries. Never touches a real call.
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
$serviceFile = dirname(__DIR__) . '/' . $variant . '/libs/mytelCallActionService.php';
$checks = $failures = 0;
function operatorCheck($condition, $label) { global $checks,$failures; $checks++; if (!$condition) $failures++; echo ($condition?'PASS ':'FAIL ') . $label . "\n"; }
if (!is_file($serviceFile)) { operatorCheck(FALSE, 'guarded operator call action service exists'); exit(1); }
require $serviceFile;
class OperatorFixtureDB {
    public $errMsg = '';
    public $devices = array(array('id'=>'100','dial'=>'PJSIP/100','tech'=>'pjsip'),array('id'=>'101','dial'=>'PJSIP/101','tech'=>'pjsip'));
    function fetchTable($sql, $assoc=TRUE, $params=array()) { return $this->devices; }
}
class OperatorFixtureAMI {
    public $socket = TRUE;
    public $requests = array();
    public $mode = 'normal';
    public $channels;
    public $bridge;
    private $handlers = array();
    private $events = array();
    function __construct() {
        $this->channels=array(
            'PJSIP/100-00000001'=>array('Channel'=>'PJSIP/100-00000001','Uniqueid'=>'1000.1','Linkedid'=>'1000.1','ChannelStateDesc'=>'Up','BridgeID'=>'bridge-1'),
            'SIP/provider-00000002'=>array('Channel'=>'SIP/provider-00000002','Uniqueid'=>'1000.2','Linkedid'=>'1000.1','ChannelStateDesc'=>'Up','BridgeID'=>'bridge-1'));
        $this->bridge=array_values($this->channels);
    }
    function setDeadline($deadline) {}
    function add_event_handler($name,$callback) { $this->handlers[strtolower($name)]=$callback; }
    function remove_event_handler($name) { unset($this->handlers[strtolower($name)]); }
    function send_request($action,$params=array(),$retry=TRUE) {
        $this->requests[]=array('action'=>$action,'params'=>$params,'retry'=>$retry);
        $id=isset($params['ActionID'])?$params['ActionID']:'';
        if ($this->mode==='query-error' && in_array($action,array('Status','BridgeInfo','Parkinglots'))) return array('Response'=>'Error');
        if ($action==='Status') {
            if (isset($this->channels[$params['Channel']])) $this->events[]=array('Status',array_merge($this->channels[$params['Channel']],array('ActionID'=>$id)));
            $this->events[]=array('StatusComplete',array('ActionID'=>$id));
        } elseif ($action==='BridgeInfo') {
            foreach ($this->bridge as $channel) $this->events[]=array('BridgeInfoChannel',array_merge($channel,array('ActionID'=>$id,'BridgeUniqueid'=>'bridge-1')));
            if ($this->mode!=='incomplete') $this->events[]=array('BridgeInfoComplete',array('ActionID'=>$id,'BridgeUniqueid'=>'bridge-1','BridgeNumChannels'=>count($this->bridge)));
        } elseif ($action==='Parkinglots') {
            $this->events[]=array('Parkinglot',array('ActionID'=>$id,'Name'=>'default','StartSpace'=>'71','StopSpace'=>'78','Timeout'=>'45'));
            $this->events[]=array('ParkinglotsComplete',array('ActionID'=>$id));
        } elseif ($action==='PJSIPShowEndpoints') {
            $this->events[]=array('EndpointList',array('ActionID'=>$id,'ObjectName'=>'101','Contacts'=>$this->mode==='offline'?'':'101/sip:101@192.0.2.10:5060;transport=TCP,','DeviceState'=>'Unavailable'));
            $this->events[]=array('EndpointListComplete',array('ActionID'=>$id));
        } elseif ($action==='Getvar') {
            return array('Response'=>'Success','Value'=>$this->mode==='identity-changed'?'replacement-id':(isset($this->channels[$params['Channel']])?$this->channels[$params['Channel']]['Uniqueid']:''));
        } elseif (in_array($action,array('BlindTransfer','Atxfer','Park','Originate'),TRUE)) {
            return $this->mode==='mutation-error'?array('Response'=>'Error','Message'=>'private debug message'):array('Response'=>'Success');
        } else throw new RuntimeException('Unexpected action: '.$action);
        return array('Response'=>'Success');
    }
    function procesarPaquetes() {
        if (!$this->events) return FALSE;
        list($name,$params)=array_shift($this->events);
        if (isset($this->handlers[strtolower($name)])) call_user_func($this->handlers[strtolower($name)],$name,$params,'',0);
        return TRUE;
    }
    function procesarActividad($timeout) { usleep(1000); return FALSE; }
    function mutations() { return array_values(array_filter($this->requests,function($request){return in_array($request['action'],array('BlindTransfer','Atxfer','Park','Originate'),TRUE);})); }
}
function operatorFixture($mode='normal') { $ami=new OperatorFixtureAMI();$ami->mode=$mode;return array(new MytelCallActionService($ami,new OperatorFixtureDB(),microtime(TRUE)+0.08),$ami); }
$local='PJSIP/100-00000001';$remote='SIP/provider-00000002';
list($service,$ami)=operatorFixture();
operatorCheck($service->transferChannel($local,'1000.1','101'), 'blind transfer accepts one exact two-party local source and configured destination');
$mutations=$ami->mutations();$last=end($mutations);
operatorCheck($last['action']==='BlindTransfer' && $last['params']['Channel']===$local && $last['params']['Context']==='ext-local' && $last['params']['Exten']==='101', 'blind transfer moves the source bridge peer via fixed internal-only context');
operatorCheck($last['retry']===FALSE, 'a transfer is never retried automatically after an uncertain response');
list($service,$ami)=operatorFixture();
operatorCheck($service->transferChannel($local,'1000.1','101',TRUE), 'consult transfer shares the same exact-channel guards');
$mutations=$ami->mutations();$last=end($mutations);
operatorCheck($last['action']==='Atxfer' && $last['params']['Priority']===1, 'consultation uses native Atxfer with an explicit internal priority');
foreach (array('stale-id','conference','unknown-target','external-target','wrong-leg','ringing','query-error','incomplete','identity-changed') as $mode) {
    list($service,$ami)=operatorFixture($mode);
    if ($mode==='conference') $ami->bridge[]=array('Channel'=>'PJSIP/101-00000003','Uniqueid'=>'1000.3');
    if ($mode==='ringing') $ami->channels[$local]['ChannelStateDesc']='Ringing';
    $target=$mode==='unknown-target'?'999':($mode==='external-target'?'+12025550123':'101');
    $channel=$mode==='wrong-leg'?$remote:$local;$identity=$mode==='stale-id'?'old':($mode==='wrong-leg'?'1000.2':'1000.1');
    operatorCheck(!$service->transferChannel($channel,$identity,$target) && !count($ami->mutations()), 'transfer fails closed before mutation: '.$mode);
}
list($service,$ami)=operatorFixture();
operatorCheck($service->parkChannel($remote,'1000.2','default'), 'park accepts the exact remote channel with a configured local bridge peer');
$mutations=$ami->mutations();$last=end($mutations);
operatorCheck($last['action']==='Park' && $last['params']['Channel']===$remote && $last['params']['TimeoutChannel']===$local && $last['params']['Parkinglot']==='default' && !isset($last['params']['Timeout']), 'park preserves lot timeout and uses only its verified local peer for return');
foreach (array('unknown-lot','wrong-parkee','stale-id','conference') as $mode) {
    list($service,$ami)=operatorFixture();
    if ($mode==='conference') $ami->bridge[]=array('Channel'=>'PJSIP/101-00000003','Uniqueid'=>'1000.3');
    operatorCheck(!$service->parkChannel($mode==='wrong-parkee'?$local:$remote,$mode==='stale-id'?'old':($mode==='wrong-parkee'?'1000.1':'1000.2'),$mode==='unknown-lot'?'not-configured':'default') && !count($ami->mutations()), 'park fails closed before mutation: '.$mode);
}
list($service,$ami)=operatorFixture();$ami->channels[$local]['ChannelStateDesc']='Ringing';$ami->channels[$local]['BridgeID']='';
operatorCheck($service->pickupChannel($local,'1000.1','101'), 'directed pickup accepts an exact ringing local endpoint and registered operator');
$mutations=$ami->mutations();$last=end($mutations);
operatorCheck($last['action']==='Originate' && $last['params']['Channel']==='PJSIP/101' && $last['params']['Application']==='PickupChan' && $last['params']['Data']==='1000.1' && $last['params']['Async']==='true', 'pickup uses only the exact observed Uniqueid, never prefix, extension search or a target list');
foreach (array('already-up','offline','stale-id','external-source','unsafe-channel') as $mode) {
    list($service,$ami)=operatorFixture($mode);
    if ($mode!=='already-up') $ami->channels[$local]['ChannelStateDesc']='Ringing';
    operatorCheck(!$service->pickupChannel($mode==='unsafe-channel'?$local.'&PJSIP/101':$local,$mode==='stale-id'?'old':'1000.1',$mode==='external-source'?'004420123456':'101') && !count($ami->mutations()), 'pickup fails closed before mutation: '.$mode);
}
list($service,$ami)=operatorFixture('mutation-error');
operatorCheck(!$service->transferChannel($local,'1000.1','101') && strpos($service->errMsg,'private debug')===FALSE, 'unconfirmed mutation returns a safe error without leaking AMI internals');
operatorCheck(mytelValidateMutation('transferChannel',array('channel'=>$local,'uniqueid'=>'1000.1','target'=>'101'))===TRUE, 'HTTP policy accepts exact internal transfer parameters');
operatorCheck(mytelValidateMutation('parkChannel',array('channel'=>$remote,'uniqueid'=>'1000.2','lot'=>"default\r\nAction: Hangup"))===FALSE, 'HTTP policy rejects parking header injection');
operatorCheck(mytelValidateMutation('pickupChannel',array('channel'=>$local,'uniqueid'=>'1000.1','source'=>array('101')))===FALSE, 'HTTP policy rejects array-shaped source parameters');
$fixture = new OperatorFixtureAMI();
$channels = array_values($fixture->channels);
$response = array('live_channels'=>$channels,'live_calls'=>array(array('channels'=>$channels)),
    'pbxchanges'=>array(array('objtype'=>'phones','active'=>array($channels[0]))));
$phones = array('PJSIP/100'=>array('extension'=>'100'));
$decorated = MytelCallActionService::decorateSnapshot($response,$phones,array(array('id'=>'default')));
operatorCheck($decorated['live_channels'][0]['actions']['transfer'] && $decorated['live_channels'][0]['actions']['consult'], 'capability hints expose transfer only on an observed local two-party source');
operatorCheck(!$decorated['live_channels'][0]['actions']['park'] && $decorated['live_channels'][1]['actions']['park'] && $decorated['live_channels'][1]['actions']['park_return_extension']==='100', 'park hints identify the exact parkee and verified local return extension');
operatorCheck($decorated['pbxchanges'][0]['active'][0]['actions'] === $decorated['live_channels'][0]['actions'], 'extension inspector and global channel list share the same action hints');
$withoutLot = MytelCallActionService::decorateSnapshot($response,$phones,array());
operatorCheck(!$withoutLot['live_channels'][1]['actions']['park'], 'unknown or unsupported parking metadata never fabricates a Park control');
echo "$checks checks; $failures failures\n";
exit($failures?1:0);
