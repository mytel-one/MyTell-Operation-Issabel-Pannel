# MyTel Operation 2.0.0 verification

Date: 2026-11-18. This report records executed checks; it is not a claim that every possible defect has been excluded.

## Scope and design contract

An English operator workspace with a white theme and MyTel blue/amber branding. The main job is to monitor current conversations, extensions, waiting callers and PBX resources, then inspect one extension or exact call channel. The optional Persian RTL package remains available. Target viewports are 1440×900 and 390×844.

Real snapshots are authoritative. Multiple call legs are grouped only by reported linked IDs, all observed legs remain inspectable, and missing data is explicitly unavailable. Call controls require an authenticated session, current connection state and validated input. Callback calling rings the selected operator extension first. Exact-channel hangup validates its current unique ID before sending the action.

## Automated results

| Check | Executed environment | Result |
|---|---|---|
| `backend_regressions.php`, each language | Target PHP 7.4 | 25 checks each, PASS |
| `backend_live.php`, each language | Target PHP 7.4 | 18 checks each, PASS |
| `snapshot_startup.php`, each language | Target PHP 7.4 | 24 checks each, PASS |
| `node --test tests/*.cjs` | Local Node | 33 tests, PASS |
| `installer_test.py` | Target Python 3.6 / PHP 7.4, temporary filesystem, `umask 077` | 15 tests, PASS |
| Module PHP lint, own JavaScript syntax, Bash syntax | Target/local runtimes | PASS |
| Handlebars templates | Bundled Handlebars 1.3 | All templates compiled |
| Synthetic browser action/DOM assertions | Desktop and 390×844 fixture | 17 assertions, PASS |

There is no configured coverage measurement or coverage gate in this inherited module; a coverage percentage is not claimed. This is a static PHP/JavaScript module and has no compilation bundle or TypeScript type-check step.

The snapshot tests exercise the actual collector with synthetic database and AMI protocol boundaries: 100 extensions, mailbox batching, simultaneous calls, 10 waiting callers in two queues, saved areas, next-snapshot removals, missing completion events, disconnects and deadlines. Browser controller tests verify one request in flight, roughly one-second start cadence, retained unchanged models, ended-object removal, three-second retry and the seven-second request timeout.

The installer tests exercise real temporary file replacement and SQLite backup/restore with a fake menu merger. They cover missing or legacy layout databases, preservation of existing AMI configuration, English default, explicit language/ref selection, public archive layout, failed/false-success menu registration, first-install rollback and read-only preflight.

## Test-first evidence

Regressions were executed against the earlier implementation before fixes:

- Missing AstDB dial data could still originate; hangup could match a longer extension with the same prefix; busy PJSIP endpoints and IPv6 contacts were misinterpreted.
- Queue-member text could inject HTML; mutation requests lacked the new method/token/input policy.
- The old installer's `--help` attempted private download and failed without a token.
- A real copy of the target's colResizable 1.5 reproduced `t.removeClass is not a function` after enumerable Ember Array helpers were added.
- New live-call normalization tests failed before the helper existed; later adversarial tests reproduced raw-field exposure before the explicit output whitelist.
- Callback and exact-channel hangup regressions use AMI doubles and validate asynchronous request fields, stale identity rejection and exact target selection.

After implementation the corresponding suites above passed. The public distribution starts from a clean source snapshot; this report preserves the RED/GREEN evidence without publishing the old private repository history.

## Rendered verification

The populated fixture uses reserved example addresses and fictional `+1202555010x` caller numbers. It was reviewed at 1440×900 and 390×844. No document-wide horizontal overflow or broken image was observed. Keyboard Enter opens extension details; Escape closes them and restores card focus. Native dialog focus and readable light-theme contrast were checked. Sampled visible body text passed the contrast thresholds used in the final review; branding and decorative symbols are excluded from that measurement.

Executed states: initial loading, connected empty PBX, populated success, initial error, stale partial data and expired-session/permission state. Search and call-state filters were exercised. A two-call extension retains both channels, queue memberships and reported agent details. Clock-only updates preserve focused controls and expanded technical details. Reopening another extension cannot bypass the in-flight action lock. Caller-controlled strings remain text. Action success/error and exact per-channel payloads were exercised only in the synthetic fixture.

Desktop/mobile screenshots and state records are retained as local development artifacts. The README screenshot is explicitly synthetic; private target details are not included in it.

## Authorized target acceptance

Verified on the requested Issabel 5 host: Rocky Linux 8.10, PHP 7.4.33, Apache 2.4.37 and Asterisk 20.12.0.

- English 2.0.0 installed successfully and the **PBX → MyTel Operation** menu was registered with administrator ACL access.
- Authenticated HTML and repeated full snapshots returned HTTP 200 without PBX errors. Three observed HTTP snapshot times were 53–69 ms on this otherwise empty PBX; this is not a loaded-system benchmark.
- The actual target reported one trunk, eight parking slots, zero configured extensions, zero queues and zero active calls.
- Anonymous snapshots disclosed no PBX data. GET mutations and missing-token POST mutations returned 403; malformed array parameters with a valid session/token returned 400.
- An authenticated same-value area-title save succeeded. All original area descriptions, widths and colors were subsequently verified preserved.
- Self-hosted scripts, fonts and branding assets returned 200. No module PHP error was found in Apache's error log during acceptance.
- Asterisk/PBX configuration hashes remained unchanged. Apache, Asterisk and MariaDB remained active with the same process IDs; no service restart was performed.
- Root-only installation/database backups and restoration instructions were created by the installer.

## Limits and original installation failure

There were no configured extensions or queues on the requested host. Real handset audio, live callback completion, live hangup, transfer scenarios and queue-agent operations could not be certified there. Call behavior is covered by protocol doubles and synthetic UI checks; these are separate from real-call acceptance.

The exact historic reason for the earlier unsuccessful installation cannot be established: no original installer output or root command history was available, and the module was absent at first inspection. The old script hid menu-registration failures, ignored important command failures and coupled download extraction to a private owner name. Those paths were corrected and regression-tested; the new installer reports failure accurately and recovers the preceding installation.
