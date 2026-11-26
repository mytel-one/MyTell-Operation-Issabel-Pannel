# Operator feature comparison

Reviewed against the official [FOP2 overview](https://www.fop2.com/),
[user guide](https://www.fop2.com/docs/userguide.php) and
[configuration guide](https://www.fop2.com/docs/) on **2026-11-26**.

MyTel provides an Issabel operator workspace and authorized access to the existing
FOP2 client, including its embedded console surface. Native MyTel features and
the embedded FOP2 client are separate implementations. FOP2 retains its own login,
permissions and license; embedding it does not grant access or activate a licensed
feature. FOP2 is not bundled or redistributed by this repository.

| Operator task | MyTel native workspace | Remaining boundary |
|---|---|---|
| Extension, trunk and queue monitoring | Implemented: complete live snapshots, registration and activity shown separately. | PBX technology and available AMI data determine the fields. |
| Concurrent calls and caller identity | Implemented: linked call families retain inspectable channel legs and caller details. | Missing metadata stays unknown. |
| Incoming/outgoing/internal distinction | Implemented from inherited PBX direction or conservative origin/route evidence. | Ambiguous calls remain unclassified. |
| Directory and fast destination selection | Searchable configured extensions, operator favorites and source-extension selection. | A full editable company contact database is absent. |
| Dial and hang up | Native callback dialing and exact channel-identity hangup. | Existing dialplan rules still apply. |
| Transfer | Native exact-channel blind and consultation transfer; both passed isolated Asterisk 20 handset acceptance. | Consultation completion/cancellation uses phone controls. External-number and voicemail transfer parity is separate. |
| Call parking and retrieval | Native parking and observed slots; parking plus handset retrieval passed isolated Asterisk 20 acceptance. | Retrieval acceptance used the configured slot on a synthetic handset. PBX parking configuration still applies. |
| Queue callers and agents | Waiting callers, timers, agent status and available counters are implemented. | Counters follow the PBX reset interval, not automatically today. |
| Pause/resume an agent | Native, queue-scoped control for an existing exact membership. | Requires the queue-control ACL grant and a fresh observed state. |
| Dynamic agent sign-in/sign-out | Native, separately permitted and explicitly confirmed; addition/removal were observed in isolated Asterisk 20 acceptance. | Existing local SIP/PJSIP endpoint only; static/realtime configuration is managed in Issabel. |
| Conference administration | Native participant visibility is partial parity. | Invite, mute, eject and lock controls are absent natively. |
| Presence, DND and forwarding | Registration/activity are visible. | Custom presence, DND synchronization and forwarding controls are absent natively. |
| Voicemail | Native message counts and the existing voicemail callback are partial parity. | Browser message playback, deletion and a voicemail explorer are absent. |
| Contacts, chat and notes | Not implemented natively. | FOP2 capabilities depend on its installation, license and permissions. |
| Recording, listening and coaching | No new native surveillance controls are provided. | FOP2's separately authorized capabilities are outside native parity. |
| Operator permissions | Native action groups use Issabel ACL; observer accounts remain read only. | FOP2 retains its own extension/button/action permissions. |

## Queue control behavior

Pause/resume reads the selected membership again using `QueueStatus`, requires
the exact queue and interface, and sends one `QueuePause` request with the queue
explicitly specified. The [Asterisk QueuePause reference](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Actions/QueuePause/)
explains that omitting the queue would affect that interface across its queues.

The requested state is not painted optimistically. An accepted AMI response and
the state subsequently observed in a PBX snapshot are distinct feedback states.
Timeouts or lost acknowledgements require refreshing before another attempt.
Pause/resume does not add/remove membership, rewrite the dialplan, reset queue
statistics or issue a hangup.

Dynamic sign-in uses [QueueAdd](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Actions/QueueAdd/)
after the local device row, its AstDB dial mapping and fresh registration agree.
Existing direct, Local and state-interface aliases are checked for duplicates.
Sign-out uses [QueueRemove](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Actions/QueueRemove/)
only for the exact, freshly observed, explicitly dynamic membership with a known
idle call state. Static, realtime, active or ambiguous memberships are refused.
These actions require the separate `membership` ACL grant. They make no permanent
queue configuration edits, and their accepted responses still await snapshot
confirmation in the workspace.

## Verification and next priorities

The full PHP service paths were also exercised against an isolated real
**Asterisk 20** engine with synthetic SIP handsets. Blind transfer reached its
destination; consultation left the other parties bridged after the transferer
hung up; exact ringing-call pickup, parking and handset retrieval, queue
pause/resume, and dynamic membership addition/removal all passed. These checks
are real engine acceptance, distinct from mocked unit tests. They do not certify
every production dialplan, physical handset, external trunk or audio path.

The independent synthetic checks are
[`queue_member_regressions.php`](../tests/queue_member_regressions.php) and
[`queue_membership_regressions.php`](../tests/queue_membership_regressions.php), plus
[`queue_member_ui.test.cjs`](../tests/queue_member_ui.test.cjs). They cover exact
membership, queue isolation, desired-state idempotence, input validation,
deadline/lost-response handling, observer access and stale-data gating. They do
not mutate or certify a real queue. Consult the release verification report for
the actual installed version, browser checks and the real engine evidence above.

The next useful native priorities are in-panel consultation completion/cancellation,
editable contacts with controlled external dialing, parked-call pickup from the
browser, and granular queue/conference administration. Each needs its own access
rules and acceptance. These gaps remain separate from capabilities available
through the independently authenticated and licensed embedded FOP2 client.
