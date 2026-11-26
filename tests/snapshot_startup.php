<?php
// Snapshot integration against the real status collector, using synthetic
// database and AMI protocol-boundary doubles. No PBX connection is opened.
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
if (!in_array($variant, array('control_panel', 'control_panel_en'), true)) exit(2);
$module = dirname(__DIR__) . '/' . $variant;
$checks = $failures = 0;
set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});
function assertSnapshot($condition, $message) {
    global $checks, $failures;
    $checks++;
    if (!$condition) $failures++;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . "\n";
}
function loadSnapshotClass($file) {
    $source = preg_replace('/^\s*require_once[^;]+;\s*$/m', '', file_get_contents($file));
    eval('?>' . $source);
}
function _tr($text) { return $text; }
function getParameter($name) { return null; }
function obtenerClaveAMIAdmin() { return 'synthetic-only'; }
function generarDSNSistema($user, $database) { return 'synthetic-pbx'; }
function getTrunks($database) { return array(); }

class paloDB {
    public $errMsg = '';
    public static $deviceCount = 100;
    private $layout;
    function __construct($dsn) { $this->layout = ($dsn === 'synthetic-layout'); }
    function disconnect() {}
    function getFirstRowQuery($sql, $assoc = false, $params = array()) { return array(); }
    function fetchTable($sql, $assoc = false, $params = array()) {
        if ($this->layout) return array(array('id_device' => '1000', 'name' => 'Area1'));
        if (strpos($sql, 'FROM devices') !== false) {
            $rows = array();
            for ($i = 0; $i < self::$deviceCount; $i++) $rows[] = array(
                'channel' => 'PJSIP/' . (1000 + $i), 'tech' => 'pjsip',
                'extension' => (string)(1000 + $i), 'description' => 'Synthetic operator ' . $i);
            return $rows;
        }
        if (strpos($sql, 'FROM queues_config') !== false) return array(
            array('extension' => '6000', 'description' => 'Synthetic support'),
            array('extension' => '6001', 'description' => 'Synthetic sales'));
        return array();
    }
}

