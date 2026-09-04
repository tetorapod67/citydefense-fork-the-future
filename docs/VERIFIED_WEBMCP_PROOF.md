# Verified WebMCP Proof

## Environment

- Host: Codex in-app browser
- Origin: `https://citydefense-fork-the-future.suguri-a.chatgpt.site`
- Account: `DEMO-CITY`
- Seat: `PLANNER-01`
- Branch: `BRANCH-MAIN`
- Persistence: `SERVER_BACKED_D1`

## Tool discovery

The authenticated top-level page exposed exactly:

- `get_city_context`
- `place_stamp_bundle`

## Read

`get_city_context` was invoked against Branch `v0`. It returned the authenticated Seat,
Central Ward state, zero initial stamps, and recent activity without changing state.

## Write

Exactly one authorized `place_stamp_bundle` call was invoked with:

- stamp: `STAMP_CONFIRM`
- target: `district:CENTRAL_WARD`
- scope: `BRANCH_PUBLIC`
- current expected Branch Version
- a unique request ID

Result:

- Branch: `v0 → v1`
- Stamp: `STAMP-G1-F9BD8E931C4942168B0B`
- Event: `EVT-G1-5965267F9FBB453D9EBF`
- `persisted=true`
- `idempotent_replay=false`

The confirmation marker and activity entry became visible in the normal page.

## Reload

A normal reload restored:

- Branch Version `v1`
- the same Stamp ID
- the same Event ID
- the same activity state

## Evidence boundary

The native host-specific “Recently used” surface was not available in the tested environment.
No claim is made about that UI. The tool discovery output, actual read and write results,
visible page update, and reload persistence were retained as evidence.
