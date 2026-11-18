# Operator workspace

The default interface is English with a white MyTel theme. Sign in using your existing Issabel account and open **PBX → MyTel Operation**.

## Live information

The dashboard requests complete PBX snapshots, with one request in flight at a time. Successful snapshots replace the current state; ended calls and removed objects disappear. During a connection failure the last successful information stays visible with a stale-data warning. Call controls must not be used as evidence that a disconnected call is still active.

Extension cards show registration and current activity. An extension can have several simultaneous calls; open its details to inspect each one. Registration and activity are different: a device may have an active channel while its registration is no longer available.

The active-call workspace groups channels only when Asterisk reports the same linked call ID. All observed channel legs remain available for inspection. Channels without a linked ID remain separate; matching caller numbers alone never proves they are the same call.

Channel age and answered duration are separate measurements. An answered timer is shown only when Asterisk reports an answer timestamp. Direction, hold state and connected-party details are shown only when supplied by the PBX; unavailable fields are identified rather than guessed.

## Queues and resources

Queue information includes waiting callers, agent state and the statistics available from Asterisk. Answered and abandoned counters are **since the last PBX queue-statistics reset**, not necessarily today. A panel refresh does not reset queue counters.

Trunks, conference participants and parking slots reflect the corresponding Asterisk state. The panel does not create extensions, queues or trunks: configure them in Issabel first.

## Call controls

Select **My extension** before placing a callback call. The PBX first rings that source extension, then calls the selected destination after it is answered. This uses the existing internal dialplan and its permissions.

Ending an individual call requires its exact current channel identity. If the channel has ended or its identity no longer matches, refresh the state and select the current call. A stale row must never be used to end another call on the same extension.

Call-control availability depends on a current authenticated session and a live PBX connection. The panel does not claim to provide transfer, recording playback or supervisor monitoring actions that are not implemented by this distribution.

## Keyboard and small screens

Search accepts ordinary, Persian and Arabic digits. Extension filters combine with the search text. Extension details and controls support keyboard focus, and the workspace reflows for narrow screens. On small screens, the surrounding Issabel menu may be collapsed using Issabel's menu button.

## Recovery

If the session expires, sign in again. If the PBX connection fails, use Retry and inspect the server's AMI/database health. Installation backups and recovery instructions are recorded by `install.sh`; see the main README for installation and rollback guidance.
