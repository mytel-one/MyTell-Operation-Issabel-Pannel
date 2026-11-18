<?php
// Standalone PHP 7.4+ regression tests. All PBX/AMI calls are isolated doubles.
$root = dirname(__DIR__);
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
$module = $root . '/' . $variant;
$failures = 0;
$checks = 0;
function check($condition, $message) {
    global $failures, $checks;
    $checks++;
    if (!$condition) $failures++;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . "\n";
}
function loadClassWithoutDependencies($file) {
    $source = file_get_contents($file);
    $source = preg_replace('/^\s*require_once[^;]+;\s*$/m', '', $source);
    eval('?>' . $source);
}
function _tr($value) { return $value; }
function obtenerClaveAMIAdmin() { return 'test-only'; }
class paloDB { public $errMsg = ''; function __construct($dsn) {} }
class AGI_AsteriskManager2 {
    static $dial = FALSE;
    static $originates = array();
    static $hangups = array();
    static $channels = '';
    static $currentIdentity = '1000.1';
    static $originateParameters = NULL;
    function setDeadline($deadline) {}
    function connect() { return TRUE; }
    function disconnect() {}
    function database_get($family, $key) { return $family === 'DEVICE' ? self::$dial : 'Test'; }
    function Originate($channel) { self::$originates[] = $channel; return array('Response' => 'Success'); }
    function Command($command) { return array('Response' => 'Follows', 'data' => self::$channels); }
    function Hangup($channel) { self::$hangups[] = $channel; return array('Response' => 'Success'); }
    function send_request($action, $parameters) {
        if ($action === 'Originate') { self::$originateParameters = $parameters; self::$originates[] = $parameters['Channel']; }
        return array('Response'=>'Success', 'Value'=>self::$currentIdentity);
    }
}
$arrConf = array('dsn_conn_database' => 'unused');
require_once $module . '/libs/mytelRequestSecurity.php';
loadClassWithoutDependencies($module . '/libs/paloControlPanelUtils.class.php');
$utils = new paloControlPanelUtils();
check($utils->callExtension('100', '101') === FALSE && !count(AGI_AsteriskManager2::$originates), 'missing AstDB dial channel never originates a call');
AGI_AsteriskManager2::$dial = 'PJSIP/100';
$utils->callExtension('100', '101');
check(isset(AGI_AsteriskManager2::$originateParameters['Async']) && AGI_AsteriskManager2::$originateParameters['Async'] === 'true', 'callback calls enqueue asynchronously rather than blocking the live workspace');
check(isset(AGI_AsteriskManager2::$originateParameters['CallerID']) && AGI_AsteriskManager2::$originateParameters['CallerID'] === 'Test <100>', 'callback caller ID uses the named AMI parameter across PHPAGI versions');
AGI_AsteriskManager2::$dial = 'SIP/10';
AGI_AsteriskManager2::$channels = 'SIP/100-00000001!a!b!c!d!e!f!g!h!i!j' . "\n" . 'SIP/10-00000002!a!b!c!d!e!f!g!h!i!j';
$utils->hangupExtension('10');
check(AGI_AsteriskManager2::$hangups === array('SIP/10-00000002'), 'hangup matches the exact extension channel, not a longer extension');
check(method_exists($utils, 'hangupChannel'), 'precise channel hangup is available');
if (method_exists($utils, 'hangupChannel')) {
    AGI_AsteriskManager2::$hangups = array();
    check($utils->hangupChannel('PJSIP/100-00000001', 'stale.1') === FALSE && !count(AGI_AsteriskManager2::$hangups), 'a stale channel identity never hangs up a replacement call');
    check($utils->hangupChannel("PJSIP/100-00000001\r\nAction: Hangup", '1000.1') === FALSE && !count(AGI_AsteriskManager2::$hangups), 'channel header injection is rejected before AMI');
    check($utils->hangupChannel('PJSIP/100-00000001', '1000.1') === TRUE && AGI_AsteriskManager2::$hangups === array('PJSIP/100-00000001'), 'matching live channel identity hangs up only the requested call leg');
}
loadClassWithoutDependencies($module . '/libs/paloInterfaceSSE.class.php');
loadClassWithoutDependencies($module . '/libs/paloControlPanelStatus.class.php');
$ref = new ReflectionClass('paloControlPanelStatus');
$panel = $ref->newInstanceWithoutConstructor();
function setPanel($panel, $name, $value) { $p = new ReflectionProperty('paloControlPanelStatus', $name); $p->setAccessible(TRUE); $p->setValue($panel, $value); }
function getPanel($panel, $name) { $p = new ReflectionProperty('paloControlPanelStatus', $name); $p->setAccessible(TRUE); return $p->getValue($panel); }
setPanel($panel, '_enumsInProgress', 1);
setPanel($panel, '_actionid', 'test');
setPanel($panel, '_internalState', array('phones' => array('PJSIP/100' => array()), 'iptrunks' => array('PJSIP/provider' => array())));
$panel->msg_EndpointList('EndpointList', array('ActionID'=>'test','ObjectName'=>'100','DeviceState'=>'Busy','Contacts'=>'100/sip:100@192.0.2.10:5060;ob,'), '', 0);
$state = getPanel($panel, '_internalState');
check($state['phones']['PJSIP/100']['registered'] === TRUE, 'busy PJSIP extension remains registered');
check($state['phones']['PJSIP/100']['ip'] === '192.0.2.10', 'PJSIP contact exposes address without SIP scheme or port');
$panel->msg_EndpointList('EndpointList', array('ActionID'=>'test','ObjectName'=>'provider','DeviceState'=>'Not in use','Contacts'=>'provider/sip:provider@[2001:db8::1]:5060,'), '', 0);
$state = getPanel($panel, '_internalState');
check($state['iptrunks']['PJSIP/provider']['ip'] === '2001:db8::1', 'PJSIP trunk IPv6 contacts parse correctly');
// Pure request-policy checks do not require a logged-in Issabel session.
$security = $module . '/libs/mytelRequestSecurity.php';
check(is_file($security), 'request policy helper is present');
if (is_file($security)) {
    require_once $security;
    check(mytelValidateMutation('callExtension', array('source'=>'100','target'=>'101')) === TRUE, 'valid call parameters are accepted');
    check(mytelValidateMutation('callExtension', array('source'=>array('100'),'target'=>'101')) === FALSE, 'array parameters are rejected without PHP warnings');
    check(mytelValidateMutation('updatePanelSize', array('panelgroup'=>'left','width'=>'150000000')) === FALSE, 'panel widths are bounded');
    check(mytelValidateMutation('updatePanelDesc', array('panel'=>'Area1','description'=>str_repeat('x',101))) === FALSE, 'panel descriptions are length bounded');
    check(mytelAuthorizeMutation('POST', 'test-token', 'test-token') === TRUE, 'matching POST CSRF token is accepted');
    check(mytelAuthorizeMutation('GET', 'test-token', 'test-token') === FALSE, 'GET never authorizes a state change');
    check(mytelAuthorizeMutation('POST', 'test-token', 'other') === FALSE, 'wrong CSRF token is rejected');
    check(mytelValidateMutation('hangupChannel', array('channel'=>'PJSIP/100-00000001','uniqueid'=>'1000.1')) === TRUE, 'exact channel action accepts an observed channel and uniqueid');
    check(mytelValidateMutation('hangupChannel', array('channel'=>'/.*/','uniqueid'=>'1000.1')) === FALSE, 'regex channel selection is forbidden');
}
loadClassWithoutDependencies($module . '/index.php');
$databasePath = tempnam(sys_get_temp_dir(), 'mytel-regression-');
$database = new SQLite3($databasePath);
$database->exec('CREATE TABLE area (id INTEGER PRIMARY KEY, name TEXT, height INTEGER, width INTEGER, description TEXT, no_column INTEGER, color TEXT)');
$database->exec("INSERT INTO area (name,description) VALUES ('Area1','Existing one'),('Area3','Existing three')");
$database->close();
check(checkAreas($databasePath) === TRUE && checkAreas($databasePath) === TRUE, 'area initialization tolerates gaps and can run twice');
$database = new SQLite3($databasePath);
check($database->querySingle('SELECT COUNT(*) FROM area') === 9, 'area initialization never duplicates an existing area');
check($database->querySingle("SELECT description FROM area WHERE name='Area3'") === 'Existing three', 'existing area descriptions are preserved');
$database->close();
unlink($databasePath);
check(checkAreas($databasePath) === FALSE && !file_exists($databasePath), 'missing database is reported without creating an empty database');
echo "$checks checks; $failures failures\n";
exit($failures ? 1 : 0);
