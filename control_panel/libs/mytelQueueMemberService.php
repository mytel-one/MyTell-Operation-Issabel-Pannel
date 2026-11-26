<?php
// MyTel, 2026-11-26. A queue-scoped pause/resume operation on an existing member.
// The caller owns Issabel ACL/CSRF enforcement, AMI login and disconnect.
// https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Actions/QueuePause/
function mytelValidQueueMemberPause($queue, $interface, $paused)
{
    return is_string($queue) && preg_match('/^[0-9]{1,40}$/D', $queue) === 1 &&
        is_string($interface) && preg_match('~^[A-Za-z][A-Za-z0-9_]{0,20}/[A-Za-z0-9_.@;:+/%-]{1,220}$~D', $interface) === 1 &&
        is_string($paused) && in_array($paused, array('0', '1'), TRUE);
}

function mytelValidQueueMembershipJoin($queue, $source)
{
    return is_string($queue) && preg_match('/^[0-9]{1,40}$/D', $queue) === 1 &&
        is_string($source) && preg_match('/^[0-9]{1,40}$/D', $source) === 1;
}

function mytelValidQueueMembershipLeave($queue, $interface)
{
    return mytelValidQueueMemberPause($queue, $interface, '0');
}

class MytelQueueMemberService
{
    public $errMsg = '';
    public $changed = FALSE;
    public $memberInterface = NULL;
    private $ami;
    private $db;
    private $deadline;
    private $actionId;
    private $queue;
    private $interface;
    private $complete = FALSE;
    private $queueFound = FALSE;
    private $observedPaused = NULL;
    private $members = array();

    function __construct($ami, $absoluteDeadline, $pbxDb = NULL)
    {
        $this->ami = $ami;
        $this->deadline = $absoluteDeadline;
        $this->db = $pbxDb;
    }

    function setPaused($queue, $interface, $paused)
    {
        $this->errMsg = '';
        $this->changed = FALSE;
        if (!mytelValidQueueMemberPause($queue, $interface, $paused))
            return $this->failure('Invalid queue member or pause state. Refresh the panel and try again.');
        if (!is_numeric($this->deadline) || microtime(TRUE) >= $this->deadline)
            return $this->failure('The queue request timed out. Refresh and try again.');
        try {
            if (!$this->readQueue($queue, $interface)) return FALSE;
            if (!$this->queueFound || is_null($this->observedPaused))
                return $this->failure('This queue member is no longer available or its pause state is unknown. Refresh the panel.');
            if ($this->observedPaused === $paused) return TRUE;
            if (microtime(TRUE) >= $this->deadline)
                return $this->failure('The queue request timed out before the change was sent. Refresh and try again.');
            // Queue is mandatory: omitting it would pause the interface in all
            // its queues. Send one idempotent desired state, never a toggle.
            $response = $this->ami->send_request('QueuePause', array(
                'ActionID'=>$this->actionId . '-pause', 'Queue'=>$queue, 'Interface'=>$interface,
                'Paused'=>$paused === '1' ? 'true' : 'false',
                'Reason'=>$paused === '1' ? 'MyTel operator pause' : 'MyTel operator resume'), FALSE);
            if (!is_array($response) || !isset($response['Response']) || $response['Response'] !== 'Success')
                return $this->failure('The PBX did not confirm the queue change. Refresh before trying again.');
            $this->changed = TRUE;
            return TRUE;
        } catch (Throwable $error) {
            return $this->failure('The queue operation could not be confirmed. Refresh the panel before trying again.');
        }
    }

    function join($queue, $source)
    {
        $this->errMsg = ''; $this->changed = FALSE; $this->memberInterface = NULL;
        if (!mytelValidQueueMembershipJoin($queue, $source))
            return $this->failure('Choose a valid queue and configured local extension.');
        try {
            if (!$this->alive() || !$this->db || !empty($this->db->errMsg))
                return $this->failure('The local endpoint could not be verified. Refresh and try again.');
            $device = $this->db->getFirstRowQuery('SELECT id, tech, dial FROM devices WHERE id = ?', TRUE, array($source));
            if (!is_array($device) || !isset($device['id'], $device['tech'], $device['dial']) ||
                (string)$device['id'] !== $source || !is_string($device['dial']) ||
                preg_match('~^(PJSIP|SIP)/[A-Za-z0-9_.-]{1,120}$~D', $device['dial'], $parts) !== 1 ||
                !is_string($device['tech']) || strtoupper($device['tech']) !== $parts[1])
                return $this->failure('This extension does not resolve to one supported local SIP or PJSIP endpoint.');
            $dial = $this->ami->database_get('DEVICE', $source . '/dial');
            if (!is_string($dial) || !hash_equals($device['dial'], $dial))
                return $this->failure('The configured endpoint and PBX device mapping do not agree. Ask the administrator to check this extension.');
            require_once __DIR__ . '/mytelCallActionService.php';
            $registration = new MytelCallActionService($this->ami, $this->db, $this->deadline);
            if (!$registration->isRegisteredOperator($device))
                return $this->failure('The selected local extension is not currently registered or its registration could not be verified.');
            if (!$this->readQueue($queue, NULL)) return FALSE;
            foreach ($this->members as $member) {
                $interface = $member['Interface'];
                $stateInterface = isset($member['StateInterface']) && is_string($member['StateInterface']) ? $member['StateInterface'] : '';
                if ($interface === $dial || $stateInterface === $dial ||
                    preg_match('~^Local/' . preg_quote($source, '~') . '@[^/\r\n]+(?:/n)?$~D', $interface) === 1 ||
                    preg_match('~^hint:' . preg_quote($source, '~') . '@(?:ext-local|from-internal)$~D', $stateInterface) === 1)
                    return $this->failure('This extension is already represented in the queue. Refresh its existing membership instead of adding a duplicate.');
            }
            if (!$this->alive()) return FALSE;
            $result = $this->ami->send_request('QueueAdd', array('ActionID'=>$this->actionId . '-join',
                'Queue'=>$queue, 'Interface'=>$dial, 'Penalty'=>0, 'Paused'=>'false',
                'MemberName'=>'Extension ' . $source, 'StateInterface'=>$dial), FALSE);
            if (!is_array($result) || !isset($result['Response']) || $result['Response'] !== 'Success')
                return $this->failure('The PBX did not confirm sign-in. Refresh the membership list before trying again.');
            $this->memberInterface = $dial; $this->changed = TRUE;
            return TRUE;
        } catch (Throwable $error) {
            return $this->failure('Queue sign-in could not be confirmed. Refresh before trying again.');
        }
    }

