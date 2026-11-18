<?php
// Synthetic call families only. No number-format or live-PBX assumptions.
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
$helper = dirname(__DIR__) . '/' . $variant . '/libs/mytelCallDirection.php';
$checks = $failures = 0;
function directionCheck($actual, $expected, $message) {
    global $checks, $failures;
    $checks++; $ok = $actual === $expected; if (!$ok) $failures++;
    echo ($ok ? 'PASS ' : 'FAIL ') . $message . "\n";
}
if (!is_file($helper)) { directionCheck(false, true, 'call direction helper exists'); exit(1); }
require $helper;
$phones = array('PJSIP/101' => array('extension'=>'101'), 'PJSIP/102' => array('extension'=>'102'));
$trunks = array('PJSIP/carrier' => array('channel'=>'PJSIP/carrier'), 'SIP/backup' => array('channel'=>'SIP/backup'));
function directionLeg($channel, $unique, $linked, $context) {
    return array('Channel'=>$channel, 'Uniqueid'=>$unique, 'Linkedid'=>$linked, 'Context'=>$context);
}
$incoming = array(directionLeg('PJSIP/carrier-00000001','1000.1','1000.1','from-trunk'), directionLeg('PJSIP/101-00000002','1000.2','1000.1','from-internal'));
$outgoing = array(directionLeg('PJSIP/101-00000003','2000.1','2000.1','from-internal'), directionLeg('PJSIP/carrier-00000004','2000.2','2000.1','from-trunk'));
$internal = array(directionLeg('PJSIP/101-00000005','3000.1','3000.1','from-internal'), directionLeg('PJSIP/102-00000006','3000.2','3000.1','from-internal'));
directionCheck(mytelClassifyCallDirection($incoming,$phones,$trunks), 'incoming', 'observed ingress trunk origin identifies incoming family');
directionCheck(mytelClassifyCallDirection($outgoing,$phones,$trunks), 'outgoing', 'known phone origin with known trunk identifies outgoing family');
directionCheck(mytelClassifyCallDirection($internal,$phones,$trunks), 'internal', 'known phone origin and distinct local peer identify internal family');
$hint=array(directionLeg('Local/synthetic@from-queue-00000001;1','1000.2','1000.1','ext-queues'));
$hint[0]['direction']='incoming';
directionCheck(mytelClassifyCallDirection($hint,$phones,$trunks), 'incoming', 'recognized inherited direction survives missing origin and Local queue legs');
$hint[]=directionLeg('PJSIP/101-00000002','1000.3','1000.1','outrt-1'); $hint[1]['direction']='outgoing';
directionCheck(mytelClassifyCallDirection($hint,$phones,$trunks), null, 'conflicting explicit direction evidence remains unknown');
$hint=$internal; $hint[0]['direction']='incoming';
directionCheck(mytelClassifyCallDirection($hint,$phones,$trunks), 'incoming', 'inherited inbound evidence takes precedence over current internal transfer legs');
$hint=$internal; $hint[0]['direction']='<img src=x>';
directionCheck(mytelClassifyCallDirection($hint,$phones,$trunks), 'internal', 'unrecognized direction field cannot inject arbitrary output');
directionCheck(mytelClassifyCallDirection(array_reverse($incoming),$phones,$trunks), 'incoming', 'channel enumeration order cannot change direction');
$incoming[0]['Context']='ext-queues';
$incoming[] = directionLeg('Local/101@from-queue-00000007;1','1000.3','1000.1','from-queue');
directionCheck(mytelClassifyCallDirection($incoming,$phones,$trunks), 'incoming', 'queue traversal keeps the observed original trunk provenance');
$incoming[1]['Context']='outrt-1';
directionCheck(mytelClassifyCallDirection($incoming,$phones,$trunks), 'incoming', 'forwarding or transfer does not overwrite incoming origin');
$outgoing[1]['Context']='from-pstn';
directionCheck(mytelClassifyCallDirection($outgoing,$phones,$trunks), 'outgoing', 'dialed trunk ingress default never flips phone-origin outgoing call');
$outgoing[0]['CallerIDNum']='101'; $outgoing[0]['ConnectedLineNum']='102';
directionCheck(mytelClassifyCallDirection($outgoing,$phones,$trunks), 'outgoing', 'external call with extension-looking numbers remains outgoing');
$internal[0]['CallerIDNum']='+989121234567'; $internal[1]['ConnectedLineNum']='00982199999999';
directionCheck(mytelClassifyCallDirection($internal,$phones,$trunks), 'internal', 'external-looking caller numbers never override actual internal endpoints');
directionCheck(mytelClassifyCallDirection(array(directionLeg('PJSIP/101-00000008','4000.1','4000.1','outrt-2')),$phones,$trunks), 'outgoing', 'verified outbound route on observed phone origin identifies outgoing before trunk creation');
directionCheck(mytelClassifyCallDirection(array(directionLeg('PJSIP/101-00000008','4000.1','4000.1','outbound-allroutes')),$phones,$trunks), 'outgoing', 'verified outbound allroutes context is recognized');
directionCheck(mytelClassifyCallDirection(array(directionLeg('PJSIP/101-00000008','4000.1','4000.1','outrt-custom-guess')),$phones,$trunks), null, 'unverified route-like names do not create direction');
directionCheck(mytelClassifyCallDirection(array(directionLeg('PJSIP/carrier-00000009','5000.2','5000.1','from-trunk')),$phones,$trunks), null, 'trunk configured context without observed origin remains ambiguous');
directionCheck(mytelClassifyCallDirection(array(directionLeg('Local/101@from-queue-0000000a;1','6000.1','6000.1','ext-queues')),$phones,$trunks), null, 'Local queue leg alone does not prove incoming direction');
directionCheck(mytelClassifyCallDirection(array(directionLeg('PJSIP/101-0000000b','7000.1','7000.1','from-internal')),$phones,$trunks), null, 'one local extension with no route or peer remains ambiguous');
directionCheck(mytelClassifyCallDirection(array(directionLeg('PJSIP/unknown-0000000c','8000.1','8000.1','from-trunk')),$phones,$trunks), null, 'unconfigured endpoint cannot be assumed a trunk from its name or context');
$missingOrigin=$internal;
$missingOrigin[0]['Uniqueid']='3000.3';
directionCheck(mytelClassifyCallDirection($missingOrigin,$phones,$trunks), null, 'two transfer legs without oldest leg cannot reconstruct original direction');
$mixed=$internal; $mixed[1]['Linkedid']='9000.1';
directionCheck(mytelClassifyCallDirection($mixed,$phones,$trunks), null, 'unrelated linked families cannot be classified together');
$unknownId=$incoming;
foreach ($unknownId as &$leg) { $leg['Uniqueid']='<unknown>'; $leg['Linkedid']='<unknown>'; }
unset($leg);
directionCheck(mytelClassifyCallDirection($unknownId,$phones,$trunks), null, 'unknown identifier placeholders are never treated as oldest-channel matches');
directionCheck(mytelClassifyCallDirection(array(array('Channel'=>array('invalid'))),$phones,$trunks), null, 'malformed channel fields are rejected without warnings');
directionCheck(mytelClassifyCallDirection(array(),$phones,$trunks), null, 'empty channel family is unknown');
$overlap=$trunks; $overlap['PJSIP/101']=array('channel'=>'PJSIP/101');
directionCheck(mytelClassifyCallDirection($outgoing,$phones,$overlap), null, 'conflicting phone and trunk configuration stays unknown');
$duplicate=$incoming; $duplicate[]=$incoming[0];
directionCheck(mytelClassifyCallDirection($duplicate,$phones,$trunks), 'incoming', 'duplicate origin record does not change a classified family');
$prefix=array(directionLeg('PJSIP/1011-00000001','9900.1','9900.1','from-internal'),directionLeg('PJSIP/carrier-00000002','9900.2','9900.1','from-trunk'));
directionCheck(mytelClassifyCallDirection($prefix,$phones,$trunks), null, 'extension channel keys match exactly rather than by prefix');
foreach (array('from-internal','macro-dialout-trunk','default','custom-unverified','') as $context) {
    $direct=array(directionLeg('PJSIP/carrier-00000001','9910.1','9910.1',$context));
    directionCheck(mytelClassifyCallDirection($direct,$phones,$trunks), null, 'direct-to-trunk origin without ingress evidence stays unknown: ' . $context);
    $direct[0]['direction']='outgoing';
    directionCheck(mytelClassifyCallDirection($direct,$phones,$trunks), 'outgoing', 'explicit direction resolves direct-to-trunk ambiguity: ' . $context);
}
$ivrOrigin=array(directionLeg('PJSIP/carrier-00000001','9920.1','9920.1','ivr-2'));
directionCheck(mytelClassifyCallDirection($ivrOrigin,$phones,$trunks), 'incoming', 'known trunk origin in the installed IVR processing convention remains incoming');
echo "$variant: $checks checks; $failures failures\n";
exit($failures ? 1 : 0);
