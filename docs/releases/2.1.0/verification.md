# MyTel Operation 2.1.0 acceptance

Tested on November 26, 2026 with Issabel 5, PHP 7.4.33, and Asterisk 20.12.0. The target also had FOP2 2.31 installed. Tests used the same English package and normal Issabel menu entry delivered by the installer.

## Normal web login and permissions

A temporary Issabel account signed in through the web login page and opened the live workspace. A user with module access could read the real snapshot and had no call-control privileges. The server denied a transfer request from that observer even with a valid session and CSRF token. Granting just the transfer privilege exposed only that action family. A transfer request with missing channel data was rejected by input validation. A POST without the CSRF token was rejected independently.

CDR and FOP2 menu visibility followed the test account's Issabel grants. Once authorized, the FOP2 menu opened the installed client. This check covered access to the client entry point. FOP2 actions use its own operator login, permissions and license. The temporary account, group and test session were removed after the checks.

Issabel's automatic asset loader and the panel template loaded exactly one copy of each MyTel script, including the new queue controls.

## Telephony behavior

A separate Asterisk 20 process used an isolated dialplan, private AMI socket on loopback, its own database and four synthetic SIP endpoints. The release PHP services used the real Asterisk Manager driver. The device catalog for those four endpoints was injected for this test. No customer trunk or user's telephone participated.

| Operation | Observed result |
|---|---|
| Blind transfer | The original peer reached the selected internal destination and the destination endpoint answered. |
| Consultation transfer | The destination answered the consultation. When the transferer disconnected, the original peer and destination were observed together in the same bridge. |
| Directed pickup | The operator answered a callback, and Asterisk bridged it to the ringing call selected by unique ID. |
| Call parking | The lot reported the selected channel's unique ID in the assigned slot. Dialing the slot from a test endpoint retrieved the call and cleared the slot. |
| Pause and resume | Two successive QueueStatus queries confirmed both changes for the exact member in the selected queue. |
| Dynamic membership | The registered endpoint joined the test queue and later signed out. The corresponding member appeared and disappeared in fresh QueueStatus responses. |

Physical handset audio quality, external provider routing, FOP2 licensed feature operation, and behavior on other PBX versions were outside these tests.

## Regression checks

The PHP suites exercise authorization, channel identity, stale and ambiguous bridges, direction, modern parking events, queue memberships, duplicate requests, AMI timeouts and snapshot reconciliation. Both language packages passed on the target PHP runtime. Node and rendered browser checks cover operator and observer modes, preferences, search, accessible controls, exact action payloads, stale data and the queue confirmation states.

The installer suite includes rollback when menu registration succeeds but the action privileges are missing. The installation backs up the previous module, layout, menu and ACL databases. The [feature comparison](../../FOP2-COMPARISON.md) lists native actions and functions available through the separately installed tools.