class AGI_AsteriskManager2 {
    public static $mode = 'populated';
    public static $last;
    public $socket = true;
    public $calls = array();
    public $loginEvents;
    public $deadline;
    private $handlers = array();
    private $events = array();
    function __construct() { self::$last = $this; }
    function setDeadline($deadline) { $this->deadline = $deadline; }
    function connect($host, $user, $secret, $events = 'on') {
        $this->loginEvents = $events;
        return self::$mode !== 'login-failure';
    }
    function disconnect($silent = false) { $this->socket = null; }
    function add_event_handler($event, $handler) { $this->handlers[$event] = $handler; }
    private function enqueue($event, $params, $action) {
        $params['ActionID'] = $action;
        $this->events[] = array($event, $params);
    }
    function MailboxCounts($mailboxes, $action) {
        $this->calls['mailboxes'] = $mailboxes;
        if (self::$mode === 'mailbox-failure') return false;
        $counts = array();
        foreach ($mailboxes as $mailbox) $counts[$mailbox] = array(
            'Response' => 'Success', 'UrgMessages' => '1', 'NewMessages' => '2', 'OldMessages' => '3');
        return $counts;
    }
    function Command($command) { $this->calls[] = $command; return array('Response' => 'Error'); }
    function SIPPeers($action) { throw new RuntimeException('SIP enumeration is unnecessary for PJSIP-only fixture'); }
    function IAXpeerlist($action) { throw new RuntimeException('IAX enumeration is unnecessary for PJSIP-only fixture'); }
    function PJSIPShowEndpoints($action) {
        for ($i = 0; $i < paloDB::$deviceCount; $i++) $this->enqueue('EndpointList', array(
            'ObjectName' => (string)(1000 + $i), 'DeviceState' => $i === 0 ? 'Busy' : 'Not in use',
            'Contacts' => (1000 + $i) . '/sip:' . (1000 + $i) . '@192.0.2.10:5060,'), $action);
        $this->enqueue('EndpointListComplete', array(), 'foreign-action');
        $this->enqueue('EndpointListComplete', array(), $action);
        return array('Response' => 'Success');
    }
    function Status($channel, $action) {
        $this->calls[] = 'Status';
        if (self::$mode !== 'empty') {
            foreach (array('Up', 'Ringing') as $i => $state) $this->enqueue('Status', array(
                'Channel' => 'PJSIP/1000-0000000' . ($i + 1),
                'Uniqueid' => '1700000000.' . ($i + 1), 'Linkedid' => '1700000000.' . ($i + 1),
                'CallerIDNum' => (string)(900001 + $i), 'CallerIDName' => 'Synthetic caller ' . $i,
                'ConnectedLineNum' => '1000', 'ConnectedLineName' => 'Synthetic operator',
                'ChannelStateDesc' => $state, 'Context' => 'from-internal',
                'Exten' => '1000', 'Priority' => '1', 'Seconds' => (string)(30 + $i)), $action);
        }
        if (self::$mode !== 'missing-complete') $this->enqueue('StatusComplete', array(), $action);
        return array('Response' => 'Success');
    }
    function QueueStatus($action) {
        foreach (array('6000', '6001') as $queue) {
            $this->enqueue('QueueParams', array('Queue' => $queue, 'Completed' => '17', 'Abandoned' => '3'), $action);
            $this->enqueue('QueueMember', array('Queue' => $queue, 'Location' => 'PJSIP/1000',
                'StateInterface' => 'PJSIP/1000', 'Name' => 'Synthetic operator', 'Status' => '2', 'Paused' => '0'), $action);
            if (self::$mode !== 'empty') for ($i = 0; $i < 5; $i++) $this->enqueue('QueueEntry', array(
                'Queue' => $queue, 'Position' => (string)($i + 1),
                'Channel' => 'Local/synthetic-' . $queue . '-' . $i . ';1',
                'Uniqueid' => '1700000010.' . $queue . $i,
                'CallerIDNum' => (string)(900010 + $i), 'CallerIDName' => 'Waiting synthetic caller',
                'ConnectedLineNum' => '<unknown>', 'ConnectedLineName' => '<unknown>',
                'Wait' => (string)(20 + $i)), $action);
        }
        $this->enqueue('QueueStatusComplete', array(), $action);
        return array('Response' => 'Success');
    }
    function procesarPaquetes() {
        if (self::$mode === 'disconnect') { $this->socket = null; return false; }
        if (!$this->events) return false;
        list($event, $params) = array_shift($this->events);
        if (isset($this->handlers[$event])) call_user_func($this->handlers[$event], $event, $params, '', 0);
        return true;
    }
    function procesarActividad($timeout) { if ($timeout) usleep(1000); return false; }
}

$arrConf = array('dsn_conn_database' => 'synthetic-layout');
loadSnapshotClass($module . '/libs/paloInterfaceSSE.class.php');
// New versions use this pure response normalizer; older versions do not.
if (is_file($module . '/libs/mytelLiveSnapshot.php')) require_once $module . '/libs/mytelLiveSnapshot.php';
require_once $module . '/libs/mytelCallActionService.php';
loadSnapshotClass($module . '/libs/paloControlPanelStatus.class.php');
function collectSnapshot($mode, $deadline = null) {
    AGI_AsteriskManager2::$mode = $mode;
    $panel = new paloControlPanelStatus(true);
    if ($deadline !== null) {
        $property = new ReflectionProperty('paloControlPanelStatus', '_snapshotDeadline');
        $property->setAccessible(true); $property->setValue($panel, microtime(true) + $deadline);
    }
    try { return $panel->snapshot(); } finally { $panel->shutdown(); }
}
function snapshotObjects($response, $type, $keyField) {
    $objects = array();
    foreach ($response['pbxchanges'] as $row) if ($row['objtype'] === $type) $objects[$row[$keyField]] = $row;
    return $objects;
}

