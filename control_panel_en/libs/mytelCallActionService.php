<?php
// MyTel, 2026-11-26. Guarded native Asterisk operator operations.
// The caller owns Issabel ACL/CSRF, fresh AMI login, and disconnect.
require_once __DIR__ . '/mytelRequestSecurity.php';

class MytelCallActionService
{
    public $errMsg = '';
    private $ami;
    private $db;
    private $deadline;
    private $catalog = NULL;

    function __construct($ami, $pbxDb, $absoluteDeadline)
    {
        $this->ami = $ami;
        $this->db = $pbxDb;
        $this->deadline = $absoluteDeadline;
    }

    function transferChannel($channel, $uniqueid, $target, $consult = FALSE)
    {
        $this->errMsg = '';
        if (!mytelValidChannelIdentity($channel, $uniqueid) || !mytelValidInternalExtension($target))
            return $this->failure('Invalid call or internal destination. Refresh and try again.');
        try {
            $catalog = $this->loadCatalog();
            $endpoint = self::endpoint($channel);
            if (!$catalog || !isset($catalog['dial'][$endpoint], $catalog['id'][$target]) ||
                $catalog['dial'][$endpoint]['dial'] === $catalog['id'][$target]['dial'])
                return $this->failure('Choose a connected local extension and a different configured internal destination.');
            $current = $this->currentChannel($channel, $uniqueid);
            if (!$current || !isset($current['ChannelStateDesc']) || $current['ChannelStateDesc'] !== 'Up')
                return $this->failure('This call is no longer connected. Refresh the panel before transferring.');
            $peer = $this->twoPartyPeer($current);
            if (!$peer || !$this->verifyIdentity($channel, $uniqueid) ||
                !$this->verifyIdentity($peer['Channel'], $peer['Uniqueid'])) return FALSE;
            if (!$this->alive()) return FALSE;
            $parameters = array('Channel'=>$channel, 'Context'=>'ext-local', 'Exten'=>$target);
            if ($consult) $parameters['Priority'] = 1;
            $response = $this->ami->send_request($consult ? 'Atxfer' : 'BlindTransfer', $parameters, FALSE);
            return $this->confirmed($response, 'The transfer request could not be confirmed. Check the live call before retrying.');
        } catch (Throwable $error) {
            return $this->failure('The transfer request could not be confirmed. Check the live call before retrying.');
        }
    }

    function parkChannel($channel, $uniqueid, $lot)
    {
        $this->errMsg = '';
        if (!mytelValidChannelIdentity($channel, $uniqueid) || !mytelValidParkingLot($lot))
            return $this->failure('Invalid call or parking lot. Refresh and try again.');
        try {
            $catalog = $this->loadCatalog();
            $current = $this->currentChannel($channel, $uniqueid);
            if (!$catalog || !$current || !isset($current['ChannelStateDesc']) || $current['ChannelStateDesc'] !== 'Up' ||
                (isset($current['Application']) && strcasecmp($current['Application'], 'Park') === 0))
                return $this->failure('Choose a connected call that is not already parked.');
            $peer = $this->twoPartyPeer($current);
            if (!$peer || !isset($catalog['dial'][self::endpoint($peer['Channel'])]))
                return $this->failure('Park the other party of a call connected to a local extension so timeout returns safely.');
            $lots = $this->collect('Parkinglots', array(), array('Parkinglot'), 'ParkinglotsComplete');
            if ($lots === FALSE) return FALSE;
            $found = FALSE;
            foreach ($lots['rows'] as $record) if (isset($record['Name']) && $record['Name'] === $lot) $found = TRUE;
            if (!$found) return $this->failure('This parking lot is no longer available. Refresh the panel.');
            if (!$this->verifyIdentity($channel, $uniqueid) ||
                !$this->verifyIdentity($peer['Channel'], $peer['Uniqueid']) || !$this->alive()) return FALSE;
            // Never infer a different parkee, override the configured timeout,
            // or construct a timeout return dial string from an external trunk.
            $response = $this->ami->send_request('Park', array(
                'Channel'=>$channel, 'TimeoutChannel'=>$peer['Channel'], 'Parkinglot'=>$lot), FALSE);
            return $this->confirmed($response, 'Parking could not be confirmed. Check the live parking slots before retrying.');
        } catch (Throwable $error) {
            return $this->failure('Parking could not be confirmed. Check the live parking slots before retrying.');
        }
    }

