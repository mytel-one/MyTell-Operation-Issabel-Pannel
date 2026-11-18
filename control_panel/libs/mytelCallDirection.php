<?php
// MyTel, 2026-11-18. Classifies an observed call family, never a number format.
// AMI Status: Linkedid is the Uniqueid of the oldest associated channel:
// https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/Status/
// Context names below were inspected in the target Issabel generated dialplan.
// Endpoint/origin fallback is an inference; custom originate/transfer workflows
// without the inherited DIRECTION variable may remain unidentifiable.
function mytelClassifyCallDirection($channels, $phones, $trunks)
{
    if (!is_array($channels) || !is_array($phones) || !is_array($trunks)) return NULL;
    $observed = array();
    $explicit = array();
    foreach ($channels as $channel) {
        if (!is_array($channel) || !isset($channel['Channel']) || !is_string($channel['Channel']) || $channel['Channel'] === '') continue;
        $observed[$channel['Channel']] = $channel;
        // This normalized field is produced only from the fixed DIRECTION
        // allowlist by mytelLiveSnapshot; raw variable dictionaries are ignored.
        if (isset($channel['direction']) && is_string($channel['direction']) &&
            in_array($channel['direction'], array('incoming', 'outgoing', 'internal'), TRUE))
            $explicit[$channel['direction']] = TRUE;
    }
    if (count($explicit) > 1) return NULL;
    if (count($explicit) === 1) return key($explicit);
    if (!count($observed)) return NULL;

    $knownPhones = mytelDirectionEndpointMap($phones);
    $knownTrunks = mytelDirectionEndpointMap($trunks);
    $linkedIds = $origins = $phoneEndpoints = array();
    $hasTrunk = $hasInboundPhoneContext = FALSE;
    foreach ($observed as $name => $channel) {
        $endpoint = preg_replace('/-[[:xdigit:]]+(?:<ZOMBIE>|<MASQ>)*(?:;[0-9]+)?$/D', '', $name);
        $phone = isset($knownPhones[$endpoint]);
        $trunk = isset($knownTrunks[$endpoint]);
        if ($phone && $trunk) return NULL;
        if ($phone) $phoneEndpoints[$endpoint] = TRUE;
        if ($trunk) $hasTrunk = TRUE;
        $context = isset($channel['Context']) && is_string($channel['Context']) ? strtolower(trim($channel['Context'])) : '';
        if ($phone && mytelDirectionInboundContext($context)) $hasInboundPhoneContext = TRUE;
        $linked = mytelDirectionIdentity(isset($channel['Linkedid']) ? $channel['Linkedid'] : NULL);
        $unique = mytelDirectionIdentity(isset($channel['Uniqueid']) ? $channel['Uniqueid'] : NULL);
        if ($linked !== NULL) $linkedIds[$linked] = TRUE;
        if ($linked !== NULL && $unique !== NULL && $linked === $unique)
            $origins[$name] = array('phone'=>$phone, 'trunk'=>$trunk, 'context'=>$context);
    }
    // A grouped call must have one linked family and one observed oldest leg.
    // Do not reconstruct missing origins from caller ID, age or row order.
    if (count($linkedIds) !== 1 || count($origins) !== 1) return NULL;
    $origin = reset($origins);
    if ($origin['trunk']) {
        // Oldest-channel identity alone cannot distinguish ingress from AMI
        // originate directly to a trunk. Require the observed trunk leg to be
        // in a verified ingress/processing context; never use another leg
        // merely retaining its trunk's configured default context.
        if (mytelDirectionInboundContext($origin['context']) || $origin['context'] === 'ext-queues' ||
            preg_match('/^ivr-[0-9]+$/D', $origin['context']) === 1) return 'incoming';
        return NULL;
    }
    if (!$origin['phone']) return NULL;
    if ($hasTrunk || mytelDirectionOutboundContext($origin['context'])) return 'outgoing';
    if (!$hasInboundPhoneContext && count($phoneEndpoints) >= 2) return 'internal';
    return NULL;
}

function mytelDirectionIdentity($value)
{
    if (!is_string($value)) return NULL;
    $value = trim($value);
    return in_array(strtolower($value), array('', 'unknown', '<unknown>', '<no name>'), TRUE) ? NULL : $value;
}

function mytelDirectionEndpointMap($configuration)
{
    $endpoints = array();
    foreach ($configuration as $key => $item) {
        $name = is_array($item) && isset($item['channel']) && is_string($item['channel']) ? $item['channel'] : $key;
        if (is_string($name) && $name !== '') $endpoints[$name] = TRUE;
    }
    return $endpoints;
}

function mytelDirectionOutboundContext($context)
{
    return in_array($context, array('outbound-allroutes', 'macro-dialout-trunk', 'macro-dialout-trunk-predial-hook'), TRUE) ||
        preg_match('/^outrt-[0-9]+$/D', $context) === 1;
}

function mytelDirectionInboundContext($context)
{
    return in_array($context, array('from-trunk', 'from-pstn', 'from-pstn-e164-us', 'from-pstn-toheader',
        'from-did-direct', 'from-did-direct-ivr', 'ext-did', 'ext-did-catchall'), TRUE) ||
        preg_match('/^ext-did-[0-9]+$/D', $context) === 1 ||
        strpos($context, 'from-trunk-sip-') === 0;
}
