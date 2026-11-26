<?php
// Behavioral contract for live call grouping; no network or PBX changes.
$variant = isset($argv[1]) ? $argv[1] : 'control_panel';
$helper = dirname(__DIR__) . '/' . $variant . '/libs/mytelLiveSnapshot.php';
$failures = 0; $checks = 0;
function verify($ok, $message) { global $checks, $failures; $checks++; if (!$ok) $failures++; echo ($ok ? 'PASS ' : 'FAIL ') . $message . "\n"; }
if (!is_file($helper)) { verify(FALSE, 'live call snapshot normalization is available'); exit(1); }
require $helper;
$phones = array('PJSIP/100'=>array('extension'=>'100'), 'PJSIP/101'=>array('extension'=>'101'));
$a = array('Channel'=>'PJSIP/100-00000001','Uniqueid'=>'1000.1','Linkedid'=>'1000.1','Seconds'=>30,'Since'=>970,'ChannelStateDesc'=>'Up','CallerIDNum'=>'100','ConnectedLineNum'=>'101');
$b = array('Channel'=>'PJSIP/101-00000002','Uniqueid'=>'1000.2','Linkedid'=>'1000.1','Seconds'=>28,'Since'=>972,'ChannelStateDesc'=>'Up');
$c = array('Channel'=>'PJSIP/100-00000003','Uniqueid'=>'1000.3','Linkedid'=>'1000.3','Seconds'=>5,'Since'=>995,'ChannelStateDesc'=>'Ringing');
$snapshot = mytelBuildLiveSnapshot(array($a,$b,$a,$c), $phones, array(), 1000);
verify(count($snapshot['live_channels'])===3, 'duplicate channel records are counted once');
verify(count($snapshot['live_calls'])===2, 'two legs of one Linkedid count as one call while a second call remains distinct');
verify(count($snapshot['live_calls'][0]['channels'])===2, 'both linked call legs remain inspectable');
verify($snapshot['live_calls'][0]['extensions']===array('100','101'), 'both observed local extensions are mapped to the linked call');
verify($snapshot['live_calls'][0]['elapsed_seconds']===30, 'elapsed duration uses the oldest real channel start');
verify($snapshot['live_calls'][0]['direction']==='internal', 'observed known-phone origin and two local endpoints identify an internal call');
verify($snapshot['live_channels'][0]['answered_seconds']===NULL, 'channel age is never mislabeled as answered duration');
$a['ConnectedLineNum']='102';
$transferred=mytelBuildLiveSnapshot(array($a,$b),$phones,array(),1001);
verify(count($transferred['live_calls'])===1 && $transferred['live_channels'][0]['ConnectedLineNum']==='102', 'transferred connected identity refreshes without duplicating the call');
$ended=mytelBuildLiveSnapshot(array(),$phones,array(),1002);
verify(!count($ended['live_calls'])&&!count($ended['live_channels']), 'ended calls are absent from the next complete snapshot');
unset($a['Linkedid'],$b['Linkedid']);
$unknown=mytelBuildLiveSnapshot(array($a,$b),$phones,array(),1000);
verify(count($unknown['live_calls'])===2, 'unlinked channels are never merged merely because numbers match');
$local=array('Channel'=>'Local/100@from-queue-000001;1','Uniqueid'=>'1000.4','Linkedid'=>'1000.1','Since'=>990,'ChannelStateDesc'=>'Up');
$unclassified=mytelBuildLiveSnapshot(array($local),$phones,array(),1000);
verify(count($unclassified['live_channels'])===1 && !count($unclassified['live_calls'][0]['extensions']), 'unclassified Local legs remain visible without inventing an endpoint owner');
$a['Variables']=array('CDR(answer,u)'=>'980.000000','CHANNEL(onhold)'=>'1');
$answered=mytelBuildLiveSnapshot(array($a),$phones,array(),1000);
verify($answered['live_channels'][0]['answered_seconds']===20 && $answered['live_channels'][0]['on_hold']===TRUE, 'reported CDR answer epoch and channel hold state remain distinct from channel age');
$a['Variable'] = 'PRIVATE_AUTH=never-expose';
$a['AppData'] = 'SIP/user:never-expose@example.invalid';
$a['UnexpectedConfig'] = 'never-expose';
$restricted = mytelBuildLiveSnapshot(array($a), $phones, array(), 1000);
verify(strpos(json_encode($restricted), 'never-expose') === FALSE, 'snapshot output excludes raw headers, unrequested fields and credential-bearing application arguments');
$a['Linkedid'] = '<unknown>';
$b['Linkedid'] = '<unknown>';
$uncorrelated = mytelBuildLiveSnapshot(array($a, $b), $phones, array(), 1000);
verify(count($uncorrelated['live_calls']) === 2, 'unknown linkedid placeholders never correlate unrelated channels');
$waiting = mytelBuildLiveSnapshot(array($a), $phones, array('600'=>array('extension'=>'600','callers'=>array(array('Channel'=>$a['Channel'])))), 1000);
verify($waiting['live_calls'][0]['state'] === 'Waiting' && $waiting['live_calls'][0]['channels'][0]['ChannelStateDesc'] === 'Up', 'PBX-answered queue callers remain waiting until QueueEntry removes them');
// Exercise the real AMI parser, preserving repeated safe headers while excluding
// unrelated channel variables from the normalized snapshot.
class AGI_AsteriskManager { public $event_handlers=array(); public $server=''; public $port=0; }
$amiSource = file_get_contents(dirname(__DIR__) . '/' . $variant . '/libs/AGI_AsteriskManager2.class.php');
eval(substr($amiSource, strpos($amiSource, 'class AGI_AsteriskManager2')));
$ami = (new ReflectionClass('AGI_AsteriskManager2'))->newInstanceWithoutConstructor();
$parse = new ReflectionMethod('AGI_AsteriskManager2', 'encontrarPaquetes');
$parse->setAccessible(TRUE);
$wire = "Event: Status\r\nChannel: PJSIP/100-00000001\r\nVariable: CDR(answer,u)=980.000000\r\nVariable: PRIVATE_AUTH=never-expose\r\nVariable: DIRECTION=INBOUND\r\nVariable: CHANNEL(onhold)=1\r\n\r\n";
$args = array(&$wire);
$packets = $parse->invokeArgs($ami, $args);
verify(isset($packets[0]['Variables']['CDR(answer,u)'], $packets[0]['Variables']['CHANNEL(onhold)']), 'AMI parser retains both safe repeated Variable headers');
verify(!isset($packets[0]['Variables']['PRIVATE_AUTH']), 'AMI parser excludes variables outside the fixed read-only allowlist');
$a['Variables'] = $packets[0]['Variables'];
$safe = mytelBuildLiveSnapshot(array($a), $phones, array(), 1000);
verify(!isset($safe['live_channels'][0]['Variables']), 'snapshot never exposes the raw channel variable dictionary');
verify($safe['live_channels'][0]['direction'] === 'incoming' && $safe['live_calls'][0]['direction'] === 'incoming', 'inherited Issabel INBOUND evidence survives context changes into normalized channel and call direction');
$a['Variables']['DIRECTION'] = 'unrecognized-private-value';
$a['Linkedid'] = 'older-origin-no-longer-visible';
$unknownDirection = mytelBuildLiveSnapshot(array($a), $phones, array(), 1000);
verify($unknownDirection['live_channels'][0]['direction'] === NULL && strpos(json_encode($unknownDirection), 'unrecognized-private-value') === FALSE, 'unrecognized direction variables remain private and do not invent a direction');
$handled = 0;
$ami->add_event_handler('MytelClosureFixture', function() use (&$handled) { $handled++; });
$closureError = FALSE;
try { $ami->process_event(array('Event'=>'MytelClosureFixture')); } catch (Throwable $error) { $closureError = TRUE; }
verify(!$closureError && $handled === 1, 'real AMI driver dispatches callable Closure event collectors without a type error');
echo "$checks checks; $failures failures\n";
exit($failures ? 1 : 0);