    function pickupChannel($channel, $uniqueid, $source)
    {
        $this->errMsg = '';
        if (!mytelValidChannelIdentity($channel, $uniqueid) || !mytelValidInternalExtension($source))
            return $this->failure('Invalid ringing call or operator extension.');
        try {
            $catalog = $this->loadCatalog();
            $endpoint = self::endpoint($channel);
            if (!$catalog || !isset($catalog['dial'][$endpoint], $catalog['id'][$source]) ||
                $catalog['id'][$source]['dial'] === $endpoint)
                return $this->failure('Choose a different registered operator extension and a ringing internal call.');
            $current = $this->currentChannel($channel, $uniqueid);
            if (!$current || !isset($current['ChannelStateDesc']) || !in_array($current['ChannelStateDesc'], array('Ring','Ringing'), TRUE))
                return $this->failure('This call is no longer ringing. Refresh the panel.');
            if (!$this->registeredOperator($catalog['id'][$source]))
                return $this->failure('The selected operator extension is not currently registered.');
            if (!$this->verifyIdentity($channel, $uniqueid) || !$this->alive()) return FALSE;
            // PickupChan accepts a Uniqueid and uses an exact comparison under the
            // channel lock. No channel prefix, list or partial-match option is sent.
            // The native application checks ringing state again when answered.
            $response = $this->ami->send_request('Originate', array(
                'Channel'=>$catalog['id'][$source]['dial'], 'Application'=>'PickupChan', 'Data'=>$uniqueid,
                'CallerID'=>'MyTel call pickup', 'Timeout'=>20000, 'Async'=>'true'), FALSE);
            return $this->confirmed($response, 'Pickup could not be confirmed. Check the live call before retrying.');
        } catch (Throwable $error) {
            return $this->failure('Pickup could not be confirmed. Check the live call before retrying.');
        }
    }

    // Read-only registration proof shared with queue membership controls.
    function isRegisteredOperator($device)
    {
        if (!is_array($device) || !isset($device['dial']) || !is_string($device['dial']) ||
            !preg_match('~^(PJSIP|SIP)/[A-Za-z0-9_.:+@-]+$~D', $device['dial'])) return FALSE;
        try { return $this->registeredOperator($device); }
        catch (Throwable $error) { return $this->failure('The operator registration could not be verified. Refresh and try again.'); }
    }

    private function registeredOperator($device)
    {
        $parts = explode('/', $device['dial'], 2);
        if ($parts[0] === 'PJSIP') {
            $response = $this->collect('PJSIPShowEndpoints', array(), array('EndpointList'), 'EndpointListComplete');
            if ($response === FALSE) return FALSE;
            foreach ($response['rows'] as $row) {
                if (!isset($row['ObjectName'], $row['Contacts']) || $row['ObjectName'] !== $parts[1]) continue;
                if (is_string($row['Contacts']) && preg_match('/sips?:(?:[^@,;\s>]+@)?(\[[^\]]+\]|[^:;,> \/@]+)/i', $row['Contacts'], $match) &&
                    !in_array(trim($match[1], '[]'), array('0.0.0.0', '::', '-none-'), TRUE)) return TRUE;
            }
        } elseif ($parts[0] === 'SIP') {
            $response = $this->collect('SIPpeers', array(), array('PeerEntry'), 'PeerlistComplete');
            if ($response === FALSE) return FALSE;
            foreach ($response['rows'] as $row) {
                if (!isset($row['ObjectName'], $row['IPaddress'], $row['IPport']) || $row['ObjectName'] !== $parts[1]) continue;
                $address = $row['IPaddress'];
                $dynamic = isset($row['Dynamic']) && in_array(strtolower($row['Dynamic']), array('yes','y','true','1'), TRUE);
                if ($dynamic && is_string($address) && filter_var($address, FILTER_VALIDATE_IP) !== FALSE &&
                    !in_array($address, array('0.0.0.0','::'), TRUE) && (int)$row['IPport'] > 0) return TRUE;
            }
        }
        return FALSE;
    }

