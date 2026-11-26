<?php
// Issabel owns user membership and per-module privileges. Every operation is
// re-authorized server-side, including requests from older panel tabs.
function mytelActionPrivileges()
{
    return array(
        'callExtension' => 'call',
        'voicemailExtension' => 'call',
        'hangupExtension' => 'hangup',
        'hangupChannel' => 'hangup',
        'transferChannel' => 'transfer',
        'consultTransferChannel' => 'transfer',
        'pickupChannel' => 'pickup',
        'parkChannel' => 'park',
        'toggleQueueMemberPause' => 'queues',
        'joinQueueMember' => 'membership',
        'leaveQueueMember' => 'membership',
        'updateExtensionPanel' => 'layout',
        'updatePanelDesc' => 'layout',
        'updatePanelSize' => 'layout',
    );
}

function mytelHasPrivilege($acl, $user, $privilege)
{
    if (!is_object($acl) || !is_callable(array($acl, 'hasModulePrivilege')) || !is_string($user) || $user === '') return FALSE;
    return $acl->hasModulePrivilege($user, 'control_panel', $privilege) === TRUE;
}

function mytelPermitAction($acl, $user, $action)
{
    if ($action === 'pbxStatusShutdown') return TRUE;
    $actions = mytelActionPrivileges();
    return isset($actions[$action]) && mytelHasPrivilege($acl, $user, $actions[$action]);
}

function mytelOperatorCapabilities($acl, $user)
{
    $capabilities = array();
    foreach (array_unique(mytelActionPrivileges()) as $privilege)
        $capabilities[$privilege] = mytelHasPrivilege($acl, $user, $privilege);
    return $capabilities;
}

// Keep call-party information and AMI arguments out of the system audit log.
function mytelLogControl($user, $action, $outcome)
{
    if (!isset(mytelActionPrivileges()[$action])) return;
    $event = array('operator' => substr((string)$user, 0, 128), 'action' => $action, 'outcome' => $outcome);
    openlog('mytel-operation', LOG_PID, LOG_AUTHPRIV);
    syslog(LOG_INFO, json_encode($event, JSON_INVALID_UTF8_SUBSTITUTE));
    closelog();
}

function mytelOperatorTools($acl, $user, $webRoot)
{
    if (!$user || !is_object($acl) || !is_callable(array($acl, 'isUserAuthorized'))) return array();
    $catalog = array(
        array('cdrreport', 'Call detail records', 'modules/cdrreport/index.php'),
        array('address_book', 'Address book', 'modules/address_book/index.php'),
        array('conference', 'Conference rooms', 'modules/conference/index.php'),
        array('voicemail', 'Voicemail', 'modules/voicemail/index.php'),
        array('monitoring', 'Call recordings', 'modules/monitoring/index.php'),
        array('fop2app', 'FOP2 console', 'fop2/index.html'),
        array('fop2manager', 'FOP2 Manager', 'fop2/admin/index.php'),
        array('group_permission', 'Group permissions', 'modules/group_permission/index.php'),
    );
    $tools = array();
    foreach ($catalog as $entry) {
        list($resource, $label, $installedFile) = $entry;
        if (!is_file($webRoot . '/' . $installedFile) || !$acl->isUserAuthorized($user, 'access', $resource)) continue;
        $tool = array('label' => $label, 'url' => 'index.php?menu=' . $resource);
        if ($resource === 'fop2app') $tool['embed_url'] = 'fop2/';
        $tools[] = $tool;
    }
    return $tools;
}
