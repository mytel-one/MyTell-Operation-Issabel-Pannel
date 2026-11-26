# Operator workspace

The default interface is English with a white MyTel theme. Sign in using your existing Issabel account and open **PBX → MyTel Operation**.

## Live information

The dashboard requests complete PBX snapshots, with one request in flight at a time. Successful snapshots replace the current state; ended calls and removed objects disappear. During a connection failure the last successful information stays visible with a stale-data warning. Call controls must not be used as evidence that a disconnected call is still active.

Extension cards show registration and current activity. An extension can have several simultaneous calls; open its details to inspect each one. Registration and activity are different: a device may have an active channel while its registration is no longer available.

Green indicates a registered extension or connected trunk. Gray indicates an offline or unconfirmed connection. A valid PJSIP contact can stay registered while its handset is idle, even with qualify disabled.

The active-call workspace groups channels only when Asterisk reports the same linked call ID. All observed channel legs remain available for inspection. Channels without a linked ID remain separate; matching caller numbers alone never proves they are the same call.

Use the direction filters to switch between incoming, outgoing, internal and unclassified calls. The panel uses PBX direction and routing evidence when available. Calls with insufficient evidence appear under Unknown.

Channel age and answered duration are separate measurements. An answered timer is shown only when Asterisk reports an answer timestamp. Direction, hold state and connected-party details are shown only when supplied by the PBX; unavailable fields are identified rather than guessed.

## Queues and resources

Queue information includes waiting callers, agent state and the statistics available from Asterisk. Answered and abandoned counters are **since the last PBX queue-statistics reset**, not necessarily today. A panel refresh does not reset queue counters.

Trunks, conference participants and parking slots reflect the corresponding Asterisk state. The panel does not create extensions, queues or trunks: configure them in Issabel first.

Expand **Call parking** to see the current slots. It starts closed and stays open while live updates arrive.

## Call controls

Select **My extension** before placing a callback call. The PBX first rings that source extension, then calls the selected destination after it is answered. This uses the existing internal dialplan and its permissions.

Ending an individual call requires its exact current channel identity. If the channel has ended or its identity no longer matches, refresh the state and select the current call. A stale row must never be used to end another call on the same extension.

For a two-party conversation, open the local extension's channel details and select a configured internal destination. **Transfer** sends its peer to the destination immediately. **Consult** rings the destination and keeps the first caller waiting while you speak. Complete the consultation using the handset and your PBX's transfer settings.

**Pickup** rings your selected operator phone to answer an identified ringing internal call. **Park** moves the selected channel into an available lot and uses the verified local peer as the parking origin. Expand **Call parking** to find occupied slots and dial the displayed slot from your phone.

Use **Agents** to pause or resume an agent in a specific queue. Dynamic sign-in and sign-out require a separate permission. The panel checks live membership before changing it. Availability and membership labels update when Asterisk confirms the new state in a subsequent snapshot.

## Users and tools

In **System → Users → Group Permissions**, grant access to **MyTel Operation** and select the action privileges needed by that group. Module access alone permits observation. Dialing, pickup, transfer, parking, hangup, pause/resume, dynamic membership and shared layout edits are independently enforced on the server. Existing non-administrator groups with module access need explicit grants when upgrading from 2.0.x.

**Operator tools** shows installed tools the current user can open, including the address book, conference rooms, CDR, voicemail and call recordings. Where FOP2 is installed, authorized users can open its advanced console inside the workspace or open it separately. FOP2 Manager opens separately. The FOP2 applications use their own authentication, permissions and licensing. Personal favorites and display preferences belong to the operator account in the current browser.

To review control requests on the server, run `journalctl -t mytel-operation`. Entries identify the account, operation and result. An accepted request means the PBX accepted the command. The live call and queue views show the observed outcome.

## Keyboard and small screens

Search accepts ordinary, Persian and Arabic digits. Extension filters combine with the search text. Extension details and controls support keyboard focus, and the workspace reflows for narrow screens. On small screens, the surrounding Issabel menu may be collapsed using Issabel's menu button.

## Recovery

If the session expires, sign in again. If the PBX connection fails, use Retry and inspect the server's AMI/database health. Installation backups and recovery instructions are recorded by `install.sh`; see the main README for installation and rollback guidance.