    private function loadCatalog()
    {
        if (!is_null($this->catalog)) return $this->catalog;
        if (!$this->db || !empty($this->db->errMsg)) return FALSE;
        $rows = $this->db->fetchTable('SELECT id, dial, tech FROM devices', TRUE);
        if (!is_array($rows)) return FALSE;
        $catalog = array('id'=>array(), 'dial'=>array());
        foreach ($rows as $row) {
            if (!isset($row['id'], $row['dial']) || !mytelValidInternalExtension((string)$row['id']) ||
                !is_string($row['dial']) || !preg_match('~^(PJSIP|SIP|IAX2|DAHDI)/[A-Za-z0-9_.:+@-]+$~D', $row['dial'])) continue;
            $catalog['id'][(string)$row['id']] = $row;
            $catalog['dial'][$row['dial']] = $row;
        }
        return $this->catalog = $catalog;
    }

    private function currentChannel($channel, $uniqueid)
    {
        $status = $this->collect('Status', array('Channel'=>$channel), array('Status'), 'StatusComplete');
        if ($status === FALSE) return FALSE;
        foreach ($status['rows'] as $row) {
            if (isset($row['Channel'], $row['Uniqueid']) && $row['Channel'] === $channel &&
                is_string($row['Uniqueid']) && hash_equals($uniqueid, $row['Uniqueid'])) return $row;
        }
        return $this->failure('The selected call has ended or changed. Refresh the panel.');
    }

    private function twoPartyPeer($current)
    {
        if (!isset($current['BridgeID']) || !is_string($current['BridgeID']) ||
            !preg_match('/^[A-Za-z0-9_.:-]{1,128}$/D', $current['BridgeID']))
            return $this->failure('This operation requires a connected two-party call.');
        $bridge = $this->collect('BridgeInfo', array('BridgeUniqueid'=>$current['BridgeID']), array('BridgeInfoChannel'), 'BridgeInfoComplete');
        if ($bridge === FALSE) return FALSE;
        $members = array();
        foreach ($bridge['rows'] as $row) {
            if (!isset($row['Channel'], $row['Uniqueid']) || !mytelValidChannelIdentity($row['Channel'], $row['Uniqueid'])) continue;
            if (isset($row['BridgeUniqueid']) && $row['BridgeUniqueid'] !== $current['BridgeID']) continue;
            $members[$row['Channel']] = $row;
        }
        if (count($members) !== 2 || !isset($members[$current['Channel']]) ||
            $members[$current['Channel']]['Uniqueid'] !== $current['Uniqueid'] ||
            (isset($bridge['complete']['BridgeNumChannels']) && (int)$bridge['complete']['BridgeNumChannels'] !== 2))
            return $this->failure('The bridge has changed or contains more than two parties. Refresh before taking action.');
        unset($members[$current['Channel']]);
        return reset($members);
    }

    private function verifyIdentity($channel, $uniqueid)
    {
        if (!$this->alive()) return FALSE;
        $response = $this->ami->send_request('Getvar', array('Channel'=>$channel, 'Variable'=>'UNIQUEID'), FALSE);
        if (is_array($response) && isset($response['Response'], $response['Value']) && $response['Response'] === 'Success' &&
            is_string($response['Value']) && hash_equals($uniqueid, $response['Value'])) return TRUE;
        return $this->failure('The selected call has ended or changed. Refresh the panel.');
    }

