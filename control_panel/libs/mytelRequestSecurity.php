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
    if ($action === 'hangupChannel' && !mytelValidChannelIdentity($input['channel'], $input['uniqueid'])) return FALSE;
    return TRUE;
}

function mytelValidChannelIdentity($channel, $uniqueid)
{
    return is_string($channel) && is_string($uniqueid) &&
        preg_match('~^[A-Za-z][A-Za-z0-9_]{0,20}/[A-Za-z0-9_.@;:+<>/-]{1,220}$~D', $channel) &&
        preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D', $uniqueid);
}