    function leave($queue, $interface)
    {
        $this->errMsg = ''; $this->changed = FALSE; $this->memberInterface = NULL;
        if (!mytelValidQueueMembershipLeave($queue, $interface))
            return $this->failure('Choose a valid current queue membership.');
        try {
            if (!$this->readQueue($queue, $interface)) return FALSE;
            if (!isset($this->members[$interface]))
                return $this->failure('This queue membership is no longer present. Refresh the panel.');
            $member = $this->members[$interface];
            if (!isset($member['Membership']) || !is_string($member['Membership']) || strtolower($member['Membership']) !== 'dynamic')
                return $this->failure('Only explicitly dynamic queue memberships can sign out here. Manage static or realtime membership in Issabel.');
            if (!isset($member['InCall'], $member['Status']) || $member['InCall'] !== '0' ||
                !in_array($member['Status'], array('1', '4', '5'), TRUE))
                return $this->failure('This member is active or its current call state is unknown. Wait for an idle snapshot before signing out.');
            if (!$this->alive()) return FALSE;
            $result = $this->ami->send_request('QueueRemove', array('ActionID'=>$this->actionId . '-leave',
                'Queue'=>$queue, 'Interface'=>$interface), FALSE);
            if (!is_array($result) || !isset($result['Response']) || $result['Response'] !== 'Success')
                return $this->failure('The PBX did not confirm sign-out. Refresh the membership list before trying again.');
            $this->memberInterface = $interface; $this->changed = TRUE;
            return TRUE;
        } catch (Throwable $error) {
            return $this->failure('Queue sign-out could not be confirmed. Refresh before trying again.');
        }
    }

    private function alive()
    {
        if (!is_numeric($this->deadline) || microtime(TRUE) >= $this->deadline || is_null($this->ami->socket))
            return $this->failure('The queue request timed out or disconnected. Refresh before trying again.');
        return TRUE;
    }

    private function readQueue($queue, $interface)
    {
        if (!$this->alive()) return FALSE;
        $this->queue = $queue; $this->interface = $interface;
        $this->complete = $this->queueFound = FALSE;
        $this->observedPaused = NULL; $this->members = array();
        $this->actionId = 'mytel-queue-' . bin2hex(random_bytes(12));
        $this->ami->setDeadline($this->deadline);
        $this->ami->add_event_handler('QueueParams', array($this, 'onQueueParams'));
        $this->ami->add_event_handler('QueueMember', array($this, 'onQueueMember'));
        $this->ami->add_event_handler('QueueStatusComplete', array($this, 'onQueueComplete'));
        $params = array('ActionID'=>$this->actionId, 'Queue'=>$queue);
        if (!is_null($interface)) $params['Member'] = $interface;
        $response = $this->ami->send_request('QueueStatus', $params, FALSE);
        if (!is_array($response) || !isset($response['Response']) || $response['Response'] !== 'Success')
            return $this->failure('The PBX could not verify the queue membership. Refresh and try again.');
        while (!$this->complete) {
            if (!$this->alive()) return FALSE;
            if (!$this->ami->procesarPaquetes())
                $this->ami->procesarActividad(min(0.05, max(0, $this->deadline - microtime(TRUE))));
        }
        if (!$this->queueFound) return $this->failure('This queue is no longer available. Refresh the panel.');
        return TRUE;
    }

    private function failure($message)
    {
        $this->errMsg = $message;
        return FALSE;
    }

    private function matchesAction($params)
    {
        return is_array($params) && isset($params['ActionID']) && $params['ActionID'] === $this->actionId;
    }

    function onQueueParams($event, $params, $server, $port)
    {
        if ($this->matchesAction($params) && isset($params['Queue']) && $params['Queue'] === $this->queue)
            $this->queueFound = TRUE;
    }

    function onQueueMember($event, $params, $server, $port)
    {
        if (!$this->matchesAction($params) || !isset($params['Queue']) || $params['Queue'] !== $this->queue) return;
        $interface = isset($params['Interface']) ? $params['Interface'] : (isset($params['Location']) ? $params['Location'] : NULL);
        if (is_string($interface) && $interface !== '') {
            $params['Interface'] = $interface;
            $this->members[$interface] = $params;
        }
        if ($interface !== $this->interface) return;
        $this->observedPaused = isset($params['Paused']) && in_array($params['Paused'], array('0', '1'), TRUE) ? $params['Paused'] : NULL;
    }

    function onQueueComplete($event, $params, $server, $port)
    {
        if ($this->matchesAction($params)) $this->complete = TRUE;
    }
}