    private function collect($action, $parameters, $events, $completeEvent)
    {
        if (!$this->alive()) return FALSE;
        $id = 'mytel-operator-' . bin2hex(random_bytes(12));
        $rows = array(); $complete = NULL;
        $callback = function($event, $params) use ($id, $completeEvent, &$rows, &$complete) {
            if (!is_array($params) || !isset($params['ActionID']) || $params['ActionID'] !== $id) return;
            if (strcasecmp($event, $completeEvent) === 0) $complete = $params;
            else $rows[] = $params;
        };
        $names = array_merge($events, array($completeEvent));
        try {
            foreach ($names as $name) if ($this->ami->add_event_handler($name, $callback) === FALSE)
                return $this->failure('The PBX verification could not be started. Refresh and try again.');
            $parameters['ActionID'] = $id;
            $response = $this->ami->send_request($action, $parameters, FALSE);
            if (!is_array($response) || !isset($response['Response']) || $response['Response'] !== 'Success')
                return $this->failure('The PBX could not verify the current call. Refresh and try again.');
            while (is_null($complete)) {
                if (!$this->alive()) return FALSE;
                if (!$this->ami->procesarPaquetes())
                    $this->ami->procesarActividad(min(0.05, max(0, $this->deadline - microtime(TRUE))));
            }
            return array('rows'=>$rows, 'complete'=>$complete);
        } finally {
            foreach ($names as $name) $this->ami->remove_event_handler($name);
        }
    }

    private function alive()
    {
        if (!is_numeric($this->deadline) || microtime(TRUE) >= $this->deadline || is_null($this->ami->socket))
            return $this->failure('The PBX request timed out or disconnected. Refresh before retrying.');
        return TRUE;
    }

    private function confirmed($response, $error)
    {
        return is_array($response) && isset($response['Response']) && $response['Response'] === 'Success' ? TRUE : $this->failure($error);
    }

    private function failure($message) { $this->errMsg = $message; return FALSE; }

    static function endpoint($channel)
    {
        return is_string($channel) ? preg_replace('/-[[:xdigit:]]+(?:<ZOMBIE>|<MASQ>)*(?:;[0-9]+)?$/D', '', $channel) : '';
    }

    static function decorateSnapshot($response, $phones, $parkingLots)
    {
        $byBridge = $byChannel = array();
        foreach (isset($response['live_channels']) ? $response['live_channels'] : array() as $channel) {
            $byChannel[$channel['Channel']] = $channel;
            if (!empty($channel['BridgeID'])) $byBridge[$channel['BridgeID']][$channel['Channel']] = $channel;
        }
        foreach ($byChannel as $name => &$channel) {
            $valid = isset($channel['Uniqueid']) && mytelValidChannelIdentity($name, $channel['Uniqueid']);
            $local = isset($phones[self::endpoint($name)]);
            $up = isset($channel['ChannelStateDesc']) && $channel['ChannelStateDesc'] === 'Up';
            $members = !empty($channel['BridgeID']) && isset($byBridge[$channel['BridgeID']]) ? $byBridge[$channel['BridgeID']] : array();
            $two = count($members) === 2;
            $peer = NULL;
            if ($two) { unset($members[$name]); $peer = reset($members); }
            $returnExtension = $peer && isset($phones[self::endpoint($peer['Channel'])]['extension']) ? (string)$phones[self::endpoint($peer['Channel'])]['extension'] : NULL;
            $channel['actions'] = array('transfer'=>$valid && $local && $up && $two,
                'consult'=>$valid && $local && $up && $two,
                'park'=>$valid && $up && $two && !is_null($returnExtension) && count($parkingLots)>0,
                'pickup'=>$valid && $local && isset($channel['ChannelStateDesc']) && in_array($channel['ChannelStateDesc'], array('Ring','Ringing'), TRUE),
                'park_return_extension'=>$returnExtension);
        }
        unset($channel);
        $response['live_channels'] = array_values($byChannel);
        foreach ($response['live_calls'] as &$call) foreach ($call['channels'] as &$channel)
            if (isset($byChannel[$channel['Channel']])) $channel = $byChannel[$channel['Channel']];
        unset($call, $channel);
        foreach ($response['pbxchanges'] as &$change) if (isset($change['active'])) foreach ($change['active'] as &$channel)
            if (isset($byChannel[$channel['Channel']])) $channel = $byChannel[$channel['Channel']];
        unset($change, $channel);
        $response['parking_lots'] = array_values($parkingLots);
        return $response;
    }
}
