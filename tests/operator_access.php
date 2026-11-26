<?php
// The browser can never grant itself a PBX control or access to a host tool.
$variant = $argv[1] ?? 'control_panel_en';
require dirname(__DIR__) . '/' . $variant . '/libs/mytelOperatorAccess.php';
class FixtureOperatorAcl {
    public function hasModulePrivilege($user, $resource, $privilege) {
        return $resource === 'control_panel' && $user === 'dispatcher' && $privilege === 'transfer';
    }
    public function isUserAuthorized($user, $action, $resource) {
        return $action === 'access' && $user === 'dispatcher' && $resource === 'cdrreport';
    }
}
function assertAccess($condition, $message) {
    if (!$condition) { fwrite(STDERR, $message."\n"); exit(1); }
}
$acl = new FixtureOperatorAcl();
assertAccess(mytelPermitAction($acl,'dispatcher','transferChannel'), 'Transfer privilege missing');
assertAccess(!mytelPermitAction($acl,'dispatcher','hangupChannel'), 'Transfer must not grant hangup');
assertAccess(!mytelPermitAction($acl,'observer','callExtension'), 'Observer must not dial');
assertAccess(!mytelPermitAction(NULL,'dispatcher','parkChannel'), 'Missing ACL must fail closed');
assertAccess(!mytelPermitAction($acl,'dispatcher','unrecognizedOperation'), 'Unknown actions must fail closed');
assertAccess(!mytelPermitAction($acl,'observer','toggleQueueMemberPause'), 'Queue changes need queue permission');
assertAccess(mytelPermitAction(NULL,'observer','pbxStatusShutdown'), 'Session polling shutdown does not control the PBX');
assertAccess(mytelOperatorCapabilities($acl,'dispatcher')['transfer'] === TRUE, 'Frontend capability mismatch');
assertAccess(mytelOperatorCapabilities($acl,'dispatcher')['layout'] === FALSE, 'Layout must require its own privilege');
$tools = mytelOperatorTools($acl,'dispatcher',dirname(__DIR__));
assertAccess($tools === array(), 'Missing installations must not produce links');
echo "Operator ACL checks passed\n";
