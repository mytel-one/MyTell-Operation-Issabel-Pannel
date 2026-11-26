<?php
// Issabel performs authentication and module ACL checks before _moduleContent.
// Keep state-changing requests bound to that authenticated browser session.
function mytelAuthorizeMutation($method, $expected, $received)
{
    return $method === 'POST' && is_string($expected) && $expected !== '' &&
        is_string($received) && hash_equals($expected, $received);
}

function mytelValidateMutation($action, $input)
{
    $fields = array(
        'updateExtensionPanel' => array('panel', 'extension'),
        'updatePanelDesc' => array('panel', 'description'),
        'updatePanelSize' => array('panelgroup', 'width'),
        'callExtension' => array('source', 'target'),
        'hangupExtension' => array('target'),
        'hangupChannel' => array('channel', 'uniqueid'),
        'transferChannel' => array('channel', 'uniqueid', 'target'),
        'consultTransferChannel' => array('channel', 'uniqueid', 'target'),
        'parkChannel' => array('channel', 'uniqueid', 'lot'),
        'pickupChannel' => array('channel', 'uniqueid', 'source'),
        'toggleQueueMemberPause' => array('queue', 'interface', 'paused'),
        'joinQueueMember' => array('queue', 'source'),
        'leaveQueueMember' => array('queue', 'interface'),
        'voicemailExtension' => array('source'),
        'pbxStatusShutdown' => array(),
    );
    if (!is_string($action) || !isset($fields[$action])) return FALSE;
    foreach ($fields[$action] as $field) {
        if (!isset($input[$field]) || !is_string($input[$field])) return FALSE;
        $value = $input[$field];
        if (in_array($field, array('source', 'target', 'extension'), TRUE) &&
            !preg_match('/^[0-9#*]{1,40}$/D', $value)) return FALSE;
        if ($field === 'panel' && !preg_match('/^(Extension|Area[1-9]|Queues|Conferences|Parkinglots|TrunksSIP|Trunks)$/D', $value)) return FALSE;
        if ($field === 'description' && (!preg_match('//u', $value) ||
            (function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value)) > 100 ||
            preg_match('/[\x00-\x1f\x7f]/', $value))) return FALSE;
        if ($field === 'panelgroup' && !in_array($value, array('left', 'right'), TRUE)) return FALSE;
        if ($field === 'width' && (!ctype_digit($value) || (int)$value < 186 || (int)$value > 3840)) return FALSE;
    }
    if (in_array($action, array('hangupChannel','transferChannel','consultTransferChannel','parkChannel','pickupChannel'), TRUE) &&
        !mytelValidChannelIdentity($input['channel'], $input['uniqueid'])) return FALSE;
    if (in_array($action, array('transferChannel','consultTransferChannel'), TRUE) && !mytelValidInternalExtension($input['target'])) return FALSE;
    if (in_array($action, array('pickupChannel','joinQueueMember'), TRUE) && !mytelValidInternalExtension($input['source'])) return FALSE;
    if ($action === 'parkChannel' && !mytelValidParkingLot($input['lot'])) return FALSE;
    if (in_array($action, array('toggleQueueMemberPause','leaveQueueMember'), TRUE)) {
        require_once __DIR__ . '/mytelQueueMemberService.php';
        if (!mytelValidQueueMemberPause($input['queue'], $input['interface'], $action === 'leaveQueueMember' ? '0' : $input['paused'])) return FALSE;
    }
    if ($action === 'joinQueueMember' && preg_match('/^[0-9]{1,40}$/D', $input['queue']) !== 1) return FALSE;
    return TRUE;
}

function mytelValidChannelIdentity($channel, $uniqueid)
{
    return is_string($channel) && is_string($uniqueid) &&
        preg_match('~^[A-Za-z][A-Za-z0-9_]{0,20}/[A-Za-z0-9_.@;:+<>/-]{1,220}$~D', $channel) &&
        preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D', $uniqueid);
}


function mytelValidInternalExtension($extension)
{
    return is_string($extension) && preg_match('/^[0-9]{1,40}$/D', $extension) === 1;
}

function mytelValidParkingLot($lot)
{
    return is_string($lot) && preg_match('/^[A-Za-z0-9_.-]{1,80}$/D', $lot) === 1;
}
