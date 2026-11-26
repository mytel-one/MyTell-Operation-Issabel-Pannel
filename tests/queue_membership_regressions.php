<?php
// Dynamic agent sign-in/sign-out. All databases and AMI events are doubles.
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
$base = dirname(__DIR__) . '/' . $variant . '/libs/';
require $base . 'mytelQueueMemberService.php';
$checks = $failures = 0;
function membershipCheck($condition, $message) { global $checks,$failures; $checks++; if (!$condition) $failures++; echo ($condition?'PASS ':'FAIL ').$message."\n"; }
if (!method_exists('MytelQueueMemberService','join') || !method_exists('MytelQueueMemberService','leave')) { membershipCheck(false,'dynamic queue membership operations exist'); exit(1); }
class MembershipFixtureDB {
    public $errMsg='';
    public $row=array('id'=>'101','tech'=>'pjsip','dial'=>'PJSIP/101');
    public $query;
    function getFirstRowQuery($sql,$assoc,$params) { $this->query=array($sql,$params); return $this->row; }
}
class MembershipFixtureAMI {
    public $socket=true, $requests=array(), $members=array(), $mode='normal', $astDial='PJSIP/101', $contact=true;
    private $handlers=array(), $events=array();
    function setDeadline($deadline) {}
    function add_event_handler($event,$callback) { $this->handlers[strtolower($event)]=$callback; return true; }
    function remove_event_handler($event) { unset($this->handlers[strtolower($event)]); }
    function database_get($family,$key) { return $family==='DEVICE'&&$key==='101/dial' ? $this->astDial : false; }
    function send_request($action,$params=array(),$retry=true) {
        $this->requests[]=array('action'=>$action,'params'=>$params,'retry'=>$retry);
        $id=isset($params['ActionID'])?$params['ActionID']:'';
        if ($action==='PJSIPShowEndpoints') {
            $this->events[]=array('EndpointList',array('ActionID'=>$id,'ObjectName'=>'101','DeviceState'=>'Unavailable',
                'Contacts'=>$this->contact?'101/sip:101@192.0.2.10:5060;transport=tcp,':''));
            $this->events[]=array('EndpointListComplete',array('ActionID'=>$id));
        } elseif ($action==='SIPpeers') {
            $this->events[]=array('PeerEntry',array('ActionID'=>$id,'ObjectName'=>'101','Dynamic'=>'yes','IPaddress'=>$this->contact?'192.0.2.10':'0.0.0.0','IPport'=>$this->contact?'5060':'0'));
            $this->events[]=array('PeerlistComplete',array('ActionID'=>$id));
        } elseif ($action==='QueueStatus') {
            if($this->mode==='query-error')return array('Response'=>'Error');
            if($this->mode!=='missing-queue')$this->events[]=array('QueueParams',array('ActionID'=>$id,'Queue'=>$params['Queue']));
            foreach($this->members as $member){$member['ActionID']=$id;$member['Queue']=$params['Queue'];$this->events[]=array('QueueMember',$member);}
            if($this->mode!=='timeout')$this->events[]=array('QueueStatusComplete',array('ActionID'=>$id));
        } elseif ($action==='QueueAdd'||$action==='QueueRemove') {
            if($this->mode==='mutation-error')return array('Response'=>'Error');
            if($this->mode==='mutation-lost')return false;
        } else throw new RuntimeException('Unexpected AMI action '.$action);
        return array('Response'=>'Success');
    }
    function procesarPaquetes(){if($this->mode==='disconnect'){$this->socket=null;return false;}if(!$this->events)return false;list($event,$params)=array_shift($this->events);if(isset($this->handlers[strtolower($event)]))call_user_func($this->handlers[strtolower($event)],$event,$params,'',0);return true;}
    function procesarActividad($timeout){usleep(1000);return false;}
    function mutations(){return array_values(array_filter($this->requests,function($r){return in_array($r['action'],array('QueueAdd','QueueRemove'),true);}));}
}
function membershipFixture($mode='normal'){$ami=new MembershipFixtureAMI();$ami->mode=$mode;$db=new MembershipFixtureDB();return array($ami,$db,new MytelQueueMemberService($ami,microtime(true)+0.04,$db));}
function dynamicMember($extra=array()){return array_merge(array('Location'=>'PJSIP/101','Membership'=>'dynamic','InCall'=>'0','Status'=>'1','Paused'=>'0'),$extra);}
list($ami,$db,$service)=membershipFixture();
membershipCheck($service->join('6000','101')===true&&$service->changed,'registered configured endpoint can sign in dynamically');
$request=$ami->mutations()[0];
membershipCheck($request['action']==='QueueAdd'&&$request['params']['Queue']==='6000'&&$request['params']['Interface']==='PJSIP/101'&&$request['retry']===false,'sign-in uses verified endpoint and one queue without mutation retries');
membershipCheck($service->memberInterface==='PJSIP/101','response exposes the verified interface for snapshot confirmation');
membershipCheck($db->query[1]===array('101'),'local device identity is queried using a bound exact extension');
membershipCheck(count(array_filter($ami->requests,function($r){return $r['action']==='PJSIPShowEndpoints';}))===1,'NonQual PJSIP contact proof is reused even when device state says unavailable');
list($ami,$db,$service)=membershipFixture();$db->row['tech']='sip';$db->row['dial']='SIP/101';$ami->astDial='SIP/101';
membershipCheck($service->join('6000','101')===true&&$service->memberInterface==='SIP/101','registered SIP source uses its exact verified SIP endpoint');
foreach(array('missing-device','astdb-mismatch','unsupported-tech','compound-dial','unregistered') as $mode){
    list($ami,$db,$service)=membershipFixture();
    if($mode==='missing-device')$db->row=array();
    if($mode==='astdb-mismatch')$ami->astDial='PJSIP/102';
    if($mode==='unsupported-tech'){$db->row['tech']='iax2';$db->row['dial']='IAX2/101';$ami->astDial='IAX2/101';}
    if($mode==='compound-dial'){$db->row['dial']='PJSIP/101&PJSIP/102';$ami->astDial=$db->row['dial'];}
    if($mode==='unregistered')$ami->contact=false;
    membershipCheck($service->join('6000','101')===false&&!count($ami->mutations()),$mode.' source never creates queue membership');
}
foreach(array('PJSIP/101','Local/101@from-queue/n','Local/101@custom-routing/n') as $existing){
    list($ami,$db,$service)=membershipFixture();$ami->members=array(dynamicMember(array('Location'=>$existing)));
    membershipCheck($service->join('6000','101')===false&&!count($ami->mutations()),'existing direct or Local equivalent is not duplicated: '.$existing);
}
list($ami,$db,$service)=membershipFixture();$ami->members=array(dynamicMember(array('Location'=>'Local/sales@custom/n','StateInterface'=>'PJSIP/101')));
membershipCheck($service->join('6000','101')===false&&!count($ami->mutations()),'authoritative state interface prevents an aliased duplicate');
list($ami,$db,$service)=membershipFixture();$ami->members=array(dynamicMember());
membershipCheck($service->leave('6000','PJSIP/101')===true&&$ami->mutations()[0]['action']==='QueueRemove','idle explicitly dynamic exact membership can sign out');
membershipCheck($ami->mutations()[0]['params']['Queue']==='6000'&&$ami->mutations()[0]['params']['Interface']==='PJSIP/101'&&$ami->mutations()[0]['retry']===false,'sign-out remains queue scoped and is not retried');
foreach(array(
    array('Membership'=>'static'),array('Membership'=>'realtime'),array('Membership'=>'unknown'),
    array('InCall'=>'1'),array('InCall'=>null),array('Status'=>'2'),array('Status'=>'6'),array('Status'=>'0')
) as $override){list($ami,$db,$service)=membershipFixture();$ami->members=array(dynamicMember($override));membershipCheck($service->leave('6000','PJSIP/101')===false&&!count($ami->mutations()),'static, realtime, ambiguous or active member cannot sign out');}
foreach(array('missing-queue','query-error','disconnect','timeout','mutation-error','mutation-lost') as $mode){
    list($ami,$db,$service)=membershipFixture($mode);
    membershipCheck($service->join('6000','101')===false&&$service->errMsg!=='',$mode.' sign-in reports failure');
    $expected=in_array($mode,array('mutation-error','mutation-lost'),true)?1:0;
    membershipCheck(count($ami->mutations())===$expected,$mode.' sign-in never makes an unverified or repeated membership mutation');
}
list($ami,$db,$service)=membershipFixture();
membershipCheck($service->join('6000',array('101'))===false&&!count($ami->requests),'array source is rejected before AMI access');
membershipCheck($service->leave('6000',"PJSIP/101\r\nQueue:6001")===false&&!count($ami->requests),'member header injection is rejected before AMI access');
echo "$variant: $checks checks; $failures failures\n";
exit($failures?1:0);
