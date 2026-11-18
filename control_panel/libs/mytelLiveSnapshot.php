<?php
// MyTel modifications, 2026-11-18. Pure normalization of observed AMI data.
require_once __DIR__ . '/mytelCallDirection.php';
function mytelBuildLiveSnapshot($channels, $phones, $queues, $timestamp, $trunks = array())
{
    $unique = array();
    foreach ($channels as $channel) {
        if (!isset($channel['Channel']) || !is_string($channel['Channel']) || $channel['Channel'] === '') continue;
        $raw = $channel;
        $channel = array();
        foreach (array('Channel','CallerIDNum','CallerIDName','ConnectedLineNum','ConnectedLineName',
            'EffectiveConnectedLineNum','EffectiveConnectedLineName','ChannelState','ChannelStateDesc',
            'Uniqueid','Linkedid','BridgeID','BridgedChannel','Context','Extension','Priority','Application',
            'DNID','Readformat','Writeformat','Nativeformats','Type','Seconds','Since') as $field) {
            $value = isset($raw[$field]) && is_scalar($raw[$field]) ? $raw[$field] : NULL;
            if (is_string($value) && in_array(strtolower(trim($value)), array('', 'unknown', '<unknown>', '<no name>'), TRUE)) $value = NULL;
            $channel[$field] = $value;
        }
        // Application arguments may contain dial credentials. Keep the legacy
        // field shape without publishing arbitrary dialplan data or headers.
        $channel['AppData'] = NULL;
        $channel['Variables'] = isset($raw['Variables']) && is_array($raw['Variables']) ? $raw['Variables'] : array();
        $unique[$channel['Channel']] = $channel;
    }
    $queueChannels = array();
    foreach ($queues as $key => $queue) {
        $number = isset($queue['extension']) ? (string)$queue['extension'] : (string)$key;
        foreach (isset($queue['callers']) ? $queue['callers'] : array() as $caller) {
            if (isset($caller['Channel'])) $queueChannels[$caller['Channel']][] = $number;
        }
    }
    $calls = array();
    foreach ($unique as $name => &$channel) {
        $endpoint = preg_replace('/-[[:xdigit:]]+(?:<ZOMBIE>|<MASQ>)*(?:;[0-9]+)?$/', '', $name);
        $channel['local_extension'] = isset($phones[$endpoint]['extension']) ? (string)$phones[$endpoint]['extension'] : NULL;
        $channel['direction'] = NULL; // Unknown unless explicit metadata or observed origin evidence supports it.
        $channel['direction_source'] = NULL;
        $channel['started_at'] = isset($channel['Since']) && is_numeric($channel['Since']) ? (int)$channel['Since'] : NULL;
        $channel['elapsed_seconds'] = is_null($channel['started_at']) ? NULL : max(0, (int)$timestamp - $channel['started_at']);
        $variables = isset($channel['Variables']) && is_array($channel['Variables']) ? $channel['Variables'] : array();
        $directions = array('INBOUND'=>'incoming', 'OUTBOUND'=>'outgoing', 'INTERNAL'=>'internal');
        $reported = isset($variables['DIRECTION']) && is_string($variables['DIRECTION']) ? strtoupper(trim($variables['DIRECTION'])) : '';
        if (isset($directions[$reported])) { $channel['direction'] = $directions[$reported]; $channel['direction_source'] = 'dialplan:DIRECTION'; }
        $answer = isset($variables['CDR(answer,u)']) && is_numeric($variables['CDR(answer,u)']) ? (float)$variables['CDR(answer,u)'] : 0;
        $channel['answered_at'] = $answer > 0 && $answer <= $timestamp ? $answer : NULL;
        $channel['answered_seconds'] = is_null($channel['answered_at']) ? NULL : (int)floor($timestamp - $answer);
        $hold = isset($variables['CHANNEL(onhold)']) ? (string)$variables['CHANNEL(onhold)'] : '';
        $channel['on_hold'] = $hold === '1' ? TRUE : ($hold === '0' ? FALSE : NULL);
        unset($channel['Variables']); // Never expose arbitrary channel variable dictionaries.
        $channel['queue_ids'] = isset($queueChannels[$name]) ? array_values(array_unique($queueChannels[$name])) : array();
        $linked = isset($channel['Linkedid']) && $channel['Linkedid'] !== '' ? $channel['Linkedid'] : NULL;
        $identity = $linked ? 'linked:' . $linked : (!empty($channel['Uniqueid']) ? 'unique:' . $channel['Uniqueid'] : 'channel:' . $name);
        if (!isset($calls[$identity])) $calls[$identity] = array('id'=>$identity, 'linkedid'=>$linked,
            'channels'=>array(), 'extensions'=>array(), 'state'=>'Unknown', 'started_at'=>NULL,
            'elapsed_seconds'=>NULL, 'answered_at'=>NULL, 'answered_seconds'=>NULL, 'direction'=>NULL, 'queue_ids'=>array());
        $call =& $calls[$identity];
        $call['channels'][] = $channel;
        if (!is_null($channel['local_extension']) && !in_array($channel['local_extension'], $call['extensions'], TRUE))
            $call['extensions'][] = $channel['local_extension'];
        $call['queue_ids'] = array_values(array_unique(array_merge($call['queue_ids'], $channel['queue_ids'])));
        if (!is_null($channel['started_at']) && (is_null($call['started_at']) || $channel['started_at'] < $call['started_at']))
            $call['started_at'] = $channel['started_at'];
        if (!is_null($channel['answered_at']) && (is_null($call['answered_at']) || $channel['answered_at'] < $call['answered_at']))
            $call['answered_at'] = $channel['answered_at'];
        $weights = array('Unknown'=>0,'Down'=>1,'Busy'=>2,'Dialing'=>3,'Ring'=>4,'Ringing'=>4,'Up'=>5);
        $state = isset($channel['ChannelStateDesc']) && isset($weights[$channel['ChannelStateDesc']]) ? $channel['ChannelStateDesc'] : 'Unknown';
        if ($weights[$state] > $weights[$call['state']]) $call['state'] = $state;
        unset($call);
    }
    unset($channel);
    foreach ($calls as &$call) {
        $call['elapsed_seconds'] = is_null($call['started_at']) ? NULL : max(0, (int)$timestamp - $call['started_at']);
        $call['answered_seconds'] = is_null($call['answered_at']) ? NULL : (int)floor($timestamp - $call['answered_at']);
        $call['channel_count'] = count($call['channels']);
        if (count($call['queue_ids'])) $call['state'] = 'Waiting';
        $call['direction'] = mytelClassifyCallDirection($call['channels'], $phones, $trunks);
        foreach ($call['channels'] as &$leg) {
            if (is_null($leg['direction']) && !is_null($call['direction'])) {
                $leg['direction'] = $call['direction'];
                $leg['direction_source'] = 'linked-call';
            }
            $unique[$leg['Channel']] = $leg;
        }
        unset($leg);
    }
    unset($call);
    return array('live_channels'=>array_values($unique), 'live_calls'=>array_values($calls));
}