$response = collectSnapshot('populated');
assertSnapshot(!isset($response['error']) && $response['snapshot'] === true, 'snapshot completes without unsolicited AMI events');
assertSnapshot(AGI_AsteriskManager2::$last->loginEvents === 'off', 'snapshot login disables unsolicited events');
$phones = snapshotObjects($response, 'phones', 'channel');
$queues = snapshotObjects($response, 'queues', 'extension');
assertSnapshot(count($phones) === 100, 'all 100 configured extensions are included');
assertSnapshot(count(AGI_AsteriskManager2::$last->calls['mailboxes']) === 100, 'mailbox request covers every extension once');
assertSnapshot($phones['PJSIP/1000']['current_area'] === 'Area1', 'saved panel assignment is included');
assertSnapshot($phones['PJSIP/1000']['registered'] === true, 'busy extension remains registered in a complete snapshot');
assertSnapshot($phones['PJSIP/1000']['NewMessages'] === 2, 'mailbox counts survive complete snapshot collection');
assertSnapshot(count($phones['PJSIP/1000']['active']) === 2, 'multiple concurrent channels on one extension survive collection');
assertSnapshot($phones['PJSIP/1000']['active'][0]['ChannelStateDesc'] === 'Up' && $phones['PJSIP/1000']['active'][1]['ChannelStateDesc'] === 'Ringing', 'answered and ringing channel states remain distinct');
assertSnapshot($phones['PJSIP/1000']['active'][0]['CallerIDNum'] === '900001', 'actual synthetic caller identity is retained');
assertSnapshot(count($queues) === 2 && count($queues['6000']['callers']) === 5 && count($queues['6001']['callers']) === 5, 'ten preexisting waiting callers load into their respective queues');
assertSnapshot(strpos($queues['6000']['callers'][0]['Channel'], 'synthetic-6000-') !== false && strpos($queues['6001']['callers'][0]['Channel'], 'synthetic-6001-') !== false, 'queue callers never bleed between queues');
assertSnapshot($queues['6000']['Completed'] === 17 && $queues['6000']['Abandoned'] === 3, 'queue counters are part of each complete snapshot');
assertSnapshot(abs(time() - $queues['6000']['callers'][0]['QueueSince'] - 20) <= 1, 'queue wait timestamp starts from the AMI waiting duration');
assertSnapshot(count($queues['6000']['memberRefresh']) === 1 && $queues['6000']['memberRefresh'][0]['Status'] === '2', 'busy queue-member state is included at startup');

paloDB::$deviceCount = 99;
$next = collectSnapshot('empty');
$nextPhones = snapshotObjects($next, 'phones', 'channel');
$nextQueues = snapshotObjects($next, 'queues', 'extension');
assertSnapshot(count($nextPhones) === 99 && !isset($nextPhones['PJSIP/1099']), 'removed extension is absent from the next complete snapshot');
assertSnapshot(count($nextPhones['PJSIP/1000']['active']) === 0, 'ended calls disappear without a hangup event or page refresh');
assertSnapshot(count($nextQueues['6000']['callers']) === 0 && count($nextQueues['6001']['callers']) === 0, 'answered or departed queue callers disappear from fresh snapshots');

$started = microtime(true);
$timeout = collectSnapshot('missing-complete', 0.03);
assertSnapshot(isset($timeout['error']) && stripos($timeout['error'], 'timed out') !== false, 'missing enumeration completion produces an explicit timeout');
assertSnapshot(microtime(true) - $started < 1, 'collector respects its supplied startup deadline');
assertSnapshot(count($timeout['pbxchanges']) === 0, 'incomplete enumeration is not published as a complete object list');
foreach (array('disconnect', 'mailbox-failure', 'login-failure') as $mode) {
    $failed = collectSnapshot($mode);
    assertSnapshot(isset($failed['error']) && count($failed['pbxchanges']) === 0, $mode . ' reports failure instead of publishing an empty successful view');
}
echo "$variant: $checks checks; $failures failures\n";
exit($failures ? 1 : 0);
