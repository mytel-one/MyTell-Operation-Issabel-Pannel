<?php
// Synthetic AMI boundary only. Never connects to or mutates a real PBX.
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
$file = dirname(__DIR__) . '/' . $variant . '/libs/mytelQueueMemberService.php';
$checks = $failures = 0;
function queueCheck($condition, $message) {
    global $checks, $failures;
    $checks++; if (!$condition) $failures++;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . "\n";
}
if (!is_file($file)) { queueCheck(false, 'queue member service exists'); exit(1); }
require $file;
class QueueFixtureAMI {
    public $socket = true;
    public $mode = 'normal';
    public $paused = '0';
    public $requests = array();
    public $deadline;
    private $handlers = array();
    private $events = array();
    function setDeadline($deadline) { $this->deadline = $deadline; }
    function add_event_handler($event, $callback) { $this->handlers[strtolower($event)] = $callback; }
    function send_request($action, $params = array(), $retry = true) {
        $this->requests[] = array('action'=>$action, 'params'=>$params, 'retry'=>$retry);
        if ($action === 'QueueStatus') {
            if ($this->mode === 'query-error') return array('Response'=>'Error');
            $id = $params['ActionID'];
            $this->events[] = array('QueueParams', array('ActionID'=>$id, 'Queue'=>$params['Queue']));
            $this->events[] = array('QueueMember', array('ActionID'=>'stale-id', 'Queue'=>$params['Queue'], 'Location'=>$params['Member'], 'Paused'=>'1'));
            if ($this->mode !== 'missing-member') $this->events[] = array('QueueMember', array(
                'ActionID'=>$id, 'Queue'=>$this->mode === 'wrong-queue' ? '6001' : $params['Queue'],
                'Location'=>$this->mode === 'prefix-member' ? $params['Member'].'1' : $params['Member'],
                'Paused'=>$this->mode === 'unknown-paused' ? 'unknown' : $this->paused));
            if ($this->mode !== 'timeout') $this->events[] = array('QueueStatusComplete', array('ActionID'=>$id));
            return array('Response'=>'Success');
        }
        if ($action === 'QueuePause') {
            if ($this->mode === 'pause-error') return array('Response'=>'Error', 'Message'=>'synthetic failure');
            if ($this->mode === 'pause-lost') return false;
            return array('Response'=>'Success');
        }
        throw new RuntimeException('Unexpected AMI action');
    }
    function procesarPaquetes() {
        if ($this->mode === 'disconnect') { $this->socket = null; return false; }
        if (!$this->events) return false;
        list($event, $params) = array_shift($this->events);
        if (isset($this->handlers[strtolower($event)])) call_user_func($this->handlers[strtolower($event)], $event, $params, '', 0);
        return true;
    }
    function procesarActividad($timeout) { usleep(1000); return false; }
    function mutations() { return array_values(array_filter($this->requests, function ($request) { return $request['action'] === 'QueuePause'; })); }
}
function queueFixture($mode = 'normal', $paused = '0', $seconds = 1) {
    $ami = new QueueFixtureAMI(); $ami->mode = $mode; $ami->paused = $paused;
    return array($ami, new MytelQueueMemberService($ami, microtime(true) + $seconds));
}
list($ami,$service)=queueFixture();
queueCheck($service->setPaused('6000','PJSIP/101','1') === true && $service->changed === true, 'existing exact queue member can be paused');
$mutation=$ami->mutations()[0];
queueCheck($mutation['params']['Queue']==='6000' && $mutation['params']['Interface']==='PJSIP/101', 'pause is scoped to one queue and one exact interface');
queueCheck($mutation['params']['Paused']==='true' && $mutation['retry']===false, 'pause uses the documented boolean and is never retried after uncertain delivery');
queueCheck($ami->requests[0]['params']['Queue']==='6000' && $ami->requests[0]['params']['Member']==='PJSIP/101', 'fresh membership query is bounded to the selected queue member');
list($ami,$service)=queueFixture('normal','1');
queueCheck($service->setPaused('6000','PJSIP/101','0') === true && $ami->mutations()[0]['params']['Paused']==='false', 'resume explicitly unpauses the selected existing member');
list($ami,$service)=queueFixture('normal','1');
queueCheck($service->setPaused('6000','PJSIP/101','1') === true && !$service->changed && !count($ami->mutations()), 'already desired state is idempotent and sends no mutation');
foreach (array('missing-member','wrong-queue','prefix-member','unknown-paused','query-error','disconnect','timeout','pause-error','pause-lost') as $mode) {
    list($ami,$service)=queueFixture($mode,'0',0.025);
    queueCheck($service->setPaused('6000','PJSIP/101','1') === false && $service->errMsg !== '', $mode . ' returns a truthful failure');
    $expected = in_array($mode,array('pause-error','pause-lost'),true) ? 1 : 0;
    queueCheck(count($ami->mutations())===$expected, $mode . ' never triggers a stale, cross-queue or repeated pause');
}
foreach (array(
    array('', 'PJSIP/101','1'), array('6000',"PJSIP/101\r\nQueue: 6001",'1'),
    array('6000','PJSIP/101','true'), array('6000',array('PJSIP/101'),'1'),
    array(array('6000'),'PJSIP/101','1'), array('6000','PJSIP/101',array('1')),
    array('6000','PJSIP/101',''), array('6000;rm','PJSIP/101','1')
) as $input) {
    list($ami,$service)=queueFixture();
    queueCheck($service->setPaused($input[0],$input[1],$input[2]) === false && !count($ami->requests), 'invalid input is rejected before contacting AMI');
}
list($ami,$service)=queueFixture('normal','0',-1);
queueCheck($service->setPaused('6000','PJSIP/101','1') === false && !count($ami->requests), 'expired overall deadline never sends a queue command');
queueCheck(mytelValidQueueMemberPause('6000','Local/101@from-queue/n','0'), 'existing Local queue member interfaces are supported without rewriting');
echo "$variant: $checks checks; $failures failures\n";
exit($failures ? 1 : 0);
