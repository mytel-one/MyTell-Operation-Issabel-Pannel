# Changelog

## 2.1.0 — 2026-11-26

- Added contextual blind transfer, consultation transfer, directed pickup and call parking with fresh channel identity checks.
- Added an Agents view and group privileges for queue actions. Issabel administrators can grant dialing, transfer, pickup, parking, hangup, queue and layout privileges independently.
- Added account-specific directory favorites, team filters and operator tools. Authorized users can open their installed FOP2 console and manager alongside Issabel call records, recordings and voicemail.

## 2.0.1 — 2026-11-18

- Recognize idle PJSIP handsets with a registered contact when qualify is disabled.
- Use green for registered extensions and connected trunks, and gray for offline or unconfirmed connections. Call activity stays visible separately.
- Show incoming, outgoing, internal and unclassified calls in separate Live Calls filters with counts.
- Keep Call parking collapsed when the workspace opens.

## 2.0.0 — 2026-11-18

- Migrated the distribution to `mytel-one/MyTell-Operation-Issabel-Pannel` with token-free public installation.
- Rebuilt the interfaces with a white theme and MyTel.one blue and amber accents; English LTR is the default, with optional Persian RTL.
- Added extension search, status filters, visible connection/retry states and responsive operational layouts.
- Added a live-call workspace, individual extension details, multi-call/channel information and queue summaries derived from reported PBX state.
- Added callback calling and exact-channel end-call controls with session validation and stale-identity protection.
- Scoped the module's styles to avoid changing the surrounding Issabel interface.
- Hardened state-changing requests, input handling and queue-member HTML output.
- Corrected PJSIP registration/address interpretation and exact channel matching for hangup.
- Replaced the installer's ignored errors with preflight validation, scoped backups, atomic module replacement and rollback.
- Added regression tests and release acceptance evidence.

## 1.1.1

- Removed floating theme/fullscreen controls from the earlier private MyTel distribution.

## 1.1.0

- Earlier queue-helper authentication, shell-input validation and AMI/state handling fixes.

## 1.0.0

- Initial MyTel personalization of the IssabelCallMonitoring module.
